# Repository vs. Store

DCA distinguishes two kinds of persistence-shaped output ports. Both `extend OutputPort`, but their **business semantics differ**:

## Repository

Collection-like interface for Aggregate Roots (Evans, Vernon).

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

## Store

Records or queries operational data without an own aggregate lifecycle.

- Exists for **Value Objects, Events, or technical state** without an aggregate lifecycle
- Append-/record-style semantics: `record()`, `count()`, `exists()`, `reset()` — lookup by key is allowed; no aggregate `save()` / `delete()` semantics
- Extends the `Store` marker (`Store extends OutputPort`) — never the `Repository` marker
- Implementation lives in `adapter.outgoing/`

```java
public interface LoginProtectionStore extends Store {
    void record(LoginAttempt attempt);
    int  countRecentFailures(BaseStore baseStore, Email email, Duration window);
    boolean isLoginBlocked(BaseStore baseStore, Email email);
}
```

## Decision matrix

| Criterion | Repository | Store |
|---|---|---|
| Stored object | Aggregate Root | Value Object / operational data |
| Aggregate lifecycle | yes — `save`, `delete` | no — `record`, `count`, `exists`; lookup by key allowed |
| Marker | `extends Repository<T, ID>` | `extends Store` |
| Examples | `CustomerAccountRepository`, `OrderRepository` | `LoginProtectionStore`, `AuditLogStore`, `EventStore` |

## Rules of thumb

1. Lookup by key (`findById`) is allowed on a Store too; aggregate lifecycle determines Repository semantics.
2. Need `record()` or `count()`? → Store (the object is recorded, not managed).
3. In doubt: if the stored object is a `Value` or a record, it's almost always a Store.

> **Note on EventStore (Event Sourcing):** The `EventStore` from Event Sourcing is a *specialization* of Store — one specifically for Domain Events that supports aggregate reconstruction. The general `Store` is the broader pattern for any operational data.

> **Note on cross-cutting `*Response` classes:** Generic Response/error classes (`ErrorResponse`, base `Response`, `SimpleResponse`) belong in the **shared kernel's adapter-incoming package**, not in any individual bounded context. ArchUnit rules that check `*Response` placement must include the shared kernel adapter — discover its package dynamically via `@SharedKernel` rather than hardcoding the name (`shared` / `common` / `core` / `sharedkernel`).

## Why the distinction matters

The naming is part of the Ubiquitous Language. A reader should know from the interface name alone whether they're dealing with a managed aggregate (Repository) or recorded data (Store) — without opening the implementation. Both are technically Output Ports in hexagonal architecture, but the business role is fundamentally different.

## Separate domain and persistence model

A repository implementation maps between two models: the aggregate the domain owns, and the
persistence type the ORM owns. The aggregate never carries persistence metadata — the mapping lives
in the outgoing adapter.

```java
// {context}/domain/model/Order.java — pure domain, no ORM metadata
public class Order implements AggregateRoot<Order, OrderId> {
    private final OrderId id;
    private final CustomerId customerId;
    private Money total;

    public void addLine(OrderLine line) { /* invariants */ }
    public void cancel() { /* invariants */ }
}

// {context}/adapter/outgoing/persistence/OrderEntity.java — the persistence model
@Entity
@Table(name = "orders")
class OrderEntity {
    @Id private String id;
    private String customerId;
    private BigDecimal totalAmount;
    private String currency;

    Order toDomain() {
        return Order.reconstitute(new OrderId(id), new CustomerId(customerId),
                                  new Money(totalAmount, Currency.getInstance(currency)));
    }

    static OrderEntity fromDomain(Order order) { /* … */ }
}

// {context}/adapter/outgoing/persistence/JpaOrderRepository.java — implements the output port
@Component
class JpaOrderRepository implements OrderRepository {
    private final SpringDataOrderRepository orders;

    @Override public Order save(Order order) {
        return orders.save(OrderEntity.fromDomain(order)).toDomain();
    }

    @Override public Optional<Order> findById(OrderId id) {
        return orders.findById(id.value()).map(OrderEntity::toDomain);
    }
}
```

Reconstitution goes through the aggregate's own reconstitution method, which raises no creation
event — an adapter must never rebuild an aggregate by calling its creation factory.
