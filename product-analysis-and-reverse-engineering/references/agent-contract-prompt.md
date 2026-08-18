# Agent Contract And Functional-Equivalent Prompt

Use this module only when evidence supports an Agent or automated decision-making role.

## I/O Contract Card

For each target role, output:

1. Name and evidence IDs
2. Core goal
3. Trigger conditions
4. Inputs grouped by source
5. Observable judgments
6. Functional tools
7. Outputs grouped by type
8. Global context reads and writes
9. Completion conditions
10. Exceptions, retry, interruption, and duplicate handling
11. Downstream handoff
12. Unknowns

## Tool Contract

For every evidenced tool or functional capability, define:

- official or functional placeholder name;
- caller and preconditions;
- required parameters;
- whether user confirmation is required;
- success result and verification;
- failure result and retry policy;
- idempotency key or duplication risk;
- billing risk;
- interruption behavior;
- state write after success;
- recovery when the tool succeeds but persistence fails.

Do not invent API-shaped names. Use placeholders such as `<generate-asset-tool>`.

## State Machine

Check for states equivalent to waiting input, planning, waiting confirmation, executing, validating, completed, failed, interrupted, retrying, and handoff. Add or remove states according to evidence.

For every state, define permitted actions, prohibited actions, entry conditions, exit conditions, persisted fields, and user-visible status.

## Prompt Structure

Write the functional-equivalent prompt with:

1. Agent name
2. Role
3. Core goal
4. Task boundaries
5. Input contract
6. Global-context protocol
7. Workflow
8. Tool-call rules
9. User-confirmation mechanism
10. Result validation
11. Modification and rollback
12. Exception handling
13. State machine
14. Downstream handoff
15. Completion conditions
16. Output format

Label derived design fields as inferred placeholders. Require explicit state writes for confirmations and completion. Do not allow natural-language claims to substitute for persisted state.

## Minimum Tests

Include at least:

| Test | Required expectation |
|---|---|
| Complete input | Correct judgment, tools, writes, validation, and handoff |
| Missing required input | No irreversible action; request only missing information |
| Local modification | Recompute the smallest valid dependency set |
| Tool failure | Accurate error, bounded retry, no false completion |
| User interruption | Stop future calls and reconcile in-flight work |
| Duplicate request | Idempotent response or explicit duplicate warning |
| State conflict | Do not choose a source of truth without evidence |
