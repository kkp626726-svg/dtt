# Output Specification

## Journey Evidence Table

Use columns:

`Stage | User goal | User action | Page feedback | Decision | Page/data/asset change | Emotion | Friction | Evidence`

## Actor Inventory

Use columns:

`Actor | First appearance | Trigger | Replaces/continues | Handoff target | Recall condition | Evidence level | Evidence`

## Tool Catalog

Use columns:

`Tool or capability | Official name visible? | Caller | Preconditions | Inputs | Result | Verification | Failure/retry | State write | Evidence`

## Context Field Table

Use columns:

`Domain | Field/object | Read/write | Producer | Consumer | Version/update | Invalidation | Evidence level | Evidence`

## Data Flow Table

Use columns:

`Data/object | Producer | Consumers | Versions | Stable reference | State consistency | Update/invalidations | Evidence`

## Architecture Traceability

Use columns:

`Component | Why needed | Evidence | Classification | Confidence | Verification gap`

## HTML Quality

- Use a readable responsive layout rather than narrow side columns.
- Keep dense tables full width and support horizontal scrolling.
- Use stable navigation for long reports.
- Keep evidence IDs visible near claims and diagram nodes.
- Include an evidence-level legend.
- Avoid decorative complexity that competes with analysis.
- Test all local image links and scripts.

## Completion Gate

Do not call the analysis complete until:

- requested evidence has been inspected or listed as inaccessible;
- conclusions are classified;
- major claims are traceable;
- state conflicts are preserved;
- diagrams match their tables;
- local links resolve;
- generated packages pass archive integrity checks;
- remaining unknowns are explicit.
