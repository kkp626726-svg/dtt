# Evidence Protocol

## Source Types

Inventory user actions, chat records, actor names, buttons, forms, navigation, canvas objects, cards, assets, history, task state, model selection, tool results, errors, billing information, files, recordings, browser pages, and official material.

## Evidence Record

Record at least:

| Field | Meaning |
|---|---|
| Evidence ID | Stable ID such as `E001` |
| Time/order | Timestamp or relative sequence |
| Source | Screenshot, page, recording, file, official document |
| Location | File name, screenshot number, page, section, or URL label |
| Actor | Visible user, Agent, service, or unknown |
| Observable text | Exact short text, button, warning, or status |
| Observable object | Card, asset, form, preview, task, version, or result |
| Interpretation | What the evidence supports |
| Level | Confirmed, Inferred, Recommended, or Unknown |

Use short quotations. Do not reproduce large copyrighted passages.

## Chronology

Start with the earliest evidence. Separate capture order from actual product-event order when they differ. Do not assume screenshot file numbering is chronological; verify using visible content.

## Corroboration

For important conclusions, seek at least two independent visible signals when possible. Examples include an Agent message plus a new asset, a task status plus a preview, or a billing warning plus a balance change.

## Conflict Handling

Create a conflict record when two surfaces disagree. Include both claims, candidate causes, user impact, and the additional evidence needed to establish the authoritative source. Never silently reconcile the conflict.

## Action Evidence

Distinguish:

- announced plan;
- visible tool invocation;
- tool result;
- asset creation;
- context or state write;
- downstream consumption;
- user-visible completion.

An announced plan does not prove a tool call. Tool success does not prove state persistence. A success message does not prove quality.

## Sensitive Information

Exclude credentials, tokens, cookies, authorization headers, private identifiers, private messages unrelated to the task, and personal information not necessary for product analysis.
