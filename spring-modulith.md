# Spring Modulith Implementation
*Practical Implementation of Domain-Centric Architecture using Spring Modulith*

> **📘 Prerequisites:** This document shows how to implement [Domain-Centric Architecture](./README.md) using Spring Modulith. Read the main document first for core patterns and rules.

> **☕ Java/Spring specific.** Everything here assumes Spring Boot and Spring Modulith. The .NET
> equivalents — project boundaries plus ArchUnitNET instead of module verification, an outbox or
> post-commit dispatch instead of `@TransactionalEventListener`, DI registration instead of component
> scan — are in [Language Mappings](./language-mappings.md).

## Introduction

Spring Modulith is a framework for building **modular monolithic applications** with Spring Boot. It implements the [Domain-Centric Architecture](./README.md) patterns while providing:

- **Module Verification** - Enforces architectural boundaries at compile/test time
- **Event-Based Communication** - Application Events between modules
- **Documentation** - Auto-generates module documentation
- **Observability** - Built-in module metrics and tracing
- **Integration Testing** - Test modules in isolation
- **Event Publication Registry** - Guaranteed event delivery

**Mapping:**
```
Spring Modulith Module = Bounded Context (from DDD)
                       = Domain-Centric Architecture Package Structure
```

> **Note:** For core bounded context and layer concepts, see [Domain-Centric Architecture](./README.md).

## What is Spring Modulith?

Spring Modulith enables building modular monoliths with clear boundaries between modules, making it easy to:

1. **Start Simple** - Single deployment unit, simple development
2. **Enforce Boundaries** - Modules can't access each other's internals
3. **Event-Driven** - Asynchronous communication between modules
4. **Extract Services** - Easy path to microservices if needed

**Benefits over plain Spring Boot:**
- Explicit module boundaries
- Compile-time verification of dependencies
- Event-based decoupling
- Easy testing of modules in isolation
- Clear documentation of module structure

## Core Concepts

### Module

**Definition:** In Spring Modulith, **one top-level package = one module**

```
com.company.ecommerce
├── order/          ← Module (= Bounded Context)
├── customer/       ← Module (= Bounded Context)
└── inventory/      ← Module (= Bounded Context)
```

**Alignment:**
- One module = one bounded context (typical)
- One team owns one module (recommended)
- Module follows [Domain-Centric Architecture layers](./README.md#layer-dependency-flow)

### Module Types

**Application Module** (default, recommended):
```java
@org.springframework.modulith.ApplicationModule
package com.company.ecommerce.order;
```
- Main business module
- Implements a bounded context
- Only specified packages are public

**Open Module** (use sparingly):
```java
@org.springframework.modulith.ApplicationModule(
    type = Type.OPEN
)
package com.company.ecommerce.shared;
```
- All packages are public
- Use only for shared kernel
- Requires team coordination

### Module API Surface

Modules expose clear API surfaces through specific packages:

**Published Package (`api/`):**
```java
// order/api/package-info.java
@org.springframework.modulith.NamedInterface("api")
package com.company.ecommerce.order.api;
```
- Public API of module
- Synchronous integration point
- Contains interfaces and DTOs

**Event Package (`events/`):**
```java
// order/events/package-info.java
@org.springframework.modulith.NamedInterface("events")
package com.company.ecommerce.order.events;
```
- Events published by module
- Asynchronous integration point
- Contains integration event DTOs

**Internal Package (`internal/`):**
- Hidden implementation
- Contains domain, application, adapter layers (see [Domain-Centric Architecture](./README.md#java-package-structure))
- Other modules CANNOT access

## Event-Driven Architecture in Spring Modulith

### Domain Events vs Integration Events

Spring Modulith supports two types of events that align with [Domain-Driven Design principles](./README.md#domain-event-rules-internal-to-bounded-context):

#### Domain Events (Internal to Module)

**Purpose:** Communication within bounded context (module)

**Location:** `{module}/internal/domain/event/` OR `{module}/events/` if kept internal

**Characteristics:**
- Scope: Same module, can cross aggregates within module
- Marker: Optional `DomainEvent` interface
- Publishing: Via `ApplicationEventPublisher` within use case
- Consumption: Via `@EventListener` within same module
- Persistence: Optional
- Retry: Not automatic
- Transaction: Same transaction as use case

**Example:**
```java
// order/internal/domain/event/OrderCreated.java
public record OrderCreated(
    UUID orderId,
    CustomerId customerId,
    Money totalAmount,
    Instant occurredAt
) implements DomainEvent {
    // Internal domain event - stays within Order module
}
```

#### Integration Events (Cross-Module)

**Purpose:** Communication between modules (bounded contexts)

**Location:** `{module}/events/` (published package)

**Characteristics:**
- **Marker:** `implements Externalized` (Spring Modulith interface) - **KEY DIFFERENCE**
- Scope: Across modules, published to external consumers
- Publishing: Via `ApplicationEventPublisher` + Event Publication Registry
- Consumption: Via `@ApplicationModuleListener` in other modules
- Persistence: Yes (Event Publication Registry ensures delivery)
- Retry: Automatic retry on failure
- Serialization: Must be serializable
- Versioning: Required for cross-module contracts

**Example:**
```java
// order/events/OrderCreatedEvent.java
public record OrderCreatedEvent(
    String eventId,
    String orderId,
    String customerId,
    BigDecimal totalAmount,
    Instant timestamp,
    String version
) implements org.springframework.modulith.events.Externalized {
    // Integration event - crosses module boundaries
    // Implements Externalized = Spring Modulith persists it
}
```

### Event Architecture Comparison

| Aspect | Domain Event | Integration Event |
|--------|--------------|-------------------|
| **Scope** | Within module | Across modules |
| **Package** | `internal/domain/event/` | `events/` (published) |
| **Marker** | Optional `DomainEvent` | `implements Externalized` ⭐ |
| **Serialization** | Not required | Required |
| **Versioning** | Not required | Required |
| **Delivery** | Sync (in-tx) *or* async (registry-backed) | Async, externalized via registry |
| **Persistence** | Only when delivered async (registry) | Yes (Event Publication Registry) |
| **Retry** | Resubmission supported for registry-backed listeners | Configure bounded retries, backoff and manual replay |
| **Visibility** | Private to module | Public to all modules |

> **Delivery mode is orthogonal to event type.** Persistence and retry come from
> **asynchronous, registry-backed delivery** — not from an event being "integration".
> A domain event handled by a synchronous listener runs in the publishing transaction and
> needs neither. A domain event handled by an **async** `@ApplicationModuleListener` is
> persisted in the registry and redelivered at-least-once — the same durable, in-process
> transactional-outbox guarantee, still **without leaving the module**. The integration
> event differs only in that its async delivery is *externalized* to a broker.

### Spring Modulith Event Publication Registry

Spring Modulith provides an **Event Publication Registry** that ensures reliable event delivery:

**Features:**
- **Persistent Events**: Events marked with `@Externalized` are persisted to database
- **Guaranteed Delivery**: Events are marked complete only after successful processing
- **Automatic Retry**: Failed event handlers are retried automatically
- **Idempotency Support**: Handlers can be idempotent via event IDs
- **Observability**: Track event processing status and failures

**Configuration:**
```java
@Configuration
@EnableApplicationModuleListener  // Enables async event processing
public class EventConfiguration {
    // Spring Modulith auto-configures Event Publication Registry
    // when spring-modulith-events-jdbc or spring-modulith-events-jpa is on classpath
}
```

**Built-in Transactional Outbox:** The registry is Spring Modulith's equivalent of the Transactional Outbox pattern. The event publication is persisted in the same transaction as the aggregate state change, so neither can exist without the other. Completion is tracked after the listener executes successfully, and incomplete publications can be resubmitted — giving at-least-once delivery. Externalized events (Kafka, RabbitMQ, etc.) get the same guarantee; a dedicated outbox table plus relay process is only needed outside Spring Modulith.

### Event Publishing Pattern

**Publishing Domain Event (internal):**
```java
@Service
@RequiredArgsConstructor
public class CreateOrderUseCase {
    private final ApplicationEventPublisher events;
    private final OrderRepository orders;

    @Transactional
    public OrderId execute(CreateOrderCommand command) {
        // 1. Create aggregate
        Order order = Order.create(command);

        // 2. Save aggregate
        orders.save(order);

        // 3. Publish domain event (same transaction)
        events.publishEvent(new OrderCreated(
            order.getId(),
            order.getCustomerId(),
            order.getTotalAmount(),
            Instant.now()
        ));

        return order.getId();
    }
}
```

**Converting to Integration Event (cross-module):**
```java
// Listening to domain event and publishing integration event
@Component
@RequiredArgsConstructor
class OrderEventPublisher {
    private final ApplicationEventPublisher events;

    @EventListener
    void on(OrderCreated event) {
        // Map domain event → integration event
        events.publishEvent(new OrderCreatedEvent(
            UUID.randomUUID().toString(),
            event.orderId().toString(),
            event.customerId().toString(),
            event.totalAmount().getAmount(),
            event.occurredAt(),
            "v1"  // Version for compatibility
        ));
        // Integration event persisted by Event Publication Registry
    }
}
```

### Event Consumption Pattern

**Consuming Integration Event (from another module):**
```java
@Component
@RequiredArgsConstructor
class InventoryEventListener {
    private final ReserveStockUseCase reserveStock;

    @ApplicationModuleListener  // Spring Modulith async listener
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    void on(OrderCreatedEvent event) {
        // Anti-Corruption Layer: Convert integration event → command
        var command = new ReserveStockCommand(
            OrderId.of(event.orderId()),
            // Map to Inventory's domain language
        );

        // Execute use case in Inventory's bounded context
        reserveStock.execute(command);

        // Event marked complete in Event Publication Registry
    }
}
```

**Key Points:**
- `@ApplicationModuleListener` enables async processing in new transaction
- `Propagation.REQUIRES_NEW` ensures independent transaction
- Failures trigger automatic retry (configured via Spring Modulith)
- Anti-Corruption Layer protects consuming module's domain

### Idempotent Consumers

At-least-once delivery means every listener must expect duplicates and out-of-order arrival:

```java
@ApplicationModuleListener
void on(OrderCreatedEvent event) {
    if (processedEvents.contains(event.eventId())) {
        return; // Duplicate delivery — already handled
    }
    reserveStock.execute(toCommand(event));
    processedEvents.markProcessed(event.eventId());
}
```

**Rules:**
- **Deduplicate** — track processed event IDs in the consumer's own store, or make the operation naturally idempotent (e.g., `reserveStock(orderId)` upserts the reservation instead of inserting a new one)
- **Tolerate out-of-order arrival** — never assume the previous event was already seen
- **Never drop silently** — permanently failing events go to a dead-letter mechanism (e.g., alert plus manual resubmission of incomplete publications after retries are exhausted)

### Anti-Corruption Layer (ACL) Pattern

When consuming integration events from other modules, use an **Anti-Corruption Layer** to protect your domain model from external event formats. The ACL translates external events into your module's domain language.

**Purpose:**
- **Isolation** - Protect domain from changes in other modules
- **Translation** - Convert external language to internal language
- **Validation** - Ensure external data meets internal invariants
- **Decoupling** - Module's domain remains independent

**Pattern Structure:**
```
Consuming Module (Inventory):
│
├── events/ (listening to external events)
│   └── OrderEventConsumer.java        ← Event listener (adapter)
│
├── acl/ (anti-corruption layer)
│   └── OrderEventToInventoryMapper.java  ← ACL Translator
│
└── application/
    └── reservestock/
        ├── ReserveStockInputPort.java
        ├── ReserveStockUseCase.java
        └── ReserveStockCommand.java     ← Internal command (domain language)
```

**Complete ACL Example:**

```java
// ========== PRODUCING MODULE (Order) ==========

// Order module publishes integration event
package com.company.ecommerce.order.events;

public record OrderCreatedEvent(
    String eventId,
    String orderId,
    String customerId,
    List<OrderItemDto> items,  // External DTO format
    BigDecimal totalAmount,
    String currency,
    Instant timestamp,
    String version
) implements org.springframework.modulith.events.Externalized {
    // Integration event - Order's language
}

public record OrderItemDto(
    String productId,
    int quantity,
    BigDecimal price
) {}

// ========== CONSUMING MODULE (Inventory) ==========

// 1. EVENT LISTENER (Adapter) - Receives external event
package com.company.ecommerce.inventory.adapter.incoming.event;

@Component
@RequiredArgsConstructor
public class OrderEventConsumer {

    private final OrderEventToInventoryMapper acl;  // ACL translator
    private final ReserveStockInputPort reserveStock;  // Use case

    @ApplicationModuleListener
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void on(OrderCreatedEvent event) {  // External event (Order's language)

        // Use ACL to translate external event → internal command
        ReserveStockCommand command = acl.toReserveStockCommand(event);

        // Execute use case with internal command (Inventory's language)
        reserveStock.execute(command);

        // Event marked complete in Event Publication Registry
    }
}

// 2. ANTI-CORRUPTION LAYER (ACL) - Translator
package com.company.ecommerce.inventory.acl;

@Component
public class OrderEventToInventoryMapper {

    /**
     * Translates OrderCreatedEvent (Order's language)
     * → ReserveStockCommand (Inventory's language)
     *
     * This is the Anti-Corruption Layer - it protects Inventory's domain
     * from Order's event structure and terminology.
     */
    public ReserveStockCommand toReserveStockCommand(OrderCreatedEvent event) {

        // Validation - protect domain invariants
        if (event.items() == null || event.items().isEmpty()) {
            throw new IllegalArgumentException("Order must have items");
        }

        // Translation - Order's OrderItemDto → Inventory's StockReservationItem
        List<StockReservationItem> reservationItems = event.items().stream()
            .map(this::toStockReservationItem)
            .toList();

        // Create command in Inventory's language
        return new ReserveStockCommand(
            OrderReference.of(event.orderId()),  // Inventory's value object
            reservationItems,                     // Inventory's domain objects
            ReservationReason.ORDER_PLACEMENT    // Inventory's enum
        );
    }

    private StockReservationItem toStockReservationItem(OrderItemDto orderItem) {
        return new StockReservationItem(
            ProductSku.of(orderItem.productId()),  // Inventory's SKU value object
            Quantity.of(orderItem.quantity())      // Inventory's Quantity value object
        );
        // Note: Inventory doesn't care about price - that's Order's concern
    }
}

// 3. INTERNAL COMMAND (Application Layer) - Inventory's language
package com.company.ecommerce.inventory.application.reservestock;

public record ReserveStockCommand(
    OrderReference orderReference,      // Inventory's value object
    List<StockReservationItem> items,   // Inventory's domain concept
    ReservationReason reason             // Inventory's enum
) {}

// Inventory's value objects - its own domain language
public record OrderReference(String value) {
    public static OrderReference of(String value) {
        return new OrderReference(value);
    }
}

public record ProductSku(String value) {
    public static ProductSku of(String value) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException("SKU cannot be empty");
        }
        return new ProductSku(value);
    }
}

public record Quantity(int value) {
    public static Quantity of(int value) {
        if (value <= 0) {
            throw new IllegalArgumentException("Quantity must be positive");
        }
        return new Quantity(value);
    }
}

public enum ReservationReason {
    ORDER_PLACEMENT,
    MANUAL_RESERVATION,
    RESTOCK_RETURN
}

// 4. USE CASE (Application Layer) - Uses Inventory's domain
package com.company.ecommerce.inventory.application.reservestock;

@Service
@RequiredArgsConstructor
public class ReserveStockUseCase implements ReserveStockInputPort {

    private final StockRepository stockRepository;  // Inventory's repository

    @Override
    public ReserveStockResult execute(ReserveStockCommand command) {
        // Work with Inventory's domain language and rules
        // No knowledge of Order module's structure

        for (StockReservationItem item : command.items()) {
            Stock stock = stockRepository.findBySku(item.sku())
                .orElseThrow(() -> new StockNotFoundException(item.sku()));

            stock.reserve(item.quantity(), command.orderReference());

            stockRepository.save(stock);
        }

        return new ReserveStockResult(true);
    }
}
```

**Key Benefits of ACL:**

1. **Language Independence**
   - Order uses `OrderItemDto` with `productId`
   - Inventory uses `StockReservationItem` with `ProductSku`
   - ACL translates between the two

2. **Structural Independence**
   - Order's event structure can change
   - ACL absorbs the change
   - Inventory's domain remains stable

3. **Validation at Boundary**
   - ACL validates external data before it enters domain
   - Protects domain invariants
   - Fails fast on invalid external data

4. **Decoupled Evolution**
   - Order and Inventory teams work independently
   - Each module uses its own ubiquitous language
   - No shared domain objects across contexts

**ACL Placement Rules:**

✅ **Correct:**
- ACL in consuming module: `inventory/acl/OrderEventToInventoryMapper.java`
- Translates external event → internal command
- Located in adapter layer or dedicated `acl/` package

❌ **Incorrect:**
- No ACL - Use case directly consumes external event
- Shared domain objects between modules
- External event structure leaking into domain

### Event Mapper Pattern (Domain Event → Integration Event)

The **Event Mapper** is the outbound equivalent of ACL - it translates internal domain events into external integration events.

**Structure:**
```
Producing Module (Order):
│
├── domain/event/
│   └── OrderCreated.java             ← Internal domain event
│
├── adapter/outgoing/messaging/
│   └── OrderEventMapper.java         ← Event Mapper
│
└── events/ (published)
    └── OrderCreatedEvent.java        ← External integration event
```

**Example:**

```java
// Internal Domain Event (Order's domain language)
package com.company.ecommerce.order.domain.event;

public record OrderCreated(
    OrderId orderId,                   // Domain value object
    CustomerId customerId,             // Domain value object
    List<OrderLine> orderLines,        // Domain entities
    Money totalAmount,                 // Domain value object
    Instant occurredAt
) implements DomainEvent {}

// Event Mapper (Adapter)
package com.company.ecommerce.order.adapter.outgoing.messaging;

@Component
@RequiredArgsConstructor
public class OrderEventMapper {

    private final ApplicationEventPublisher events;

    @EventListener  // Listen to internal domain event
    public void on(OrderCreated domainEvent) {

        // Map domain event → integration event (DTO)
        OrderCreatedEvent integrationEvent = toIntegrationEvent(domainEvent);

        // Publish integration event (persisted by Event Publication Registry)
        events.publishEvent(integrationEvent);
    }

    private OrderCreatedEvent toIntegrationEvent(OrderCreated domainEvent) {
        return new OrderCreatedEvent(
            UUID.randomUUID().toString(),         // Event ID for idempotency
            domainEvent.orderId().getValue(),     // Extract primitive from value object
            domainEvent.customerId().getValue(),  // Extract primitive from value object
            toOrderItemDtos(domainEvent.orderLines()),  // Map to DTOs
            domainEvent.totalAmount().getAmount(),
            domainEvent.totalAmount().getCurrency().getCurrencyCode(),
            domainEvent.occurredAt(),
            "v1"  // Version for compatibility
        );
    }

    private List<OrderItemDto> toOrderItemDtos(List<OrderLine> orderLines) {
        return orderLines.stream()
            .map(line -> new OrderItemDto(
                line.getProductId().getValue(),
                line.getQuantity(),
                line.getPrice().getAmount()
            ))
            .toList();
    }
}

// External Integration Event (Published DTO)
package com.company.ecommerce.order.events;

public record OrderCreatedEvent(
    String eventId,
    String orderId,
    String customerId,
    List<OrderItemDto> items,
    BigDecimal totalAmount,
    String currency,
    Instant timestamp,
    String version
) implements org.springframework.modulith.events.Externalized {}
```

**Key Principles:**

1. **Domain events stay internal** - Never cross module boundaries
2. **Integration events are DTOs** - Serializable, versioned, primitive types
3. **Event Mapper translates** - Domain language → External DTO
4. **Two-step publishing** - Domain event → Event Mapper → Integration event

### Best Practices

**When to Use Domain Events:**
- Communication within the same module
- Eventual consistency between aggregates in same bounded context
- Triggering side effects in same transaction

**When to Use Integration Events:**
- Communication between different modules (bounded contexts)
- Cross-team integration points
- Events that may be externalized to message broker later
- When guaranteed delivery and retry are needed

**Naming Conventions:**
- Domain Events: Past tense, no suffix (e.g., `OrderCreated`, `PaymentProcessed`)
- Integration Events: Past tense + "Event" suffix (e.g., `OrderCreatedEvent`, `PaymentProcessedEvent`)

## Module Structure

### Recommended Structure: Module per Bounded Context

```
com.company.ecommerce
├── order (module = bounded context)
│   ├── api (published - public interface)
│   │   ├── OrderApi.java
│   │   ├── CreateOrderRequest.java
│   │   └── OrderResponse.java
│   ├── events (published - integration events)
│   │   ├── OrderCreatedEvent.java
│   │   └── OrderCancelledEvent.java
│   └── internal (hidden)
│       ├── domain
│       │   ├── model
│       │   │   ├── Order.java (Aggregate Root)
│       │   │   ├── OrderLine.java (Entity)
│       │   │   └── Money.java (Value Object)
│       │   ├── service
│       │   │   └── PricingService.java
│       │   └── event
│       │       └── OrderCreated.java (Domain Event)
│       ├── application
│       │   ├── createorder
│       │   │   ├── CreateOrderInputPort.java
│       │   │   ├── CreateOrderUseCase.java
│       │   │   ├── CreateOrderCommand.java
│       │   │   └── CreateOrderResult.java
│       │   ├── findorder
│       │   ├── cancelorder
│       │   └── shared
│       │       ├── OrderRepository.java
│       │       └── DomainEventPublisher.java
│       ├── adapter
│       │   ├── incoming
│       │   │   ├── web
│       │   │   │   └── OrderController.java
│       │   │   └── event
│       │   │       └── OrderEventConsumer.java
│       │   └── outgoing
│       │       ├── persistence
│       │       │   └── OrderRepositoryAdapter.java
│       │       └── payment
│       │           └── PaymentGatewayAdapter.java
│       └── config
│           └── OrderModuleConfiguration.java
```

> **Note:** The `internal/` structure follows [Domain-Centric Architecture layers](./README.md#java-package-structure). See main document for layer rules and responsibilities.

### Module Configuration

**Module Rules (package-info.java):**
```java
// order/package-info.java
@org.springframework.modulith.ApplicationModule(
    displayName = "Order Management",
    allowedDependencies = {"customer::api", "inventory::api", "shared"}
)
package com.company.ecommerce.order;
```

**API Package:**
```java
// order/api/package-info.java
@org.springframework.modulith.NamedInterface("api")
package com.company.ecommerce.order.api;
```

**Events Package:**
```java
// order/events/package-info.java
@org.springframework.modulith.NamedInterface("events")
package com.company.ecommerce.order.events;
```

## Progressive Complexity for Spring Modulith Modules

When creating a Spring Modulith module (bounded context), **start with minimal structure** and add complexity only when needed.

> **Core Principle:** The full package structure shown in this document is for **mature modules**. Don't start there!

For general progressive complexity guidelines, see [Domain-Centric Architecture](./README.md#progressive-complexity-principle).

### Phase 1: Minimal Module Structure (Starting Out)

**When:**
- New module creation
- <10 domain classes
- <5 use cases
- MVP or proof-of-concept phase

**Timeline:** Weeks 1-2

**Structure:**
```
com.company.ecommerce.order/ (module)
├── package-info.java (@ApplicationModule)
├── api/ (published)
│   ├── package-info.java (@NamedInterface("api"))
│   ├── OrderApi.java
│   └── CreateOrderRequest.java
├── events/ (published)
│   ├── package-info.java (@NamedInterface("events"))
│   └── OrderCreatedEvent.java (implements Externalized)
└── internal/ (hidden)
    ├── Order.java (Aggregate Root - domain)
    ├── OrderLine.java (Entity - domain)
    ├── Money.java (Value Object - domain)
    ├── CreateOrderUseCase.java (application)
    ├── OrderRepository.java (port - interface)
    ├── OrderController.java (adapter - web)
    └── OrderRepositoryAdapter.java (adapter - persistence)
```

**Characteristics:**
- **Flat internal structure** - all implementation files directly in `internal/`
- **Essential packages only** - `api/`, `events/`, `internal/`
- **~10-15 files total**
- Fast to navigate, easy to understand

### Phase 2: Growing Module Structure (Adding Features)

**When:**
- 10-30 domain classes
- 5-10 use cases
- Multiple external integrations

**Timeline:** Months 2-3

**Triggers for Refactoring:**
- **>10 files in internal/** suggests subdivision
- **>3 domain events** suggests `internal/domain/event/` package
- **>2 adapter types** suggests `internal/adapter/incoming/` and `/outgoing/` packages

**Structure:**
```
com.company.ecommerce.order/
├── api/
├── events/
└── internal/
    ├── domain/
    │   ├── model/
    │   │   ├── Order.java
    │   │   ├── OrderLine.java
    │   │   └── Money.java
    │   ├── event/
    │   │   ├── OrderCreated.java (Domain Event - internal)
    │   │   └── OrderCancelled.java
    │   └── service/
    │       └── PricingService.java
    ├── application/
    │   ├── createorder/
    │   ├── findorder/
    │   ├── cancelorder/
    │   └── shared/
    ├── adapter/
    │   ├── incoming/
    │   │   ├── web/
    │   │   └── event/
    │   └── outgoing/
    │       ├── persistence/
    │       └── payment/
    └── config/
```

> **Refactoring Note:** Refactoring from Phase 1 → Phase 2 takes **<30 minutes** with IDE. Use IDE "Move" refactoring, and Spring Modulith verification tests catch any issues.

### Phase 3: Mature Module Structure (Production-Ready)

**When:**
- >30 domain classes
- >10 use cases
- Complex domain logic
- Multiple bounded contexts to integrate with

**Timeline:** Months 6+

**Full structure:** See [Module Structure](#module-structure) above for complete example.

**Characteristics:**
- **Full subdirectory structure**
- **Use case folders** with Command/Query/Result
- **60+ files**, well-organized
- **Event mappers** - Domain Events → Integration Events
- **Anti-Corruption Layers** - protect domain from external events

## Shared Kernel in Spring Modulith

The Shared Kernel is a **small, carefully controlled** `shared/` module containing code used across multiple modules.

> **Important:** For general Shared Kernel concepts and when to use it, see [Domain-Centric Architecture](./README.md#packaging-rules).

### Spring Modulith Configuration

```java
// shared/package-info.java
@org.springframework.modulith.ApplicationModule(
    displayName = "Shared Kernel",
    type = org.springframework.modulith.ApplicationModule.Type.OPEN
)
package com.company.ecommerce.shared;
```

### Structure

```
com.company.ecommerce.shared/
├── package-info.java (@ApplicationModule with Type.OPEN)
├── marker/              ← Marker interfaces for DDD patterns
│   ├── AggregateRoot.java
│   ├── Entity.java
│   ├── ValueObject.java
│   ├── DomainEvent.java
│   ├── InputPort.java
│   └── OutputPort.java
├── types/               ← Common value objects
│   ├── Money.java
│   ├── Address.java
│   └── EmailAddress.java
└── exception/           ← Base exceptions
    ├── DomainException.java
    └── NotFoundException.java
```

### Module Dependencies on Shared

```java
// order/package-info.java
@org.springframework.modulith.ApplicationModule(
    allowedDependencies = {
        "shared",              // Can depend on entire shared module
        "customer::api",
        "inventory::api"
    }
)
package com.company.ecommerce.order;
```

**All modules can depend on `shared`:**
- Order → shared ✅
- Customer → shared ✅
- Inventory → shared ✅
- Shared → (no dependencies on other modules) ✅

## Testing

### Module Structure Verification

Modulith's `ApplicationModules.verify()` is not an ArchUnit rule and needs `spring-modulith-core` at compile
time, so it ships in its own test artifact next to the rule catalog, `dev.domaincentric:dca-archunit-spring-modulith`.
Two base classes, two test classes, the same layout:

```kotlin
testImplementation("dev.domaincentric:dca-archunit:0.3.0")
testImplementation("dev.domaincentric:dca-archunit-spring-modulith:0.1.0")
```

```java
class ModulithTest extends DcaSpringModulithTest {
    @Override
    protected DcaLayout layout() {
        return DcaLayout.forBasePackage("com.company.project");
    }
}
```

The base class runs `verify()` and lists the discovered modules with their named interfaces. Its one piece
of knowledge is the test-class filter: architecture tests living directly in the base package would
otherwise become a synthetic *root module* that Modulith reports as depending on non-exposed types. The
filter matches the **full** class name, so inner and Groovy closure classes (`FooTest$1`,
`FooSpec$_check_closure1`) are excluded with their owner. `SpringModulithModules.of(layout)` returns the filtered
`ApplicationModules` for assertions of your own — the raw form, for reference:

```java
class ModularityTests {

    ApplicationModules modules = ApplicationModules.of("com.company.project", SpringModulithModules.testClasses());

    @Test
    void verifiesModularStructure() {
        modules.verify();
    }

    @Test
    void documentsModules() throws IOException {
        new Documenter(modules)
            .writeDocumentation()
            .writeIndividualModulesAsPlantUml();
    }
}
```

### Module Integration Tests

```java
@ApplicationModuleTest
class OrderModuleIntegrationTest {

    @Autowired
    OrderApi orderApi;

    @Autowired
    ScenarioCustomizer scenarioCustomizer;

    @Test
    void shouldPublishOrderCreatedEvent() {
        var request = new CreateOrderRequest(...);

        // Verify event was published
        scenarioCustomizer
            .scenario("order-creation")
            .stimulate(() -> orderApi.createOrder(request))
            .andWaitForEventOfType(OrderCreatedEvent.class)
            .matching(event -> event.orderId().equals("123"))
            .toArriveAndVerify(event ->
                assertThat(event.totalAmount()).isEqualTo(new BigDecimal("99.99"))
            );
    }
}
```

## Module Communication

### Option 1: Domain Events (Preferred - Async)

```java
// Publisher (Order Module)
@Service
class CreateOrderService implements OrderApi {
    private final ApplicationEventPublisher events;

    @Transactional
    public OrderResponse createOrder(CreateOrderRequest request) {
        Order order = Order.create(...);
        repository.save(order);

        // Publish event
        events.publishEvent(new OrderCreatedEvent(...));

        return toResponse(order);
    }
}

// Consumer (Inventory Module)
@Component
class OrderEventListener {
    @ApplicationModuleListener
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    void on(OrderCreatedEvent event) {
        // Reserve stock for order
        inventoryService.reserveStock(event.orderId());
    }
}
```

**Benefits:**
- ✅ Loose coupling
- ✅ Async processing
- ✅ Event persistence (with Spring Modulith JPA)
- ✅ Automatic retry
- ✅ Transaction boundaries

### Option 2: Direct API Calls (Sync)

```java
// Publisher (Order Module API)
// order/api/OrderApi.java
public interface OrderApi {
    OrderResponse createOrder(CreateOrderRequest request);
    OrderResponse findOrder(String orderId);
}

// Implementation (Order Module)
@Service
class CreateOrderService implements OrderApi {
    // Implementation
}

// Consumer (Customer Module)
@Service
class CustomerService {
    private final OrderApi orderApi; // injected from order module

    public CustomerStats getCustomerStats(String customerId) {
        var orders = orderApi.findOrdersByCustomer(customerId);
        return calculateStats(orders);
    }
}
```

**Module Dependency:**
```java
// customer/package-info.java
@ApplicationModule(
    allowedDependencies = {"order::api"}  // Can only use order.api
)
package com.company.ecommerce.customer;
```

## Build Configuration

### Maven

```xml
<!-- pom.xml -->
<dependencies>
    <dependency>
        <groupId>org.springframework.modulith</groupId>
        <artifactId>spring-modulith-starter-core</artifactId>
    </dependency>
    <dependency>
        <groupId>org.springframework.modulith</groupId>
        <artifactId>spring-modulith-starter-jpa</artifactId>
    </dependency>
    <dependency>
        <groupId>org.springframework.modulith</groupId>
        <artifactId>spring-modulith-starter-test</artifactId>
        <scope>test</scope>
    </dependency>
</dependencies>
```

### Gradle

```groovy
dependencies {
    implementation 'org.springframework.modulith:spring-modulith-starter-core'
    implementation 'org.springframework.modulith:spring-modulith-starter-jpa'
    testImplementation 'org.springframework.modulith:spring-modulith-starter-test'
}
```

## Summary

**Spring Modulith implements [Domain-Centric Architecture](./README.md) by:**

1. **Enforcing Boundaries** - Modules = Bounded Contexts with verified boundaries
2. **Event-Driven** - Domain Events and Integration Events with guaranteed delivery
3. **Clear Structure** - `api/`, `events/`, `internal/` packages
4. **Progressive Complexity** - Start simple, grow as needed
5. **Testing** - Verify structure and test modules in isolation

**Migration Path:**
- Start with Spring Modulith modular monolith
- Extract to microservices when needed
- Event-based integration survives extraction

**Cross-References:**
- Core architecture: [Domain-Centric Architecture](./README.md)
- Deployment options: [Deployment Patterns](./deployment-patterns.md)
- Team alignment: [Team Topologies Integration](./team-topologies.md)

### Optional events and reliable delivery

Events are optional: an aggregate that never registers a fact needs no publisher dependency. `DCA-USE-009`
exempts a save only when the repository type argument and the aggregate's complete hierarchy can be inspected
and no registration is found; unresolved arguments, incomplete scans and undecidable external helpers retain the check.
Contracts belong in the configured `{context}/events/` segment. Translators belong in `adapter/outgoing/event/`;
transport and storage are separate adapters. Schema versions belong in integration-event type metadata.
`DCA-ADV-006/007` use a name heuristic for `schemaVersion`, `eventVersion`, `contractVersion`; a business `version` is allowed.

An in-process registry may deliver domain events within a context **or integration events between contexts**.
Process location does not determine event classification. Synchronous delivery is atomic only for local resources
participating in the same transaction; a synchronous remote effect cannot be rolled back with the aggregate.
For an external effect, either (A) an own-context async consumer receives a durably captured domain fact, or
(B) an own-context synchronous translator captures an integration contract consumed asynchronously. Cross-context
consumers always use the integration contract. No broker is required to cross a context boundary.

Capture the publication in the aggregate transaction; establish delivery eligibility with commit, then wake the
worker after commit. Recovery reads committed publications even when that wakeup was lost. Track completion per
consumer/effect, retry only unfinished work with bounded attempts and exponential backoff, retain terminal failures
for inspection and deliberate replay. Reuse the original payload and `eventId + consumer + effect` identity.
Provider acceptance is the acknowledgement point. If the process stops after acceptance but before local acknowledgement,
provider-supported idempotency can deduplicate a repeated key; without it, a duplicate external effect remains possible.
For each concrete effect, decide whether rendering/template version and recipient are captured or resolved later;
the event snapshot alone does not decide these. No universal email policy is implied.

`DCA-USE-012` checks transaction-boundary evidence in Java and .NET (`FrameworkTypes.TransactionalAttribute` is empty
by default). Static call graphs cannot prove lambda containment: publishing after an empty boundary in the same
method passes this check. Verify runtime containment and rollback separately. `.NET DCA-USE-013` remains unavailable;
review remote-capable calls and transaction scope explicitly.
