# AGENTS.md

This file provides guidance to AI coding agents (Claude Code, Codex, and others) when working with code in this repository.

## Principles that apply in every DCA repository

These hold for anyone working in any of the DCA repositories — human or agent — regardless of local tooling or memory.

1. **The samples exist to make the AI harness deterministic, not to ship features.** They are the experiment field
   for the harness: knowledge catalog, architecture rules, markers, plugins. Every architectural change in a sample
   answers three questions before it is done — does the catalog need a node (pitfall / decision / recipe /
   template)? could an ArchUnit / ArchUnitNET rule check it (same rule id in `dca-java` and `dca-dotnet`)? would one
   more *generic* marker in the building blocks make it checkable? Record the answer, "none" included, in the WP or
   ADR. Two agents building the same thing differently in the two samples is a determinism gap to close at the
   source (catalog, rule, marker), not with a code fix.
2. **Rules, markers and the catalog are general.** They are the foundation other production systems — any industry —
   build on with AI. Nothing in them may exist only because the e-commerce sample needs it: no shop vocabulary in
   rule or marker names or texts, no selection that only matches the sample's layout, no catalog node that presupposes
   a cart. The sample proves the general artifact; it is never its source of names or shapes.
3. **The core libraries are framework-neutral.** `dca-building-blocks` / `DomainCentric.BuildingBlocks` have zero
   dependencies; `dca-archunit` / `DomainCentric.ArchRules` reference frameworks only as configurable presets
   (`FrameworkAnnotations`, `FrameworkTypes`) and never on their class path. Framework-specific code goes into
   satellite artifacts (`dca-spring`, `dca-archunit-spring-modulith`) or into the sample. Spring is the default
   preset and the reference implementation's framework, not the vocabulary of the rules.
4. **Each reader artifact stands alone.** Guide, book and catalog bundle are independently readable; links never
   cross repository boundaries (the sample may cite the guide). `AGENTS.md` files are exempt — they carry the
   cross-project pointers and the sync duties.

## Repository Overview

This is a **documentation repository** focused on Domain-Centric Architecture - a synthesis of Domain-Driven Design (DDD), Hexagonal Architecture (Ports & Adapters), and Clean Architecture principles. It contains no source code, only comprehensive architectural guidance and implementation patterns.

**Purpose:** Reference documentation for teams implementing domain-centric architectures in Java/Spring Boot projects — and, through `language-mappings.md`, in C#/.NET. The guide is written in Java; every concept has a documented .NET spelling.

**Building blocks and rules are published libraries**, not guide-owned code: Java `dev.domaincentric:dca-building-blocks` + `dca-archunit` (Maven Central), .NET `DomainCentric.BuildingBlocks` + `DomainCentric.ArchRules(.Xunit)` (NuGet). The guide shows the dependency and describes the markers; it never presents them as files to write. Versions quoted in snippets (`0.1.2` / `0.3.0`) must follow releases of `../dca-java` and `../dca-dotnet`.

**Reference Implementation:** [dca-ecommerce-sample-java](https://github.com/domain-centric-development/dca-ecommerce-sample-java) - Complete working implementation demonstrating all patterns described in this documentation.

## ⚠️ This guide stands alone — no links out

A reader may have this repository and nothing else. Content may be used freely, **pointers may not**:

- ❌ no links to `dca-book/…`, no `https://github.com/domain-centric-development/dca-ecommerce-sample-java`, no source
  paths like `dca-ecommerce-sample-java/src/main/java/…`
- ✅ describe the pattern, show the code inline, name a class — as self-contained text
- ✅ links *within* this repository (`./spring-modulith.md`, `#section-anchors`)

Direction is one-way: the sample may cite this guide, this guide never cites the sample. The
knowledge bundle generated from these documents copies their text verbatim, so a link added here
reappears there — where it is even less resolvable.

**This file is exempt** (tooling context, not reader content).

## Documentation Structure

The repository contains interconnected markdown documents:

### Core Documentation
- **README.md** - Main architectural reference guide covering:
  - Four-layer architecture (Domain, Application, Adapter, Infrastructure)
  - Tactical DDD patterns (Entities, Value Objects, Aggregates, Domain Events)
  - Strategic DDD patterns (Bounded Contexts, Shared Kernel, Context Maps)
  - Java package structures and naming conventions
  - Comprehensive architectural rules and principles
  - Integration patterns and dependency flows

### Supplementary Guides
- **spring-modulith.md** - Practical implementation using Spring Modulith framework
- **archunit-governance.md** - Automated architecture testing with the `dca-archunit` rule library (and ArchUnitNET for .NET); plain-ArchUnit examples explain what each rule checks
- **language-mappings.md** - Java/Spring ↔ C#/.NET: packages, building blocks, ports, context declaration, solution layout, framework concepts, governance
- **clean-architecture-comparison.md** - Comparison with Clean Architecture and when to use each
- **deployment-patterns.md** - Self-Contained Systems, service decomposition, deployment strategies
- **team-topologies.md** - Organizational patterns and team structure alignment

### Templates
- **factory.md** - Delivering one story: the backlog contract, outcome events, the six stages with their
  hand-over files, the gates between them, and the two questions a run must hand to a human
- **adr-template.md** - Architecture Decision Record template

## Key Architectural Patterns

### Layer Structure
```
Infrastructure → Adapters → Application → Domain
                                          (zero dependencies)
```

### Use Case Organization (Application Layer)
Each use case is self-contained in its own folder:
```
application/
├── {usecasename}/                  # or {feature}/{usecasename}/ once the context groups its use cases
│   ├── *InputPort.java      # Interface: extends UseCase<INPUT, OUTPUT>
│   ├── *UseCase.java         # Implementation: implements *InputPort
│   ├── *Command.java         # Input (writes) or *Query.java (reads)
│   └── *Result.java          # Output
└── shared/
    └── *Repository.java      # Shared Output Ports (extends OutputPort)
```

### Bounded Context Pattern
```
com.company.project/
├── {boundedcontext}/
│   ├── domain/               # Pure business logic (zero dependencies)
│   ├── application/          # Use cases, ports, orchestration
│   ├── adapter/
│   │   ├── incoming/         # Controllers, event consumers
│   │   └── outgoing/         # Repository impls, API clients
│   └── infrastructure/       # Framework configuration (optional, per-context)
├── sharedkernel/             # Keep minimal - project-specific shared code only
│   ├── application/shared/   # Application-specific shared ports (IdentityProvider)
│   ├── domain/model/         # Universal value objects (Money, ProductId, UserId)
│   (markers, ports, TransactionBoundary come from dca-building-blocks; their Spring implementations
│    SpringDomainEventPublisher / SpringTransactionBoundary from dca-spring; Modulith verification
│    from dca-archunit-spring-modulith)
└── infrastructure/           # Global infrastructure (cross-cutting)
    ├── config/               # @Configuration classes
    ├── support/              # Framework support (processors, listeners)
    └── security/             # Security infrastructure
```

### Event Patterns
- **Domain Events** - Internal to bounded context (in `domain/event/`)
- **Integration Events** - Cross-context DTOs (in `events/`)
- **Event Mappers** - Convert domain events to integration events

## Naming Conventions

### Application Layer
- **Use Case Folders**: lowercase (e.g., `createorder`, `additemtocart`, `getproductbyid`)
- **Feature Folders** (optional group of use cases, `application/{feature}/{usecase}`): lowercase terms of the ubiquitous language (e.g., `cartrecovery`, `checkoutcompletion`); one context is flat or grouped, never both (`DCA-USE-014`); never technical buckets (`commands`, `queries`, `handlers`) or delivery mechanisms (`web`, `api`)
- **Input Ports**: `*InputPort extends UseCase<Command, Result>` (extends `UseCase`, not `InputPort`)
- **Output Ports**: Domain names (e.g., `OrderRepository`, `PaymentGateway`, `DomainEventPublisher`)
- **Use Cases**: `*UseCase implements *InputPort`
- **Commands**: `*Command` (writes)
- **Queries**: `*Query` (reads)
- **Results**: `*Result` — top level only; nested part records are named by content (`CartItemSummary`, `LineItemData`, `ProfileView`), never `*Result`. A result carries values (primitives, part records, value objects, read models), never an aggregate root or entity (`DCA-USE-015`); command results stay small, the view comes from a query
- **Assemblers**: `*Assembler` when result assembly outgrows a static `from(...)` factory or is shared by several use cases — never `*Mapper`/`*Converter`/`*Helper` in `application/`

### Adapter Layer
- **Incoming Adapters**:
  - Web: `*PageController` (e.g., `ProductPageController`)
  - API: `*Resource` (e.g., `ProductResource`, `OrderResource`)
  - Event: `*EventConsumer` (e.g., `ProductEventConsumer`, `CartEventConsumer`)
  - MCP: `*McpToolProvider` (e.g., `ProductCatalogMcpToolProvider`)
- **Outgoing Adapters**: Implementation-specific (e.g., `InMemoryProductRepository`, `OrderRepositoryAdapter`)

### Domain Layer
- **Domain Events**: Past tense (e.g., `OrderCreated`, `OrderCancelled`)
- **Integration Events**: Past tense + "Event" suffix (e.g., `OrderCreatedEvent`)

## Key Implementation Details from Reference

The [dca-ecommerce-sample-java](https://github.com/domain-centric-development/dca-ecommerce-sample-java) demonstrates these specific choices:

### Shared Kernel Structure
- **Building blocks come from the library** `dev.domaincentric.dca.buildingblocks` (dependency, not source):
  - `ddd.tactical` - DDD tactical patterns (Id, Entity, Value, AggregateRoot, BaseAggregateRoot, DomainEvent, IntegrationEvent, IntegrationEventType, DomainService, DomainGateway, Factory, Specification)
  - `ddd.strategic` (+ `.relationships`) - @BoundedContext, @SharedKernel, @OpenHostService, @Upstream, @ExternalUpstream, @Partnership
  - `hexagonal.port.in` - InputPort, UseCase; `hexagonal.port.out` - OutputPort, Repository, Store, DomainEventPublisher, IntegrationEventPublisher
  - `application` - TransactionBoundary (execution abstraction, not a port)
- **The project's `sharedkernel/` holds only**: `application/shared/` (application-specific shared ports, e.g. `IdentityProvider`), `domain/model/`, `domain/specification/`. The runtime adapters come from `dev.domaincentric:dca-spring` (`SpringDomainEventPublisher`, `SpringTransactionBoundary`, `InMemoryTransactionBoundary`, auto-configured); the Modulith verification test from `dev.domaincentric:dca-archunit-spring-modulith` (`DcaSpringModulithTest`). A Spring project pairs `dca-building-blocks` + `dca-spring` (production) with `dca-archunit` + `dca-archunit-spring-modulith` (test)
- **Port Interface Hierarchy**:
  - `InputPort` - Marker interface for all input ports (driving adapters)
  - `OutputPort` - Marker interface for all output ports (driven adapters)
  - `UseCase<INPUT, OUTPUT> extends InputPort` - Specific input port with Command/Query → Response pattern
  - `Repository<T, ID> extends OutputPort` - Base repository interface (Aggregate Roots only)
  - `Store extends OutputPort` - Persistence port for operational data without aggregate lifecycle
  - `DomainEventPublisher extends OutputPort` - Event publishing interface
- **Specification Pattern**: Fully implemented in `sharedkernel/domain/specification/` with Composite, And, Or, Not specifications
- **Common Value Objects**: `Money.java`, `Price.java`, `ProductId.java`, `UserId.java` in `sharedkernel/domain/model/`

### Domain Layer
- **Structure**: `model/`, `event/`, `service/`, `specification/` subdirectories
- **No separate**: `exception/` packages at domain level

### Adapter Layer
- **Incoming**: `web/`, `api/` (REST), `event/`, `mcp/` — sub-packages are the project's choice, no rule checks them. An in-process Open Host Service lives in the context's published `{context}/api/` package, not in the adapter tree
- **Outgoing**: `persistence/` (InMemory, JPA, JDBC), plus cross-context data adapters (e.g., `inventory/`, `pricing/`, `product/`)

### Technology Choices
- Java 25
- Spring Boot 4.x
- ArchUnit for architecture testing
- In-memory storage for simplicity (ConcurrentHashMap)
- Model Context Protocol (MCP) server for AI tooling

## Progressive Complexity Principle

**Critical:** The documentation shows ALL possible subdivisions for reference. In practice:

1. **Start simple** - Begin with 4 core layers without deep nesting
2. **Add when needed** - Introduce subdirectories only when >10 files in a directory
3. **Refactor later** - Easier to add structure than maintain unnecessary complexity early

The detailed package structures are **reference templates**, not prescriptions to use everything from day one.

## When Editing Documentation

### Making Changes
When updating this documentation, maintain:
- **Cross-references** - Keep document links accurate (use relative paths)
- **Consistency** - Ensure examples align across documents
- **Completeness** - Update all affected sections when changing patterns
- **Clarity** - Use examples to illustrate complex concepts

### Key Sections to Update Together
If changing architectural patterns, update these sections across documents:
1. Main README.md rules and package structures
2. Spring Modulith implementation examples
3. ArchUnit test examples
4. Deployment pattern implications
5. `language-mappings.md` — every new Java concept or rename needs its C# row

### Code Examples
All code examples should:
- Use consistent package naming: `com.company.project.{boundedcontext}`
- Follow established naming conventions (see above)
- Show complete context (package declarations, imports where relevant)
- Include comments explaining the pattern being demonstrated

### Cross-Document Dependencies
- Spring Modulith guide assumes knowledge from main README.md
- ArchUnit guide references rules from main README.md
- Deployment patterns extend concepts from main README.md and Team Topologies
- All guides reference back to core concepts in README.md

## Git Workflow

This is a documentation-focused repository:
- Changes should maintain consistency across all documents
- Use ADR template for significant architectural decisions
- Commit messages should reference which pattern/section is being updated

## Java Version

Examples assume Java 25 with:
- Records for Value Objects and DTOs
- Modern Java features (var, text blocks where appropriate)
- Spring Boot 4.x conventions

A domain term such as `PortfolioManager` is valid; the remaining technical suffix
restrictions still apply. Operation implementations are discovered by InputPort
assignability or the configured use-case suffix. Optional organisational segments
are configured with `withOperationContainers(...)` / `WithOperationContainers(...)`
and removed before measuring flat/grouped operation depth. Supporting subfolders do
not define operations. One context must still use one depth. A Repository or Store
used by one use case may live with it; `application/shared` is the reuse default.

WP-34 policy: use-case stereotypes are optional; configuration registration is equally valid.
NAM-002 is a non-failing Java diagnostic, not a wiring guarantee. Outgoing adapters may
reuse global/own infrastructure. Domain metadata rules classify configured roles on
types and members (including composed metadata), allow unclassified metadata, and assign
exclusive ownership to ADV-004/011/015/018 before ONI-003.

WP-35: USE-016 forbids direct/input-port/helper-mediated operation invocation except
explicit caller-side coordinator exclusions; CYC-005 checks operation slices even within
one feature. USE-017 maps the effective public surface to input ports (inherited/explicit
implementations valid, unrelated methods/properties forbidden). MAP-008 requires a
translation site for each declared upstream/channel; shared adapter packages are allowed.

WP-36 policy (2026-09-09): integration contracts use the configured events segment only; translators use adapter/outgoing/event. Events are optional with conservative USE-009 proof. USE-012 exists in both libraries; static boundary evidence is not runtime containment. Delivery is per consumer/effect with snapshot replay, bounded retry and explicit manual recovery; never claim local keys alone prevent external duplicates.

2026-09-09 WP-38: shared resolved-preset contract drives bootstrap/scaffold imports and wiring; publisher examples use the published API, event contracts use events/, business version remains valid. Scaffold Spring/none/.NET smoke and canonical/mirror catalog checks passed.
