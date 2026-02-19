# Privacy-Safe Telemetry Plan

## Goal
Capture product reliability signals without collecting user images or sensitive data.

## Principles
- Never upload image bytes, pixel data, or generated output files.
- Log only aggregate conversion metadata.
- Keep telemetry optional and easy to disable.

## Allowed Events
- `conversion_started`
  - fields: timestamp, browser family, quality value, source mime type
- `conversion_succeeded`
  - fields: duration_ms, input_bytes, output_bytes, savings_percent
- `conversion_failed`
  - fields: error_code, stage (`decode|encode|worker`)
- `conversion_cancelled`
  - fields: stage
- `benchmark_run_completed`
  - fields: avg_worker_ms, avg_wall_ms, avg_savings_percent

## Redaction Rules
- Do not send filename.
- Do not send object URLs.
- Do not send image dimensions if considered sensitive in your policy.

## Collection Strategy
- Start with console-only logging in development.
- For production, route events to a lightweight endpoint with sampling.
- Suggested sample rate: 10% for success events, 100% for failures (no payload with user content).

## Opt-out
- Add a user setting to disable telemetry collection.
- Respect `Do Not Track` when policy requires it.

## Retention
- Keep raw event logs for 30 days.
- Keep aggregated dashboards longer if anonymized.

## Implementation Notes
- Wrap telemetry calls in a single utility module.
- Use strict runtime validation for event payload shape.
- Fail open: telemetry errors must never block conversion UX.
