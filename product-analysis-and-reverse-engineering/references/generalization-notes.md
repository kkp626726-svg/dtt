# Generalization Notes

This skill was generalized from a product-specific AI media analysis process. The following changes prevent overfitting.

| Product-specific assumption removed | General replacement |
|---|---|
| Script, character, scene, prop, storyboard, video | Business objects, domain entities, artifacts, and workflow nodes |
| Art director, writer, designer, storyboard Agent | Dynamically discovered users, Agents, automated roles, services, and reviewers |
| Specific video model, resolution, and duration | Model or engine capability, quality tier, input/output constraint, cost, and latency |
| Character identity and voice assets | Identity, brand, object consistency, stable references, and reusable private assets |
| Product-specific credits | Subscription, balance, quota, usage, authorization, reservation, settlement, and refund |
| Media-only asset store | Files, records, documents, orders, reports, code, media, and other outputs |
| Mandatory multi-Agent architecture | Optional actor/orchestration layer only when evidenced |
| Mandatory System Prompt reconstruction | Conditional functional-equivalent behavior specification |
| Fixed creative workflow | Evidence-derived stages, branches, state transitions, and business domains |

The following original strengths were preserved: chronological evidence review, UI plus asset inspection, completion verification, state-conflict recording, normal/correction/failure/interruption paths, I/O and tool contracts, producer-consumer flows, state machines, layered architecture, As-Is/To-Be separation, evidence traceability, testing, image organization, and packaging.
