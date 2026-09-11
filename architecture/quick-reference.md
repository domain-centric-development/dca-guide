# Quick Reference

A lookup table for readers who know the style and need the placement, not the reasoning. Every
entry is stated in full elsewhere in this guide; nothing here is a rule of its own.

## Where things live

| Component | Layer | Example |
|---|---|---|
| Entities, Value Objects | Domain | `Order`, `OrderId`, `Money` |
| Domain Events | Domain | `OrderPlaced`, `OrderCancelled` |
| Domain Services | Domain | `PricingService` |
| Input Ports | Application — the use-case package | `CreateOrderInputPort` |
| Use-case implementations | Application — the use-case package | `CreateOrderUseCase` |
| Commands, Queries, Results | Application — the use-case package | `CreateOrderCommand`, `CreateOrderResult` |
| Output Ports | Application — the use-case package, or `application/shared` when reused | `OrderRepository`, `LoginProtectionStore` |
| REST controllers | `adapter/incoming` | `OrderRestController` |
| Message listeners | `adapter/incoming` | `OrderCommandListener` |
| Persistence adapters, ORM entities | `adapter/outgoing` | `JpaOrderRepository`, `OrderEntity` |
| Event publishers, API clients | `adapter/outgoing` | `KafkaEventPublisher`, `PaymentGatewayClient` |
| Framework configuration | Infrastructure | `BeansConfiguration` |
| Universal value objects | `sharedkernel/domain/model` | `Money`, `Address` |
| Shared application ports | `sharedkernel/application/shared` | `IdentityProvider` |

## Dependency matrix

```text
Layer          | May depend on
---------------+-----------------------------------------------------------
Domain         | nothing, or shared-kernel domain concepts
Application    | domain, shared kernel
Adapter (in)   | application, domain, shared kernel, external libraries
Adapter (out)  | the same, plus global and own-module infrastructure
Infrastructure | all of the above
Shared kernel  | nothing — framework-independent
```

Your own infrastructure layer is not the same thing as an external framework: every adapter may use
Spring. Your `infrastructure/` package is a different question, and the answer depends on direction —
an incoming adapter reaches none of it (`DCA-HEX-004`), an outgoing adapter reaches the global and
its own module's, but never another module's (`DCA-HEX-005`).

## Port placement

```text
Port type | Interface declared in | Implemented in    | Called by
----------+-----------------------+-------------------+------------------
Input     | application           | application       | adapter/incoming
Output    | application           | adapter/outgoing  | application
```

The asymmetry is the whole point: an incoming adapter *uses* an input port, an outgoing adapter
*implements* an output port. Both interfaces are declared inside, never in the adapter.

## Framework annotations

```text
Layer          | Framework annotations | Example
---------------+-----------------------+------------------------------------
Domain         | never                 | pure Java / C# only
Application    | minimal, or none      | possibly a stereotype on the use case
Adapter        | yes                   | @RestController, @Entity
Infrastructure | yes                   | @Configuration, @Bean
Shared kernel  | neutral metadata only | @Nullable, own annotations
```

## Checklist for new code

- [ ] Does this carry business logic (domain) or technical concern (everything else)?
- [ ] Is this interface an input port (an actor calls it) or an output port (the application calls it)?
- [ ] Do all dependencies point inward?
- [ ] Is the domain free of framework annotations?
- [ ] Are the domain model and the persistence model separate types?
- [ ] Does the incoming adapter *use* the input port, and the outgoing adapter *implement* the output port?
- [ ] Does infrastructure do nothing but wiring and configuration?
- [ ] Can the domain and the application layer be tested without a framework?
