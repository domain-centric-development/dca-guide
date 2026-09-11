# Team Topologies Integration
*Aligning Team Structure with Domain-Centric Architecture*

> **📘 Prerequisites:** This document integrates Team Topologies organizational patterns with [Domain-Centric Architecture](../README.md). Read the main document first for technical architecture patterns.

## Introduction

[Domain-Centric Architecture](../README.md) defines the **technical structure** of systems. Team Topologies provides the **organizational structure** for the teams building those systems.

**Key Insight:** System architecture and team structure should align (Conway's Law).

This document shows how to:
- Structure teams around bounded contexts
- Minimize inter-team dependencies
- Optimize for fast flow of value
- Manage cognitive load
- Define clear team interactions

## Team Types

### Stream-Aligned Team

**Definition:** Team aligned to a single, continuous flow of work (typically one bounded context)

**Characteristics:**
- **Owns one bounded context** (preferred)
- Full-stack capability (UI → Database)
- Can deliver value end-to-end
- Size: 5-9 members (ideal)
- Long-lived, stable team

**Responsibilities:**
- Own domain, application, and adapters (see [Domain-Centric Architecture](../architecture/dependency-structure.md#layer-dependency-flow))
- Build, deploy, run, maintain
- Respond to user needs
- Continuous delivery

**Example:**
```
Order Team (Stream-Aligned)
├── Owns: Order Bounded Context
├── Full stack: Backend + Frontend + Database
├── Independent deployment
└── End-to-end delivery: Order creation → Payment → Fulfillment
```

### Platform Team

**Definition:** Team providing internal platform/infrastructure as a service

**Characteristics:**
- **Reduces cognitive load** of stream-aligned teams
- Provides self-service capabilities
- Clear API/interface
- Treats stream-aligned teams as customers

**Services Provided:**
- Database provisioning
- Message broker (Kafka, RabbitMQ)
- CI/CD pipelines
- Monitoring/observability
- Cloud infrastructure
- Developer tools

**Example:**
```
Platform Team
├── Provides: Postgres Database as a Service
├── API: Self-service provisioning
├── SLA: 99.9% uptime
└── Customers: All stream-aligned teams
```

**Interaction Mode:** X-as-a-Service (stream-aligned teams consume platform services)

### Enabling Team

**Definition:** Team helping stream-aligned teams overcome obstacles and learn new capabilities

**Characteristics:**
- Deep technical expertise
- **Facilitating interaction mode**
- Time-limited engagement
- Teaches, doesn't do the work
- Doesn't own production systems

**Helps With:**
- Adopting new technologies
- Implementing architectural patterns (e.g., DDD, CQRS)
- Performance optimization
- Security practices
- Testing strategies

**Example:**
```
Enabling Team
├── Expertise: DDD, Event Sourcing, CQRS
├── Engagement: 2-week pairing with Inventory Team
├── Goal: Transfer knowledge on implementing Event Sourcing
└── Outcome: Inventory Team becomes self-sufficient
```

**Interaction Mode:** Facilitating (temporary knowledge transfer)

### Complicated-Subsystem Team

**Definition:** Team owning a complex technical component requiring specialist knowledge

**Characteristics:**
- High complexity requires dedicated focus
- Reduces cognitive load for stream-aligned teams
- Provides X-as-a-Service interface
- **Rare** - only when truly necessary

**Examples:**
- ML/AI models
- Complex pricing algorithms
- Video encoding/processing
- Geospatial calculations

**Example:**
```
Pricing Engine Team (Complicated-Subsystem)
├── Owns: Complex ML-based pricing algorithm
├── Provides: Pricing API
├── Hides: ML model complexity
└── Consumers: Order Team, Customer Team
```

**Interaction Mode:** X-as-a-Service (stream-aligned teams consume via API)

## Team Interaction Modes

### Collaboration Mode

**When:** Discovery and rapid learning

**Characteristics:**
- Two teams work closely together
- High communication bandwidth
- Time-limited (weeks to months)
- Use when building new capabilities
- Use when integration points are unclear

**Example:**
```
Order Team ↔ Inventory Team (Collaboration)
├── Goal: Define integration for stock reservation
├── Duration: 4 weeks
├── Activities: Pair programming, daily syncs, shared design
└── Outcome: Clear API contract, switch to X-as-a-Service
```

**Transition:** Switch to X-as-a-Service when interfaces stabilize

### X-as-a-Service Mode

**When:** Stable, well-defined interfaces

**Characteristics:**
- Clear API/interface between teams
- Minimal collaboration required
- Versioned APIs
- Service-level expectations defined
- Self-service where possible

**Example:**
```
Order Team → Platform Team (X-as-a-Service)
├── Order Team consumes: Database provisioning API
├── SLA: Database available in <10 minutes
├── Documentation: Self-service portal
└── Communication: Minimal (via API)
```

**Primary Mode For:**
- Stream-aligned ↔ Platform
- Stream-aligned ↔ Complicated-Subsystem
- Stable integrations between stream-aligned teams

### Facilitating Mode

**When:** Learning and capability building

**Characteristics:**
- Enabling team helps stream-aligned team
- Teaching and mentoring focus
- Time-limited engagement
- Stream-aligned team retains ownership
- Goal: increase capability, not create dependency

**Example:**
```
Enabling Team → Customer Team (Facilitating)
├── Request: Help implementing CQRS pattern
├── Engagement: 2 weeks embedded pairing
├── Ownership: Remains with Customer Team
└── Outcome: Customer Team can apply CQRS independently
```

**Primary Mode For:**
- Enabling team ↔ Stream-aligned team

## Team Ownership

### Bounded Context Ownership

**Rule:** One stream-aligned team owns one bounded context

**Ownership Includes:**
- All layers: domain, application, adapters, infrastructure (see [Domain-Centric Architecture Layers](../architecture/dependency-structure.md#layer-dependency-flow))
- Code, tests, deployment, monitoring, support
- Autonomy over internal implementation
- Responsibility for published interfaces/APIs

**Example:**
```
Order Team owns Order Bounded Context
├── domain/ (Order, OrderLine, Money)
├── application/ (CreateOrderUseCase, CancelOrderUseCase)
├── adapter/ (OrderController, OrderRepositoryAdapter)
├── infrastructure/ (Spring configuration)
├── Tests (unit, integration, E2E within context)
├── CI/CD pipeline
├── Monitoring dashboards
└── On-call rotation
```

> **For bounded context technical structure:** See [Domain-Centric Architecture](../architecture/package-structure.md#java-package-structure)

### Code Ownership

**Strong Code Ownership:**
- Team controls all changes to their context
- Cross-team code changes via API/interface only
- No shared code ownership across teams
- Pull requests reviewed by team members

**Shared Kernel Exception:**
- Requires explicit team agreement
- Coordinate changes via architecture guild
- Use sparingly (see [Domain-Centric Architecture - Shared Kernel](../architecture/rules.md#packaging-rules))

### API/Interface Ownership

**Team API Responsibilities:**
- **Synchronous APIs:** REST endpoints (in `adapter/incoming/web/`)
- **Asynchronous APIs:** Integration Events (in `events/`)
- **Domain APIs:** Input Ports (in `application/{usecasename}/`)

**API Management:**
- Team owns and versions their public APIs
- Breaking changes require coordination
- Semantic versioning for APIs
- Backward compatibility preferred
- Anti-Corruption Layer for consuming external APIs

**Example:**
```
Order Team's APIs:
├── REST API: POST /orders, GET /orders/{id}
├── Integration Events: OrderCreatedEvent, OrderCancelledEvent
└── Versioning: Semantic versioning (v1, v2, v3)
    └── v2 maintains backward compatibility with v1
```

> **For adapter and API technical patterns:** See [Domain-Centric Architecture - Adapter Layer](../architecture/rules.md#adapter-layer-rules)

## Conway's Law

### The Law

> "Organizations which design systems are constrained to produce designs which are copies of the communication structures of these organizations."
> — Melvin Conway

**In Practice:**
- System boundaries tend to match team boundaries
- Communication patterns between teams reflect in system architecture
- Tightly coupled teams produce tightly coupled systems
- Independent teams produce independent systems

### Reverse Conway Maneuver

**Strategy:** Design team structure to achieve desired architecture

**Steps:**
1. Define desired architecture (bounded contexts)
2. Align team boundaries with bounded context boundaries
3. Minimize inter-team dependencies
4. Use appropriate interaction modes

**Example:**
```
Desired Architecture:
├── Order BC (independent)
├── Customer BC (independent)
└── Inventory BC (independent)

Team Structure:
├── Order Team (owns Order BC)
├── Customer Team (owns Customer BC)
└── Inventory Team (owns Inventory BC)

Result: Independent deployment, loose coupling
```

### Organizational Design Principles

**Align:**
- 1 Bounded Context = 1 Stream-Aligned Team
- Independent bounded contexts → Independent teams
- Clear bounded context boundaries → Clear team boundaries

**Minimize:**
- Inter-team dependencies
- Synchronous communication
- Shared code ownership

**Optimize:**
- Team autonomy
- Fast flow of value
- Independent deployment

## Cognitive Load Management

### What is Cognitive Load?

**Definition:** Mental capacity required to work with a system

**Three Types:**
1. **Intrinsic:** Inherent complexity of domain
2. **Extraneous:** Complexity from poor design/tools
3. **Germane:** Learning and skill development

**Goal:** Keep total cognitive load within team capacity

### Managing Team Cognitive Load

**For Stream-Aligned Teams:**
- Limit to **one bounded context** per team
- Limit to **one core domain** per team
- Offload generic subdomains to platform or external services
- Use platform team to reduce infrastructure cognitive load
- Use enabling team to reduce learning cognitive load

**For Platform Team:**
- Provides self-service infrastructure
- Reduces cognitive load of stream-aligned teams
- Makes complex infrastructure simple to consume

**For Enabling Team:**
- Reduces learning curve for new patterns/technologies
- Transfers knowledge to reduce future cognitive load

**Example - Reducing Load:**
```
Before:
Order Team manages:
├── Order domain (intrinsic load)
├── Kubernetes infrastructure (extraneous load)
├── Database setup (extraneous load)
├── Monitoring setup (extraneous load)
└── Total: OVERLOADED

After:
Order Team manages:
├── Order domain (intrinsic load)
└── Total: MANAGEABLE

Platform Team provides:
├── Kubernetes platform (X-as-a-Service)
├── Database service (X-as-a-Service)
└── Monitoring service (X-as-a-Service)
```

## Team Structure Examples

### E-Commerce Organization

```
┌─────────────────────────────────────────────┐
│  Platform Team                              │
│  - Database as a Service                    │
│  - Message Broker as a Service              │
│  - CI/CD Pipelines                          │
│  - Monitoring/Observability                 │
└─────────────────────────────────────────────┘
     ↓ provides services (X-as-a-Service)
┌─────────────────────────────────────────────┐
│  Stream-Aligned Teams                       │
│                                             │
│  ┌─────────────┐  ┌─────────────┐         │
│  │ Order Team  │  │Customer Team│         │
│  │             │  │             │         │
│  │ Owns:       │  │ Owns:       │         │
│  │ - Order BC  │  │ - Customer  │         │
│  │ - Full stack│  │   BC        │         │
│  │ - Deployment│  │ - Full stack│         │
│  └─────────────┘  └─────────────┘         │
│         ↕                 ↕                 │
│         └── Events/APIs ──┘                 │
└─────────────────────────────────────────────┘
     ↑ receives help (Facilitating)
┌─────────────────────────────────────────────┐
│  Enabling Team                              │
│  - DDD/Architecture expertise               │
│  - Testing practices                        │
│  - Performance optimization                 │
└─────────────────────────────────────────────┘
```

### Team Interaction Patterns

**Stream-Aligned ↔ Stream-Aligned:**
- **Preferred:** X-as-a-Service via domain events (async)
- **Alternative:** X-as-a-Service via REST API (sync)
- **Initial:** Collaboration mode during integration discovery
- **Transition:** To X-as-a-Service when interfaces stabilize

**Stream-Aligned ↔ Platform:**
- **Always:** X-as-a-Service
- Platform provides self-service infrastructure
- Clear SLAs and documentation

**Stream-Aligned ↔ Enabling:**
- **Always:** Facilitating mode
- Time-boxed engagement
- Knowledge transfer, not delivery

**Stream-Aligned ↔ Complicated-Subsystem:**
- **Always:** X-as-a-Service
- Well-defined API
- Complicated subsystem hides complexity

> **For technical integration patterns:** See [Domain-Centric Architecture - Integration Patterns](../architecture/integration-patterns.md#integration-patterns)

## Deployment & Operations

### Team Deployment Responsibilities

**Stream-Aligned Team:**
- Deploys their own bounded context
- Owns CI/CD pipeline for their context
- Independent deployment schedule
- Blue/green or canary deployments

**Platform Team:**
- Provides deployment infrastructure
- Provides CI/CD platform
- Ensures deployment self-service

**Example:**
```
Order Team Deployment:
├── CI/CD Pipeline: TeamCity (provided by Platform)
├── Deployment: Kubernetes (provided by Platform)
├── Schedule: Independent (10+ deploys/day possible)
└── Strategy: Blue/green deployment
```

> **For deployment patterns:** See [Deployment Patterns](./deployment-patterns.md)

### Monitoring & Observability

**Stream-Aligned Team:**
- Monitors their own bounded context
- Own dashboards and alerts
- On-call rotation for their context
- Domain events provide audit trail

**Platform Team:**
- Provides monitoring infrastructure
- Provides centralized logging
- Provides distributed tracing
- Self-service dashboards

**Example:**
```
Order Team Monitoring:
├── Infrastructure: Prometheus + Grafana (Platform Team)
├── Dashboards: Custom Order metrics (Order Team)
├── Alerts: Order-specific thresholds (Order Team)
└── On-call: Order Team rotation
```

## Progressive Structure Evolution

Teams and architecture should evolve together. For detailed package structure evolution, see [Domain-Centric Architecture - Progressive Complexity](../architecture/package-structure.md#progressive-complexity-principle).

### Phase 1: New Stream-Aligned Team (Week 1-2)

**Team Context:**
- Team just formed
- Learning domain and DDD patterns
- **Enabling team may be embedded** to teach
- **Collaboration mode** with other teams for discovery

**Technical Structure:**
- Flat directories within each layer
- ~10-15 files total
- Focus on shipping value, not perfect structure

### Phase 2: Growing Team (Month 2-3)

**Team Context:**
- Team becoming autonomous
- **Transitioning to X-as-a-Service mode** with other teams
- Less enabling team involvement
- Focus on scaling features

**Technical Structure:**
- Added subdirectories for organization
- ~25-30 files
- Use cases still relatively flat

### Phase 3: Mature Team (Month 6+)

**Team Context:**
- **Team fully autonomous**
- **Clear team APIs** (Input Ports, Integration Events, REST)
- **X-as-a-Service mode** with all teams
- Team makes independent architectural decisions

**Technical Structure:**
- Full subdivision per layer
- 60+ files, well-organized
- DTOs, mappers, and ACLs separated

## Implementation Patterns

### With Modular Monolith (Spring Modulith)

**Team Structure:**
```
Single Deployment, Multiple Teams
┌─────────────────────────────────────────┐
│  E-Commerce Application                 │
│                                         │
│  ┌────────────┐  Order Team (owns)     │
│  │Order Module│                         │
│  └────────────┘                         │
│                                         │
│  ┌──────────────┐  Customer Team (owns)│
│  │Customer      │                       │
│  │Module        │                       │
│  └──────────────┘                       │
│                                         │
│  ┌────────────┐  Inventory Team (owns) │
│  │Inventory   │                         │
│  │Module      │                         │
│  └────────────┘                         │
└─────────────────────────────────────────┘
        ↓ deployed by
┌─────────────────────────────────────────┐
│  Platform Team                          │
│  - Deployment pipeline                  │
│  - Database                             │
│  - Monitoring                           │
└─────────────────────────────────────────┘
```

> **For Spring Modulith details:** See [Spring Modulith Implementation](./spring-modulith.md)

### With Microservices

**Team Structure:**
```
┌────────┐     ┌──────────────────────┐     ┌────────┐
│ Order  │     │ Spring Boot App      │     │Inventory│
│Service │     │ ┌────────┐          │     │Service │
│        │────→│ │Customer│          │←────│        │
│(Order  │     │ │ Module │          │     │(Inven- │
│Team)   │     │ └────────┘          │     │tory    │
└────────┘     │ (Customer Team)     │     │Team)   │
               └──────────────────────┘     └────────┘
```

> **For service decomposition:** See [Deployment Patterns](./deployment-patterns.md)

## Summary

**Key Principles:**

1. **Team ≈ Bounded Context** - Align team boundaries with bounded context boundaries
2. **Conway's Law** - Design team structure to achieve desired architecture
3. **Four Team Types** - Stream-Aligned, Platform, Enabling, Complicated-Subsystem
4. **Three Interaction Modes** - Collaboration, X-as-a-Service, Facilitating
5. **Cognitive Load** - Keep team load manageable
6. **Team APIs** - Clear interfaces between teams (technical + organizational)

**Team Evolution:**
- Start with collaboration mode for discovery
- Transition to X-as-a-Service for stability
- Use enabling team for learning
- Use platform team to reduce cognitive load

**Cross-References:**
- Technical architecture: [Domain-Centric Architecture](../README.md)
- Deployment strategies: [Deployment Patterns](./deployment-patterns.md)
- Modular monolith: [Spring Modulith Implementation](./spring-modulith.md)
