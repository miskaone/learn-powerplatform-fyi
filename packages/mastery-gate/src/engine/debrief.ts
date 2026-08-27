import type {
  DebriefSegment,
  DebriefSegmentKind,
  DebriefState,
  Ledger,
  NarrationCue,
} from '../schema';
import { MAX_SCRIPT_LINE_LENGTH } from '../schema';
import { cloneLedger } from './ledger';

export const MAX_DEBRIEF_SEGMENTS = 12;

export const DEBRIEF_KIND_ORDER: Record<DebriefSegmentKind, number> = {
  title: 0,
  misconception: 1,
  rubric: 2,
  drill: 3,
};

export interface ComposeDebriefResult {
  accepted: boolean;
  playlist: DebriefSegment[];
  rejectedSegmentIds: string[];
  reason: string | null;
}

export interface AdvanceSegmentResult {
  ok: boolean;
  currentSegmentId: string | null;
}

function refusal(
  reason: string,
  rejectedSegmentIds: string[] = [],
): ComposeDebriefResult {
  return {
    accepted: false,
    playlist: [],
    rejectedSegmentIds,
    reason,
  };
}

function rebuildSegment(segment: DebriefSegment): DebriefSegment {
  const rebuilt: DebriefSegment = {
    id: segment.id,
    kind: segment.kind,
    scriptLine: segment.scriptLine.trim().slice(0, MAX_SCRIPT_LINE_LENGTH),
    audioAsset: segment.audioAsset,
  };
  if (segment.misconceptionId !== undefined) {
    rebuilt.misconceptionId = segment.misconceptionId;
  }
  return rebuilt;
}

function misconceptionFired(ledger: Ledger, misconceptionId: string): boolean {
  return (ledger.misconceptionFires[misconceptionId] ?? 0) >= 1;
}

export function applyComposeDebrief(
  ledger: Ledger,
  segments: readonly DebriefSegment[],
  moduleComplete: boolean,
): ComposeDebriefResult {
  if (!moduleComplete) {
    return refusal('module-incomplete');
  }
  if (segments.length === 0) {
    return refusal('no-segments');
  }
  if (segments.length > MAX_DEBRIEF_SEGMENTS) {
    return refusal('too-many-segments');
  }

  const seen = new Set<string>();
  const duplicateIds = new Set<string>();
  for (const segment of segments) {
    if (seen.has(segment.id)) {
      duplicateIds.add(segment.id);
    }
    seen.add(segment.id);
  }

  const rejectedSegmentIds: string[] = [];
  const accepted: DebriefSegment[] = [];
  for (const segment of segments) {
    let rejected = false;
    if (duplicateIds.has(segment.id)) {
      rejected = true;
    }
    if (segment.scriptLine.trim().length === 0) {
      rejected = true;
    }
    if (segment.kind === 'misconception') {
      const misconceptionId = segment.misconceptionId;
      if (
        misconceptionId === undefined ||
        !misconceptionFired(ledger, misconceptionId)
      ) {
        rejected = true;
      }
    }
    if (rejected) {
      rejectedSegmentIds.push(segment.id);
    } else {
      accepted.push(rebuildSegment(segment));
    }
  }

  if (rejectedSegmentIds.length > 0) {
    return refusal('segment-rejected', rejectedSegmentIds);
  }

  const playlist = accepted.slice().sort((left, right) => {
    return DEBRIEF_KIND_ORDER[left.kind] - DEBRIEF_KIND_ORDER[right.kind];
  });

  return {
    accepted: true,
    playlist,
    rejectedSegmentIds: [],
    reason: null,
  };
}

export function buildNarrationCues(
  debrief: DebriefState | null,
  learnerName: string | null,
): NarrationCue[] {
  if (debrief === null) {
    return [];
  }
  const name = learnerName ?? 'learner';
  const cues: NarrationCue[] = [];
  for (let index = 0; index < debrief.playlist.length; index += 1) {
    const segment = debrief.playlist[index];
    cues.push({
      segmentId: segment.id,
      order: index,
      scriptLine: segment.scriptLine.split('{learnerName}').join(name),
    });
  }
  return cues;
}

export function applyAdvanceSegment(
  ledger: Ledger,
  segmentId: string,
): { ledger: Ledger; result: AdvanceSegmentResult } {
  const debrief = ledger.debrief;
  if (debrief === null) {
    return {
      ledger,
      result: { ok: false, currentSegmentId: null },
    };
  }
  const nextSegment = debrief.playlist[debrief.currentIndex + 1];
  if (nextSegment === undefined || nextSegment.id !== segmentId) {
    const current = debrief.playlist[debrief.currentIndex];
    return {
      ledger,
      result: {
        ok: false,
        currentSegmentId: current === undefined ? null : current.id,
      },
    };
  }
  const next = cloneLedger(ledger);
  if (next.debrief === null) {
    return {
      ledger,
      result: { ok: false, currentSegmentId: null },
    };
  }
  next.debrief.currentIndex = debrief.currentIndex + 1;
  return {
    ledger: next,
    result: { ok: true, currentSegmentId: segmentId },
  };
}
