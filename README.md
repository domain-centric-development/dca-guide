# Domain-Centric Architecture
*Synthesis of Domain-Driven Design, Hexagonal Architecture, and Clean Architecture*

## About this guide

This guide was written with AI assistance, in an iterative dialogue with the author since 2025: the
author set the direction, made the architectural decisions, reviewed the design and spot-checked the
code that accompanies it. The rules here are stated so that a build can enforce them — that is what
made the collaboration workable at this size.

Published under the MIT licence; see [LICENSE](LICENSE).

Contributions are accepted under the MIT licence, and the copyright holder may additionally publish
them under other licences (for example a documentation licence for prose).

## Table of Contents

- [Key Points](#key-points)
- [Related Documentation](#related-documentation)
- [ELEMENTS](#elements)
  - [Domain Layer (Enterprise Business Rules)](#domain-layer-enterprise-business-rules)
  - [Application Layer (Use Cases / Application Business Rules)](#application-layer-use-cases--application-business-rules)
  - [Adapter Layer (Interface Adapters)](#adapter-layer-interface-adapters)
  - [Infrastructure Layer (Frameworks & Drivers)](#infrastructure-layer-frameworks--drivers)
  - [Strategic Architecture](#strategic-architecture)
- [RULES](#rules)
  - [The Fundamental Dependency Rule](#the-fundamental-dependency-rule)
  - [Domain Layer Rules](#domain-layer-rules)
  - [Application Layer Rules](#application-layer-rules)
  - [Adapter Layer Rules](#adapter-layer-rules)
  - [Infrastructure Layer Rules](#infrastructure-layer-rules)
  - [Strategic Design Rules](#strategic-design-rules)
  - [Boundary Crossing Rules](#boundary-crossing-rules)
  - [Testing Rules](#testing-rules)
  - [Packaging Rules](#packaging-rules)
- [JAVA PACKAGE STRUCTURE](#java-package-structure)
  - [Standard Structure (Fully Elaborated)](#standard-structure-fully-elaborated)
  - [Structure Evolution Example: From Startup to Maturity](#structure-evolution-example-from-startup-to-maturity)
- [DEPENDENCY STRUCTURE](#dependency-structure)
  - [Layer Dependency Flow](#layer-dependency-flow)
  - [Request Flow with Dependency Inversion](#request-flow-with-dependency-inversion)
  - [Cross-Bounded Context Communication](#cross-bounded-context-communication)
- [INTEGRATION PATTERNS](#integration-patterns)
  - [Same Bounded Context](#same-bounded-context)
  - [Different Bounded Contexts](#different-bounded-contexts)
  - [Open Host Service Pattern](#open-host-service-pattern)
  - [Composite Adapter Pattern](#composite-adapter-pattern)
  - [Resolver Pattern](#resolver-pattern)
  - [Enriched Read Model Pattern](#enriched-read-model-pattern)
  - [Factory for Cross-Context Assembly](#factory-for-cross-context-assembly)
- [DEVIATIONS FROM THE LITERATURE](#deviations-from-the-literature)
- [GENERAL PRINCIPLES](#general-principles)
- [ADDITIONAL TOPICS](#additional-topics)
- [REFERENCES & FURTHER READING](#references--further-reading)

## Quick Navigation

### New to Domain-Centric Architecture?
| Step | Section | Description |
|------|---------|-------------|
| 1 | [Key Points](#key-points) | Core concepts and benefits |
| 2 | [Four Layers](#key-points) | Layer diagram and dependency flow |
| 3 | [Use Case Pattern](#use-case-pattern-with-input-ports) | Application layer organization |

### Ready to Implement?
- **[Java Package Structure](#java-package-structure)** - Copy-paste templates
- **[Spring Modulith](./spring-modulith.md)** - Framework implementation guide
- **[ArchUnit Governance](./archunit-governance.md)** - Enforce rules automatically

### Deep Dive Topics
| Topic | Guide | When to Read |
|-------|-------|--------------|
| Clean Architecture comparison | [clean-architecture-comparison.md](./clean-architecture-comparison.md) | Understand differences |
| Deployment strategies | [deployment-patterns.md](./deployment-patterns.md) | Planning production |
| Team organization | [team-topologies.md](./team-topologies.md) | Scaling teams |
| Architecture decisions | [adr-template.md](./adr-template.md) | Documenting choices |
| E2E Testing | [e2e-testing.md](./e2e-testing.md) | Browser-based testing |
| Quick lookup | [architecture-reference-guide.md](./architecture-reference-guide.md) | Already know DCA, need quick reference |

### Cross-Context Integration Patterns
| Pattern | Section | When to Use |
|---------|---------|-------------|
| Open Host Service | [OHS Pattern](#open-host-service-pattern) | Exposing context API to consumers |
| Composite Adapter | [Composite Adapter](#composite-adapter-pattern) | Aggregating data from multiple OHS |
| Resolver | [Resolver Pattern](#resolver-pattern) | Domain logic needing fresh external data |
| Enriched Read Model | [Enriched Read Model](#enriched-read-model-pattern) | Comparing persisted vs current data |
| Factory Assembly | [Factory for Cross-Context](#factory-for-cross-context-assembly) | Assembling complex domain objects |

---

## Key Points

**Domain-Centric Architecture** is an architectural approach that puts **domain logic at the center** and protects it from infrastructure concerns. It synthesizes proven patterns from Domain-Driven Design, Hexagonal Architecture, and Clean Architecture.

### Core Principles

1. **Dependencies Point Inward** - All code dependencies point toward the domain layer. The domain has zero outward dependencies.

2. **Domain is King** - Business logic lives in a rich domain model using tactical DDD patterns (Entities, Value Objects, Aggregates, Domain Services, Domain Events).

3. **Ports & Adapters** - Application layer defines interfaces (ports), infrastructure implements them (adapters). This inverts dependencies.

4. **Bounded Contexts** - Large systems are partitioned into bounded contexts, each with its own ubiquitous language and model.

5. **Event-Driven Integration** - Bounded contexts communicate asynchronously via domain events (internal) and integration events (external).

6. **Progressive Complexity** - Start simple with flat structures, add complexity only when needed based on actual pain points.

### Four Layers

```
Infrastructure  ─→  Frameworks, Database, Message Broker
     ↓ depends on
Adapters       ─→  Controllers, Repositories, API Clients
     ↓ depends on
Application    ─→  Use Cases, Input Ports, Output Ports
     ↓ depends on
Domain         ─→  Entities, Value Objects, Aggregates, Events
(ZERO DEPENDENCIES)
```

### Key Benefits

- ✅ **Business Logic Protection** - Domain isolated from technical concerns
- ✅ **Testability** - Domain and application layers testable without infrastructure
- ✅ **Flexibility** - Easy to swap frameworks, databases, or external services
- ✅ **Team Scaling** - Bounded contexts enable independent teams
- ✅ **Evolution** - Clear path from monolith to microservices
- ✅ **Maintainability** - Clear separation of concerns and explicit boundaries

### When to Use

**Ideal for:**
- Complex business domains with rich logic
- Systems that will evolve and scale over time
- Multiple teams working on different parts
- Event-driven or microservices architectures

**Consider alternatives for:**
- Simple CRUD applications
- Very small systems with minimal business logic
- Short-lived projects or prototypes

### Quick Start

1. **Identify bounded contexts** - Partition your domain by language and model boundaries
2. **Start with 4 layers** - domain, application, adapter, infrastructure (keep it flat initially)
3. **Apply tactical DDD** - Use Entities, Value Objects, Aggregates in domain layer
4. **Define ports** - Input Ports for use cases, Output Ports for infrastructure needs
5. **Implement adapters** - Web controllers, persistence, messaging as adapters
6. **Add complexity progressively** - Subdivide packages only when you feel pain

For detailed patterns and rules, continue reading below. For specific topics, see [Related Documentation](#related-documentation).

## Related Documentation

This document describes the core Domain-Centric Architecture patterns and principles. For specific topics, see:

> **📝 Note on Examples:** This documentation uses **generic examples** (Order, Customer, Inventory contexts) for educational clarity. The actual reference implementation uses **Product Catalog**, **Shopping Cart**, and **Portal** contexts. Both approaches are valid - use examples that match your domain. Package names shown as `com.company.project.*` are placeholders; the reference implementation uses `de.sample.aiarchitecture.*`

### Supplementary Documentation
- **[Clean Architecture Comparison](./clean-architecture-comparison.md)** - Differences from Clean Architecture and when to use each
- **[Deployment Patterns](./deployment-patterns.md)** - Self-Contained Systems, service decomposition, and deployment strategies
- **[Spring Modulith Implementation](./spring-modulith.md)** - Practical implementation using Spring Modulith framework
- **[Team Topologies Integration](./team-topologies.md)** - Organizational patterns and team structure alignment
- **[ArchUnit Governance](./archunit-governance.md)** - Automated architecture testing and enforcement
- **[Domain Services with Data Dependencies](./domain-services-with-data-dependencies.md)** - DomainGateway and Strategy/Callback patterns for Domain Services that need external data

## ELEMENTS

### Domain Layer (Enterprise Business Rules)

#### Tactical Building Blocks
- **Entity** - Object with identity and lifecycle
- **Value Object** - Immutable object without identity
- **Aggregate** - Transactional consistency boundary
- **Aggregate Root** - Entry point entity for aggregate access
- **Domain Service** - Stateless operation on domain objects
- **Domain Event** - Immutable record of domain occurrence (internal to bounded context)
- **Specification** - Encapsulated business rule
- **Factory** - Complex object creation logic

#### Strategic Building Blocks
- **Bounded Context** - Explicit boundary for unified model
- **Ubiquitous Language** - Shared vocabulary in code and conversation
- **Subdomain** - Logical domain partition (Core, Supporting, Generic)

### Application Layer (Use Cases / Application Business Rules)

#### Use Case Pattern with Input Ports

The application layer organizes business operations using a structured **Use Case pattern** where each use case is isolated in its own folder with dedicated Input/Output models:

**Pattern Structure:**
- **Use Case** - Implements business operation (orchestrates domain objects)
- **Input Port** - Interface defining use case contract (`extends UseCase<INPUT, OUTPUT>`)
- **Command/Query** - Input model (Command for writes, Query for reads)
- **Result** - Output model (standardized return type)
- **Output Port** - Interface for infrastructure needs (repositories, gateways, publishers)

**Organization:**
```
application/
├── {usecasename}/          # e.g., createorder, findorder, cancelorder (lowercase)
│   ├── *InputPort.java     # Interface: public interface CreateOrderInputPort extends UseCase<CreateOrderCommand, CreateOrderResult>
│   ├── *UseCase.java       # Implementation: @Service public class CreateOrderUseCase implements CreateOrderInputPort
│   ├── *Command.java       # Input model (for write operations)
│   │   OR *Query.java      # Input model (for read operations)
│   └── *Result.java      # Output model
└── shared/                 # Shared output ports
    └── *Repository.java    # Repository interfaces, DomainEventPublisher, etc.
```

> **Note:** Use case folder names are **lowercase** (e.g., `createorder`, `additemtocart`, `getproductbyid`), while the files inside use **PascalCase** (e.g., `CreateOrderInputPort.java`, `CreateOrderUseCase.java`).

**Benefits:**
- ✅ **Single Responsibility** - One use case class per business operation
- ✅ **Explicit Contracts** - Clear input/output via InputPort interface
- ✅ **Self-Contained** - All related files grouped together
- ✅ **Interface Segregation** - Adapters inject only the specific ports they need
- ✅ **Better Hexagonal Alignment** - Input Ports define the application's external API

**Example:**
```java
// Input Port Interface (defines contract)
public interface CreateOrderInputPort extends UseCase<CreateOrderCommand, CreateOrderResult> {
    CreateOrderResult execute(CreateOrderCommand command);
}

// Use Case Implementation (orchestrates domain)
@Service
public class CreateOrderUseCase implements CreateOrderInputPort {

    private final OrderRepository orderRepository;  // Output Port
    private final DomainEventPublisher eventPublisher;  // Output Port

    @Override
    public CreateOrderResult execute(CreateOrderCommand command) {
        // 1. Convert DTO to domain
        Order order = Order.create(command.customerId(), command.items());

        // 2. Business logic (in domain)
        order.validate();

        // 3. Persist via output port
        orderRepository.save(order);

        // 4. Publish events via output port
        eventPublisher.publish(order.getDomainEvents());

        // 5. Convert domain to DTO
        return CreateOrderResult.from(order);
    }
}

// Input Model (Command)
public record CreateOrderCommand(CustomerId customerId, List<OrderItemDto> items) {}

// Output Model (Result)
public record CreateOrderResult(OrderId orderId, Money total, OrderStatus status) {
    public static CreateOrderResult from(Order order) {
        return new CreateOrderResult(order.getId(), order.getTotal(), order.getStatus());
    }
}
```

#### Shaping the Result

The rules above fix the *edges* of a result: its name and place (`*Result`, in the use-case package), its
immutability, and that response DTOs and view models belong to the adapter. The *middle* — what a result may
carry, who assembles it and how big it should be — follows seven sentences.

1. **A result carries values, never identities.** Allowed: primitives, nested records, value objects
   (shared kernel included — `Money`, `ProductId`), enriched domain models and read models (`Value` records
   from `domain/model` and `domain/readmodel`). Forbidden: anything assignable to `AggregateRoot` or `Entity`.
   Identity and behaviour stay behind the port; the adapter gets an answer, not a handle on the model.
   Enforced transitively — through nested records, part records and generic arguments (`List<T>`,
   `Optional<T>`, `Map<K,V>`) — by `DCA-USE-015`.
2. **Command results are small.** A command returns ids, status or outcome, and what the caller needs for its
   next step — not the view. The view comes from a query use case or a read model. Returning a whole read model
   from a command is the documented exception (it saves a remote caller a round trip), and then it returns the
   read-model `Value`, never a parade of primitives.
3. **Part records are named by content; `*Result` is the top level only.** `CartItemSummary`, `LineItemData`,
   `ProfileView` — nested in the result they belong to. A part shared by several use cases moves to
   `application/shared`; there is no feature-level `shared`.
4. **The application layer assembles the result — in order of effort.** (a) A static factory `from(...)` on the
   result, parts as records with their own `from`. (b) A projection that needs several ports is orchestration
   and lives in the use-case body. (c) When it grows or several use cases need it, a dedicated **`*Assembler`**
   in the use-case folder or `application/shared`. Never `*Mapper`, `*Converter` (`DCA-NAM-008`), never
   `Helper`.
5. **Large aggregates hand out a snapshot, not a getter parade.** A `Value` record in `domain/readmodel`, built
   by `Snapshot.from(aggregate)` (`DCA-TAC-022`). The snapshot *is* the result field; the use case does not
   flatten it a second time.
6. **The active-domain restriction is asymmetric.** An incoming adapter may read the domain values and read
   models a `Result` delivers and format them for HTTP, HTML, MCP or another transport. It must not inject or
   invoke a domain service (`DCA-HEX-012`), construct aggregates, entities or domain values, or execute domain
   behaviour: it translates external input into a `Command`/`Query` and calls an input port. Outgoing adapters
   are different: a repository or persistence adapter necessarily maps, constructs and reconstitutes domain
   objects while implementing an output port. That mapping may restore state; it must not make new business
   decisions.
7. **One model for every adapter.** Vernon's Domain Payload Object (handing whole aggregates to the UI) and the
   Mediator/double-dispatch rendering are not taken, also for in-process UIs — see
   [Deviations from the literature](#deviations-from-the-literature).

**Snapshot as the result field:**
```java
// domain/readmodel — a Value built from the aggregate, no identity of its own
public record CheckoutCartSnapshot(
        CheckoutSessionId sessionId, CheckoutStep step, CheckoutSessionStatus status,
        List<LineItemSnapshot> lineItems, Money subtotal, @Nullable CheckoutTotals totals,
        @Nullable BuyerInfo buyerInfo, @Nullable DeliveryAddress deliveryAddress)
        implements Value {
    public static CheckoutCartSnapshot from(CheckoutSession session) { /* copies state, no behaviour */ }
}

// application — the query result wraps the snapshot; nothing is flattened again
public record GetCheckoutSessionResult(boolean found, @Nullable CheckoutCartSnapshot session) {
    public static GetCheckoutSessionResult found(CheckoutCartSnapshot session) {
        return new GetCheckoutSessionResult(true, session);
    }
}
```

**Command vs. query sizing:**
```java
// Command: what the caller needs next — the next page asks the query
public record SubmitDeliveryResult(String sessionId, String currentStep, String status) {
    public static SubmitDeliveryResult from(CheckoutSession session) {
        return new SubmitDeliveryResult(
                session.id().value().toString(), session.currentStep().name(), session.status().name());
    }
}

// Query: the read model the page renders
public record GetCheckoutSessionResult(boolean found, @Nullable CheckoutCartSnapshot session) { ... }
```

What an incoming adapter may do with a delivered value or read model: call its **own, parameterless queries**
— `lineTotal()`, `priceDifference()`, `isValidForCheckout()` on an enriched cart are derivations of the
value's own state, and a read model that could not answer them would be no read model. What it must not do:
obtain or invoke a domain service, construct aggregates, entities or domain values, combine values from
several sources into a new business fact, or trigger behaviour with side effects. When a page needs a fact the
read model does not know — the tax contained in a subtotal, whether a checkout step may be opened — that fact
is computed in the use case and delivered in the result. The result is too poor when an adapter has to import
a domain service to render: a page controller that has to decide whether a checkout step may be opened asks
the query for that decision (the use case invokes the domain service and delivers a `StepAccess` value) and
maps the answer to a route.

#### Application Layer Components

- **Use Case / Application Service** - Orchestrates business operations
- **Input Port** - Interface defining use case entry point
- **Output Port** - Interface for infrastructure needs
- **Command** - Request to change state
- **Query** - Request to retrieve data
- **Input Data / DTO** - Data structure for use case input
- **Output Data / DTO** - Data structure for use case output
- **Repository Interface** - Aggregate persistence abstraction
- **Domain Event Publisher Interface** - Event dispatching abstraction

### Adapter Layer (Interface Adapters)

#### Input Adapters (Driving/Primary)
- **Controller** - Handles HTTP/framework requests
- **Event Consumer** - Handles external events/messages
- **CLI Handler** - Command-line interface
- **GraphQL Resolver** - GraphQL query/mutation handler
- **Scheduled Job** - Time-triggered operations

#### Output Adapters (Driven/Secondary)
- **Repository Adapter** - Persistence implementation
- **Event Publisher Adapter** - Event publishing implementation
- **External API Client** - Third-party service integration
- **Presenter** - Formats use case output for external world
- **Gateway** - Database/external system translation

#### Adapter Components
- **Mapper** - Translation between layers
- **DTO** - Data transfer across boundaries
- **View Model** - Presentation data structure
- **Database Entity** - ORM/persistence model
- **Integration Event** - DTO representing domain event for cross-context communication
- **Event Mapper** - Converts domain events to/from integration events
- **Anti-Corruption Layer (ACL)** - Protects domain from external event formats

### Infrastructure Layer (Frameworks & Drivers)

- **Web Framework** - Spring, Quarkus, etc.
- **Persistence Framework** - JPA, Hibernate, etc.
- **Message Broker** - Kafka, RabbitMQ, etc.
- **Configuration** - Dependency injection, framework setup
- **Cross-Cutting Concerns** - Logging, monitoring, security

### Strategic Architecture

- **Context Map** - Relationships between bounded contexts
- **Anti-Corruption Layer** - Protection from external models
- **Shared Kernel** - Shared code between contexts (see detailed structure below)
- **Open Host Service** - Published integration API
- **Published Language** - Well-documented shared protocol

#### Shared Kernel Pattern (Strategic DDD)

The **Shared Kernel** contains code shared across ALL bounded contexts within your application. It should be kept minimal and requires coordination between teams.

**Structure:**
```
sharedkernel/
├── marker/                        # All architectural markers (consolidated)
│   ├── tactical/                  # DDD Tactical Patterns
│   │   ├── Id.java                # Base interface for identifiers
│   │   ├── Entity.java            # Interface for entities
│   │   ├── Value.java             # Marker for value objects
│   │   ├── AggregateRoot.java     # Interface for aggregate roots
│   │   ├── BaseAggregateRoot.java # Abstract base implementation
│   │   ├── DomainEvent.java       # Interface for domain events
│   │   ├── IntegrationEvent.java  # Interface for integration events
│   │   ├── DomainService.java     # Marker for domain services
│   │   ├── Factory.java           # Marker for factories
│   │   └── Specification.java     # Interface for specifications
│   ├── strategic/                 # DDD Strategic Patterns
│   │   ├── SharedKernel.java      # Annotation for shared kernel packages
│   │   ├── BoundedContext.java    # Annotation for bounded context packages
│   │   ├── OpenHostService.java   # Marker for Open Host Service adapters
│   │   ├── Upstream.java          # Declares an upstream context (ACL or Conformist, via API or events)
│   │   ├── ExternalUpstream.java  # Declares an external system as upstream/downstream
│   │   └── Partnership.java       # Declares a mutual Partnership with another context
│   └── port/                      # Hexagonal Architecture Ports
│       ├── in/                    # Input Ports (Driving/Primary)
│       │   ├── InputPort.java     # Marker for all input ports
│       │   └── UseCase.java       # UseCase<INPUT, OUTPUT> extends InputPort
│       └── out/                   # Output Ports (Driven/Secondary)
│           ├── OutputPort.java    # Marker for all output ports
│           ├── Repository.java    # Base repository: extends OutputPort (for Aggregate Roots)
│           ├── Store.java         # Base store: extends OutputPort (for operational data)
│           ├── DomainEventPublisher.java  # Event publishing: extends OutputPort
│           └── IntegrationEventPublisher.java  # Cross-context event publishing: extends OutputPort
│
├── application/
│   └── shared/                    # Application-specific ports shared by several contexts
│       └── IdentityProvider.java  # e.g. current caller's identity — NOT a generic marker
│
└── domain/
    ├── model/                     # Universal Value Objects
    │   ├── Money.java             # Universal money type
    │   ├── Price.java             # Common price value object
    │   ├── ProductId.java         # Shared product identifier
    │   └── UserId.java            # Shared user identifier
    └── specification/             # Specification Pattern Implementation
        ├── CompositeSpecification.java
        ├── AndSpecification.java
        ├── OrSpecification.java
        ├── NotSpecification.java
        └── SpecificationVisitor.java
```

**Port Interface Hierarchy:**
```
Input Ports (marker/port/in/)        Output Ports (marker/port/out/)
┌────────────────────────────┐       ┌─────────────────────────────────┐
│ InputPort (marker)         │       │ OutputPort (marker)             │
│   └── UseCase<INPUT,OUTPUT>│       │   ├── Repository<T, ID>         │
│         └── *InputPort     │       │   ├── Store                     │
└────────────────────────────┘       │   ├── DomainEventPublisher      │
                                     │   └── IntegrationEventPublisher │
                                     └─────────────────────────────────┘
```

Only *generic* contracts live under `marker/`: interfaces that assign an architectural role and
carry no business methods. A port with domain-specific methods — even one that several bounded
contexts share — is an **application-specific shared port** and belongs in
`sharedkernel/application/shared/`, mirroring the `application/shared/` convention each bounded
context uses for its own ports. The catalog and the bootstrap only pick up `marker/`, so this
separation keeps project concepts out of the reusable building-block set.

**Example — an application-specific shared port (Identity):**
```java
// In sharedkernel/application/shared/IdentityProvider.java — project-specific, not a marker
public interface IdentityProvider extends OutputPort {
    Identity getCurrentIdentity();

    // Nested interface - contract for identity
    interface Identity {
        UserId userId();
        IdentityType type();
        Optional<String> email();
        Set<String> roles();
        default boolean isAnonymous() { return type().isAnonymous(); }
        default boolean isRegistered() { return type().isRegistered(); }
    }

    // Nested interface - extensible identity type
    interface IdentityType {
        String name();
        boolean isAnonymous();
        boolean isRegistered();
    }
}

// In the owning context's adapter/outgoing/security/ - PROJECT-SPECIFIC implementations
public enum JwtIdentityType implements IdentityProvider.IdentityType {
    ANONYMOUS, REGISTERED, SERVICE_ACCOUNT;  // Extensible per project
}

public record JwtIdentity(...) implements IdentityProvider.Identity { ... }
```

**Why the identity port is not a building block.** Its contract returns `UserId` — a value object of
*this* project's shared kernel — and its `IdentityType` encodes *this* shop's two-cookie design (anonymous
visitor vs. registered customer). A reusable marker must carry neither, and a marker only earns its place
once a rule selects on it; every rule about identity that exists today ("the domain never reads the
caller") works over the layer packages alone. So the port is written per project, following the cut below.

**How to cut the identity port:**

1. **One output port, in the shared kernel's `application/shared/`** (or in a single context's
   `application/shared/` if only that context needs it). It extends `OutputPort`, returns an `Identity`
   made of the project's own types, and knows nothing about tokens, cookies or headers.
2. **The implementation is an outgoing adapter of the context that owns authentication** — it reads the
   security context the framework populated (`adapter/outgoing/security/`). Incoming adapters and use cases
   see only the port.
3. **The authentication filter enriches, it never gates.** It attaches an identity or nothing and lets the
   request proceed; every request has an identity (an anonymous visitor is one). Blanket
   "must be authenticated" rules at the token boundary are not where authorization lives.
4. **Ownership goes into the command.** A use case that acts on somebody's resource takes the caller as a
   field — `GetCartByIdQuery(cartId, customerId)`, `StartCheckoutCommand(cartId, customerId)` — and asks the
   repository a *scoped* question (`findByIdForCustomer(cartId, customerId)`) instead of loading by id and
   comparing afterwards. The incoming adapter resolves the caller through the port and fills the field; the
   use case never calls the identity port to find out on whose behalf it runs.
5. **A claims-only gate may stay in the adapter.** "Does this token carry the staff role?" reads nothing but
   the caller's claims and is a property of the *exposure*, so the REST resource or page controller may
   check it and refuse. Anything that needs the resource — is this cart theirs — is a property of the
   *operation* and belongs to the use case, through the command field of step 4.
6. **The domain never sees the caller.** No `User` parameter on an aggregate method, no role check in a
   value object; `cart.checkout()` protects *its* invariants (not empty, not already completed), the use
   case has already answered *who may*.
7. **A use case without a caller says so.** An event consumer completing a cart after a confirmed checkout
   acts on nobody's behalf; leave its command unscoped and document why, or the next reader "fixes" it.

Refusals are decided in the use case and *rendered* in the adapter: whether a stranger's cart answers
`403` or `404` is a protocol choice (a `403` confirms the id exists), and the REST resource makes it.

- **InputPort** - Marker interface for all entry points to the application (called by driving adapters)
- **OutputPort** - Marker interface for all dependencies the application needs (implemented by driven adapters)
- **UseCase<INPUT, OUTPUT>** - Specific input port type with Command/Query → Result pattern
- **Repository<T, ID>** - Collection-like output port for Aggregate Roots (one-per-aggregate)
- **Store** - Output port for operational data without aggregate lifecycle (Value Objects, Events, technical state)

### Repository vs. Store

DCA distinguishes two kinds of persistence-shaped output ports. Both `extend OutputPort`, but their **business semantics differ**:

**Repository** — collection-like interface for Aggregate Roots (Evans, Vernon).

- Exists **only** for Aggregate Roots
- Identity + lifecycle semantics: `findById()`, `save()`, `delete()`
- Extends the `Repository<T, ID>` marker
- One Repository per Aggregate Root

```java
public interface CustomerAccountRepository extends Repository<CustomerAccount, CustomerAccountId> {
    Optional<CustomerAccount> findById(CustomerAccountId id);
    void save(CustomerAccount account);
}
```

**Store** — records or queries operational data without an own aggregate lifecycle.

- Exists for **Value Objects, Events, or technical state** without identity-based access
- Append-/record-style semantics: `record()`, `count()`, `exists()`, `reset()` — no `findById()` / `save()`
- Extends the `Store` marker (`Store extends OutputPort`) — never the `Repository` marker
- Implementation lives in `adapter.outgoing/`

```java
public interface LoginProtectionStore extends Store {
    void record(LoginAttempt attempt);
    int  countRecentFailures(BaseStore baseStore, Email email, Duration window);
    boolean isLoginBlocked(BaseStore baseStore, Email email);
}
```

**Decision matrix:**

| Criterion | Repository | Store |
|---|---|---|
| Stored object | Aggregate Root | Value Object / operational data |
| Identity & lifecycle | yes — `findById`, `save`, `delete` | no — `record`, `count`, `exists` |
| Marker | `extends Repository<T, ID>` | `extends Store` |
| Examples | `CustomerAccountRepository`, `OrderRepository` | `LoginProtectionStore`, `AuditLogStore`, `EventStore` |

**Rules of thumb:**

1. Need `findById()`? → Repository (the object has identity).
2. Need `record()` or `count()`? → Store (the object is recorded, not managed).
3. In doubt: if the stored object is a `Value` or a record, it's almost always a Store.

> **Note on EventStore (Event Sourcing):** The `EventStore` from Event Sourcing is a *specialization* of Store — one specifically for Domain Events that supports aggregate reconstruction. The general `Store` is the broader pattern for any operational data.

> **Note on cross-cutting `*Response` classes:** Generic Response/error classes (`ErrorResponse`, base `Response`, `SimpleResponse`) belong in the **shared kernel's adapter-incoming package**, not in any individual bounded context. ArchUnit rules that check `*Response` placement must include the shared kernel adapter — discover its package dynamically via `@SharedKernel` rather than hardcoding the name (`shared` / `common` / `core` / `sharedkernel`).

**Why the distinction matters:**
The naming is part of the Ubiquitous Language. A reader should know from the interface name alone whether they're dealing with a managed aggregate (Repository) or recorded data (Store) — without opening the implementation. Both are technically Output Ports in hexagonal architecture, but the business role is fundamentally different.

**What Belongs in Shared Kernel:**

✅ **Include:**
- **Universal value objects** used by multiple contexts (Money, Price, shared IDs)
- **DDD marker interfaces** that define your architectural patterns (Entity, AggregateRoot, Value, etc.)
- **Base port interfaces** (`UseCase<INPUT, OUTPUT>`, `Repository`, `DomainEventPublisher`)
- **Specification pattern implementations** (CompositeSpecification, And/Or/Not specifications)
- **Cross-cutting domain concepts** that have identical meaning everywhere

❌ **Exclude:**
- **Aggregates** - These belong to specific bounded contexts
- **Business logic** - Should live in context-specific domain layers
- **Context-specific value objects** - Only truly universal ones belong here
- **Use case implementations** - Belong to specific contexts
- **Adapters** - Never shared between contexts

**Guidelines:**
- Keep the Shared Kernel **as small as possible**
- Changes to Shared Kernel affect all contexts - coordinate carefully
- Only include code that has **identical meaning** across all contexts
- When in doubt, duplicate rather than share
- Use versioning if Shared Kernel becomes a separate module

**Decision Tree: Should This Go in Shared Kernel?**
```
START: I have code that might be shared
   │
   ├─ Is it used by 2+ bounded contexts?
   │     NO → Keep in single context
   │     YES ↓
   │
   ├─ Does it have IDENTICAL meaning everywhere?
   │     NO → Duplicate instead (different models OK)
   │     YES ↓
   │
   ├─ Is it a marker interface or base type?
   │     YES → Add to sharedkernel/marker/tactical/
   │     NO ↓
   │
   ├─ Is it a universal value object (Money, Address)?
   │     YES → Add to sharedkernel/domain/model/
   │     NO ↓
   │
   └─ Is it a base port interface (UseCase, Repository)?
         YES → Add to sharedkernel/marker/port/
         NO → Probably shouldn't be in Shared Kernel
```

**Example - Marker Interface:**
```java
// sharedkernel/marker/tactical/Id.java
public interface Id {
    // Marker interface - typed identifiers, no type parameter of their own
}

// sharedkernel/marker/tactical/Entity.java
public interface Entity<T extends Entity<T, ID>, ID extends Id> {
    ID id();
    default boolean sameIdentityAs(T other) {
        return other != null && id().equals(other.id());
    }
}

// sharedkernel/marker/tactical/AggregateRoot.java
public interface AggregateRoot<T extends AggregateRoot<T, ID>, ID extends Id>
        extends Entity<T, ID> {
    // Marker interface - identifies aggregate roots for all contexts
}
```

**Example - Shared Value Object:**
```java
// sharedkernel/domain/model/Money.java
public record Money(BigDecimal amount, Currency currency) implements Value {

    public Money {
        Objects.requireNonNull(amount);
        Objects.requireNonNull(currency);
        if (amount.scale() > 2) {
            throw new IllegalArgumentException("Money cannot have more than 2 decimal places");
        }
    }

    public Money add(Money other) {
        if (!this.currency.equals(other.currency)) {
            throw new IllegalArgumentException("Cannot add money with different currencies");
        }
        return new Money(this.amount.add(other.amount), this.currency);
    }
}
```

**Example - Port Interface Hierarchy:**
```java
// sharedkernel/marker/port/in/InputPort.java
public interface InputPort {
    // Marker interface for all input ports (hexagonal architecture concept)
}

// sharedkernel/marker/port/out/OutputPort.java
public interface OutputPort {
    // Marker interface for all output ports (hexagonal architecture concept)
}

// sharedkernel/marker/port/in/UseCase.java
public interface UseCase<INPUT, OUTPUT> extends InputPort {
    OUTPUT execute(INPUT input);
}

// sharedkernel/marker/port/out/Repository.java
public interface Repository<T extends AggregateRoot<T, ID>, ID extends Id> extends OutputPort {
    Optional<T> findById(ID id);
    T save(T aggregate);
    void deleteById(ID id);
}

// Usage in a bounded context:
// order/application/createorder/CreateOrderInputPort.java
public interface CreateOrderInputPort extends UseCase<CreateOrderCommand, CreateOrderResult> {
    // Inherits execute() method with specific types
}

// order/application/shared/OrderRepository.java
public interface OrderRepository extends Repository<Order, OrderId> {
    // Inherits base methods, add domain-specific queries
    Optional<Order> findByCustomerId(CustomerId customerId);
}
```

## RULES

### THE FUNDAMENTAL DEPENDENCY RULE

- **All dependencies point inward toward domain**
- Domain has zero outward dependencies
- Domain knows nothing about outer layers
- Application depends only on domain
- Adapters depend on application and domain (through interfaces)
- Infrastructure depends on adapters
- Outer layers know inner layers, never reverse
- Inner layers define interfaces, outer layers implement them

### DOMAIN LAYER RULES

#### Entity Rules
- Entity has unique identity
- Identity remains constant throughout lifecycle
- Entities compared by identity only
- Entity can change attributes while keeping identity
- Entity equality based on ID only
- Entity validates its own invariants

#### Value Object Rules
- Value Objects are immutable
- Value Objects have no identity
- Value Objects compared by all attributes
- Replace entire Value Object instead of modifying
- Value Objects can be shared freely
- Value Objects validate themselves
- Side-effect-free methods only

#### Aggregate Rules
- Access external objects only through Aggregate Root
- Aggregate Root is an Entity
- Aggregate defines transactional boundary
- Aggregate maintains invariants at all times
- Small aggregates preferred
- Reference other aggregates by ID only, not object reference
- One transaction modifies one aggregate only
- Eventual consistency between aggregates
- Delete aggregate deletes all contained entities
- Never inject repositories or services into aggregates — pass dependencies as method parameters
- Two factories, two purposes: `create(...)` enforces creation invariants and registers the creation event; `reconstitute(...)` rebuilds a stored aggregate from persisted state and registers nothing. Persistence adapters use only the latter — rebuilding through `create` publishes a phantom creation on the next save
- Domain events leave the aggregate through one call, `DomainEventPublisher.publishAndClearEvents(aggregate)`, after the save: dispatch everything, clear only when every listener returned. Iterating `domainEvents()` and calling `publish` per event is not the sanctioned form
- Protect against lost updates with optimistic concurrency: version field on the root, incremented per state change; persistence rejects saves with a stale expected version

#### Domain Service Rules
- Domain Service is stateless
- Use when operation doesn't belong to Entity or Value Object
- Use when operation involves multiple domain objects
- Domain Service operates in domain language
- Domain Service is part of domain layer
- No dependencies on application or outer layers

#### Domain Event Rules (Internal to Bounded Context)
- Domain Events are immutable
- Domain Events use past tense naming (e.g., OrderCreated, not CreateOrder)
- Domain Events represent something that happened in the domain
- Domain Events are defined in `{context}/domain/event/` package
- Domain Events enable eventual consistency within bounded context
- Domain Events emitted by aggregates during state changes
- Domain Events published by use cases via DomainEventPublisher (Output Port)
- Domain Events handled asynchronously when crossing aggregates
- Domain Events must not contain behavior, only data
- Domain Events belong to the domain layer, not adapters

#### Integration Event Rules (Cross-Bounded Context)
- Integration Events are DTOs representing domain events for external systems
- Integration Events defined in `{context}/adapter/outgoing/messaging/event/` package
- Integration Events use past tense + "Event" suffix (e.g., OrderCreatedEvent)
- Integration Events must be serializable (JSON, Protobuf, Avro)
- Integration Events include: event ID, timestamp, correlation ID; the schema version and
  stable logical name are a **class property** via `@IntegrationEventType(name, version)` —
  never a `version` data field on the instance
- Integration Events created by Event Mappers in outgoing adapters
- Domain events never cross bounded context boundaries directly
- Event Mapper converts domain event → integration event DTO
- Integration Events must be backward compatible (add fields, don't remove)
- Integration Events contain only primitives and value types, no domain objects

**Integration Event Payload Styles** — choose per event type:

| Style | Payload | When |
|---|---|---|
| **Notification** | IDs only — consumer queries back via Open Host Service | Sensitive or large data; query-back doubles as authorization gate |
| **Event-Carried State Transfer** | Relevant state snapshot | Consumer maintains a local cache/replica, avoids chatty query-backs |
| **Domain Fact** | The business fact and its data | Consumer reacts to what happened, no replica needed |

Invariant in all styles: flat, serializable, versioned — never aggregate references.

**Decision Tree: Domain Event or Integration Event?**
```
START: Something happened in the domain
   │
   ├─ Does it need to cross bounded context boundaries?
   │     NO → Domain Event only
   │     │     - Define in: {context}/domain/event/
   │     │     - Name: past tense (e.g., OrderCreated)
   │     │     - Contains: domain objects OK
   │     │
   │     YES ↓
   │
   ├─ Create Domain Event FIRST (always)
   │     - Define in: {context}/domain/event/
   │     - Published via DomainEventPublisher
   │     ↓
   │
   └─ Create Integration Event (for external consumers)
         - Define in: {context}/adapter/outgoing/messaging/event/
         - Name: past tense + "Event" suffix (e.g., OrderCreatedEvent)
         - Contains: only primitives and serializable types
         - Created by: Event Mapper in adapter layer
         - Published to: message broker (Kafka, RabbitMQ)
```

#### Event Publishing Rules
- Use cases call DomainEventPublisher (Output Port) to publish events
- DomainEventPublisher interface in marker/port/out
- DomainEventPublisherAdapter in adapter/outgoing/messaging
- Adapter converts domain events to integration events via mapper
- Message broker (Kafka, RabbitMQ) used for async delivery
- One topic per bounded context or per event type
- Order inside the use case: `save`, then `publishAndClearEvents` — same transaction, never before the save
- The publisher dispatches first and clears the aggregate afterwards; the clear is the acknowledgement that every listener saw the event. A throwing listener fails the use case and leaves the events on the aggregate
- Integration events go through a **transactional outbox**: the publication is written *inside* the aggregate's transaction (Spring Modulith's event publication registry, an outbox table, an in-process stand-in), released to the dispatcher after commit, discarded on rollback. Registering only after commit leaves a crash window between commit and outbox entry
- Delivery is asynchronous and at least once: failures are retried with backoff, permanently failing publications stay visible (`Failed`), outstanding ones are replayed on restart

#### Event Consumption Rules
- Event Consumer in adapter/incoming/messaging receives integration events
- Anti-Corruption Layer (ACL) protects domain from external formats
- ACL in adapter/incoming/messaging/acl converts events to domain commands
- Event Consumer calls Input Port, never domain directly
- Consuming bounded context maintains its own model
- Eventual consistency between bounded contexts via events
- Assume at-least-once delivery: consumers deduplicate (event ID or naturally idempotent operations)
- Consumers tolerate out-of-order arrival (check event version/timestamp, never assume sequence)
- Permanently failing events go to a dead-letter queue — never dropped silently
- An event handler modifies at most one aggregate, in its own transaction

#### General Domain Rules
- Domain contains business logic only
- Domain is framework-agnostic
- Domain is persistence-agnostic
- Domain is UI-agnostic
- Domain uses pure language features
- Domain can be tested without infrastructure
- Domain reflects business, not database structure
- Ubiquitous Language used throughout domain code

### APPLICATION LAYER RULES

#### Use Case / Application Service Rules
- One use case class per business operation
- Use case implements Input Port interface
- Use case orchestrates domain objects
- Use case is thin, delegates to domain
- Use case calls Output Ports for infrastructure
- Use case handles transaction boundaries
- Use case transforms DTOs to domain objects
- Use case transforms domain objects to DTOs
- Use case assembles the `*Result` (static factory, use-case body or `*Assembler`); a result carries values, never aggregate roots or entities (`DCA-USE-015`)
- Command results are small (ids, status, what the caller needs next); the view comes from a query or read model
- A use case that saves an aggregate publishes and clears its domain events after the save (`publishAndClearEvents`, `DCA-USE-009`) — whether the action raised any or not
- A query use case carries no transaction and no publisher; it loads and assembles
- A bulk operation (delete all, archive everything before a date) is a method on the port — the port is freely extensible beyond `findById`/`save`/`deleteById` — that the use case calls without loading or saving a single aggregate: no domain event, no publisher, a declarative transaction. If other contexts must learn about it, one integration event describes the bulk fact
- A number derived from a list (the count of open items on a list page) is a field of the list query's result, not a use case of its own and not a read model
- No business logic in use cases
- Use case tested with port mocks
- Use case knows nothing about presentation
- Use case knows nothing about persistence details

#### Authorization Rules
- Authorization ("may *this caller* do this?") is decided in the use case; the caller arrives as a field of the Command/Query, resolved by the incoming adapter through the identity output port
- A use case that acts on a caller's resource asks the repository a scoped question (`findByIdForCustomer`), never an open lookup followed by a comparison
- A claims-only gate (a role on the token) may sit in the incoming adapter — it reads nothing but the caller
- The domain never knows the caller: no `User` parameter on aggregate methods, no role checks in domain code — invariants only
- The identity port is a project-specific output port in `application/shared/` (context or shared kernel), implemented in the authenticating context's outgoing adapter; the authentication filter enriches every request and gates none
- A use case with no caller (event consumers, scheduled work) stays unscoped and documents it

#### Input Port Rules
- Input Port defines use case interface
- Input Port represents business operation
- One Input Port per use case
- Input Port uses domain language
- Input Port accepts Input Data/DTOs
- Input Port has no framework dependencies
- Input Port belongs to application layer

#### Output Port Rules
- Output Port defines infrastructure need
- Output Port uses domain language and types
- Output Port implemented by adapters
- Output Port has no framework dependencies
- Output Port belongs to application layer
- Repository interfaces are Output Ports
- Event Publisher interfaces are Output Ports

#### Repository Interface Rules
- Repository interface in application layer
- Repository returns Aggregate Roots only
- One repository interface per Aggregate Root
- Repository provides collection-like interface
- Repository uses domain types, not DTOs
- Repository manages object lifecycle
- Repository implementation in adapter layer
- **Repository reads return copies, never the stored instance** — see below

##### A repository hands out copies

This is where the collection metaphor stops. A `Map`-backed adapter that returns `store.get(id)`
hands out the instance it holds, so a caller who mutates an aggregate has already changed the store
and `save()` is decoration. Against a database the same code loses the change silently, because
loading a row constructs a new object — so the in-memory adapter has been hiding a missing `save()`
in exactly the tests meant to catch it.

Every adapter therefore maps back through the aggregate's `reconstitute` factory: the JDBC/JPA one
because a row leaves it no choice, the in-memory one on purpose (copy on write *and* on read).
Registered-but-unpublished domain events are not carried over — a stored aggregate is a fact, and
re-reading it must not replay what the writer already published.

Keep the adapters honest with a **contract test on the port** that every implementation runs,
including the assertion that an unsaved mutation is invisible to the next reader.

#### Transaction Rules
- One transaction per use case execution
- Transaction boundaries managed by use case
- Transaction spans single aggregate modification
- Cross-aggregate changes use eventual consistency

### ADAPTER LAYER RULES

#### Input Adapter Rules
- Input Adapter calls Input Port
- Controller extracts data from HTTP request
- Controller creates Input Data/DTO
- Controller delegates to use case
- Controller is thin, no business logic
- Controller handles framework-specific concerns
- One controller method per use case (preferred)
- A state-changing use case is reached only by an unsafe HTTP method (`POST`, `PUT`, `DELETE`) — never by `GET`; links do not create sessions, orders or carts. Prefetching, crawlers and cross-site navigation would otherwise trigger the change
- Every browser form that changes state carries a CSRF token; cookie-authenticated endpoints without one are a defect. Token-authenticated APIs (`Authorization: Bearer`) are exempt only if they neither read nor issue cookies

#### Output Adapter Rules
- Output Adapter implements Output Port
- Repository Adapter implements Repository Interface
- Adapter translates between domain and external world
- Adapter contains framework-specific code
- Adapter handles data transformation
- Adapter protects domain from external changes
- Multiple adapters can implement same port
- Adapters are replaceable

#### Presenter Rules
- Presenter implements Output Port (in some variants)
- Presenter formats use case output
- Presenter creates View Models
- Presenter knows about UI needs
- Presenter has no business logic
- Use case doesn't know about presenter implementation

#### Mapper Rules
- Mapper translates between domain and persistence
- Mapper translates between domain and DTOs
- Mapper in adapter layer, not domain
- One mapper per aggregate (typical)

#### General Adapter Rules
- Adapters depend on ports (interfaces)
- Adapters never depend on other adapters
- Adapters can be tested with integration tests
- Adapters handle technical concerns
- Domain types don't leak to external world
- External types don't leak to domain

### INFRASTRUCTURE LAYER RULES

- Framework code stays in infrastructure
- Infrastructure is a detail
- Database is a detail
- Web framework is a detail
- Infrastructure decisions can be delayed
- Infrastructure can be swapped
- No business logic in infrastructure

### STRATEGIC DESIGN RULES

#### Bounded Context Rules
- Each Bounded Context has own Ubiquitous Language
- Each Bounded Context has own model
- Same term can mean different things in different contexts
- Context boundaries are explicit
- Models not unified across contexts
- Teams own Bounded Contexts
- One Bounded Context per deployment unit (preferred)

> **Note:** For deployment variations including multi-service bounded contexts, see [Deployment Patterns](./deployment-patterns.md)

#### Context Integration Rules
- Make all context relationships explicit — declare them in code on each context's `package-info.java`
  (`@Upstream`, `@ExternalUpstream`, `@Partnership`, see [Declaring Context Relationships in Code](#declaring-context-relationships-in-code))
- Use Context Map to document relationships and each context's subdomain type (Core/Supporting/Generic);
  generate it from the declarations so it cannot drift
- Protect domain with Anti-Corruption Layer
- Shared Kernel requires team coordination
- Keep Shared Kernel small
- Upstream contexts influence downstream
- Define integration patterns clearly

#### Subdomain Rules
- Focus most effort on Core Domain
- Core Domain provides competitive advantage
- Supporting Subdomains support core
- Generic Subdomains can be outsourced
- Align Bounded Contexts with Subdomains

#### Pattern Selection per Subdomain

DCA's full pattern set is not mandatory for every bounded context. Apply tactical DDD where complexity warrants it — never to trivial domains. Choose per context, by subdomain type:

| Subdomain | Business Logic Pattern | Architecture | Notes |
|---|---|---|---|
| **Core** | Rich domain model (aggregates, domain events) | Ports & Adapters, optionally CQRS / event sourcing | Full DCA rule set applies |
| **Supporting** | Transaction script or active record | Simple layering | CRUD is not an anti-pattern here |
| **Generic** | Buy / adopt (SaaS, open source) | Integrate via ACL | Don't build what you can buy |

Rules:
- Each bounded context declares its chosen pattern style in an ADR
- Architecture tests activate the matching rule subset per context: domain-model contexts get the full tactical rules; transaction-script contexts only the structural baseline (layer dependencies, no cycles, context isolation) — see [ArchUnit Governance](./archunit-governance.md)
- Consistency within a context matters; uniformity across contexts does not
- Reclassify when a subdomain's importance changes (supporting → core happens) and upgrade the pattern with it — this is Progressive Complexity at the strategic level

### BOUNDARY CROSSING RULES

- Data crosses boundaries as simple DTOs
- DTOs have no business logic
- DTOs have no dependencies
- Never pass entities across boundaries
- Never pass value objects across boundaries (convert to DTOs)
- Domain events can cross boundaries (as DTOs)
- Dependencies point inward at boundaries
- Control flow can go any direction
- Use Dependency Inversion when control flow goes outward

### TESTING RULES

- Domain tested in isolation (unit tests)
- Domain tests require no infrastructure
- Domain tests require no frameworks
- Use cases tested with port mocks
- Use cases tested in isolation
- Adapters tested with integration tests
- Full system tested with acceptance tests
- Test pyramid: many unit, fewer integration, few E2E

### ERROR HANDLING RULES

#### Exception Layer Placement
- **Domain Exceptions** - Business rule violations (e.g., `InsufficientStockException`, `InvalidOrderStateException`)
- **Application Exceptions** - Use case failures (e.g., `OrderNotFoundException`, `CustomerNotActiveException`)
- **Adapter Exceptions** - Translated to appropriate responses (HTTP status codes, error DTOs)

#### Exception Flow Pattern
```
Domain Exception (invariant violation)
    ↓ propagates to
Application Layer (can catch, wrap, or let propagate)
    ↓ propagates to
Adapter Layer (translates to external format)
    ↓ returns
HTTP 400/404/422 + Error DTO
```

#### Error Handling Best Practices
- Domain exceptions should be **domain language** (not technical)
- Use cases catch domain exceptions only when they need to **transform behavior**
- Adapters (controllers) handle **all exceptions** and convert to external format
- Never expose stack traces or internal details to external consumers
- Use **exception mappers** or `@ExceptionHandler` in adapters for consistent responses

#### Example - Exception Handling Across Layers
```java
// Domain exception (business rule violation)
public class InsufficientStockException extends RuntimeException {
    private final ProductId productId;
    private final int requested;
    private final int available;
    // Constructor with domain details
}

// Application exception (use case failure)
public class ProductNotFoundException extends RuntimeException {
    private final ProductId productId;
    public ProductNotFoundException(ProductId productId) {
        super("Product not found: " + productId.value());
        this.productId = productId;
    }
}

// Adapter - Exception handler (translates to HTTP response)
@RestControllerAdvice
public class OrderExceptionHandler {
    @ExceptionHandler(ProductNotFoundException.class)
    @ResponseStatus(HttpStatus.NOT_FOUND)
    public ErrorResponse handle(ProductNotFoundException ex) {
        return new ErrorResponse("PRODUCT_NOT_FOUND", ex.getMessage());
    }

    @ExceptionHandler(InsufficientStockException.class)
    @ResponseStatus(HttpStatus.UNPROCESSABLE_ENTITY)
    public ErrorResponse handle(InsufficientStockException ex) {
        return new ErrorResponse("INSUFFICIENT_STOCK", "Not enough stock available");
    }
}
```

### TRANSACTION RULES

#### Transaction Boundary Placement
- **Transaction boundaries live at the use case level** (application layer)
- One transaction = one aggregate modification (single aggregate rule)
- Use `@Transactional` (or equivalent) on use case implementations **whose work is entirely local** — repositories, stores, event publishers
- **Never call a remote-capable port inside the transaction.** A port that may leave the process (another context's API, a payment provider, a mail gateway) called inside `@Transactional` holds the database connection for the remote round trip; under load the pool runs dry, and a rollback cannot undo the remote effect
- Use cases that need such a port **draw the boundary by hand** with `TransactionBoundary` (an application-layer execution abstraction — not a port; implemented in infrastructure): remote reads first, then `transactionBoundary.inTransaction(load, mutate, save, publish)`; remote effects after the commit, as a reaction to an integration event
- Domain layer is transaction-agnostic

#### Cross-Aggregate Consistency
- **Within same bounded context**: eventual consistency via domain events
- **Across bounded contexts**: eventual consistency via integration events
- Never modify multiple aggregates in one transaction

#### Transaction Pattern Example
```java
@Service
public class CreateOrderUseCase implements CreateOrderInputPort {

    private final OrderRepository orderRepository;
    private final DomainEventPublisher eventPublisher;

    @Transactional  // Transaction boundary at use case level
    @Override
    public CreateOrderResult execute(CreateOrderCommand command) {
        // 1. Domain logic (within transaction)
        Order order = Order.create(command.customerId(), command.items());

        // 2. Persist single aggregate
        orderRepository.save(order);

        // 3. Publish events (after persistence, before commit)
        eventPublisher.publishAndClearEvents(order);

        return CreateOrderResult.from(order);
    }
}
```

#### Eventual Consistency Example
```
Order Aggregate modified → OrderCreated event published
    ↓ (async, separate transaction)
Inventory Aggregate modified → StockReserved event published
    ↓ (async, separate transaction)
Customer Aggregate notified → Loyalty points updated
```

#### Remote Port Example — Boundary Drawn by Hand
```java
@Service                                   // no class-level @Transactional
public class AddItemToCartUseCase implements AddItemToCartInputPort {

    private final ShoppingCartRepository carts;
    private final ArticleDataPort articles;          // reaches another context — remote-capable
    private final DomainEventPublisher eventPublisher;
    private final TransactionBoundary transactionBoundary;             // application-layer abstraction (not a port) → TransactionTemplate

    @Override
    public AddItemToCartResult execute(AddItemToCartCommand command) {
        // 1. Remote-capable read — outside the transaction
        CartArticle article = articles.getArticleData(command.productId()).orElseThrow();

        // 2. Short transaction: load, mutate, save, publish
        return transactionBoundary.inTransaction(() -> {
            ShoppingCart cart = carts.findById(command.cartId()).orElseThrow();
            cart.addItem(command.productId(), command.quantity(), Price.of(article.currentPrice()));
            carts.save(cart);
            eventPublisher.publishAndClearEvents(cart);
            return AddItemToCartResult.from(cart);
        });
    }
}
```

Two rules of the DCA catalog make this a compile-time fact: `DCA-USE-012` — a use case that publishes domain events has a transaction boundary — declarative `@Transactional` **or** an explicit `TransactionBoundary.inTransaction`; `DCA-USE-013` — a `@Transactional` use case calls no output port other than `Repository`, `Store`, `DomainEventPublisher`, `IntegrationEventPublisher` (`TransactionBoundary` is not a port; a use case that needs remote reads draws the explicit boundary instead of the annotation). In .NET the boundary is a decorator around `IUseCase<,>` or `ITransactionBoundary.InTransactionAsync`; `DCA-NET-006` keeps EF Core, `System.Data` and `System.Transactions` out of the application layer.

**Note:** For complex multi-aggregate workflows, consider the **Saga pattern** (orchestration or choreography). This is an advanced topic beyond the scope of basic domain-centric architecture.

### PACKAGING RULES

- Package by bounded context, then by layer; inside the application layer by use case — optionally grouped into
  features (see [Grouping use cases into features](#grouping-use-cases-into-features))
- Layer separation enforced by module structure
- Domain module has zero external dependencies
- Application module depends only on domain
- Adapter modules depend on application
- Infrastructure module depends on adapters
- Modules can be independently deployed

> **Note:** For Spring Modulith module organization, see [Spring Modulith Implementation](./spring-modulith.md)

## JAVA PACKAGE STRUCTURE

### Standard Structure (Fully Elaborated)

#### High-Level Structure Overview

```
com.company.project/
│
├── {boundedcontext}/
│   │
│   ├── domain/              [CORE LAYER]
│   │                        Pure business logic with zero dependencies
│   │                        Entities, Value Objects, Aggregates, Domain Services, Domain Events
│   │
│   ├── application/         [USE CASE LAYER]
│   │                        Orchestrates domain objects and defines boundaries
│   │                        Input Ports, Output Ports, Use Cases, Commands, Queries, DTOs
│   │
│   ├── adapter/             [INFRASTRUCTURE INTERFACE LAYER]
│   │                        Connects application to external world
│   │   ├── incoming/        Controllers, Event Consumers, CLI (call Input Ports)
│   │   └── outgoing/        Repository Impl, API Clients, Publishers (implement Output Ports)
│   │
│   └── infrastructure/      [FRAMEWORKS & DRIVERS LAYER]
│                            Framework-specific configuration and cross-cutting concerns
│                            Spring, JPA, Kafka config, Logging, Security
│
├── sharedkernel/            [SHARED ACROSS ALL CONTEXTS - Keep Minimal]
│   ├── marker/              DDD markers (tactical/, strategic/) and port interfaces (port/)
│   ├── domain/model/        Universal value objects (Money, Address, etc.)
│   └── adapter/outgoing/    Shared adapters (e.g., SpringDomainEventPublisher)
│
└── infrastructure/          [GLOBAL INFRASTRUCTURE]
                             Application-wide configuration and setup
```

#### Progressive Complexity Principle

This structure shows **ALL possible subdivisions** for a fully-featured bounded context with significant complexity. However, you should **START SIMPLE** and add structure incrementally:

**🎯 Start Minimal**
- Begin with the 4 core layers (domain, application, adapter, infrastructure) without deep nesting
- Place files directly in layer directories until organization becomes difficult
- A simple bounded context may only need 5-10 files total

**📈 Add When Needed**
- Introduce subdirectories only when you have enough files that organization provides clear benefit
- Typically: >10 files in a directory suggests subdividing
- Let pain points guide structure, not theoretical perfection

**🔄 Refactor Later**
- It's easier to add structure later than to maintain unnecessary complexity early
- Moving files into new subdirectories is a simple refactoring
- IDEs handle this automatically with refactoring tools

**The structure below is a REFERENCE showing all options, not a prescription to use everything from day one.**

#### Grouping use cases into features

DCA has three scales below the system: the **bounded context**, the **layer**, and the **use case**. When the
application layer of one context grows — a dozen use-case packages in one flat list — a fourth, optional scale
fills the gap between layer and use case: the **feature**.

```text
system -> bounded context -> layer -> feature -> use case
```

A *feature* is a domain-named group of related use cases inside one bounded context. It is a navigation and
cohesion boundary and nothing more: not a layer, not a module, not an aggregate owner, not a deployment unit.

The two canonical forms of the application layer — and the only two — are:

```text
application/{usecase}/              # flat: a small context
application/{feature}/{usecase}/    # grouped: cohesive clusters have emerged
```

A context that has grown into features:

```text
checkout/
├── domain/                              # concepts owned by the whole context — never mirrored by feature
│   ├── model/
│   ├── service/
│   ├── event/
│   └── readmodel/
├── application/
│   ├── session/                         # feature
│   │   ├── startcheckout/               # use case — input port, implementation, command/query, result
│   │   ├── getactivecheckoutsession/
│   │   ├── getcheckoutsession/
│   │   └── getconfirmedcheckoutsession/
│   ├── checkoutcompletion/              # feature — a term of the ubiquitous language, not UI jargon
│   │   ├── submitbuyerinfo/
│   │   ├── getshippingoptions/
│   │   ├── submitdelivery/
│   │   ├── getpaymentproviders/
│   │   ├── submitpayment/
│   │   └── confirmcheckout/
│   ├── cartsync/
│   │   └── synccheckoutwithcart/
│   └── shared/                          # context-wide output ports only
├── adapter/
│   ├── incoming/
│   │   ├── web/{session,checkoutcompletion}/   # protocol first, feature below it
│   │   └── event/cartsync/
│   └── outgoing/{persistence,payment,cart,product,event}/   # by technology or partner, as before
├── api/
├── events/
└── infrastructure/
```

**The eight rules of the feature scale:**

1. **Flat first.** A small context keeps `application/{usecase}/`. Add the feature level when cohesive clusters
   have emerged and the flat list has become hard to navigate. The "about ten entries" guidance above is a prompt
   to *evaluate* grouping, not a numeric law.
2. **Feature names come from the ubiquitous language**, lowercase: `cartrecovery`, `checkoutcompletion`,
   `session`. Never technical buckets (`commands`, `queries`, `handlers`, `services`, `utils`) and never delivery
   mechanisms (`web`, `api`).
3. **The use case stays the smallest application unit.** Its input port, implementation, command or query,
   result and any use-case-specific output port stay together in the use-case package.
4. **`application/shared` stays context-wide.** Repository and Store interfaces continue to live there
   (`DCA-TAC-014`, `DCA-TAC-019`); there is no `application/{feature}/shared`. A port used by one use case stays
   with that use case, a port used by several belongs in `application/shared`.
5. **The domain is organised by concept, not mirrored by feature.** Aggregates and value objects belong to the
   bounded context and may serve several features — a feature owns no aggregate.
6. **Incoming adapters may mirror features *below* their protocol:** `adapter/incoming/web/{feature}`,
   `adapter/incoming/event/{feature}`. The protocol segment stays first, so the adapter vocabulary and its rules
   (`DCA-NAM-011`) keep working. Outgoing adapters stay organised by technology or partner.
7. **One form per context.** Within one context, use cases are either all flat or all grouped once a migration is
   complete; a lasting mixture leaves the reader guessing whether a direct child of `application/` is a feature,
   a use case or a leftover. A short-lived mixed state during one refactoring is fine — move one whole context
   atomically. `DCA-USE-014` checks this; `DCA-CYC-005` keeps the feature (or, in a flat context, use-case)
   packages free of cycles — a one-directional dependency between two features is allowed.
8. **A vertical slice is not a feature.** `{context}/{feature}/{domain,application,adapter}` puts a layer segment
   below the feature, so the structural module discovery rightly treats every slice as a module of its own and the
   isolation rules demand communication through `api`/`events`. If that boundary is what you want, model it as a
   module and ask whether it is a separate bounded context. Do not weaken the isolation rules to let a shared
   aggregate span such slices.

A feature relieves *package pressure*. It is not evidence against splitting a context: when language, model or
team ownership have diverged, split the context — grouping use cases does not resolve that.

---

#### Detailed Structure with All Subdivisions

```
com.company.project
│
├── order (bounded context)
│   ├── domain
│   │   ├── model
│   │   │   ├── Order.java (Aggregate Root)
│   │   │   ├── OrderId.java (Value Object)
│   │   │   ├── OrderLine.java (Entity)
│   │   │   └── OrderStatus.java (Value Object/Enum)
│   │   ├── service
│   │   │   └── PricingService.java (Domain Service)
│   │   └── event
│   │       ├── OrderCreated.java (Domain Event)
│   │       └── OrderCancelled.java (Domain Event)
│   │
│   ├── application (use-case focused - each use case self-contained)
│   │   ├── createorder (use case folder - lowercase, contains ALL related files)
│   │   │   ├── CreateOrderInputPort.java
│   │   │   │   interface CreateOrderInputPort extends UseCase<CreateOrderCommand, CreateOrderResult> {}
│   │   │   ├── CreateOrderUseCase.java
│   │   │   │   @Service class CreateOrderUseCase implements CreateOrderInputPort { }
│   │   │   ├── CreateOrderCommand.java
│   │   │   └── CreateOrderResult.java
│   │   │
│   │   ├── findorder (use case folder - lowercase, contains ALL related files)
│   │   │   ├── FindOrderInputPort.java
│   │   │   │   interface FindOrderInputPort extends UseCase<OrderQuery, OrderResult> {}
│   │   │   ├── FindOrderUseCase.java
│   │   │   │   @Service class FindOrderUseCase implements FindOrderInputPort { }
│   │   │   ├── OrderQuery.java
│   │   │   └── OrderResult.java
│   │   │
│   │   ├── cancelorder (use case folder - lowercase, contains ALL related files)
│   │   │   ├── CancelOrderInputPort.java
│   │   │   │   interface CancelOrderInputPort extends UseCase<CancelOrderCommand, CancelOrderResult> {}
│   │   │   ├── CancelOrderUseCase.java
│   │   │   │   @Service class CancelOrderUseCase implements CancelOrderInputPort { }
│   │   │   ├── CancelOrderCommand.java
│   │   │   └── CancelOrderResult.java
│   │   │
│   │   ├── updateorder (use case folder - lowercase, contains ALL related files)
│   │   │   ├── UpdateOrderInputPort.java
│   │   │   │   interface UpdateOrderInputPort extends UseCase<UpdateOrderCommand, UpdateOrderResult> {}
│   │   │   ├── UpdateOrderUseCase.java
│   │   │   │   @Service class UpdateOrderUseCase implements UpdateOrderInputPort { }
│   │   │   ├── UpdateOrderCommand.java
│   │   │   └── UpdateOrderResult.java
│   │   │
│   │   └── shared (SHARED OUTPUT PORTS - infrastructure dependencies)
│   │       ├── OrderRepository.java (Output Port)
│   │       ├── PaymentGateway.java (Output Port)
│   │       ├── InventoryService.java (Output Port)
│   │       └── DomainEventPublisher.java (Output Port)
│   │
│   └── adapter
│       ├── incoming (INCOMING ADAPTERS - call input ports)
│       │   ├── web
│       │   │   ├── OrderPageController.java
│       │   │   ├── dto
│       │   │   │   ├── CreateOrderWebRequest.java
│       │   │   │   └── OrderWebResponse.java
│       │   │   └── mapper
│       │   │       └── OrderWebMapper.java
│       │   ├── api
│       │   │   └── OrderRestController.java
│       │   ├── event
│       │   │   ├── OrderEventConsumer.java
│       │   │   ├── dto
│       │   │   │   └── ExternalOrderEvent.java
│       │   │   └── acl
│       │   │       └── ExternalEventToCommandMapper.java
│       │   └── mcp
│       │       └── OrderMcpToolProvider.java (Model Context Protocol)
│       │
│       └── outgoing (OUTGOING ADAPTERS - implement output ports)
│           ├── persistence
│           │   ├── InMemoryOrderRepository.java (implements OrderRepository)
│           │   └── SampleDataInitializer.java (Optional: for demo data)
│           │   # Note: For production, add JPA/JDBC adapters as needed
│           ├── payment
│           │   ├── PaymentGatewayAdapter.java (implements PaymentGateway)
│           │   └── dto
│           │       └── PaymentRequest.java
│           ├── inventory
│           │   └── InventoryServiceAdapter.java (implements InventoryService)
│           └── messaging
│               ├── DomainEventPublisherAdapter.java (implements DomainEventPublisher)
│               ├── event
│               │   ├── OrderCreatedEvent.java (Integration Event DTO)
│               │   └── OrderCancelledEvent.java (Integration Event DTO)
│               └── mapper
│                   └── OrderEventMapper.java
│
├── customer (bounded context)
│   ├── domain
│   ├── application
│   │   ├── registercustomer
│   │   │   ├── RegisterCustomerInputPort.java
│   │   │   ├── RegisterCustomerUseCase.java
│   │   │   ├── RegisterCustomerCommand.java
│   │   │   └── RegisterCustomerResult.java
│   │   ├── updatecustomer
│   │   │   ├── UpdateCustomerInputPort.java
│   │   │   ├── UpdateCustomerUseCase.java
│   │   │   ├── UpdateCustomerCommand.java
│   │   │   └── UpdateCustomerResult.java
│   │   ├── findcustomer
│   │   │   ├── FindCustomerInputPort.java
│   │   │   ├── FindCustomerUseCase.java
│   │   │   ├── CustomerQuery.java
│   │   │   └── CustomerResult.java
│   │   └── shared
│   │       ├── CustomerRepository.java
│   │       └── EmailService.java
│   └── adapter
│       ├── incoming
│       └── outgoing
│
├── inventory (bounded context)
│   ├── domain
│   ├── application
│   │   ├── reservestock
│   │   │   ├── ReserveStockInputPort.java
│   │   │   ├── ReserveStockUseCase.java
│   │   │   ├── ReserveStockCommand.java
│   │   │   └── ReserveStockResult.java
│   │   ├── releasestock
│   │   │   ├── ReleaseStockInputPort.java
│   │   │   ├── ReleaseStockUseCase.java
│   │   │   ├── ReleaseStockCommand.java
│   │   │   └── ReleaseStockResult.java
│   │   ├── checkavailability
│   │   │   ├── CheckAvailabilityInputPort.java
│   │   │   ├── CheckAvailabilityUseCase.java
│   │   │   ├── AvailabilityQuery.java
│   │   │   └── AvailabilityResult.java
│   │   └── shared
│   │       └── StockRepository.java
│   └── adapter
│       ├── incoming
│       └── outgoing
│
├── sharedkernel (Shared across ALL bounded contexts - keep minimal)
│   ├── marker (All architectural markers consolidated)
│   │   ├── tactical (DDD tactical patterns)
│   │   │   ├── Id.java
│   │   │   │   public interface Id {}  // Base for typed identifiers
│   │   │   ├── Entity.java
│   │   │   │   public interface Entity<T extends Entity<T, ID>, ID extends Id> { ID id(); }
│   │   │   ├── Value.java
│   │   │   │   public interface Value {}  // Marker for value objects
│   │   │   ├── AggregateRoot.java
│   │   │   │   public interface AggregateRoot<T extends AggregateRoot<T, ID>, ID extends Id> extends Entity<T, ID> {}
│   │   │   ├── BaseAggregateRoot.java
│   │   │   │   public abstract class BaseAggregateRoot<T extends AggregateRoot<T, ID>, ID extends Id> implements AggregateRoot<T, ID> {}
│   │   │   ├── DomainEvent.java
│   │   │   │   public interface DomainEvent { UUID eventId(); Instant occurredOn(); }
│   │   │   ├── IntegrationEvent.java
│   │   │   │   public interface IntegrationEvent { UUID eventId(); Instant occurredOn(); }
│   │   │   ├── IntegrationEventType.java
│   │   │   │   @interface IntegrationEventType { String name(); int version() default 1; }  // contract identity as class property
│   │   │   ├── DomainService.java
│   │   │   │   public interface DomainService {}
│   │   │   ├── Factory.java
│   │   │   │   public interface Factory<T> {}
│   │   │   └── Specification.java
│   │   │       public interface Specification<T> { boolean isSatisfiedBy(T t); }
│   │   ├── strategic (DDD strategic patterns)
│   │   │   ├── SharedKernel.java      // Package annotation
│   │   │   ├── BoundedContext.java    // Package annotation
│   │   │   └── OpenHostService.java   // Marker for OHS adapters
│   │   └── port (Hexagonal architecture ports)
│   │       ├── in (Input ports - driving adapters)
│   │       │   ├── InputPort.java     // Marker for all input ports
│   │       │   └── UseCase.java
│   │       │       public interface UseCase<INPUT, OUTPUT> extends InputPort {
│   │       │         OUTPUT execute(INPUT input);
│   │       │       }
│   │       └── out (Output ports - driven adapters)
│   │           ├── OutputPort.java    // Marker for all output ports
│   │           ├── Repository.java
│   │           │   public interface Repository<T extends AggregateRoot<T, ID>, ID extends Id> extends OutputPort {}
│   │           ├── DomainEventPublisher.java
│   │           │   public interface DomainEventPublisher extends OutputPort {
│   │           │     void publish(DomainEvent event);
│   │           │   }
│   │           ├── IntegrationEventPublisher.java
│   │           │   public interface IntegrationEventPublisher extends OutputPort {
│   │           │     void publish(IntegrationEvent event);  // boundary-crossing facts
│   │           │   }
│   ├── application
│   │   └── TransactionBoundary.java   // execution abstraction, NOT a port
│   │       public interface TransactionBoundary {
│   │         <T> T inTransaction(Supplier<T> work);  // explicit transaction boundary
│   │       }
│   └── domain
│       ├── model (Universal value objects)
│       │   ├── Money.java
│       │   ├── Price.java
│       │   ├── ProductId.java  // Shared product identifier
│       │   └── UserId.java     // Shared user identifier
│       └── specification (Specification pattern implementations)
│           ├── CompositeSpecification.java
│           ├── AndSpecification.java
│           ├── OrSpecification.java
│           ├── NotSpecification.java
│           └── SpecificationVisitor.java
│
└── infrastructure (cross-cutting concerns)
    ├── configuration
    │   ├── SpringBootApplication.java
    │   ├── DependencyInjectionConfig.java
    │   ├── WebConfig.java
    │   ├── SecurityConfig.java
    │   └── JpaConfig.java
    ├── persistence
    │   └── DatabaseMigration.java
    ├── messaging
    │   └── KafkaConfig.java
    └── monitoring
        ├── LoggingConfig.java
        └── MetricsConfig.java
```

---

### Structure Evolution Example: From Startup to Maturity

This example shows how a bounded context's structure naturally evolves as complexity grows. For detailed progressive complexity guidelines, see the original structure above.

---

**Use Case Organization - Self-Contained Pattern:**

```
APPLICATION LAYER
├── createorder/                   (USE CASE - All related files together)
│   ├── CreateOrderInputPort.java      ← Input Port Interface
│   │   interface CreateOrderInputPort extends UseCase<CreateOrderCommand, CreateOrderResult>
│   ├── CreateOrderUseCase.java        ← Use Case Implementation
│   │   @Service class CreateOrderUseCase implements CreateOrderInputPort
│   ├── CreateOrderCommand.java        ← Input Model (Command for writes)
│   └── CreateOrderResult.java       ← Output Model
│
├── findorder/                     (USE CASE - All related files together)
│   ├── FindOrderInputPort.java        ← Input Port Interface
│   ├── FindOrderUseCase.java          ← Use Case Implementation
│   ├── OrderQuery.java                ← Input Model (Query for reads)
│   └── OrderResult.java             ← Output Model
│
├── cancelorder/                   (USE CASE - All related files together)
│   ├── CancelOrderInputPort.java      ← Input Port Interface
│   ├── CancelOrderUseCase.java        ← Use Case Implementation
│   ├── CancelOrderCommand.java        ← Input Model
│   └── CancelOrderResult.java       ← Output Model
│
└── shared/                        (SHARED OUTPUT PORTS)
    ├── OrderRepository.java           ← Output Port (used by multiple use cases)
    ├── PaymentGateway.java            ← Output Port
    ├── InventoryService.java          ← Output Port
    └── DomainEventPublisher.java      ← Output Port
```

**Key Principles:**

1. **Each use case is self-contained** in its own folder with ALL related files
2. **InputPort interface** lives WITH the use case, not in a separate port/in/ directory
3. **UseCase implementation** lives WITH the InputPort in the same folder
4. **Command/Query and Result** models live WITH the use case
5. **Output Ports** (repositories, gateways) are shared across use cases in `shared/` directory

**Naming Convention:**
- **Use Case Folders**: lowercase (e.g., `createorder`, `findorder`, `cancelorder`)
- **Input Ports**: `*InputPort extends UseCase<INPUT, OUTPUT>` (e.g., `CreateOrderInputPort extends UseCase<CreateOrderCommand, CreateOrderResult>`)
- **Output Ports**: Domain-specific names (e.g., `OrderRepository`, `PaymentGateway`, `DomainEventPublisher`)
- **Use Case Implementation**: `*UseCase implements *InputPort` (e.g., `CreateOrderUseCase implements CreateOrderInputPort`)
- **Commands**: `*Command` (e.g., `CreateOrderCommand`)
- **Queries**: `*Query` (e.g., `OrderQuery`)
- **Results**: `*Result` (e.g., `CreateOrderResult`) — top level only; part records nested in the result are named by content (`CartItemSummary`, `LineItemData`, `ProfileView`), never `*Result`
- **Assemblers**: `*Assembler` when result assembly outgrows a static factory or is shared by several use cases (e.g., `ProductArticleAssembler` in `application/shared`) — never `*Mapper`, `*Converter` or `*Helper` in the application layer
- **Adapters**: `*Adapter` or specific suffixes (e.g., `InMemoryOrderRepository`, `OrderPageController`, `OrderMcpToolProvider`)

**Benefits:**
- ✅ **High Cohesion** - All files for one use case are together
- ✅ **Single Responsibility** - One folder = one business operation
- ✅ **Easy Navigation** - Find everything related to a use case in one place
- ✅ **Better Scalability** - Structure grows linearly with use cases
- ✅ **Minimal Coupling** - Use cases are independent, share only via output ports
- ✅ **Clear Dependencies** - Use case depends on domain + shared output ports only
- ✅ **Adapters clearly separated** - `adapter/incoming` and `adapter/outgoing`
- ✅ **Self-documenting** - Folder name = business operation name
- ✅ **Team-friendly** - Different developers can work on different use cases independently

**When the flat list outgrows itself — features:**

```
APPLICATION LAYER (grouped form)
├── ordering/                      (FEATURE - a term of the ubiquitous language)
│   ├── createorder/                   ← use case, unchanged inside
│   ├── updateorder/
│   └── cancelorder/
├── fulfilment/                    (FEATURE)
│   ├── shiporder/
│   └── trackshipment/
├── reporting/                     (FEATURE)
│   └── findorder/
└── shared/                        (CONTEXT-WIDE OUTPUT PORTS - not per feature)
    ├── OrderRepository.java
    └── PaymentGateway.java
```

The use-case packages are untouched by the move — only their parent changes. The domain layer is not
mirrored: `Order` serves `ordering`, `fulfilment` and `reporting` alike. See
[Grouping use cases into features](#grouping-use-cases-into-features) for the rules.


## DEPENDENCY STRUCTURE

### Layer Dependency Flow

```
┌─────────────────────────────────────────────────────┐
│  INFRASTRUCTURE                                     │
│  - Spring Boot, JPA, Kafka, Configuration           │
│  - Glue code only, no business logic                │
└────────────────────┬────────────────────────────────┘
                     │ depends on
                     ↓
┌─────────────────────────────────────────────────────┐
│  ADAPTER                                            │
│                                                     │
│  Input Adapters          Output Adapters            │
│  - Controllers           - Repository Impl          │
│  - Event Consumers       - API Clients              │
│  - CLI Handlers          - Event Publishers         │
│                          - Presenters               │
└────────────────────┬────────────────────────────────┘
                     │ depends on
                     ↓
┌─────────────────────────────────────────────────────┐
│  APPLICATION                                        │
│                                                     │
│  Input Ports ← Use Cases → Output Ports             │
│  (interfaces)  (implementations)  (interfaces)      │
│                                                     │
│  - CreateOrderInputPort  - OrderRepository          │
│  - CreateOrderUseCase    - PaymentGateway           │
│  - DTOs                  - EventPublisher           │
└────────────────────┬────────────────────────────────┘
                     │ depends on
                     ↓
┌─────────────────────────────────────────────────────┐
│  DOMAIN                                             │
│                                                     │
│  - Entities (Order, OrderLine)                      │
│  - Value Objects (Money, OrderId)                   │
│  - Aggregates (Order = Aggregate Root)              │
│  - Domain Services (PricingService)                 │
│  - Domain Events (OrderCreated)                     │
│  - Specifications                                   │
│                                                     │
│  ZERO DEPENDENCIES                                  │
└─────────────────────────────────────────────────────┘
```

### Request Flow with Dependency Inversion

```
HTTP Request
    ↓
┌──────────────────────────────────────────┐
│ Spring Controller (infrastructure)       │
└──────────────────────────────────────────┘
    ↓ delegates to
┌──────────────────────────────────────────┐
│ OrderController (adapter)                │
│ - validates HTTP input                   │
│ - creates CreateOrderCommand (DTO)       │
└──────────────────────────────────────────┘
    ↓ calls (depends on interface)
┌──────────────────────────────────────────┐
│ CreateOrderInputPort (application)       │ ← Interface
└──────────────────────────────────────────┘
    ↑ implemented by
┌──────────────────────────────────────────┐
│ CreateOrderUseCase (application)         │
│ - converts DTO → Domain                  │
│ - calls Order.create()                   │
│ - validates business rules               │
│ - calls repository.save()                │
│ - publishes domain events                │
│ - converts Domain → DTO                  │
└──────────────────────────────────────────┘
    │                           │
    │ uses                      │ calls
    ↓                           ↓
┌─────────────────┐    ┌──────────────────┐
│ Order           │    │ OrderRepository  │ ← Interface (application)
│ (Aggregate)     │    │ (Output Port)    │
│ (domain)        │    └──────────────────┘
│                 │            ↑ implemented by
│ - OrderLine     │    ┌──────────────────────────┐
│ - Money         │    │ OrderRepositoryAdapter   │
│ - OrderId       │    │ (adapter)                │
└─────────────────┘    │ - maps Domain ↔ JPA      │
                       │ - uses Spring Data       │
                       └──────────────────────────┘
                               ↓ uses
                       ┌──────────────────────────┐
                       │ OrderJpaEntity           │
                       │ (adapter)                │
                       └──────────────────────────┘
                               ↓
                       ┌──────────────────────────┐
                       │ Spring Data JPA          │
                       │ (infrastructure)         │
                       └──────────────────────────┘
                               ↓
                           Database
```

### Cross-Bounded Context Communication

```
Order Context                                     Inventory Context
┌───────────────────────┐                        ┌─────────────────────┐
│ CreateOrderUseCase    │                        │ ReserveStockUseCase │
│ (application)         │                        │ (application)       │
└───────────┬───────────┘                        └──────────┬──────────┘
            │ publishes                                     ↑ calls
            ↓                                               │
┌───────────────────────┐                                   │
│ OrderCreated          │                                   │
│ (domain event)        │                                   │
└───────────┬───────────┘                                   │
            │ via DomainEventPublisher                      │
            ↓                                               │
┌───────────────────────┐                                   │
│ OrderEventMapper      │                                   │
│ (adapter/outgoing)    │                                   │
└───────────┬───────────┘                                   │
            │ converts to DTO                               │
            ↓                                               │
┌───────────────────────┐                                   │
│ OrderCreatedEvent     │                                   │
│ (integration event)   │                                   │
└───────────┬───────────┘                                   │
            │                                               │
            └────────→ Message Broker ─────────┐            │
                      (Kafka/RabbitMQ)         │            │
                                               │            │
                                               ↓            │
                          ┌─────────────────────────────────┐
                          │ OrderEventConsumer              │
                          │ (adapter/incoming)              │
                          └──────────┬──────────────────────┘
                                     │ via ACL
                                     ↓
                          ┌─────────────────────────────────┐
                          │ ExternalEventToCommandMapper    │
                          │ (Anti-Corruption Layer)         │
                          │ converts to ReserveStockCommand │
                          └─────────────────────────────────┘
                                     │
                          ┌──────────┘
                          │
                          ↓
                    ┌────────────────────┐
                    │ ReserveStockInput  │
                    │ Port (application) │
                    └────────────────────┘
```

### Complete Cross-Context Event Flow

(Event flow diagram included - see original document for full details)

### Allowed Dependencies

- ✅ Infrastructure → Adapter
- ✅ Adapter → Application
- ✅ Application → Domain
- ✅ Adapter → Port (interface)
- ✅ Use Case → Domain
- ✅ Use Case → Output Port (interface)
- ✅ Controller → Input Port (interface)
- ✅ Outer → Inner (always)

### Forbidden Dependencies

- ❌ Domain → Application
- ❌ Domain → Adapter
- ❌ Domain → Infrastructure
- ❌ Application → Adapter
- ❌ Application → Infrastructure
- ❌ Adapter → Infrastructure
- ❌ Use Case → Controller
- ❌ Use Case → Repository Implementation
- ❌ Port → Adapter (implementation)
- ❌ Inner → Outer (never)

## INTEGRATION PATTERNS

### Same Bounded Context
- Direct method calls within aggregate
- Domain events for cross-aggregate communication
- Use case coordinates multiple aggregates
- Eventual consistency between aggregates

### Different Bounded Contexts
- Anti-Corruption Layer for external models
- Open Host Service for synchronous queries
- Domain events via message broker
- REST API with DTOs
- Shared Kernel (minimal, coordinated)

### Declaring Context Relationships in Code

Context-map relationships are declared on the bounded context's `package-info.java`, next to
`@BoundedContext`. The declaration is the single source of truth: architecture tests verify that the
declared relationships match the actual dependencies, and the human-readable context map (table +
diagram) is rendered from the same annotations — an **executable context map** that cannot drift.

```java
// checkout/package-info.java
@BoundedContext(name = "Checkout", description = "Checkout process, order placement, payment orchestration")
@Upstream(
    context = "product",
    translation = Upstream.Translation.ANTI_CORRUPTION_LAYER,
    via = Upstream.Consumes.API,
    rationale = "Product data is translated into checkout's own article types")
@Upstream(
    context = "cart",
    translation = Upstream.Translation.CONFORMIST,
    via = Upstream.Consumes.EVENTS,
    rationale = "CartCheckedOutEvent is consumed as published, no translation needed")
@ExternalUpstream(
    name = "Payment Provider",
    translation = Upstream.Translation.ANTI_CORRUPTION_LAYER,
    interaction = ExternalUpstream.Interaction.OUTBOUND,
    protocol = "REST",
    contractPackages = "..checkout.adapter.outgoing.payment..")
package com.company.project.checkout;
```

| Annotation | Declares | Key attributes |
|------------|----------|----------------|
| `@Upstream` (repeatable) | this context is **downstream** of `context` | `translation` = `ANTI_CORRUPTION_LAYER` \| `CONFORMIST`; `via` = `API` \| `EVENTS`; `status` = `IMPLEMENTED` \| `PLANNED`; `rationale` |
| `@ExternalUpstream` (repeatable) | an **external system** the context talks to | `interaction` = `OUTBOUND` \| `INBOUND`; `protocol`, `exchanges`, `contractPackages` |
| `@Partnership` (repeatable) | mutual, coordinated evolution with `context` | `rationale` |
| `@OpenHostService` | this adapter is a published API for other contexts | on the adapter class, not the package |
| `@SharedKernel` | the package is the shared kernel | on `package-info.java` |

Rules the declarations enable (see [ArchUnit Governance](./archunit-governance.md)):

- Every cross-context dependency in code must be covered by an `@Upstream`/`@Partnership` declaration
  (undeclared coupling fails the build).
- Every declared relationship with `status = IMPLEMENTED` must have a matching dependency (dead
  declarations fail the build); `PLANNED` relationships are exempt.
- `ANTI_CORRUPTION_LAYER`: the upstream's contract types must stay inside the matching outgoing
  adapter (or event consumer) — they never leak into application or domain.
- `CONFORMIST`: the upstream's contract types may be used as-is in the application layer, but still
  never reach the domain layer — conformism does not suspend domain purity.
- Declarations must be well-formed: target context exists, never the declaring context itself, unique
  per context and channel, `@Partnership` symmetric on both sides, and consistent with Spring Modulith
  `allowedDependencies` where used.

### Open Host Service Pattern

For synchronous cross-context queries, use the Open Host Service pattern.

```
PROVIDER CONTEXT (Product)               CONSUMER CONTEXT (Cart)
┌──────────────────────────────┐        ┌──────────────────────────────┐
│ adapter/incoming/api/        │        │ adapter/outgoing/product/    │
│   ProductCatalogApi          │◄───────│   ProductDataAdapter         │
│   @RestController (REST)     │ calls  │   (implements ProductDataPort)│
│   OR @OpenHostService        │        └───────────────┬──────────────┘
│   (in-process modulith)      │                        │ implements
└──────────────────────────────┘                        ▼
                                        ┌──────────────────────────────┐
                                        │ application/shared/          │
                                        │   ProductDataPort            │
                                        │   (output port)              │
                                        └───────────────┬──────────────┘
                                                        │ uses
                                                        ▼
                                        ┌──────────────────────────────┐
                                        │ application/additemtocart/   │
                                        │   AddItemToCartUseCase       │
                                        │   (uses port, NOT OHS)       │
                                        └──────────────────────────────┘
```

#### Provider: REST API (Canonical)

The canonical DDD Open Host Service is a **REST API** with a published language:

```java
// adapter/incoming/api/ProductCatalogApi.java
@RestController
@RequestMapping("/api/v1/products")
public class ProductCatalogApi {

    private final GetProductByIdInputPort getProductUseCase;

    public record ProductInfoDto(String id, String name, BigDecimal price, int stock) {}

    @GetMapping("/{productId}")
    public ResponseEntity<ProductInfoDto> getProduct(@PathVariable String productId) {
        return getProductUseCase.execute(new GetProductQuery(ProductId.of(productId)))
            .map(r -> new ProductInfoDto(r.productId().value(), r.name(), r.price().amount(), r.stock()))
            .map(ResponseEntity::ok)
            .orElse(ResponseEntity.notFound().build());
    }
}
```

#### Provider: In-Process Service (Modulith Optimization)

For modulith deployments (single JVM), an in-process service avoids network overhead. It lives in the
context's published `api/` package — the in-process contract, next to `events/` — not in the adapter
tree: an Open Host Service is the *relationship* a context publishes, and the transport (in-process
call, REST, gRPC, MCP) is a detail. The REST variant above is simply the same relationship as an
incoming adapter.

```java
// api/ProductCatalogService.java  (published package of the Product context)
@OpenHostService(context = "Product Catalog", description = "...")
@Service
public class ProductCatalogService {
    private final GetProductByIdInputPort getProductByIdInputPort;  // Use case, NOT repository

    public record ProductInfo(ProductId productId, String name, Price price, int availableStock) {}

    public Optional<ProductInfo> getProductInfo(ProductId productId) {
        var response = getProductByIdInputPort.execute(new GetProductByIdQuery(productId.value()));
        if (!response.found()) return Optional.empty();
        return Optional.of(new ProductInfo(
            productId, response.name(),
            Price.of(Money.of(response.priceAmount(), Currency.getInstance(response.priceCurrency()))),
            response.stockQuantity()
        ));
    }
}
```

**Important:** Like an incoming adapter, the OHS calls **use cases (input ports)**, not repositories directly.

#### Consumer: Output Port + Adapter (Same for Both)

The consumer-side pattern is **identical** regardless of transport:

```java
// application/shared/ProductDataPort.java - Consumer defines what it needs
public interface ProductDataPort extends OutputPort {
    record ProductData(ProductId id, Price price, boolean hasStock) {}
    Optional<ProductData> getProductData(ProductId id, int quantity);
}

// adapter/outgoing/product/ProductDataAdapter.java - REST variant
@Component
public class ProductDataAdapter implements ProductDataPort {
    private final RestTemplate restTemplate;  // For REST API

    public Optional<ProductData> getProductData(ProductId id, int qty) {
        var response = restTemplate.getForObject("/api/v1/products/" + id.value(), ProductInfoDto.class);
        if (response == null) return Optional.empty();
        return Optional.of(new ProductData(id, Price.of(response.price()), response.stock() >= qty));
    }
}

// OR: adapter/outgoing/product/ProductDataAdapter.java - In-process variant (modulith)
@Component
public class ProductDataAdapter implements ProductDataPort {
    private final ProductCatalogService productCatalogService;  // In-process OHS

    public Optional<ProductData> getProductData(ProductId id, int qty) {
        return productCatalogService.getProductInfo(id)
            .map(info -> new ProductData(id, info.price(), info.stock() >= qty));
    }
}

// application/additemtocart/AddItemToCartUseCase.java - Uses port only (unchanged)
@Service
public class AddItemToCartUseCase {
    private final ProductDataPort productDataPort;  // NOT ProductCatalogService or RestTemplate

    public AddItemToCartResult execute(AddItemToCartCommand cmd) {
        ProductData data = productDataPort.getProductData(cmd.productId(), cmd.qty())
            .orElseThrow(() -> new IllegalArgumentException("Product not found"));
        // ...
    }
}
```

**Key Point:** Only the adapter implementation changes when migrating from modulith to microservices. Use cases and ports remain identical.

**Rules:**
- ✅ REST API as an incoming adapter, e.g. `adapter/incoming/api/` (canonical OHS over the network; the sub-package is the project's choice)
- ✅ In-process OHS in the context's published `api/` package (modulith optimization)
- ✅ OHS returns DTOs, never domain objects
- ✅ Consumer defines own output port specifying exactly what it needs
- ✅ Consumer's adapter in `adapter/outgoing/{context}/` is the ONLY place that imports OHS
- ❌ Use cases never import OHS directly (violates hexagonal architecture)
- ❌ Application layer never imports from other bounded contexts

> **Note:** For multi-service integration patterns, see [Deployment Patterns](./deployment-patterns.md)

### Composite Adapter Pattern

When a context needs data from **multiple** Open Host Services, use a **Composite Adapter** to aggregate the data in one place.

```
Context A (Consumer)                    Provider Contexts
┌─────────────────────────────────┐    ┌───────────────────┐
│ application/shared/             │    │ ProductCatalog    │
│   ArticleDataPort               │    │ (OHS - names)     │
│   (output port)                 │    └───────────────────┘
└────────────────┬────────────────┘    ┌───────────────────┐
                 │ implements          │ Pricing           │
                 ▼                     │ (OHS - prices)    │
┌─────────────────────────────────┐    └───────────────────┘
│ adapter/outgoing/product/       │    ┌───────────────────┐
│   CompositeArticleDataAdapter   │───▶│ Inventory         │
│   - ProductCatalogService       │    │ (OHS - stock)     │
│   - PricingService              │    └───────────────────┘
│   - InventoryService            │
└─────────────────────────────────┘
```

**Example:**
```java
// adapter/outgoing/product/CompositeArticleDataAdapter.java
@Component
public class CompositeArticleDataAdapter implements ArticleDataPort {

    private final ProductCatalogService productCatalogService;  // OHS
    private final PricingService pricingService;                // OHS
    private final InventoryService inventoryService;            // OHS

    @Override
    public Map<ProductId, ArticleData> getArticleData(Collection<ProductId> productIds) {
        // Bulk fetch from each OHS
        Map<ProductId, PriceInfo> prices = pricingService.getPrices(productIds);
        Map<ProductId, StockInfo> stocks = inventoryService.getStock(productIds);

        Map<ProductId, ArticleData> result = new HashMap<>();
        for (ProductId productId : productIds) {
            Optional<ProductInfo> productInfo = productCatalogService.getProductInfo(productId);
            if (productInfo.isPresent()) {
                result.put(productId, combineData(productId, productInfo.get(),
                    prices.get(productId), stocks.get(productId)));
            }
        }
        return result;
    }
}
```

**Rules:**
- ✅ Composite adapter is the **ONLY** place that imports from multiple OHS
- ✅ Aggregates data from multiple sources into context-specific DTO
- ✅ Use cases depend on port interface, not the adapter
- ✅ Isolates cross-context coupling to adapter layer
- ❌ Use cases never import OHS directly

### Resolver Pattern

When **domain logic** needs external data (e.g., current prices) without infrastructure dependencies, use a **Resolver** - a functional interface injected into domain methods.

```
Application Layer                      Domain Layer
┌───────────────────────────────┐     ┌─────────────────────────────────┐
│ Use Case                      │     │ Aggregate                       │
│ - fetches data via port       │     │ - calculateTotal(Resolver)      │
│ - builds resolver from data   │────▶│ - validateItems(Resolver)       │
│ - passes resolver to domain   │     │ - confirm(Resolver)             │
└───────────────────────────────┘     └─────────────────────────────────┘
```

**Example:**
```java
// Domain - Functional interface for resolving prices
@FunctionalInterface
public interface ArticlePriceResolver {
    ArticlePrice resolve(ProductId productId);

    record ArticlePrice(Money price, boolean isAvailable, int availableStock) implements Value {}
}

// Domain - Aggregate uses resolver
public class ShoppingCart extends BaseAggregateRoot<ShoppingCart, CartId> {

    public Money calculateTotal(ArticlePriceResolver resolver) {
        Money total = Money.zero();
        for (CartItem item : items) {
            ArticlePrice price = resolver.resolve(item.productId());
            total = total.add(price.price().multiply(item.quantity()));
        }
        return total;
    }

    public CartValidationResult validateForCheckout(ArticlePriceResolver resolver) {
        List<ValidationError> errors = new ArrayList<>();
        for (CartItem item : items) {
            ArticlePrice price = resolver.resolve(item.productId());
            if (!price.isAvailable()) {
                errors.add(ValidationError.productUnavailable(item.productId()));
            }
        }
        return errors.isEmpty() ? CartValidationResult.valid()
                                : CartValidationResult.withErrors(errors);
    }
}

// Application - Use case builds resolver from fetched data
@Service
public class CheckoutCartUseCase implements CheckoutCartInputPort {
    private final ArticleDataPort articleDataPort;  // Output port

    @Override
    public CheckoutCartResult execute(CheckoutCartCommand command) {
        ShoppingCart cart = cartRepository.findById(command.cartId())...;

        // Fetch data via port
        Map<ProductId, ArticleData> articleData =
            articleDataPort.getArticleData(cart.productIds());

        // Build resolver from fetched data
        ArticlePriceResolver resolver = productId -> {
            ArticleData data = articleData.get(productId);
            return new ArticlePrice(data.currentPrice(), data.isAvailable(), data.availableStock());
        };

        // Domain uses resolver - no infrastructure dependency
        CartValidationResult validation = cart.validateForCheckout(resolver);
        if (!validation.isValid()) {
            throw new ValidationException(validation.errors());
        }

        cart.checkout();
        return CheckoutCartResult.success(cart.id());
    }
}
```

**Benefits:**
- ✅ Domain remains **framework-independent** - no external service calls
- ✅ **Fresh data** - resolver provides current prices at execution time
- ✅ **Testable** - easily mock resolver in domain tests
- ✅ **Explicit dependency** - domain method signature shows data need

**Rules:**
- ✅ Resolver is a `@FunctionalInterface` in domain layer
- ✅ Resolver's return type (`ArticlePrice`) is a domain Value Object
- ✅ Use case fetches data via port, builds resolver, passes to domain
- ❌ Domain never calls external services directly
- ❌ Resolver never used to modify external state (read-only)

### Enriched Read Model Pattern

When you need to **combine persisted data with fresh external data** for rich domain logic (e.g., comparing original price to current price), create an **Enriched Read Model**.

```
Persisted Data                Fresh External Data        Enriched Read Model
┌─────────────────┐          ┌─────────────────┐        ┌─────────────────────────┐
│ CheckoutLineItem│    +     │ CheckoutArticle │   =    │ EnrichedCheckoutLineItem│
│ - unitPrice     │          │ - currentPrice  │        │ - hasPriceChanged()     │
│ - quantity      │          │ - isAvailable   │        │ - priceDifference()     │
│ - productName   │          │ - availableStock│        │ - isValidForCheckout()  │
└─────────────────┘          └─────────────────┘        └─────────────────────────┘
```

**Example:**
```java
// Enriched line item - combines persisted with current data
public record EnrichedCheckoutLineItem(
    CheckoutLineItem lineItem,     // Persisted at checkout start
    CheckoutArticle currentArticle  // Fresh from external services
) implements Value {

    public Money currentLineTotal() {
        return currentArticle.currentPrice().multiply(lineItem.quantity());
    }

    public boolean hasPriceChanged() {
        return !lineItem.unitPrice().equals(currentArticle.currentPrice());
    }

    public Money priceDifference() {
        return currentArticle.currentPrice().subtract(lineItem.unitPrice());
    }

    public boolean isValidForCheckout() {
        return currentArticle.isAvailable() &&
               currentArticle.availableStock() >= lineItem.quantity();
    }
}

// Enriched cart - collection with business logic
public record CheckoutCart(
    CartId cartId,
    CustomerId customerId,
    List<EnrichedCheckoutLineItem> items
) implements Value {

    public boolean hasAnyPriceChanges() {
        return items.stream().anyMatch(EnrichedCheckoutLineItem::hasPriceChanged);
    }

    public Money calculateCurrentSubtotal() {
        return items.stream()
            .map(EnrichedCheckoutLineItem::currentLineTotal)
            .reduce(Money::add)
            .orElse(Money.zero());
    }

    public boolean isValidForCheckout() {
        return !items.isEmpty() &&
               items.stream().allMatch(EnrichedCheckoutLineItem::isValidForCheckout);
    }

    public List<EnrichedCheckoutLineItem> invalidItems() {
        return items.stream()
            .filter(item -> !item.isValidForCheckout())
            .toList();
    }
}
```

**Benefits:**
- ✅ **Rich domain logic** - "Has price changed?" "Is stock sufficient?"
- ✅ **Single query point** - all validation/calculation in one place
- ✅ **Immutable** - Value Object, safe to pass around
- ✅ **Real-world metaphor** - like a smart shopping cart display

**Note:** Enriched Read Model is a Value Object, **not** an Aggregate. It has no lifecycle or events.

### Factory for Cross-Context Assembly

Use a **Factory** to assemble enriched domain objects from data fetched via ports.

```java
// Factory assembles enriched cart from multiple data sources
public class CheckoutCartFactory implements Factory {

    public CheckoutCart create(
        CartId cartId,
        CustomerId customerId,
        List<CheckoutLineItem> lineItems,
        Map<ProductId, CheckoutArticle> articleData
    ) {
        List<EnrichedCheckoutLineItem> enrichedItems = lineItems.stream()
            .map(item -> {
                CheckoutArticle article = articleData.get(item.productId());
                if (article == null) {
                    throw new IllegalArgumentException(
                        "Article data not found for: " + item.productId());
                }
                return new EnrichedCheckoutLineItem(item, article);
            })
            .toList();

        return new CheckoutCart(cartId, customerId, enrichedItems);
    }
}

// Use case uses factory
@Service
public class StartCheckoutUseCase implements StartCheckoutInputPort {
    private final CheckoutArticleDataPort articleDataPort;
    private final CheckoutCartFactory checkoutCartFactory;

    @Override
    public StartCheckoutResult execute(StartCheckoutCommand command) {
        // Fetch data via ports
        List<CheckoutLineItem> lineItems = ...;
        Map<ProductId, CheckoutArticle> articleData =
            articleDataPort.getArticleData(productIds);

        // Factory assembles enriched cart
        CheckoutCart checkoutCart = checkoutCartFactory.create(
            cartId, customerId, lineItems, articleData);

        // Domain validation
        if (!checkoutCart.isValidForCheckout()) {
            throw new ValidationException(checkoutCart.invalidItems());
        }

        // ...
    }
}
```

**Rules:**
- ✅ Factory is in **domain layer** (implements `Factory` marker)
- ✅ Factory is **framework-independent** (no Spring annotations)
- ✅ Application layer fetches data via ports, passes to factory
- ✅ Factory validates all required data is present
- ❌ Factory never fetches data itself (no port injection)

## DEVIATIONS FROM THE LITERATURE

DCA deliberately deviates from classic DDD literature in a few places. The deviations are conscious decisions, not oversights:

### Repository Interfaces in the Application Layer

Classic DDD (Evans, Vernon, Millett/Tune) places repository interfaces in the domain layer. DCA places them in the application layer as **output ports**: the use case owns the contract for what it needs from the outside world, the domain stays free of persistence concerns entirely. This follows Hexagonal/Clean Architecture port ownership consistently.

The rejected alternative is worth naming: keeping the interface in the domain layer means the domain declares what it wants from persistence, which reads as independence but is not. The signature — what can be looked up, by what, returning what — is shaped by the use cases that call it, so the domain would be declaring a contract on someone else's behalf and would have to change whenever a use case's needs change.

### Repository vs. Store

The literature knows only the Repository (one per aggregate root). DCA refines this with a second output-port type, the **Store**, for operational data without aggregate lifecycle (value objects, technical state) — see [Repository vs. Store](#repository-vs-store).

### Results Instead of Output Ports, Assembled on the Application Side

Clean Architecture (Martin) lets the interactor hand its output data to a presenter through an output port; the presenter builds the view model. DCA returns the result: `UseCase<INPUT, OUTPUT>` yields a `*Result`, and the incoming adapter maps it to a `*Response` or `*ViewModel`. Two mapping steps, one direction of call, no callback interface per use case.

Vernon (*Implementing DDD*, "Rendering Domain Objects") offers the **Domain Payload Object** — handing whole aggregates to an in-process UI — and the **Mediator** (double dispatch into a rendering interface) as alternatives to a DTO assembler. DCA takes neither, not even for an in-process UI: every adapter gets the same result model, REST and MCP are remote anyway, and a result that carries an aggregate root or entity is a rule violation (`DCA-USE-015`). What the literature agrees on is kept: no entity crosses the use-case boundary, the application layer assembles the business result (Fowler's *Assembler* is the name for the class when a static factory no longer suffices), and the incoming adapter formats without deriving business facts.

The restriction is deliberately asymmetric. An incoming adapter reads and formats what a result delivers — including the own queries of a delivered value or read model — and operates no domain object; it obtains no domain service (`DCA-HEX-012`), constructs nothing and combines nothing into a new business fact. An outgoing adapter — a repository, a persistence mapper — necessarily constructs and reconstitutes domain objects while implementing an output port; it restores state and makes no new business decision.

### Pragmatic Domain-Layer Dependencies

"Framework-free domain" is enforced strictly for frameworks (Spring, JPA, Jackson, messaging), but compile-time-only conveniences without runtime coupling (Lombok, `commons-lang3`, JSpecify nullability annotations) are permitted. The boundary is behavioral coupling, not the import statement.

## GENERAL PRINCIPLES

- **Domain First** - Domain is the heart, everything serves it
- **Dependency Inversion** - Depend on abstractions, not concretions
- **Separation of Concerns** - Each layer has single responsibility
- **Framework Independence** - Domain and application know no framework
- **Database Independence** - Domain knows no persistence
- **UI Independence** - Domain knows no presentation
- **Testability** - Test domain without infrastructure
- **Replaceability** - Swap adapters without changing domain
- **Screaming Architecture** - Use cases are visible
- **Ubiquitous Language** - Domain terms everywhere
- **Bounded Contexts** - Explicit boundaries
- **Small Aggregates** - Minimal transactional boundaries
- **Eventual Consistency** - Between aggregates and contexts
- **Interface Segregation** - Small, focused ports
- **Immutability** - Value objects and events are immutable
- **Protection** - Protect domain from external changes
- **Delay Decisions** - Defer infrastructure choices
- **Business Focus** - Code reflects business, not technology

## ADDITIONAL TOPICS

### Deployment Strategies
For information about deployment patterns including Self-Contained Systems (SCS), service decomposition, and multi-service architectures, see [Deployment Patterns](./deployment-patterns.md).

### Implementation with Spring Modulith
For practical implementation using Spring Modulith including event publication, module boundaries, and testing, see [Spring Modulith Implementation](./spring-modulith.md).

### Team Organization and Conway's Law
For guidance on aligning teams with bounded contexts using Team Topologies principles, see [Team Topologies Integration](./team-topologies.md).

### E2E Testing Patterns
For browser-based E2E testing using Playwright with data-test attributes and the Page Object Pattern, see [E2E Testing](./e2e-testing.md).

## References & Further Reading

Domain-Centric Architecture synthesizes ideas from multiple foundational works and thought leaders. Below are the key sources that have influenced this architectural approach.

### Domain-Driven Design

**Books:**
- **[Domain-Driven Design: Tackling Complexity in the Heart of Software](https://www.domainlanguage.com/ddd/)** by Eric Evans (2003)
  - The seminal work that introduced DDD concepts
  - Defines tactical patterns: Entities, Value Objects, Aggregates, Domain Services
  - Defines strategic patterns: Bounded Contexts, Ubiquitous Language, Context Mapping
  - ISBN: 978-0321125217

- **[Implementing Domain-Driven Design](https://vaughnvernon.com/implementing-domain-driven-design/)** by Vaughn Vernon (2013)
  - Practical guide to implementing DDD patterns
  - Deep dive into Aggregates and bounded contexts
  - Event Sourcing and CQRS patterns
  - ISBN: 978-0321834577

- **[Domain-Driven Design Distilled](https://vaughnvernon.com/domain-driven-design-distilled/)** by Vaughn Vernon (2016)
  - Concise introduction to DDD core concepts
  - Great starting point for learning DDD
  - ISBN: 978-0134434421

**Online Resources:**
- [Domain Language - Eric Evans](https://www.domainlanguage.com/) - Official DDD resources
- [DDD Community](https://github.com/ddd-crew) - Tools, patterns, and community resources

### Hexagonal Architecture (Ports & Adapters)

**Articles:**
- **[Hexagonal Architecture](https://alistair.cockburn.us/hexagonal-architecture/)** by Alistair Cockburn (2005)
  - Original article introducing Ports & Adapters pattern
  - Foundation for dependency inversion in Domain-Centric Architecture

**Books:**
- **[Get Your Hands Dirty on Clean Architecture](https://thombergs.gumroad.com/l/gyhdoca)** by Tom Hombergs (2019)
  - Practical implementation of Hexagonal Architecture
  - Detailed package structures and code examples
  - Spring Boot implementation patterns
  - ISBN: 978-1839211966

### Clean Architecture

**Books:**
- **[Clean Architecture: A Craftsman's Guide to Software Structure and Design](https://www.informit.com/store/clean-architecture-a-craftsmans-guide-to-software-structure-9780134494166)** by Robert C. Martin (2017)
  - Defines the dependency rule and layer structure
  - Framework independence principles
  - ISBN: 978-0134494166

**Articles:**
- **[The Clean Architecture](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html)** by Robert C. Martin (2012)
  - Original blog post introducing Clean Architecture circles

### Team Topologies

**Books:**
- **[Team Topologies: Organizing Business and Technology Teams for Fast Flow](https://teamtopologies.com/book)** by Matthew Skelton & Manuel Pais (2019)
  - Four fundamental team types
  - Team interaction modes
  - Conway's Law and organizational design
  - ISBN: 978-1942788812

**Online Resources:**
- [Team Topologies Website](https://teamtopologies.com/) - Official resources and tools
- [Team Topologies Academy](https://teamtopologies.com/academy) - Training and workshops

### Spring Modulith

**Official Resources:**
- **[Spring Modulith Reference Documentation](https://docs.spring.io/spring-modulith/reference/)** - Official documentation
- **[Spring Modulith GitHub](https://github.com/spring-projects/spring-modulith)** - Source code and examples
- **[Spring Blog - Introducing Spring Modulith](https://spring.io/blog/2022/10/21/introducing-spring-modulith)** - Announcement and overview

**Presentations:**
- **[Spring Modulith – Spring for the Architecturally Curious Developer](https://www.youtube.com/watch?v=QX6lP-h-u8I)** by Oliver Drotbohm - SpringOne 2023

### Self-Contained Systems (SCS)

**Online Resources:**
- **[SCS Architecture](https://scs-architecture.org/)** - Official SCS website
  - Principles and characteristics
  - Comparison with microservices
  - Implementation examples

### Microservices & Distributed Systems

**Books:**
- **[Building Microservices: Designing Fine-Grained Systems](https://www.oreilly.com/library/view/building-microservices-2nd/9781492034018/)** by Sam Newman (2nd Edition, 2021)
  - Microservices patterns and practices
  - Service decomposition strategies
  - ISBN: 978-1492034025

- **[Monolith to Microservices](https://www.oreilly.com/library/view/monolith-to-microservices/9781492047834/)** by Sam Newman (2019)
  - Migration patterns from monolith to microservices
  - ISBN: 978-1492047841

### Event-Driven Architecture

**Books:**
- **[Designing Event-Driven Systems](https://www.confluent.io/designing-event-driven-systems/)** by Ben Stopford (2018)
  - Event-driven patterns with Apache Kafka
  - Free ebook from Confluent

**Articles:**
- **[Domain Events vs. Integration Events](https://www.kamilgrzybek.com/blog/posts/domain-events-vs-integration-events)** by Kamil Grzybek
  - Clear explanation of event types

### Software Architecture Patterns

**Books:**
- **[Patterns of Enterprise Application Architecture](https://www.martinfowler.com/books/eaa.html)** by Martin Fowler (2002)
  - Foundational enterprise patterns
  - Repository, Unit of Work, and more
  - ISBN: 978-0321127420

- **[Software Architecture: The Hard Parts](https://www.oreilly.com/library/view/software-architecture-the/9781492086888/)** by Neal Ford, Mark Richards, Pramod Sadalage, Zhamak Dehghani (2021)
  - Modern architectural decision-making
  - Trade-off analysis
  - ISBN: 978-1492086895

### Influential Blogs & Communities

**Blogs:**
- **[Martin Fowler's Blog](https://martinfowler.com/)** - Software architecture patterns and practices
- **[Vaughn Vernon's Blog](https://vaughnvernon.com/)** - DDD patterns and implementations
- **[Udi Dahan's Blog](https://udidahan.com/)** - SOA and DDD insights
- **[Tom Hombergs' Blog (Reflectoring)](https://reflectoring.io/)** - Clean/Hexagonal Architecture tutorials

**Communities:**
- **[DDD/CQRS Google Group](https://groups.google.com/g/dddcqrs)** - Active DDD community
- **[Software Architecture Slack](https://softwarearchitecture.slack.com/)** - Architecture discussions
- **[Virtual DDD](https://virtualddd.com/)** - Online DDD meetups and resources

### Related Patterns & Practices

**CQRS (Command Query Responsibility Segregation):**
- **[CQRS Pattern](https://martinfowler.com/bliki/CQRS.html)** by Martin Fowler
- **[CQRS Journey](https://docs.microsoft.com/en-us/previous-versions/msp-n-p/jj554200(v=pandp.10))** by Microsoft patterns & practices

**Event Sourcing:**
- **[Event Sourcing](https://martinfowler.com/eaaDev/EventSourcing.html)** by Martin Fowler
- **[Event Sourcing Basics](https://eventstore.com/blog/what-is-event-sourcing/)** by Event Store

**Aggregates:**
- **[Effective Aggregate Design](https://www.dddcommunity.org/library/vernon_2011/)** by Vaughn Vernon (3-part series)

### Acknowledgments

Domain-Centric Architecture stands on the shoulders of giants. Special recognition to:

- **Eric Evans** - For Domain-Driven Design and the concept of Bounded Contexts
- **Alistair Cockburn** - For Hexagonal Architecture and the Ports & Adapters pattern
- **Robert C. Martin (Uncle Bob)** - For Clean Architecture and the Dependency Rule
- **Vaughn Vernon** - For practical DDD implementation guidance
- **Matthew Skelton & Manuel Pais** - For Team Topologies and organizational patterns
- **Tom Hombergs** - For practical Hexagonal Architecture implementation examples
- **Oliver Drotbohm** - For Spring Modulith framework
- **The DDD Community** - For continuous evolution of patterns and practices

### Contributing to This Documentation

This documentation is a living resource. Contributions, corrections, and improvements are welcome. The patterns and practices described here continue to evolve based on real-world experience and community feedback.
