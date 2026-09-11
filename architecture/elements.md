# Elements

## Domain Layer (Enterprise Business Rules)

### Tactical Building Blocks
- **Entity** - Object with identity and lifecycle
- **Value Object** - Immutable object without identity
- **Aggregate** - Transactional consistency boundary
- **Aggregate Root** - Entry point entity for aggregate access
- **Domain Service** - Stateless operation on domain objects
- **Domain Event** - Immutable record of domain occurrence (internal to bounded context)
- **Specification** - Encapsulated business rule
- **Factory** - Complex object creation logic

### Strategic Building Blocks
- **Bounded Context** - Explicit boundary for unified model
- **Ubiquitous Language** - Shared vocabulary in code and conversation
- **Subdomain** - Logical domain partition (Core, Supporting, Generic)

## Application Layer (Use Cases / Application Business Rules)

### Use Case Pattern with Input Ports

The application layer organizes business operations using a structured **Use Case pattern** where each use case is isolated in its own folder with dedicated Input/Output models:

**Pattern Structure:**
- **Use Case** - Implements business operation (orchestrates domain objects)
- **Input Port** - Interface defining use case contract (`extends UseCase<INPUT, OUTPUT>`)
- **Command/Query** - Input model (Command for writes, Query for reads)
- **Result** - Output model (standardized return type)
- **Output Port** - Interface for infrastructure needs (repositories, gateways, publishers)

**Organization:**
```text
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

### Shaping the Result

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
   by `Snapshot.from(aggregate)` — a value like any other (`DCA-TAC-008`…`DCA-TAC-012`). The snapshot *is* the result field; the use case does not
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
   [Deviations from the literature](../README.md#deviations-from-the-literature).

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

### Application Layer Components

- **Use Case / Application Service** - Orchestrates business operations
- **Input Port** - Interface defining use case entry point
- **Output Port** - Interface for infrastructure needs
- **Command** - Request to change state
- **Query** - Request to retrieve data
- **Input Data / DTO** - Data structure for use case input
- **Output Data / DTO** - Data structure for use case output
- **Repository Interface** - Aggregate persistence abstraction
- **Domain Event Publisher Interface** - Event dispatching abstraction

## Adapter Layer (Interface Adapters)

### Input Adapters (Driving/Primary)
- **Controller** - Handles HTTP/framework requests
- **Event Consumer** - Handles external events/messages
- **CLI Handler** - Command-line interface
- **GraphQL Resolver** - GraphQL query/mutation handler
- **Scheduled Job** - Time-triggered operations

### Output Adapters (Driven/Secondary)
- **Repository Adapter** - Persistence implementation
- **Event Publisher Adapter** - Event publishing implementation
- **External API Client** - Third-party service integration
- **Presenter** - Formats use case output for external world
- **Gateway** - Database/external system translation

### Adapter Components
- **Mapper** - Translation between layers
- **DTO** - Data transfer across boundaries
- **View Model** - Presentation data structure
- **Database Entity** - ORM/persistence model
- **Integration Event** - DTO representing domain event for cross-context communication
- **Event Mapper** - Converts domain events to/from integration events
- **Anti-Corruption Layer (ACL)** - Protects domain from external event formats

## Infrastructure Layer (Frameworks & Drivers)

- **Web Framework** - Spring, Quarkus, etc.
- **Persistence Framework** - JPA, Hibernate, etc.
- **Message Broker** - Kafka, RabbitMQ, etc.
- **Configuration** - Dependency injection, framework setup
- **Cross-Cutting Concerns** - Logging, monitoring, security

## Building blocks, as the library defines them

**The tactical markers, as the library defines them:**
```java
// dev.domaincentric.dca.buildingblocks.ddd.tactical — from dca-building-blocks, not written per project
public interface Id {
    // Marker interface - typed identifiers, no type parameter of their own
}

public interface Entity<T extends Entity<T, ID>, ID extends Id> {
    ID id();
    default boolean sameIdentityAs(T other) {
        return other != null && id().equals(other.id());
    }
}

public interface AggregateRoot<T extends AggregateRoot<T, ID>, ID extends Id>
        extends Entity<T, ID> {
    // Marker interface - identifies aggregate roots for all contexts
}
```

```csharp
// DomainCentric.BuildingBlocks.Ddd.Tactical — the same contracts in C#
public interface IId { }
public interface IEntity<TSelf, TId> : IEntity where TSelf : IEntity<TSelf, TId> where TId : IId { TId Id { get; } }
public interface IAggregateRoot<TSelf, TId> : IEntity<TSelf, TId>, IAggregateRoot
    where TSelf : IAggregateRoot<TSelf, TId> where TId : IId { }
```

**The port hierarchy, as the library defines it — and how a context uses it:**
```java
// dev.domaincentric.dca.buildingblocks.hexagonal.port.in
public interface InputPort {
    // Marker interface for all input ports (hexagonal architecture concept)
}

public interface UseCase<INPUT, OUTPUT> extends InputPort {
    OUTPUT execute(INPUT input);
}

// dev.domaincentric.dca.buildingblocks.hexagonal.port.out
public interface OutputPort {
    // Marker interface for all output ports (hexagonal architecture concept)
}

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
