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
  LessonTextResultPublic,
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

const TEACH_BACK_SEED =
  'Teach-back: before moving on, ask the learner to explain the corrected idea in their own words — do not advance until they can.';

const GATE_PASS_HINT =
  'Gate passed: advance_module and start_exam are now available — re-check this page\'s tools (getTools) before your next move.';

const SECOND_FIRE_HINT = (misconceptionId: string): string =>
  `This misconception has now fired twice: get_misconception_brief is now available for "${misconceptionId}" — re-check this page's tools.`;

const EXAM_START_HINT =
  'Exam started: coaching tools are revoked until submit — only get_exam_status and submit_exam stay registered. Re-check this page\'s tools.';

const EXAM_SUBMIT_HINT =
  'Exam submitted: get_exam_debrief is now registered — call it to review. Coaching tools return only after the learner clicks "Return to practice" on the exam screen; until then only the exam tools remain. Re-check this page\'s tools.';

const GATE_REGRESS_HINT =
  'Gate closed: this accepted rescore dropped a dimension below 3 — advance_module and start_exam are revoked. Re-check this page\'s tools (getTools).';

const RUBRIC_INTERVIEW_GUIDANCE =
  'MCQ coverage is sufficient but the gate has not passed — run the rubric interview now: ask 5–8 open questions across recall, connections, application, and transfer, one at a time, never answering for the learner. Then submit score_rubric with a 0–4 score per dimension and a verbatim evidence quote for each.';

interface ProfileSuffixes {
  hint: string;
  brief: string;
}

function composeProfileSuffixes(engine: EngineFacade): ProfileSuffixes | null {
  const fires = engine.getLearnerState().misconceptionFires;
  const repeated = Object.keys(fires)
    .filter((id) => fires[id] >= 2)
    .sort((a, b) => (fires[b] - fires[a]) || (a < b ? -1 : a > b ? 1 : 0))
    .slice(0, 3);
  if (repeated.length === 0) {
    return null;
  }
  const entries = repeated.map((id) => {
    const name = engine.getMisconceptionBrief(id)?.name ?? id;
    return { name, count: fires[id] };
  });
  const names = entries.map((e) => `"${e.name}"`).join(', ');
  const history = entries.map((e) => `"${e.name}" (${e.count}x)`).join(', ');
  return {
    hint: ` Returning learner: they have repeatedly stumbled on ${names} — when a hint touches one of these, slow down and ground it in where they went wrong before.`,
    brief: ` Returning learner fire history: ${history} — reference this history when you coach.`,
  };
}

export function createToolset(
  engine: EngineFacade,
): Record<ToolName, ToolDescriptor> {
  const suffixes = composeProfileSuffixes(engine);
  return {
    get_learner_state: descriptor(
      'get_learner_state',
      'Read this first, every session — the learner\'s rubric scores, misconception fire counts, phase, gate status, attempt count, their written lesson aims, one-line rule compressions, and run commitments, PLUS coachingNotes (durable observations from previous coaching sessions, including yours) and a coachCalibration summary of how earlier confidence hints and rubric proposals matched engine outcomes. Call again before choosing any coaching move. When a rule compression exists, critique it against the lesson\'s governing rule — what did they miss or overstate?',
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
      'Read the current objective and, when the learner is on a lesson page, that lesson\'s slug, title, and section anchors. Call first in every session and after any navigation, to orient before coaching.',
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
      'Scroll the learner\'s page to a named section anchor and highlight it (anchors come from get_current_context.lesson.sectionAnchors or a verdict\'s remediationAnchor). Call when routing says review or coach, or whenever the lesson text you are discussing should be on the learner\'s screen.',
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
      'Deposit a durable observation about HOW this learner learns — a pattern, a preference, a piece of their world worth remembering next session (kind: observation | preference | context; defaults to observation). Notes persist across sessions and replay to the next coach through get_learner_state, so write for your future self. Never answer content: the engine deterministically rejects notes naming question or option ids or quoting answer-option text (reason "answer-content"), and notes can never be used as rubric evidence.',
      closedObject(
        {
          note: stringSchema(),
          kind: {
            type: 'string',
            enum: ['observation', 'preference', 'context'],
          },
        },
        ['note'],
      ),
      async (input) => {
        const parsed = requireStrings(input, ['note'] as const);
        if (!parsed.ok) {
          return parsed.response;
        }
        const kindParsed = parseKind(input);
        if (!kindParsed.ok) {
          return kindParsed.response;
        }
        const result = engine.logCoachingNote(
          parsed.value.note,
          kindParsed.value,
        );
        return textResponse({ stored: result.stored, reason: result.reason });
      },
    ),
    get_current_question: descriptor(
      'get_current_question',
      'Fetch the current practice question — prompt and options only; the correct answer is structurally absent. Call at the start of each practice loop and after every submit_answer to load the next question. Let the learner reason aloud before they choose.',
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
      'Submit the learner\'s chosen option for grading. Call only after the learner has committed to a choice themselves — never choose for them. A miss names the misconception that fired (coach Socratically from it); the rationale stays withheld until the question resolves. Watch the response for a toolChangeHint naming newly available tools.',
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
          const verdict = publicVerdict(
            engine.submitAnswer(parsed.value.questionId, parsed.value.optionId),
          );
          const misconceptionId = verdict.misconceptionId;
          if (
            misconceptionId !== null &&
            engine.getLearnerState().misconceptionFires[misconceptionId] === 2
          ) {
            return textResponse({
              questionId: verdict.questionId,
              correct: verdict.correct,
              misconceptionId: verdict.misconceptionId,
              attemptNumber: verdict.attemptNumber,
              attemptsRemaining: verdict.attemptsRemaining,
              rationale: verdict.rationale,
              remediationAnchor: verdict.remediationAnchor,
              defeatedMisconception: verdict.defeatedMisconception,
              toolChangeHint: SECOND_FIRE_HINT(misconceptionId),
            });
          }
          return textResponse(verdict);
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
      'Request the next hint tier for the current question. Call only when the learner is stuck or routing says hint — the engine enforces the ladder and refuses tier 2 before a genuine first attempt. Re-voice the hint Socratically, grounded in the learner\'s world — their stated aim, their work, what get_learner_state shows about their history; never add answer information of your own.' +
        (suffixes === null ? '' : suffixes.hint),
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
      'Ask the deterministic referee for the next pedagogical move. Call after every graded answer; pass confidence "low" when a correct answer felt shaky to the learner. Verdicts: hint, review, coach, go_deeper, advance, rubric_interview (run the open-question interview described in score_rubric), or continue. Follow the verdict — do not improvise the route.',
      closedObject(
        { confidence: { type: 'string', enum: ['low', 'high'] } },
        [],
      ),
      async (input) => {
        const parsed = parseConfidence(input);
        if (!parsed.ok) {
          return parsed.response;
        }
        const verdict = engine.requestNextAction(parsed.value);
        if (verdict === 'rubric_interview') {
          return textResponse({
            verdict,
            guidance: RUBRIC_INTERVIEW_GUIDANCE,
          });
        }
        return textResponse({ verdict });
      },
    ),
    prescribe_drill: descriptor(
      'prescribe_drill',
      'Ask the engine which drill targets the learner\'s weakest rubric dimension. Call once rubric scores exist and practice is going well — before advancing, or when the learner asks what to work on next.',
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
      'Submit 0-4 scores for recall, connections, application, and transfer, each grounded by a VERBATIM quote from the lesson text as evidence. Call only after a rubric interview: 5-8 open questions across the four dimensions, one at a time, never answering for the learner. The engine rejects non-verbatim evidence, requires prior graded attempts, and refuses during an exam. Every dimension at 3 or above opens the gate; the response then names the newly available tools.',
      scoreRubricSchema(),
      async (input) => {
        const parsed = parseScoreRubric(input);
        if (!parsed.ok) {
          return parsed.response;
        }
        const gateWasPassed = engine.getLearnerState().gatePassed;
        const verdict = publicRubricVerdict(engine.scoreRubric(parsed.value));
        const crossedOpen =
          verdict.accepted && verdict.gatePassed && !gateWasPassed;
        const crossedClosed =
          verdict.accepted && !verdict.gatePassed && gateWasPassed;
        if (crossedOpen || crossedClosed) {
          return textResponse({
            accepted: verdict.accepted,
            scores: verdict.scores,
            gatePassed: verdict.gatePassed,
            rejectionReason: verdict.rejectionReason,
            toolChangeHint: crossedOpen ? GATE_PASS_HINT : GATE_REGRESS_HINT,
          });
        }
        return textResponse(verdict);
      },
    ),
    set_lesson_aim: descriptor(
      'set_lesson_aim',
      'Record why the learner is here: "I\'m reading this because I need to ___". ASK for the aim as your FIRST question of every session, before any practice, and store the answer here (200 chars max). It persists per lesson — keyed "track" when the learner is on the hub rather than a lesson page — appears in get_learner_state, and can never be used as rubric evidence. Set it again if the learner\'s goal shifts. Connect the aim to goals you already know this learner has — from their coaching notes and previous aims — and reflect that connection back to them.',
      closedObject({ aim: stringSchema() }, ['aim']),
      async (input) => {
        const parsed = requireStrings(input, ['aim'] as const);
        if (!parsed.ok) {
          return parsed.response;
        }
        return textResponse(publicLessonText(engine.setLessonAim(parsed.value.aim)));
      },
    ),
    advance_module: descriptor(
      'advance_module',
      'Advance the learner to the next objective. Call only when routing returns advance (the gate is open) and AFTER the learner has explained the concept back in their own words — the teach-back is your final check; the gate was the engine\'s.',
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
      'Fetch the contrast and Socratic seed questions for a misconception that has fired at least twice — this tool appears only then. Call when routing says coach or a miss repeats a misconception. Ground the contrast in the learner\'s world: connect it to their stated aim and what you know of their work. Use the seeds one at a time and finish with the teach-back: the learner restates the corrected idea in their own words before you move on.' +
        (suffixes === null ? '' : suffixes.brief),
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
      'Flip exactly one assumption in the active Flip-Condition drill scenario (available only while a drill is running). Call at the start of each drill round, before the learner predicts — one mutation per round, engine-enforced.',
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
      'Commit the learner\'s prediction and their reasoning for the mutated scenario. Call after mutate_assumption, once the learner has said what changes and why — the engine rejects thin reasoning, and reveal_outcome only registers after a commit.',
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
      'Reveal the engine\'s outcome for the committed prediction (this tool appears only after commit_prediction). Call once the learner has locked their prediction in; then compare outcome against prediction and coach the gap.',
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
      'Start the timed exam (available only once the gate has passed). Call only when the learner explicitly agrees to be examined. Starting revokes every coaching tool until submit — the roster shrinks to get_exam_status and submit_exam, and the response says so.',
      emptySchema(),
      async (input) => {
        const parsed = parseEmpty(input);
        if (!parsed.ok) {
          return parsed.response;
        }
        const status = publicExamStatus(engine.startExam());
        if (status.active && !status.submitted) {
          return textResponse({
            active: status.active,
            remainingSeconds: status.remainingSeconds,
            questionsAnswered: status.questionsAnswered,
            questionsTotal: status.questionsTotal,
            submitted: status.submitted,
            toolChangeHint: EXAM_START_HINT,
          });
        }
        return textResponse(status);
      },
    ),
    get_exam_status: descriptor(
      'get_exam_status',
      'Read remaining seconds and answered-of-total progress for the active exam. Call to pace the learner or when they ask how much time is left.',
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
      'Submit the exam, locking all answers and unlocking get_exam_debrief. Coaching tools return only when the learner leaves the exam screen ("Return to practice") — that step is theirs, not yours. Call when the learner finishes or time is nearly out, then watch the response\'s toolChangeHint.',
      emptySchema(),
      async (input) => {
        const parsed = parseEmpty(input);
        if (!parsed.ok) {
          return parsed.response;
        }
        const status = publicExamStatus(engine.submitExam());
        if (status.submitted) {
          return textResponse({
            active: status.active,
            remainingSeconds: status.remainingSeconds,
            questionsAnswered: status.questionsAnswered,
            questionsTotal: status.questionsTotal,
            submitted: status.submitted,
            toolChangeHint: EXAM_SUBMIT_HINT,
          });
        }
        return textResponse(status);
      },
    ),
    get_exam_debrief: descriptor(
      'get_exam_debrief',
      'Read the post-exam debrief — scores, missed concepts, and misconceptions that fired (available only after submit_exam). Call right after submitting, to ground the review of what to study next.',
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
      'Propose the mastery-debrief playlist for engine validation (available only after module completion). Call when composing the closing debrief; any segment citing a misconception that never fired is rejected.',
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
      'Fetch the engine-approved narration cues for the composed debrief. Call after compose_debrief accepts and before narrating — speak only engine-approved lines.',
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
      'Advance the debrief to a named segment. Call as you finish narrating each cue, so the scenes keep pace with your voice.',
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

function parseKind(
  input: unknown,
): ParseResult<'observation' | 'preference' | 'context' | undefined> {
  const obj = readObject(input);
  if (obj === null) {
    return fail('expected an object');
  }
  const kind = obj['kind'];
  if (kind === undefined) {
    return ok(undefined);
  }
  if (kind !== 'observation' && kind !== 'preference' && kind !== 'context') {
    return fail(
      'kind must be "observation", "preference", or "context"',
    );
  }
  return ok(kind);
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

function copyStringRecord(
  record: Record<string, string>,
): Record<string, string> {
  const copied: Record<string, string> = {};
  for (const key of Object.keys(record)) {
    copied[key] = record[key];
  }
  return copied;
}

function publicLearnerState(state: LearnerStatePublic): LearnerStatePublic {
  return {
    scores: publicScores(state.scores),
    misconceptionFires: { ...state.misconceptionFires },
    phase: state.phase,
    gatePassed: state.gatePassed,
    attemptCount: state.attemptCount,
    lessonAims: copyStringRecord(state.lessonAims),
    ruleCompressions: copyStringRecord(state.ruleCompressions),
    runCommitments: copyStringRecord(state.runCommitments),
    coachingNotes: state.coachingNotes.map((note) => ({
      text: note.text,
      kind: note.kind,
    })),
    coachCalibration:
      state.coachCalibration === null
        ? null
        : {
            confidenceHintCount: state.coachCalibration.confidenceHintCount,
            confidenceAgreements: state.coachCalibration.confidenceAgreements,
            highConfidenceMisses: state.coachCalibration.highConfidenceMisses,
            rubricProposalCount: state.coachCalibration.rubricProposalCount,
            rubricProposalsAccepted:
              state.coachCalibration.rubricProposalsAccepted,
          },
  };
}

function publicLessonText(result: LessonTextResultPublic): LessonTextResultPublic {
  return {
    stored: result.stored,
    reason: result.reason,
    lessonKey: result.lessonKey,
    value: result.value,
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
    defeatedMisconception:
      verdict.defeatedMisconception === null
        ? null
        : {
            id: verdict.defeatedMisconception.id,
            name: verdict.defeatedMisconception.name,
          },
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
    socraticSeeds: [...brief.socraticSeeds, TEACH_BACK_SEED],
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
