# weavin-ga4-report-demo

Minimal **Google Analytics 4 (GA4)** report runner.

It reads the GA4 OAuth access token from the `GA_ACCESS_TOKEN` environment variable
(supplied by the connected Google Analytics integration) and a GA4 **property id**
as the first command-line argument, calls the GA4 Data API
(`https://analyticsdata.googleapis.com` `runReport`), and prints the JSON report to
stdout. No files are written; output is stdout-only.

## Usage

```sh
node index.js <GA4_PROPERTY_ID>
```

- `GA_ACCESS_TOKEN` (env): GA4 OAuth access token (Google Analytics integration).
- `<GA4_PROPERTY_ID>` (arg): numeric GA4 property id, e.g. `123456789`.
