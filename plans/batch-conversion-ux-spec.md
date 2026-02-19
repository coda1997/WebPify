# Batch Conversion UX Spec (WebPify)

Date: 2026-02-19
Owner: Product + Frontend
Status: Ready for implementation
Scope: `/` converter page only (no benchmark changes)

## 1) Intent and Constraints

### User goal
Convert many images in one session and retrieve outputs with minimal friction.

### UX constraints
- Keep current two-panel layout and existing design system.
- Keep a single global quality control for MVP.
- Do not add new routes or heavy configuration.
- Preserve privacy trust messaging: local-only processing.

## 2) Information Architecture (MVP)

## Left panel (Control)
1. Guided steps (existing)
2. Multi-file dropzone + file summary
3. Quality slider + presets (existing)
4. Primary action row (stateful)
5. Batch status text

## Right panel (Outcome)
1. Batch summary strip (new)
2. Latest output stats (existing, keep)
3. Selected/latest preview compare (existing, keep)
4. Queue table/list with row actions (existing, enhanced)

Rationale: controls remain on left; decision and outcome clarity move to right where there is space for queue + summary.

## 3) Component-Level Spec

## 3.1 Dropzone
- Title copy: `Drop images here or click to choose`
- Helper copy: `PNG, JPEG, and browser-supported image files`
- Selection summary:
  - 0 files: `No file selected`
  - 1 file: `{name} ({size})`
  - N files: `{N} files ({totalSize})`
- Validation behavior:
  - Skip non-image files.
  - Show non-blocking message: `{X} non-image file(s) were skipped.`

## 3.2 Batch action row
Use one dominant CTA at a time.

### Idle with queued files
- Primary: `Convert all`
- Secondary: `Reset`

### Processing
- Primary (disabled): `Converting...`
- Secondary: `Cancel`
- Optional tertiary text link near queue header: `Clear completed` (disabled while processing)

### Completed (at least one success)
- Primary: `Download all`
- Secondary: `Convert new files` (or `Reset` if keeping existing behavior)

## 3.3 Batch summary strip (new)
Place at top of right panel.

Fields:
- `Files`: total count
- `Done`: completed count
- `Failed`: error count
- `Cancelled`: cancelled count (only visible if > 0)
- `Total saved`: sum(inputBytes - outputBytes) for completed items
- `Avg time`: mean(durationMs) for completed items

Example copy:
`23 files • 18 done • 2 failed • Saved 34.2 MB • Avg 0.42 s/image`

## 3.4 Queue list enhancements
Each row shows:
- File name
- Input size
- Status pill: `queued | processing | done | error | cancelled`
- If done: output size + savings percent
- Row actions:
  - Done: `Download`
  - Error: `Retry`
  - Queued/cancelled: `Remove`

Queue-level quick filters (tabs/chips):
- `All`
- `Processing`
- `Done`
- `Failed`

MVP note: filter changes are view-only and do not mutate queue state.

## 3.5 Download strategy
MVP behavior:
- If exactly one completed item: preserve existing direct file download.
- If multiple completed items: `Download all` triggers zipped download (`webpify-exports.zip`).
- Keep per-row `Download` always available for done items.

## 3.6 Preview behavior
- Keep existing compare/side-by-side preview.
- Default preview source: latest completed item.
- On queue row click, update preview target to that row if it is `done`.
- If selected row is not `done`, keep current preview and show subtle hint: `Preview available after conversion.`

## 4) State Model (UI + actions)

## States
- `empty`: no files
- `ready`: files queued, not converting
- `processing`: sequential conversion in progress
- `partial`: processing finished with mixed outcomes
- `success`: all convertible files done
- `cancelled`: run cancelled

## Transition rules
- `empty -> ready`: add valid files
- `ready -> processing`: click `Convert all`
- `processing -> cancelled`: click `Cancel`
- `processing -> success`: all done and no errors
- `processing -> partial`: at least one done and one error/cancelled
- `partial/success/cancelled -> ready`: add/remove/retry updates queue to executable state
- any state -> `empty`: click `Reset` with no kept files

## Action availability matrix
- `Convert all`: enabled only in `ready`, `partial`, `cancelled` when at least one executable (`queued`/`error`) item exists.
- `Cancel`: enabled only in `processing`.
- `Download all`: enabled when completed count >= 1.
- `Retry failed`: enabled when failed count >= 1 and not processing.
- `Clear completed`: enabled when completed count >= 1 and not processing.

## 5) Microcopy (final text)

## Global status line
- Empty: `Select or drop images to start. Processing stays in your browser.`
- Processing: `Converting {currentName} ({currentIndex}/{total})... keep this tab open.`
- Success: `Done. Converted {done}/{total} file(s).`
- Partial: `Completed {done}/{total}. {failed} failed.`
- Cancelled: `Conversion cancelled. Completed {done}/{total}.`

## Error messages
- Unsupported file set: `Please select at least one image file.`
- Per-file fallback: `Failed to convert this image. Try a different file.`
- Non-image skipped: `{X} non-image file(s) were skipped.`

## Privacy line
`Runs locally in your browser. No upload required.`

## 6) Accessibility + Interaction Requirements
- Keep keyboard access for dropzone (`Enter` / `Space`).
- Status region remains `aria-live="polite"`.
- Processing state changes must be announced once per item transition (not on every render).
- Ensure action buttons have deterministic focus order after state transitions.
- Queue status pills must not rely on color alone (include text labels).

## 7) Instrumentation (privacy-safe, optional)
Track only aggregate event counts/timings (no file names):
- `batch_files_added`
- `batch_convert_started`
- `batch_convert_completed`
- `batch_download_all`
- `batch_retry_failed`

## 8) Implementation Notes for Current Code
Based on `components/upload-shell.tsx`:
- Existing queue/status model already supports MVP states.
- Add derived metrics (`failedCount`, `cancelledCount`, `savedBytesTotal`, `avgDurationMs`).
- Add queue row actions (`retry`, `remove`, preview select).
- Add queue filter state (`all|processing|done|failed`).
- Keep sequential worker processing in MVP; no concurrency required.

## 9) Acceptance Criteria (MVP)
1. User can select/drop multiple files and convert all in one run.
2. User sees per-file status and can download each successful output.
3. User can download all successful outputs through one action.
4. User can retry only failed files without re-adding successful ones.
5. User can cancel active processing; remaining queued items move to cancelled/queued per implementation decision.
6. User always sees privacy-local processing message.
7. Keyboard and screen-reader status updates remain functional.
