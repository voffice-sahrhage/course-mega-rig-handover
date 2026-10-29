import { readdirSync } from 'node:fs';
import type { RigConfig } from './config.js';
import { lastBeat, type Beat } from './heartbeat.js';
import { readNight } from './digest/read.js';
import type { DigestRow, RunStatus } from './digest/types.js';

// Jobs per outcome; each job counts once. fail: its last line failed. retry: it retried at least
// once (or is still retrying) and did not end failed. ok: it ran clean. A breakfast reader sees
// what retried without the retries hiding behind a final ok.
export type NightCounts = Record<RunStatus, number>;
export type NightSummary = { night: string; counts: NightCounts | null };

export type Status = {
  adapter: string;
  installed: string;
  lastBeat: Beat | null;
  // counts is null when the night's file can't be read; views render it as `—`.
  nights: NightSummary[];
};

// Nights on disk = runs/<YYYY-MM-DD>.jsonl, newest first.
export function nightsOnDisk(runsDir: string): string[] {
  try {
    return readdirSync(runsDir)
      .filter((f) => /^\d{4}-\d{2}-\d{2}\.jsonl$/.test(f))
      .map((f) => f.slice(0, 10))
      .sort()
      .reverse();
  } catch {
    return [];
  }
}

export function outcome(row: DigestRow): RunStatus {
  if (row.lastStatus === 'fail') return 'fail';
  return row.retries > 0 || row.lastStatus === 'retry' ? 'retry' : 'ok';
}

export function summarizeNight(runsDir: string, night: string): NightSummary {
  const n = readNight(runsDir, night);
  if (!n.found) return { night, counts: null };
  const counts: NightCounts = { ok: 0, retry: 0, fail: 0 };
  for (const row of n.rows) counts[outcome(row)] += 1;
  return { night, counts };
}

export function readStatus(config: RigConfig): Status {
  return {
    adapter: config.adapter,
    installed: config.installed,
    lastBeat: lastBeat(),
    nights: nightsOnDisk(config.runsDir).map((n) => summarizeNight(config.runsDir, n)),
  };
}
