'use strict';
// Minimal Google Analytics 4 (GA4) report runner.
//
// Reads the GA4 OAuth access token from the GA_ACCESS_TOKEN environment variable
// (provided by the connected Google Analytics integration) and a GA4 property id
// as the first CLI argument (optional; defaults to "0"), then calls the GA4 Data
// API (https://analyticsdata.googleapis.com) runReport and prints the JSON report
// to stdout. Network egress goes through the platform forward proxy via curl,
// which honors the HTTPS_PROXY environment variable. Output is stdout-only.
//
// The access token is NEVER printed and is passed to curl via a stdin config file
// (curl -K -), so it never appears in argv / /proc/<pid>/cmdline or error messages.
const { spawnSync } = require('node:child_process');

function main() {
  const token = process.env.GA_ACCESS_TOKEN || '';
  const propertyId = String(process.argv[2] || process.env.GA_PROPERTY_ID || '0').trim();
  // Benign presence marker (no secret value) so the run shows the integration
  // token was injected, without leaking it.
  console.log('GA_TOKEN_PRESENT=' + Boolean(token));
  if (!token) { console.error('missing GA_ACCESS_TOKEN (integration token was not injected)'); process.exit(1); }

  const url = 'https://analyticsdata.googleapis.com/v1beta/properties/' +
    encodeURIComponent(propertyId) + ':runReport';
  const body = JSON.stringify({
    dateRanges: [{ startDate: '7daysAgo', endDate: 'today' }],
    dimensions: [{ name: 'date' }],
    metrics: [{ name: 'activeUsers' }, { name: 'sessions' }],
  });
  // Authorization header via stdin config — keeps the token out of argv.
  const curlConfig = 'header = "Authorization: Bearer ' + token + '"\n';
  const res = spawnSync('curl', [
    '-sS', '--max-time', '30', '-w', '\nHTTP_STATUS=%{http_code}\n',
    '-X', 'POST', url,
    '-H', 'Content-Type: application/json',
    '--data', body,
    '-K', '-',
  ], { input: curlConfig, encoding: 'utf8' });

  if (res.error) {
    // spawn failed (curl missing / not executable) — not an egress signal.
    console.error('failed to spawn curl:', res.error.code || 'spawn error');
    process.exit(3);
  }
  if (res.status !== 0) {
    // curl transport failure (e.g., egress blocked / no proxy route). curl's own
    // diagnostics never contain the token (it was passed via stdin config).
    console.error('curl transport failure (egress blocked?), exit=' + res.status);
    if (res.stderr) console.error(res.stderr.trim());
    process.exit(2);
  }
  console.log('=== GA4 runReport response ===');
  console.log(res.stdout);
  // Exit 0 whenever curl got an HTTP response (egress + auth reached the host),
  // even if GA4 returns 4xx for a placeholder property id.
}

main();
