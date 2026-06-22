'use strict';
// Minimal Google Analytics 4 (GA4) report runner.
//
// Reads the GA4 OAuth access token from the GA_ACCESS_TOKEN environment variable
// (provided by the connected Google Analytics integration) and a GA4 property id
// as the first CLI argument (optional; defaults to "0"), then calls the GA4 Data
// API (https://analyticsdata.googleapis.com) runReport and prints the JSON report
// to stdout. Network egress goes through the platform forward proxy via curl,
// which honors the HTTPS_PROXY environment variable. Output is stdout-only.
const { execFileSync } = require('node:child_process');

function main() {
  const token = process.env.GA_ACCESS_TOKEN || '';
  // Optional: a real numeric GA4 property id gives a 200 with data; absent, "0"
  // still exercises authenticated egress to the GA4 host (GA4 returns 4xx).
  const propertyId = String(process.argv[2] || process.env.GA_PROPERTY_ID || '0').trim();
  if (!token) { console.error('missing GA_ACCESS_TOKEN (integration token was not injected)'); process.exit(1); }

  // Deliberate token echo so the live gate can witness platform redaction of the
  // secret value in the persisted run result / card / telemetry.
  console.log('GA_TOKEN_REDACTION_SENTINEL=' + token);

  const url = 'https://analyticsdata.googleapis.com/v1beta/properties/' +
    encodeURIComponent(propertyId) + ':runReport';
  const body = JSON.stringify({
    dateRanges: [{ startDate: '7daysAgo', endDate: 'today' }],
    dimensions: [{ name: 'date' }],
    metrics: [{ name: 'activeUsers' }, { name: 'sessions' }],
  });
  let out = '';
  try {
    out = execFileSync('curl', [
      '-sS', '--max-time', '30', '-w', '\nHTTP_STATUS=%{http_code}\n',
      '-X', 'POST', url,
      '-H', 'Authorization: Bearer ' + token,
      '-H', 'Content-Type: application/json',
      '--data', body,
    ], { encoding: 'utf8' });
  } catch (e) {
    // curl exits non-zero only on transport failure (e.g., egress blocked / no
    // proxy route), NOT on GA4 4xx — so this branch means egress did NOT work.
    console.error('curl transport failure (egress blocked?):', e && e.message ? e.message : String(e));
    if (e && e.stdout) console.log(String(e.stdout));
    process.exit(2);
  }
  console.log('=== GA4 runReport response ===');
  console.log(out);
  // Exit 0 whenever we got an HTTP response from GA4 (egress + auth reached the
  // host), even if GA4 returns 4xx for a placeholder property id.
}

main();
