// Plan morning-digest § 1. The contract every part of § 2 builds on: one row per job in a night's
// run log, and the reader's signature. The reader itself lives in `read.ts`.

export type RunStatus = 'ok' | 'retry' | 'fail';

// One line of runs/<night>.jsonl, once parsed at the edge.
export type RunLine = {
  at: string;
  job: string;
  status: RunStatus;
  owner: string | null;
  error?: string;
};

export type DigestRow = {
  job: string;
  // null when the log says so; views render it as `—`.
  owner: string | null;
  runs: number;
  retries: number;
  lastStatus: RunStatus;
  // The error of the job's last line, null when that line has none.
  lastError: string | null;
  // Times exactly as the log wrote them, offset kept (styleguide: never convert to UTC).
  firstAt: string;
  lastAt: string;
};

// `found: false`: no file for that night (the routes answer 404).
// `found: true` with no rows: the file is there but nothing ran.
export type Night =
  | { found: false; night: string }
  | { found: true; night: string; rows: DigestRow[]; badLines: number };

// Rows are sorted by job. Lines that don't parse are counted in `badLines`, never thrown.
export type ReadNight = (runsDir: string, night: string) => Night;
