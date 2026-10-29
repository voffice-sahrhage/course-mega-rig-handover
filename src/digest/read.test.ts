import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readNight } from './read.js';

describe('readNight', () => {
  it('reads runs/2026-10-28.jsonl: 5 jobs, 1 bad line', () => {
    const night = readNight('runs', '2026-10-28');
    if (!night.found) throw new Error('night not found');
    expect(night.badLines).toBe(1);
    expect(night.rows.map((r) => r.job)).toEqual([
      'digest/render',
      'fixtures/refresh',
      'lane/sync',
      'notes/backup',
      'rig/rotate-logs',
    ]);
    const byJob = Object.fromEntries(night.rows.map((r) => [r.job, r]));
    expect(byJob['fixtures/refresh']).toMatchObject({
      runs: 4,
      retries: 3,
      lastStatus: 'ok',
      lastError: null,
      firstAt: '2026-10-29T01:30:00+01:00',
      lastAt: '2026-10-29T01:37:00+01:00',
    });
    expect(byJob['notes/backup']).toMatchObject({ runs: 1, lastStatus: 'fail', lastError: 'quota exceeded' });
    expect(byJob['lane/sync']).toMatchObject({ runs: 8, retries: 1, lastStatus: 'ok', firstAt: '2026-10-28T23:00:06+01:00' });
    expect(byJob['digest/render']?.owner).toBeNull();
  });

  it('tells a missing night from an empty one', () => {
    const dir = mkdtempSync(join(tmpdir(), 'rig-runs-'));
    writeFileSync(join(dir, '2026-10-30.jsonl'), '');
    expect(readNight(dir, '2026-10-29')).toEqual({ found: false, night: '2026-10-29' });
    expect(readNight(dir, '2026-10-30')).toEqual({ found: true, night: '2026-10-30', rows: [], badLines: 0 });
  });

  it('counts lines of the wrong shape as bad, never throws', () => {
    const dir = mkdtempSync(join(tmpdir(), 'rig-runs-'));
    writeFileSync(
      join(dir, '2026-10-30.jsonl'),
      ['[]', '{"at":"x","job":"a","status":"maybe","owner":null}', '{"at":"x","job":"a","status":"ok","owner":null}', '{'].join('\n'),
    );
    const night = readNight(dir, '2026-10-30');
    expect(night).toMatchObject({ found: true, badLines: 3 });
  });

  it('rejects a night that is not a date', () => {
    expect(readNight('runs', '../package')).toEqual({ found: false, night: '../package' });
  });
});
