import { test, expect } from 'bun:test';
import type { ContentManifest, DebriefSegment } from '../schema';
import { MAX_SCRIPT_LINE_LENGTH } from '../schema';
import { MasteryEngine } from './engine';
import { FIXTURE_MANIFEST_WITH_EXAM } from './fixtures';
import { MAX_LEARNER_NAME_LENGTH } from './ledger';
import { MemoryStorageAdapter } from './storage';

function corpusOf(manifest: ContentManifest): string {
  return manifest.objectives.map((objective) => objective.summary).join('\n');
}

function passingRubric(manifest: ContentManifest, transferScore = 3) {
  const quoteA = manifest.objectives[0].summary;
  const quoteB = manifest.objectives[1].summary;
  return {
    recall: { score: 3, quote: quoteA },
    connections: { score: 3, quote: quoteB },
    application: { score: 3, quote: quoteA },
    transfer: { score: transferScore, quote: quoteB },
  };
}

function scoreGate(
  engine: MasteryEngine,
  manifest: ContentManifest,
  transferScore = 3,
): void {
  const scored = engine.scoreRubric(
    passingRubric(manifest, transferScore),
    corpusOf(manifest),
  );
  expect(scored.ok).toBe(true);
}

function passGate(engine: MasteryEngine): void {
  engine.submitAnswer('q1-a');
  scoreGate(engine, FIXTURE_MANIFEST_WITH_EXAM, 3);
}

function attemptAllQuestions(engine: MasteryEngine): void {
  engine.submitAnswer('q1-a');
  engine.submitAnswer('q2-b');
  engine.submitAnswer('q3-b');
  engine.submitAnswer('q4-a');
}

function completeModule(
  engine: MasteryEngine,
  fireMisconception = false,
): void {
  if (fireMisconception) {
    engine.submitAnswer('q1-b');
    engine.submitAnswer('q1-a');
  } else {
    engine.submitAnswer('q1-a');
  }
  engine.submitAnswer('q2-b');
  engine.submitAnswer('q3-b');
  engine.submitAnswer('q4-a');
  scoreGate(engine, FIXTURE_MANIFEST_WITH_EXAM, 3);
  expect(engine.isModuleComplete()).toBe(true);
}

function segment(
  id: string,
  kind: DebriefSegment['kind'],
  scriptLine: string,
  misconceptionId?: string,
): DebriefSegment {
  const item: DebriefSegment = {
    id,
    kind,
    scriptLine,
    audioAsset: null,
  };
  if (misconceptionId !== undefined) {
    item.misconceptionId = misconceptionId;
  }
  return item;
}

test('composeDebrief refuses when the module is incomplete', () => {
  const gated = new MasteryEngine(
    FIXTURE_MANIFEST_WITH_EXAM,
    new MemoryStorageAdapter(),
    { now: () => 1_000_000 },
  );
  passGate(gated);
  expect(gated.isModuleComplete()).toBe(false);
  const gatedRefusal = gated.composeDebrief([
    segment('title-1', 'title', 'Nice work'),
  ]);
  expect(gatedRefusal).toEqual({
    accepted: false,
    playlist: [],
    rejectedSegmentIds: [],
    reason: 'module-incomplete',
  });
  expect(gated.getDebriefState()).toBe(null);
  expect(gated.getLearnerState().phase).not.toBe('debrief');

  const attempted = new MasteryEngine(
    FIXTURE_MANIFEST_WITH_EXAM,
    new MemoryStorageAdapter(),
    { now: () => 1_000_000 },
  );
  attemptAllQuestions(attempted);
  scoreGate(attempted, FIXTURE_MANIFEST_WITH_EXAM, 2);
  expect(attempted.getLearnerState().gatePassed).toBe(false);
  expect(attempted.isModuleComplete()).toBe(false);
  const attemptedRefusal = attempted.composeDebrief([
    segment('title-1', 'title', 'Nice work'),
  ]);
  expect(attemptedRefusal.reason).toBe('module-incomplete');
  expect(attemptedRefusal.accepted).toBe(false);
  expect(attempted.getDebriefState()).toBe(null);
});

test('accepted compose stores a template-ordered playlist and enters debrief', () => {
  const engine = new MasteryEngine(
    FIXTURE_MANIFEST_WITH_EXAM,
    new MemoryStorageAdapter(),
    { now: () => 1_000_000 },
  );
  completeModule(engine, true);
  const result = engine.composeDebrief([
    segment('drill-1', 'drill', 'Try the flip again'),
    segment('mc-1', 'misconception', 'HTTP is the wrong boundary', 'mc-shared'),
    segment('title-1', 'title', 'Mastery debrief'),
    segment('rubric-1', 'rubric', 'Every dimension cleared'),
  ]);
  expect(result.accepted).toBe(true);
  expect(result.reason).toBe(null);
  expect(result.playlist.map((entry) => entry.kind)).toEqual([
    'title',
    'misconception',
    'rubric',
    'drill',
  ]);
  expect(result.playlist.map((entry) => entry.id)).toEqual([
    'title-1',
    'mc-1',
    'rubric-1',
    'drill-1',
  ]);
  expect(engine.getLearnerState().phase).toBe('debrief');
  const stored = engine.getDebriefState();
  expect(stored === null).toBe(false);
  if (stored === null) {
    return;
  }
  expect(stored.currentIndex).toBe(0);
  expect(stored.playlist.map((entry) => entry.id)).toEqual([
    'title-1',
    'mc-1',
    'rubric-1',
    'drill-1',
  ]);
});

test('misconception segments that never fired are rejected; fired ids are accepted', () => {
  const unfired = new MasteryEngine(
    FIXTURE_MANIFEST_WITH_EXAM,
    new MemoryStorageAdapter(),
    { now: () => 1_000_000 },
  );
  completeModule(unfired, false);
  const refused = unfired.composeDebrief([
    segment('title-1', 'title', 'Mastery debrief'),
    segment('mc-1', 'misconception', 'This never fired', 'mc-q2-post'),
  ]);
  expect(refused.accepted).toBe(false);
  expect(refused.reason).toBe('segment-rejected');
  expect(refused.rejectedSegmentIds).toEqual(['mc-1']);
  expect(unfired.getDebriefState()).toBe(null);
  expect(unfired.getLearnerState().phase).not.toBe('debrief');

  const fired = new MasteryEngine(
    FIXTURE_MANIFEST_WITH_EXAM,
    new MemoryStorageAdapter(),
    { now: () => 1_000_000 },
  );
  completeModule(fired, true);
  const accepted = fired.composeDebrief([
    segment('title-1', 'title', 'Mastery debrief'),
    segment('mc-1', 'misconception', 'HTTP is the wrong boundary', 'mc-shared'),
  ]);
  expect(accepted.accepted).toBe(true);
  expect(accepted.rejectedSegmentIds).toEqual([]);
  expect(fired.getDebriefState()?.playlist.map((entry) => entry.id)).toEqual([
    'title-1',
    'mc-1',
  ]);
});

test('composeDebrief rejects empty, oversized, duplicate, and empty-script playlists; clamps long lines', () => {
  const engine = new MasteryEngine(
    FIXTURE_MANIFEST_WITH_EXAM,
    new MemoryStorageAdapter(),
    { now: () => 1_000_000 },
  );
  completeModule(engine);

  expect(engine.composeDebrief([])).toEqual({
    accepted: false,
    playlist: [],
    rejectedSegmentIds: [],
    reason: 'no-segments',
  });

  const thirteen: DebriefSegment[] = [];
  for (let index = 0; index < 13; index += 1) {
    thirteen.push(segment(`s-${index}`, 'title', `Line ${index}`));
  }
  expect(engine.composeDebrief(thirteen).reason).toBe('too-many-segments');
  expect(engine.composeDebrief(thirteen).accepted).toBe(false);

  const duplicates = engine.composeDebrief([
    segment('dup', 'title', 'First title'),
    segment('dup', 'title', 'Second title'),
  ]);
  expect(duplicates.accepted).toBe(false);
  expect(duplicates.reason).toBe('segment-rejected');
  expect(duplicates.rejectedSegmentIds).toEqual(['dup', 'dup']);
  expect(engine.getDebriefState()).toBe(null);

  const emptyLine = engine.composeDebrief([
    segment('title-1', 'title', '   '),
  ]);
  expect(emptyLine.accepted).toBe(false);
  expect(emptyLine.reason).toBe('segment-rejected');
  expect(emptyLine.rejectedSegmentIds).toEqual(['title-1']);

  const longLine = 'x'.repeat(400);
  const clamped = engine.composeDebrief([
    segment('title-1', 'title', longLine),
  ]);
  expect(clamped.accepted).toBe(true);
  expect(clamped.playlist[0]?.scriptLine.length).toBe(MAX_SCRIPT_LINE_LENGTH);
  expect(engine.getDebriefState()?.playlist[0]?.scriptLine.length).toBe(
    MAX_SCRIPT_LINE_LENGTH,
  );
});

test('getNarrationScript interpolates learnerName from the stored playlist only', () => {
  const engine = new MasteryEngine(
    FIXTURE_MANIFEST_WITH_EXAM,
    new MemoryStorageAdapter(),
    { now: () => 1_000_000 },
  );
  expect(engine.getNarrationScript()).toEqual([]);
  completeModule(engine);
  engine.composeDebrief([
    segment('title-1', 'title', 'Hello {learnerName}, you passed.'),
    segment('rubric-1', 'rubric', 'Keep going {learnerName}.'),
  ]);

  const unnamed = engine.getNarrationScript();
  expect(unnamed.map((cue) => cue.order)).toEqual([0, 1]);
  expect(unnamed[0]).toEqual({
    segmentId: 'title-1',
    order: 0,
    scriptLine: 'Hello learner, you passed.',
  });
  expect(unnamed[1]?.scriptLine).toBe('Keep going learner.');

  engine.setLearnerName('Mike');
  const named = engine.getNarrationScript();
  expect(named[0]?.scriptLine).toBe('Hello Mike, you passed.');
  expect(named[1]?.scriptLine).toBe('Keep going Mike.');
});

test('setLearnerName clamps to 40 chars, clears whitespace, and persists', () => {
  const adapter = new MemoryStorageAdapter();
  const engine = new MasteryEngine(FIXTURE_MANIFEST_WITH_EXAM, adapter, {
    now: () => 1_000_000,
  });
  engine.setLearnerName('a'.repeat(61));
  expect(engine.getLearnerName()?.length).toBe(MAX_LEARNER_NAME_LENGTH);
  expect(engine.getLearnerName()).toBe('a'.repeat(40));

  engine.setLearnerName('   ');
  expect(engine.getLearnerName()).toBe(null);

  engine.setLearnerName('  Ada  ');
  expect(engine.getLearnerName()).toBe('Ada');

  const reloaded = new MasteryEngine(FIXTURE_MANIFEST_WITH_EXAM, adapter, {
    now: () => 1_000_000,
  });
  expect(reloaded.getLearnerName()).toBe('Ada');
});

test('advanceSegment allows only the next playlist item and persists progression', () => {
  const adapter = new MemoryStorageAdapter();
  const engine = new MasteryEngine(FIXTURE_MANIFEST_WITH_EXAM, adapter, {
    now: () => 1_000_000,
  });
  completeModule(engine);
  engine.composeDebrief([
    segment('title-1', 'title', 'Title'),
    segment('rubric-1', 'rubric', 'Rubric'),
    segment('drill-1', 'drill', 'Drill'),
  ]);
  const playlist = engine.getDebriefState()?.playlist;
  expect(playlist === undefined).toBe(false);
  if (playlist === undefined) {
    return;
  }

  const skip = engine.advanceSegment(playlist[2].id);
  expect(skip).toEqual({ ok: false, currentSegmentId: playlist[0].id });
  expect(engine.getDebriefState()?.currentIndex).toBe(0);

  const repeat = engine.advanceSegment(playlist[0].id);
  expect(repeat.ok).toBe(false);
  expect(repeat.currentSegmentId).toBe(playlist[0].id);

  const unknown = engine.advanceSegment('no-such-segment');
  expect(unknown.ok).toBe(false);
  expect(unknown.currentSegmentId).toBe(playlist[0].id);

  const next = engine.advanceSegment(playlist[1].id);
  expect(next).toEqual({ ok: true, currentSegmentId: playlist[1].id });
  expect(engine.getDebriefState()?.currentIndex).toBe(1);

  const reloaded = new MasteryEngine(FIXTURE_MANIFEST_WITH_EXAM, adapter, {
    now: () => 1_000_000,
  });
  expect(reloaded.getDebriefState()?.currentIndex).toBe(1);
  expect(reloaded.getDebriefState()?.playlist[1]?.id).toBe(playlist[1].id);
});

test('learner name never enters rubric evidence', () => {
  const engine = new MasteryEngine(
    FIXTURE_MANIFEST_WITH_EXAM,
    new MemoryStorageAdapter(),
    { now: () => 1_000_000 },
  );
  engine.setLearnerName('AtlasEvidence');
  engine.submitAnswer('q1-a');
  const name = engine.getLearnerName();
  expect(name).toBe('AtlasEvidence');
  const verdict = engine.scoreRubric(
    {
      recall: { score: 3, quote: name as string },
      connections: {
        score: 3,
        quote: FIXTURE_MANIFEST_WITH_EXAM.objectives[1].summary,
      },
      application: {
        score: 3,
        quote: FIXTURE_MANIFEST_WITH_EXAM.objectives[0].summary,
      },
      transfer: {
        score: 3,
        quote: FIXTURE_MANIFEST_WITH_EXAM.objectives[1].summary,
      },
    },
    corpusOf(FIXTURE_MANIFEST_WITH_EXAM),
  );
  expect(verdict.ok).toBe(false);
  if (!verdict.ok) {
    expect(verdict.errors.join(';')).toContain(
      'quote is not verbatim from the session transcript',
    );
  }
  expect(engine.getLearnerState().gatePassed).toBe(false);
});
