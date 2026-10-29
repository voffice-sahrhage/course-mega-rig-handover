import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

type Row = { job: string; owner: string | null; retries: number; lastStatus: string };
type Body = { night: string; rows: Row[]; badLines: number };

let runsDir: string;
let app: ReturnType<typeof createApp>;

const line = (at: string, job: string, status: string, owner: string | null, error?: string) =>
  JSON.stringify({ at, job, status, owner, ...(error === undefined ? {} : { error }) });

// Written out of job order on purpose: the digest sorts rows by job.
const busy = [
  line('2026-10-20T01:00:00+02:00', 'sync-users', 'ok', 'ann'),
  line('2026-10-20T01:05:00+02:00', 'backup', 'retry', 'bob', 'timeout'),
  line('2026-10-20T01:10:00+02:00', 'backup', 'retry', 'bob', 'timeout'),
  line('2026-10-20T01:15:00+02:00', 'backup', 'retry', 'bob', 'timeout'),
  line('2026-10-20T01:20:00+02:00', 'backup', 'ok', 'bob'),
  line('2026-10-20T02:00:00+02:00', 'cleanup', 'ok', null),
  line('2026-10-20T03:00:00+02:00', 'export', 'fail', 'cy', 'disk full'),
];

const withBadLine = [
  line('2026-10-22T01:00:00+02:00', 'alpha', 'ok', 'ann'),
  '{ this is not json',
  line('2026-10-22T02:00:00+02:00', 'beta', 'ok', 'bob'),
];

beforeAll(() => {
  runsDir = mkdtempSync(join(tmpdir(), 'rig-digest-'));
  writeFileSync(join(runsDir, '2026-10-20.jsonl'), busy.join('\n') + '\n');
  writeFileSync(join(runsDir, '2026-10-21.jsonl'), '');
  writeFileSync(join(runsDir, '2026-10-22.jsonl'), withBadLine.join('\n') + '\n');
  app = createApp({ adapter: 'shim', installed: '2026-10-29T14:06:00+01:00', beatEverySeconds: 60, runsDir });
});

afterAll(() => {
  rmSync(runsDir, { recursive: true, force: true });
});

// The cells of every body row, as text, in page order.
function htmlRows(html: string): string[][] {
  const body = html.split('<tbody>')[1] ?? '';
  return body
    .split('<tr')
    .slice(1)
    .map((tr) => [...tr.matchAll(/<td>(.*?)<\/td>/g)].map((m) => m[1] ?? ''));
}

// The opening tag of the body row for one job.
function rowTag(html: string, job: string): string {
  const tr = (html.split('<tbody>')[1] ?? '').split('<tr').find((t) => t.includes(`<td>${job}</td>`));
  return tr ? `<tr${tr.slice(0, tr.indexOf('>') + 1)}` : '';
}

describe('GET /digest/:night', () => {
  it('200 lists the night\'s jobs, sorted by job', async () => {
    const res = await app.request('/digest/2026-10-20');
    expect(res.status).toBe(200);
    const jobs = htmlRows(await res.text()).map((cells) => cells[0]);
    expect(jobs).toEqual(['backup', 'cleanup', 'export', 'sync-users']);
  });

  it('404 for a night with no file', async () => {
    const res = await app.request('/digest/2026-10-19');
    expect(res.status).toBe(404);
    expect(await res.text()).toContain('no run log for this night');
  });

  it('the empty night says "nothing ran"', async () => {
    const res = await app.request('/digest/2026-10-21');
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('nothing ran');
    expect(htmlRows(html)).toEqual([]);
  });

  it('a night with a bad line is 200, renders the good rows and mentions the bad line', async () => {
    const res = await app.request('/digest/2026-10-22');
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(htmlRows(html).map((cells) => cells[0])).toEqual(['alpha', 'beta']);
    expect(html).toContain('1 line in the log could not be read');
  });

  it('marks a job with 3 or more retries', async () => {
    const html = await (await app.request('/digest/2026-10-20')).text();
    // backup: 3 retries, last status ok
    expect(rowTag(html, 'backup')).toBe('<tr class="warn">');
  });

  it('marks a job whose last status is fail', async () => {
    const html = await (await app.request('/digest/2026-10-20')).text();
    expect(rowTag(html, 'export')).toBe('<tr class="warn">');
  });

  it('does not mark a healthy job', async () => {
    const html = await (await app.request('/digest/2026-10-20')).text();
    expect(rowTag(html, 'sync-users')).toBe('<tr>');
  });

  it('renders a null owner as —', async () => {
    const html = await (await app.request('/digest/2026-10-20')).text();
    const cleanup = htmlRows(html).find((cells) => cells[0] === 'cleanup');
    expect(cleanup?.[1]).toBe('—');
  });
});

describe('GET /api/digest/:night', () => {
  it('200 lists the night\'s jobs, sorted by job', async () => {
    const res = await app.request('/api/digest/2026-10-20');
    expect(res.status).toBe(200);
    const body = (await res.json()) as Body;
    expect(body.night).toBe('2026-10-20');
    expect(body.badLines).toBe(0);
    expect(body.rows.map((r) => r.job)).toEqual(['backup', 'cleanup', 'export', 'sync-users']);
    expect(body.rows.find((r) => r.job === 'backup')).toMatchObject({ retries: 3, lastStatus: 'ok', owner: 'bob' });
    expect(body.rows.find((r) => r.job === 'cleanup')?.owner).toBeNull();
  });

  it('lists the same jobs in the same order as the HTML page', async () => {
    const html = await (await app.request('/digest/2026-10-20')).text();
    const body = (await (await app.request('/api/digest/2026-10-20')).json()) as Body;
    expect(htmlRows(html).map((cells) => cells[0])).toEqual(body.rows.map((r) => r.job));
  });

  it('404 for a night with no file', async () => {
    const res = await app.request('/api/digest/2026-10-19');
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'no run log for 2026-10-19' });
  });

  it('the empty night has rows: []', async () => {
    const res = await app.request('/api/digest/2026-10-21');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ night: '2026-10-21', rows: [], badLines: 0 });
  });

  it('a night with a bad line is 200 with the good rows and badLines 1', async () => {
    const res = await app.request('/api/digest/2026-10-22');
    expect(res.status).toBe(200);
    const body = (await res.json()) as Body;
    expect(body.badLines).toBe(1);
    expect(body.rows.map((r) => r.job)).toEqual(['alpha', 'beta']);
  });
});
