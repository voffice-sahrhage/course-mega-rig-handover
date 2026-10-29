import { readdirSync } from 'node:fs';
import type { RigConfig } from './config.js';
import { lastBeat, type Beat } from './heartbeat.js';
import { readNight } from './digest/read.js';
import type { RunStatus } from './digest/types.js';

// Jobs per final status. A job counts once, under the status of its last line in the night's log,
// so a job that retried and then succeeded is one ok, not one ok plus retries.
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

export function summarizeNight(runsDir: string, night: string): NightSummary {
  const n = readNight(runsDir, night);
  if (!n.found) return { night, counts: null };
  const counts: NightCounts = { ok: 0, retry: 0, fail: 0 };
  for (const row of n.rows) counts[row.lastStatus] += 1;
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
