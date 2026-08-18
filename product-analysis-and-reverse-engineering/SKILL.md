---
name: product-analysis-and-reverse-engineering
description: Evidence-driven analysis and reverse engineering for any digital product, including websites, mobile apps, desktop software, SaaS, AI products, Agent systems, enterprise tools, developer platforms, and content products. Use when Codex needs to inspect screenshots, recordings, browser pages, chats, forms, assets, task states, errors, official materials, or project files to reconstruct user journeys, feature flows, actors or Agents, I/O contracts, tool and service calls, global context, data entities, functional-equivalent prompts, layered product architecture, As-Is/To-Be designs, risks, traceability, and packaged evidence. Supports one module or the complete workflow. Defaults to read-only evidence collection and never treats hidden implementation as confirmed fact.
---

# Product Analysis And Reverse Engineering

Build a reproducible product analysis from observable evidence. Separate what the product visibly does from inferred implementation and recommended design.

## Select The Scope

Determine the requested mode from the user's wording. Do not force later modules when the user requests only one.

- **Journey**: reconstruct user goals, actions, feedback, decisions, emotions, failures, and recovery paths.
- **Actors**: identify visible users, Agents, automated roles, services, and their I/O, tools, state, and handoffs.
- **Behavior**: produce a functional-equivalent behavior specification or System Prompt for one evidenced Agent or automation role.
- **Architecture**: reconstruct functional domains, layers, data, context, knowledge, models, infrastructure capabilities, risks, and As-Is/To-Be views.
- **Complete**: execute Evidence → Journey → Actors → Behavior when applicable → Architecture → Packaging.

Use quick depth for an initial review, standard depth for product work, and deep depth for contracts, state machines, architecture diagrams, and traceability. If unclear, use standard depth and state the assumption.

## Enforce Safety

- Treat browsers and live products as read-only unless the user explicitly authorizes an action.
- Do not send messages, submit forms, trigger generation, publish, buy, recharge, delete, or overwrite assets during evidence collection.
- Do not inspect or reveal passwords, cookies, tokens, authorization headers, or sensitive personal information.
- Prefer official product sources when external research is necessary. Do not use third-party speculation as architecture evidence.
- Do not claim access to hidden chain-of-thought, private prompts, backend code, databases, queues, cloud providers, or internal tool names without direct evidence.
- Treat an Agent's “completed” message as a statement, not proof of task completion. Verify page state, assets, tool results, and persisted status.

## Establish Evidence First

Before analysis, inventory the available screenshots, recordings, pages, files, chat records, assets, states, errors, billing indicators, and official documents. Number evidence consistently as `E001`, `E002`, and so on.

Classify every conclusion:

- **Confirmed**: directly visible or supported by official material or reproducible results.
- **Inferred**: supported by multiple confirmed facts but the implementation is not visible.
- **Recommended**: a proposed improvement, not a current product fact.
- **Unknown**: insufficient evidence.

Read `references/evidence-protocol.md` before collecting or citing evidence. Use `scripts/inventory_evidence.py` when many local artifacts are present.

## Execute The Requested Modules

Read `references/workflow-modules.md` for module-specific steps and stopping rules.

### Journey Module

Trace from the earliest evidence in chronological order. Check text, controls, forms, navigation, cards, generated objects, histories, statuses, previews, warnings, and recovery actions. Include normal, correction, failure, interruption, return, and alternative paths only when evidenced; otherwise mark them unknown.

### Actors Module

Identify only actors that appear in evidence. A product may have no Agents. For each actor, record trigger, input sources, observable judgments, functional tools, outputs, global-state reads and writes, completion conditions, exceptions, and downstream handoff.

### Behavior Module

Generate a functional-equivalent prompt only for an evidenced Agent or automation role. Reproduce observable workflow and boundaries, not hidden reasoning or proprietary wording. Read `references/agent-contract-prompt.md` before writing the contract or prompt.

### Architecture Module

Build dynamic layers from evidence instead of forcing a fixed AI architecture. Collapse Agent, model, media, billing, knowledge, or infrastructure layers when they do not apply. Read `references/architecture-views.md` before drawing the panorama, ER diagram, or sequence diagram.

## Reconcile State And Assets

Explicitly compare:

- conversational statements versus page or canvas state;
- visible objects versus asset-library records;
- tool success versus persisted global state;
- current state versus history or version records;
- upstream edits versus downstream invalidation;
- task completion versus required output existence;
- billing messages versus actual balance or ledger evidence.

Record conflicts without selecting one side as truth. Name the candidate sources of truth and mark the authoritative one unknown unless evidence establishes it.

## Produce Traceable Deliverables

Every major table row, contract rule, diagram node, architectural component, risk, and recommendation must link to evidence IDs or state that it is inferred/recommended/unknown.

Use `references/output-specification.md` to choose the minimum sufficient deliverables. For a complete deep analysis, produce:

1. Scope and evidence gaps
2. Evidence registry
3. User journey evidence table and three-lane journey
4. Actor or Agent inventory and I/O contracts
5. Tool and service catalog
6. Global context and data-field table
7. Producer-consumer data-flow table
8. Functional-equivalent behavior prompt when applicable
9. State machines and test cases
10. Functional domains and end-to-end flow
11. Layered panorama with As-Is, inferred, and To-Be distinctions
12. Data entities, ER diagram, and sequence diagram
13. Risks and component-evidence traceability
14. Unknowns and next verification questions
15. Organized evidence package

Use Mermaid for editable diagrams. Use HTML when a large layered architecture, evidence gallery, filters, or interactive inspection materially improves comprehension. The panorama must show data and state movement, not only component boxes.

## Organize And Package Evidence

Preserve originals. Create a separate organized directory with names such as:

`scene-order_item-order_original-id_observable-content.ext`

Do not rename based on assumptions. If later inspection disproves an old title, create a corrected copy and document the correction. Use:

- `scripts/build_image_index.py` for a local gallery;
- `scripts/validate_evidence_ids.py` for traceability checks;
- `scripts/package_deliverables.py` for a deterministic ZIP and manifest.

## Stop Conditions

Stop and ask for clarification only when the requested product or evidence set cannot be identified, access would require a prohibited action, or a high-impact interpretation has multiple equally plausible meanings. Otherwise continue with explicit assumptions.

When the user requests staged review, stop after the requested module and wait for confirmation. Never continue from Journey into Actors, Behavior, or Architecture without permission in a staged engagement.

## Resource Map

- `references/evidence-protocol.md`: evidence levels, chronology, citations, conflicts, and safety.
- `references/workflow-modules.md`: detailed Journey, Actors, Behavior, Architecture, and Packaging workflows.
- `references/agent-contract-prompt.md`: Agent contract, state machine, prompt reconstruction, and tests.
- `references/architecture-views.md`: panorama, data/context, models, infrastructure, ER, sequence, As-Is/To-Be.
- `references/output-specification.md`: output tables, diagrams, HTML requirements, and quality gates.
- `references/generalization-notes.md`: explicit changes made when generalizing the original product-specific process.
- `assets/panorama-architecture-template.html`: reusable layered architecture starter.
- `assets/evidence-registry-template.csv`: evidence registry columns.
- `assets/analysis-config-template.yaml`: optional engagement configuration.
