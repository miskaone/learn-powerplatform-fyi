import type {
  DebriefSegment,
  Misconception,
  NarrationCue,
  QuestionPublic,
  RubricDimension,
  RubricScore,
  RubricScores,
} from '../schema';
import type {
  AdvanceModuleResultPublic,
  AdvanceSegmentResultPublic,
  CommitPredictionResultPublic,
  ComposeDebriefResultPublic,
  CurrentContextPublic,
  DrillPrescriptionPublic,
  EngineFacade,
  ExamDebriefPublic,
  ExamStatusPublic,
  HintResultPublic,
  LearnerStatePublic,
  MutateAssumptionResultPublic,
  NavigateResultPublic,
  RevealOutcomeResultPublic,
  RubricEvidence,
  RubricSubmission,
  RubricVerdictPublic,
  SubmitAnswerVerdictPublic,
} from './engine-facade';
import {
  textResponse,
  type JsonSchema,
  type ToolDescriptor,
  type ToolResponse,
} from './model-context';
import type { ToolName } from './tool-names';

type ParseResult<T> =
  | { ok: true; value: T }
  | { ok: false; response: ToolResponse };

const RUBRIC_DIMENSIONS: readonly RubricDimension[] = [
  'recall',
  'connections',
  'application',
  'transfer',
];

const DEBRIEF_KINDS: readonly DebriefSegment['kind'][] = [
  'title',
  'misconception',
  'rubric',
  'drill',
];

interface IncomingSegment {
  id: string;
  kind: DebriefSegment['kind'];
  scriptLine: string;
  misconceptionId: string | undefined;
}

export function createToolset(
  engine: EngineFacade,
): Record<ToolName, ToolDescriptor> {
  return {
    get_learner_state: descriptor(
      'get_learner_state',
      'Return the learner current rubric scores, misconception fire counts, phase, gate status, and attempt count.',
      emptySchema(),
      async (input) => {
        const parsed = parseEmpty(input);
        if (!parsed.ok) {
          return parsed.response;
        }
        return textResponse(publicLearnerState(engine.getLearnerState()));
      },
    ),
    get_current_context: descriptor(
      'get_current_context',
      'Return the current objective, section, concepts, and prerequisites for the learner.',
      emptySchema(),
      async (input) => {
        const parsed = parseEmpty(input);
        if (!parsed.ok) {
          return parsed.response;
        }
        return textResponse(publicContext(engine.getCurrentContext()));
      },
    ),
    navigate_to_anchor: descriptor(
      'navigate_to_anchor',
      'Scroll the lesson to a named section anchor.',
      closedObject({ anchor: stringSchema() }, ['anchor']),
      async (input) => {
        const parsed = requireStrings(input, ['anchor'] as const);
        if (!parsed.ok) {
          return parsed.response;
        }
        return textResponse(
          publicNavigate(engine.navigateToAnchor(parsed.value.anchor)),
        );
      },
    ),
    log_coaching_note: descriptor(
      'log_coaching_note',
      'Record a coaching note against the learner ledger.',
      closedObject({ note: stringSchema() }, ['note']),
      async (input) => {
        const parsed = requireStrings(input, ['note'] as const);
        if (!parsed.ok) {
          return parsed.response;
        }
        engine.logCoachingNote(parsed.value.note);
        return textResponse({ ok: true });
      },
    ),
    get_current_question: descriptor(
      'get_current_question',
      'Return the current practice question with redacted options, or note if none is active.',
      emptySchema(),
      async (input) => {
        const parsed = parseEmpty(input);
        if (!parsed.ok) {
          return parsed.response;
        }
        const question = engine.getCurrentQuestion();
        if (question === null) {
          return textResponse({
            question: null,
            note: 'no active question',
          });
        }
        return textResponse({ question: publicQuestion(question) });
      },
    ),
    submit_answer: descriptor(
      'submit_answer',
      'Submit an option for the current question and receive a graded verdict.',
      closedObject(
        { questionId: stringSchema(), optionId: stringSchema() },
        ['questionId', 'optionId'],
      ),
      async (input) => {
        const parsed = requireStrings(input, ['questionId', 'optionId'] as const);
        if (!parsed.ok) {
          return parsed.response;
        }
        try {
          return textResponse(
            publicVerdict(
              engine.submitAnswer(parsed.value.questionId, parsed.value.optionId),
            ),
          );
        } catch (error) {
          if (error instanceof RangeError) {
            return textResponse({
              error: 'question-not-current',
              questionId: parsed.value.questionId,
            });
          }
          throw error;
        }
      },
    ),
    get_hint: descriptor(
      'get_hint',
      'Request the next allowed hint tier for a question.',
      closedObject({ questionId: stringSchema() }, ['questionId']),
      async (input) => {
        const parsed = requireStrings(input, ['questionId'] as const);
        if (!parsed.ok) {
          return parsed.response;
        }
        try {
          return textResponse(publicHint(engine.getHint(parsed.value.questionId)));
        } catch (error) {
          if (error instanceof RangeError) {
            return textResponse({
              error: 'question-not-current',
              questionId: parsed.value.questionId,
            });
          }
          throw error;
        }
      },
    ),
    request_next_action: descriptor(
      'request_next_action',
      'Ask the engine which pedagogical move to take next. Pass confidence "low" after a correct answer the learner was unsure about.',
      closedObject(
        { confidence: { type: 'string', enum: ['low', 'high'] } },
        [],
      ),
      async (input) => {
        const parsed = parseConfidence(input);
        if (!parsed.ok) {
          return parsed.response;
        }
        return textResponse(engine.requestNextAction(parsed.value));
      },
    ),
    prescribe_drill: descriptor(
      'prescribe_drill',
      'Ask the engine which drill to run against the weakest rubric dimension.',
      emptySchema(),
      async (input) => {
        const parsed = parseEmpty(input);
        if (!parsed.ok) {
          return parsed.response;
        }
        return textResponse(publicDrill(engine.prescribeDrill()));
      },
    ),
    score_rubric: descriptor(
      'score_rubric',
      'Submit per-dimension rubric scores with verbatim evidence quotes for engine scoring.',
      scoreRubricSchema(),
      async (input) => {
        const parsed = parseScoreRubric(input);
        if (!parsed.ok) {
          return parsed.response;
        }
        return textResponse(publicRubricVerdict(engine.scoreRubric(parsed.value)));
      },
    ),
    advance_module: descriptor(
      'advance_module',
      'Advance to the next objective after the mastery gate has passed.',
      emptySchema(),
      async (input) => {
        const parsed = parseEmpty(input);
        if (!parsed.ok) {
          return parsed.response;
        }
        return textResponse(publicAdvanceModule(engine.advanceModule()));
      },
    ),
    get_misconception_brief: descriptor(
      'get_misconception_brief',
      'Return a brief on a named misconception that has already fired.',
      closedObject({ misconceptionId: stringSchema() }, ['misconceptionId']),
      async (input) => {
        const parsed = requireStrings(input, ['misconceptionId'] as const);
        if (!parsed.ok) {
          return parsed.response;
        }
        const brief = engine.getMisconceptionBrief(parsed.value.misconceptionId);
        if (brief === null) {
          return textResponse(null);
        }
        return textResponse(publicMisconception(brief));
      },
    ),
    mutate_assumption: descriptor(
      'mutate_assumption',
      'Flip one assumption in a transfer-drill scenario.',
      closedObject(
        { scenarioId: stringSchema(), assumptionId: stringSchema() },
        ['scenarioId', 'assumptionId'],
      ),
      async (input) => {
        const parsed = requireStrings(input, [
          'scenarioId',
          'assumptionId',
        ] as const);
        if (!parsed.ok) {
          return parsed.response;
        }
        return textResponse(
          publicMutate(
            engine.mutateAssumption(
              parsed.value.scenarioId,
              parsed.value.assumptionId,
            ),
          ),
        );
      },
    ),
    commit_prediction: descriptor(
      'commit_prediction',
      'Commit a prediction and reason for a transfer-drill scenario.',
      closedObject(
        {
          scenarioId: stringSchema(),
          prediction: stringSchema(),
          reason: stringSchema(),
        },
        ['scenarioId', 'prediction', 'reason'],
      ),
      async (input) => {
        const parsed = requireStrings(input, [
          'scenarioId',
          'prediction',
          'reason',
        ] as const);
        if (!parsed.ok) {
          return parsed.response;
        }
        return textResponse(
          publicCommit(
            engine.commitPrediction(
              parsed.value.scenarioId,
              parsed.value.prediction,
              parsed.value.reason,
            ),
          ),
        );
      },
    ),
    reveal_outcome: descriptor(
      'reveal_outcome',
      'Reveal the outcome of a transfer-drill scenario after a prediction is committed.',
      closedObject({ scenarioId: stringSchema() }, ['scenarioId']),
      async (input) => {
        const parsed = requireStrings(input, ['scenarioId'] as const);
        if (!parsed.ok) {
          return parsed.response;
        }
        return textResponse(
          publicReveal(engine.revealOutcome(parsed.value.scenarioId)),
        );
      },
    ),
    start_exam: descriptor(
      'start_exam',
      'Start exam mode for the current objective.',
      emptySchema(),
      async (input) => {
        const parsed = parseEmpty(input);
        if (!parsed.ok) {
          return parsed.response;
        }
        return textResponse(publicExamStatus(engine.startExam()));
      },
    ),
    get_exam_status: descriptor(
      'get_exam_status',
      'Return remaining time and progress for the active exam.',
      emptySchema(),
      async (input) => {
        const parsed = parseEmpty(input);
        if (!parsed.ok) {
          return parsed.response;
        }
        return textResponse(publicExamStatus(engine.getExamStatus()));
      },
    ),
    submit_exam: descriptor(
      'submit_exam',
      'Submit the exam and lock further answers.',
      emptySchema(),
      async (input) => {
        const parsed = parseEmpty(input);
        if (!parsed.ok) {
          return parsed.response;
        }
        return textResponse(publicExamStatus(engine.submitExam()));
      },
    ),
    get_exam_debrief: descriptor(
      'get_exam_debrief',
      'Return exam debrief scores and the concepts and misconceptions that fired.',
      emptySchema(),
      async (input) => {
        const parsed = parseEmpty(input);
        if (!parsed.ok) {
          return parsed.response;
        }
        return textResponse(publicExamDebrief(engine.getExamDebrief()));
      },
    ),
    compose_debrief: descriptor(
      'compose_debrief',
      'Submit a mastery-debrief playlist of segments for engine validation.',
      composeDebriefSchema(),
      async (input) => {
        const parsed = parseComposeDebrief(input);
        if (!parsed.ok) {
          return parsed.response;
        }
        const fired = new Set(engine.getFiredMisconceptionIds());
        const mapped: DebriefSegment[] = [];
        const rejectedSegmentIds: string[] = [];
        for (const segment of parsed.value) {
          const debrief = toDebriefSegment(segment);
          mapped.push(debrief);
          if (debrief.kind === 'misconception') {
            const misconceptionId = debrief.misconceptionId;
            if (misconceptionId === undefined || !fired.has(misconceptionId)) {
              rejectedSegmentIds.push(debrief.id);
            }
          }
        }
        if (rejectedSegmentIds.length > 0) {
          return textResponse({
            error: 'segment_rejected',
            rejectedSegmentIds,
          });
        }
        return textResponse(publicCompose(engine.composeDebrief(mapped)));
      },
    ),
    get_narration_script: descriptor(
      'get_narration_script',
      'Return the engine-approved narration cues for the current debrief.',
      emptySchema(),
      async (input) => {
        const parsed = parseEmpty(input);
        if (!parsed.ok) {
          return parsed.response;
        }
        return textResponse(publicCues(engine.getNarrationScript()));
      },
    ),
    advance_segment: descriptor(
      'advance_segment',
      'Advance the debrief narrator to a named segment.',
      closedObject({ segmentId: stringSchema() }, ['segmentId']),
      async (input) => {
        const parsed = requireStrings(input, ['segmentId'] as const);
        if (!parsed.ok) {
          return parsed.response;
        }
        return textResponse(
          publicAdvanceSegment(engine.advanceSegment(parsed.value.segmentId)),
        );
      },
    ),
  };
}

function descriptor(
  name: ToolName,
  description: string,
  inputSchema: JsonSchema,
  execute: (input: unknown) => Promise<ToolResponse>,
): ToolDescriptor {
  return { name, description, inputSchema, execute };
}

function stringSchema(): JsonSchema {
  return { type: 'string' };
}

function emptySchema(): JsonSchema {
  return closedObject({}, []);
}

function closedObject(
  properties: Record<string, JsonSchema>,
  required: readonly string[],
): JsonSchema {
  return {
    type: 'object',
    properties,
    required: [...required],
    additionalProperties: false,
  };
}

function scoreRubricSchema(): JsonSchema {
  const evidence = closedObject(
    {
      score: { type: 'number', minimum: 0, maximum: 4 },
      evidenceQuote: { type: 'string' },
    },
    ['score', 'evidenceQuote'],
  );
  const properties: Record<string, JsonSchema> = {};
  for (const dimension of RUBRIC_DIMENSIONS) {
    properties[dimension] = evidence;
  }
  return closedObject(properties, RUBRIC_DIMENSIONS);
}

function composeDebriefSchema(): JsonSchema {
  return closedObject(
    {
      segments: {
        type: 'array',
        items: closedObject(
          {
            id: stringSchema(),
            kind: { type: 'string', enum: [...DEBRIEF_KINDS] },
            scriptLine: stringSchema(),
            misconceptionId: stringSchema(),
          },
          ['id', 'kind', 'scriptLine'],
        ),
      },
    },
    ['segments'],
  );
}

function invalidInput(detail: string): ToolResponse {
  return textResponse({ error: 'invalid_input', detail });
}

function fail(detail: string): ParseResult<never> {
  return { ok: false, response: invalidInput(detail) };
}

function ok<T>(value: T): ParseResult<T> {
  return { ok: true, value };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readObject(input: unknown): Record<string, unknown> | null {
  if (input === undefined || input === null) {
    return {};
  }
  if (isRecord(input)) {
    return input;
  }
  return null;
}

function parseConfidence(
  input: unknown,
): ParseResult<'low' | 'high' | undefined> {
  const obj = readObject(input);
  if (obj === null) {
    return fail('expected an object');
  }
  const confidence = obj['confidence'];
  if (confidence === undefined) {
    return ok(undefined);
  }
  if (confidence !== 'low' && confidence !== 'high') {
    return fail('confidence must be "low" or "high"');
  }
  return ok(confidence);
}

function parseEmpty(input: unknown): ParseResult<Record<string, never>> {
  const obj = readObject(input);
  if (obj === null) {
    return fail('expected an object');
  }
  return ok({});
}

function requireStrings<K extends string>(
  input: unknown,
  keys: readonly K[],
): ParseResult<Record<K, string>> {
  const obj = readObject(input);
  if (obj === null) {
    return fail('expected an object');
  }
  const values = {} as Record<K, string>;
  for (const key of keys) {
    const value = obj[key];
    if (typeof value !== 'string') {
      return fail(`missing or invalid ${key}`);
    }
    values[key] = value;
  }
  return ok(values);
}

function clampRubricScore(value: number): RubricScore {
  const rounded = Math.round(value);
  if (rounded <= 0) {
    return 0;
  }
  if (rounded === 1) {
    return 1;
  }
  if (rounded === 2) {
    return 2;
  }
  if (rounded === 3) {
    return 3;
  }
  return 4;
}

function parseEvidence(
  input: Record<string, unknown>,
  dimension: RubricDimension,
): ParseResult<RubricEvidence> {
  const raw = input[dimension];
  if (!isRecord(raw)) {
    return fail(`missing or invalid ${dimension}`);
  }
  const scoreRaw = raw['score'];
  if (typeof scoreRaw !== 'number' || !Number.isFinite(scoreRaw)) {
    return fail(`missing or invalid ${dimension}.score`);
  }
  const quote = raw['evidenceQuote'];
  if (typeof quote !== 'string' || quote.trim() === '') {
    return {
      ok: false,
      response: textResponse({ error: 'evidence_required', dimension }),
    };
  }
  return ok({
    score: clampRubricScore(scoreRaw),
    evidenceQuote: quote,
  });
}

function parseScoreRubric(input: unknown): ParseResult<RubricSubmission> {
  const obj = readObject(input);
  if (obj === null) {
    return fail('expected an object');
  }
  const recall = parseEvidence(obj, 'recall');
  if (!recall.ok) {
    return recall;
  }
  const connections = parseEvidence(obj, 'connections');
  if (!connections.ok) {
    return connections;
  }
  const application = parseEvidence(obj, 'application');
  if (!application.ok) {
    return application;
  }
  const transfer = parseEvidence(obj, 'transfer');
  if (!transfer.ok) {
    return transfer;
  }
  return ok({
    recall: recall.value,
    connections: connections.value,
    application: application.value,
    transfer: transfer.value,
  });
}

function isDebriefKind(value: string): value is DebriefSegment['kind'] {
  return (DEBRIEF_KINDS as readonly string[]).includes(value);
}

function parseComposeDebrief(input: unknown): ParseResult<IncomingSegment[]> {
  const obj = readObject(input);
  if (obj === null) {
    return fail('expected an object');
  }
  const segments = obj['segments'];
  if (!Array.isArray(segments)) {
    return fail('missing or invalid segments');
  }
  const parsed: IncomingSegment[] = [];
  for (const item of segments) {
    if (!isRecord(item)) {
      return fail('each segment must be an object');
    }
    const id = item['id'];
    const kind = item['kind'];
    const scriptLine = item['scriptLine'];
    if (typeof id !== 'string') {
      return fail('missing or invalid segment id');
    }
    if (typeof kind !== 'string' || !isDebriefKind(kind)) {
      return fail('missing or invalid segment kind');
    }
    if (typeof scriptLine !== 'string') {
      return fail('missing or invalid scriptLine');
    }
    const misconceptionId = item['misconceptionId'];
    if (misconceptionId !== undefined && typeof misconceptionId !== 'string') {
      return fail('invalid misconceptionId');
    }
    parsed.push({
      id,
      kind,
      scriptLine,
      misconceptionId:
        typeof misconceptionId === 'string' ? misconceptionId : undefined,
    });
  }
  return ok(parsed);
}

function toDebriefSegment(segment: IncomingSegment): DebriefSegment {
  const mapped: DebriefSegment = {
    id: segment.id,
    kind: segment.kind,
    scriptLine: segment.scriptLine,
    audioAsset: null,
  };
  if (segment.misconceptionId !== undefined) {
    mapped.misconceptionId = segment.misconceptionId;
  }
  return mapped;
}

function publicScores(scores: RubricScores): RubricScores {
  return {
    recall: scores.recall,
    connections: scores.connections,
    application: scores.application,
    transfer: scores.transfer,
  };
}

function publicLearnerState(state: LearnerStatePublic): LearnerStatePublic {
  return {
    scores: publicScores(state.scores),
    misconceptionFires: { ...state.misconceptionFires },
    phase: state.phase,
    gatePassed: state.gatePassed,
    attemptCount: state.attemptCount,
  };
}

function publicContext(context: CurrentContextPublic): CurrentContextPublic {
  return {
    objectiveId: context.objectiveId,
    sectionId: context.sectionId,
    sectionTitle: context.sectionTitle,
    concepts: [...context.concepts],
    prerequisites: [...context.prerequisites],
    lesson:
      context.lesson === null
        ? null
        : {
            slug: context.lesson.slug,
            title: context.lesson.title,
            objectiveId: context.lesson.objectiveId,
            sectionAnchors: [...context.lesson.sectionAnchors],
          },
  };
}

function publicQuestion(question: QuestionPublic): QuestionPublic {
  return {
    id: question.id,
    objectiveId: question.objectiveId,
    concepts: [...question.concepts],
    prompt: question.prompt,
    options: question.options.map((option) => {
      return {
        id: option.id,
        text: option.text,
      };
    }),
  };
}

function publicVerdict(
  verdict: SubmitAnswerVerdictPublic,
): SubmitAnswerVerdictPublic {
  return {
    questionId: verdict.questionId,
    correct: verdict.correct,
    misconceptionId: verdict.misconceptionId,
    attemptNumber: verdict.attemptNumber,
    attemptsRemaining: verdict.attemptsRemaining,
    // Post-resolution only (facade contract) — never leaks while attempts remain.
    rationale: verdict.rationale,
    // Miss-only lesson-section anchor; not answer-key material.
    remediationAnchor: verdict.remediationAnchor,
  };
}

function publicHint(hint: HintResultPublic): HintResultPublic {
  return {
    granted: hint.granted,
    tier: hint.tier,
    hint: hint.hint,
    refusal: hint.refusal,
  };
}

function publicDrill(drill: DrillPrescriptionPublic): DrillPrescriptionPublic {
  return {
    drillKind: drill.drillKind,
    targetDimension: drill.targetDimension,
    rationale: drill.rationale,
  };
}

function publicRubricVerdict(verdict: RubricVerdictPublic): RubricVerdictPublic {
  return {
    accepted: verdict.accepted,
    scores: publicScores(verdict.scores),
    gatePassed: verdict.gatePassed,
    rejectionReason: verdict.rejectionReason,
  };
}

function publicNavigate(result: NavigateResultPublic): NavigateResultPublic {
  return {
    ok: result.ok,
    anchor: result.anchor,
  };
}

function publicMisconception(brief: Misconception): Misconception {
  return {
    id: brief.id,
    name: brief.name,
    contrast: brief.contrast,
    socraticSeeds: [...brief.socraticSeeds],
    anchor: brief.anchor,
  };
}

function publicMutate(
  result: MutateAssumptionResultPublic,
): MutateAssumptionResultPublic {
  return {
    accepted: result.accepted,
    scenarioId: result.scenarioId,
    round: result.round,
    assumptionText: result.assumptionText,
  };
}

function publicCommit(
  result: CommitPredictionResultPublic,
): CommitPredictionResultPublic {
  return {
    committed: result.committed,
    scenarioId: result.scenarioId,
    refusalReason: result.refusalReason,
  };
}

function publicReveal(
  result: RevealOutcomeResultPublic,
): RevealOutcomeResultPublic {
  return {
    outcome: result.outcome,
    predictionWasCorrect: result.predictionWasCorrect,
    explanationAnchor: result.explanationAnchor,
  };
}

function publicExamStatus(status: ExamStatusPublic): ExamStatusPublic {
  return {
    active: status.active,
    remainingSeconds: status.remainingSeconds,
    questionsAnswered: status.questionsAnswered,
    questionsTotal: status.questionsTotal,
    submitted: status.submitted,
  };
}

function publicExamDebrief(debrief: ExamDebriefPublic): ExamDebriefPublic {
  return {
    scores: publicScores(debrief.scores),
    missedConceptIds: [...debrief.missedConceptIds],
    misconceptionIdsFired: [...debrief.misconceptionIdsFired],
  };
}

function publicAdvanceModule(
  result: AdvanceModuleResultPublic,
): AdvanceModuleResultPublic {
  return {
    advanced: result.advanced,
    nextObjectiveId: result.nextObjectiveId,
  };
}

function publicCompose(
  result: ComposeDebriefResultPublic,
): ComposeDebriefResultPublic {
  return {
    accepted: result.accepted,
    rejectedSegmentIds: [...result.rejectedSegmentIds],
    reason: result.reason,
  };
}

function publicCues(cues: NarrationCue[]): NarrationCue[] {
  return cues.map((cue) => {
    return {
      segmentId: cue.segmentId,
      order: cue.order,
      scriptLine: cue.scriptLine,
    };
  });
}

function publicAdvanceSegment(
  result: AdvanceSegmentResultPublic,
): AdvanceSegmentResultPublic {
  return {
    ok: result.ok,
    currentSegmentId: result.currentSegmentId,
  };
}
