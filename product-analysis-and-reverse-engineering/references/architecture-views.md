# Architecture Views

## Dynamic Layering

Use only applicable layers. A common maximum structure is:

1. Users and channels
2. Interaction and workbench
3. Product applications and business domains
4. Actors, Agents, orchestration, and workflow
5. Tools, integrations, and shared services
6. Models and capability routing
7. Global context and business data
8. Knowledge and reusable assets
9. Infrastructure, security, billing, observability, and governance

Remove Agent or model layers for conventional products. Replace media assets with the actual product outputs, such as records, orders, documents, reports, code, configurations, or messages.

## Panorama Requirements

The main panorama must answer:

- Where does the user's need enter?
- Who or what decides the next handler?
- Where do handlers obtain inputs?
- What tools or services are called?
- Where are outputs stored?
- How does the next step obtain earlier outputs?
- Where can the user confirm, modify, return, or interrupt?
- Where are failures, permission, safety, and billing blocked?
- What is the source of reusable knowledge?
- What establishes true completion?

Label arrows with `call`, `read`, `write`, `event`, `confirm`, `state update`, `asset reference`, or domain-equivalent terms.

Use solid lines for Confirmed, dashed lines for Inferred, dotted or blue lines for Recommended, red markers for observed conflicts, and muted styling for Unknown. Include a legend and evidence IDs.

Use `assets/panorama-architecture-template.html` as a starter, not as proof that every layer exists.

## Context Architecture

Consider these semantic domains and keep only relevant ones:

- UserContext
- WorkspaceContext
- ProjectContext
- DomainContext
- AssetContext
- WorkflowState
- PermissionContext
- BillingContext
- EvaluationContext
- IntegrationContext

These are analysis templates, not confirmed product field names. For each field, record producer, consumer, read/write behavior, version, update time, evidence level, and invalidated dependencies.

## Knowledge Architecture

Separate:

- professional knowledge;
- business rules;
- model capability knowledge;
- style or taxonomy knowledge;
- prompt or workflow templates;
- safety, legal, and billing rules;
- platform public assets;
- user private assets;
- project-temporary data;
- feedback and performance data.

Security, billing, and permission rules should be enforced by services or tools even if prompts mention them. Prompts alone are not an adequate control boundary.

## Technical Selection

For unobservable implementation, output four columns: required capability, possible options, recommended direction, and why the actual choice is unknown. Do not identify a vendor, language, database, queue, or cloud as current fact without direct evidence.

## Data And Runtime Views

At deep depth, create:

- entity table and Mermaid ER diagram;
- sequence diagram containing input, confirmation, context writes, asynchronous work, outputs, modification, failure, interruption, and handoff;
- As-Is table;
- To-Be table;
- prioritized risks;
- component-evidence traceability table.
