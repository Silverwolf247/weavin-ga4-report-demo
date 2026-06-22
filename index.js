'use strict';
// Minimal Google Analytics 4 (GA4) report runner.
//
// Reads the GA4 OAuth access token from the GA_ACCESS_TOKEN environment variable
// (provided by the connected Google Analytics integration) and a GA4 property id
// as the first CLI argument, then calls the GA4 Data API
// (https://analyticsdata.googleapis.com) runReport and prints the JSON report to
// stdout. Network egress goes through the platform forward proxy via curl, which
// honors the HTTPS_PROXY environment variable.
const { execFileSync } = require('node:child_process');

function main() {
  const token = process.env.GA_ACCESS_TOKEN || '';
  const propertyId = String(process.argv[2] || process.env.GA_PROPERTY_ID || '').trim();
  if (!token) { console.error('missing GA_ACCESS_TOKEN'); process.exit(1); }
  if (!propertyId) { console.error('missing propertyId (pass as first arg)'); process.exit(1); }

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
    console.error('curl failed:', e && e.message ? e.message : String(e));
    if (e && e.stdout) console.log(String(e.stdout));
    if (e && e.stderr) console.error(String(e.stderr));
    process.exit(2);
  }
  console.log('=== GA4 runReport response ===');
  console.log(out);
}

main();
