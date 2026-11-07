# Quick Reference

A lookup table for readers who know the style and need the placement, not the reasoning. Every
entry is stated in full elsewhere in this guide; nothing here is a rule of its own.

## Where things live

| Component | Layer | Example |
|---|---|---|
| Entities, Value Objects | Domain | `Order`, `OrderId`, `Money` |
| Domain Events | Domain | `OrderPlaced`, `OrderCancelled` |
| Domain Services | Domain | `PricingService` |
| Domain exceptions | Domain — beside the model, no `exception/` package | `InsufficientStockException` |
| Input Ports | Application — the use-case package | `CreateOrderInputPort` |
| Use-case implementations | Application — the use-case package | `CreateOrderUseCase` |
| Commands, Queries, Results | Application — the use-case package | `CreateOrderCommand`, `CreateOrderResult` |
| Output Ports | Application — the use-case package, or `application/shared` when reused | `OrderRepository`, `LoginProtectionStore` |
| Expected refusals | Application — cases nested in the use case's sealed `*Result`, or use-case exceptions beside the use case; one way per context | `CancelOrderResult.OrderNotFound`, `OrderNotFoundException` |
| Use-case exceptions (extend `UseCaseException`) | Application — beside the use case, or `application/shared` when reused | `PaymentProviderUnavailableException` |
| Output-port exceptions (extend `OutputPortException`) | Application — beside the port whose contract declares them | `DuplicateOrderNumberException`, `PaymentGatewayUnavailableException` |
| Answers to result cases | `adapter/incoming` — written once per context, called from each switch (a returning context) | `OrderProblems` |
| Exception handlers | `adapter/incoming` — one per context, for what is thrown | `OrderApiExceptionHandler` |
| REST controllers | `adapter/incoming` | `OrderRestController` |
| Message listeners | `adapter/incoming` | `OrderCommandListener` |
| Persistence adapters, ORM entities | `adapter/outgoing` | `JpaOrderRepository`, `OrderEntity` |
| Event publishers, API clients | `adapter/outgoing` | `KafkaEventPublisher`, `PaymentGatewayClient` |
| Framework configuration | Infrastructure | `BeansConfiguration` |
| Composition root — wiring, a port implemented by another use case | Infrastructure — `{context}/infrastructure/` | `PricingConfiguration` |
| Process manager — executive and tracker | Application (use case) and Domain (tracker aggregate) | `BookTripUseCase`, `TripBooking` |
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
Shared kernel  | its domain: nothing. Its adapters and infrastructure: the same as a context's
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
Shared kernel  | its domain: never       | @Nullable, own annotations
               | its adapters: yes       | the shared outbox, the transaction boundary
```

## Checklist for new code

- [ ] Does this carry business logic (domain) or technical concern (everything else)?
- [ ] Is this interface an input port (an actor calls it) or an output port (the application calls it)?
- [ ] Does the application need this capability without owning it, and does the adapter depend on the port? Cookies, tokens and a question into the own context are not ports
- [ ] Do all dependencies point inward?
- [ ] Is the domain free of framework annotations?
- [ ] Are the domain model and the persistence model separate types?
- [ ] Does the incoming adapter *use* the input port, and the outgoing adapter *implement* the output port?
- [ ] Does infrastructure do nothing but wiring and configuration?
- [ ] Can the domain and the application layer be tested without a framework?
- [ ] Does each business rule refuse with its own named failure, and each argument guard with the platform's argument exception?
- [ ] Does every use case of the context carry its expected refusals the same way — all thrown, or all returned as cases — and is the choice recorded in the project's technical description (`Refusals: thrown | returned`, or `Refusals (<context>): …` for a context that departs)?
- [ ] Where the context returns: does every switch over a result name each case, without a `default`, and does each refusal case carry `Refusal`?
- [ ] Is each refusal's answer written once per context — in the class the switches call, or in the context's one exception handler?
- [ ] Does every refusal come before the first write?
- [ ] Does a failure an output port declares extend `OutputPortException`, thrown by its adapter and caught by the use case — and does a concrete use-case failure extend `UseCaseException`, never `InputPortException`?
- [ ] Does a failure of the system's own infrastructure — its database, its broker — stay the platform's exception, and is the expected failure of a foreign system (an external system on the context map) declared by its port as an `OutputPortException` and answered by the use case as a refusal?
- [ ] Does a "which one, if any" query answer *none* with an empty value, and is "not found" a refusal only where the caller names a specific thing?
- [ ] Does no incoming adapter catch `PortException` or `InputPortException` generically?
- [ ] Is each rule on input checked once, in its value object — a missing value refused there too, no annotation or default repeating it at the adapter?
- [ ] Are the words a person reads the adapter's, made from the failure's values — never the exception's message?
