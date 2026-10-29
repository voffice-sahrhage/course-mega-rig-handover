import type { DigestRow } from '../digest/types.js';

const dash = '—';

// Missing values (null, undefined, empty string) render as `—`, never as an empty cell.
function show(v: string | number | null | undefined) {
  return v === null || v === undefined || v === '' ? dash : String(v);
}

function flagged(row: DigestRow): boolean {
  return row.retries >= 3 || row.lastStatus === 'fail';
}

export function DigestPage({ night, rows, badLines }: { night: string; rows: DigestRow[]; badLines: number }) {
  return (
    <>
      <h1>digest · {night}</h1>
      {rows.length === 0 ? (
        <p class="mute">nothing ran</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>job</th>
              <th>owner</th>
              <th>runs</th>
              <th>retries</th>
              <th>last status</th>
              <th>last error</th>
              <th>first</th>
              <th>last</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr class={flagged(r) ? 'warn' : undefined}>
                <td>{show(r.job)}</td>
                <td>{show(r.owner)}</td>
                <td>{show(r.runs)}</td>
                <td>{show(r.retries)}</td>
                <td>{show(r.lastStatus)}</td>
                <td>{show(r.lastError)}</td>
                <td>{show(r.firstAt)}</td>
                <td>{show(r.lastAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {badLines > 0 ? (
        <p class="mute">
          {badLines} {badLines === 1 ? 'line' : 'lines'} in the log could not be read
        </p>
      ) : null}
    </>
  );
}

export function DigestNotFound({ night }: { night: string }) {
  return (
    <>
      <h1>digest · {night}</h1>
      <p class="mute">no run log for this night</p>
    </>
  );
}
