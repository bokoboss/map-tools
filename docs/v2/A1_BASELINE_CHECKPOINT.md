# A1 Baseline Checkpoint

Date: 2026-08-25

## Baseline

- Project baseline commit: `e8cf5a6870f1548c14f26010f2a4cbd1699e715d`
- Workflow bootstrap commit: `ebcd11d647f6ecaaa8adf637149447696b5bb6da`
- Stage 1 scope: characterization coverage and repeatable local test/smoke tooling only.
- Existing v1 save/open behavior was not changed before this checkpoint.

## Exact commands and results

```text
npm install
added 3 packages, and audited 4 packages in 1s
found 0 vulnerabilities

npm test
14 tests, 14 passed, 0 failed

npm run test:browser
1 test, 1 passed, 0 failed
```

The Node suite covers the marker/radius/shape/arrow/text/search/save-open characterization surface and pure schema/fixture validation. The browser smoke test verifies that the map shell and core controls render in Chromium.

## Known v1 persistence defects recorded for A2

- v1 JSON has no schema version or project metadata envelope.
- Text and arrow semantics are renderer/runtime artifacts and are not losslessly represented by the legacy GeoJSON path.
- The legacy loader clears the active map before validation completes.
- User text is interpolated into popup and text-marker HTML.
- Search results currently enter the project marker collection implicitly.

These are baseline defects, not accepted v2 behavior.
