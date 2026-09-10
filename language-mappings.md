# Language Mappings: Java/Spring ↔ C#/.NET

*One architecture, two spellings*

> **📘 Prerequisites:** This document translates the concepts of [Domain-Centric Architecture](./README.md) from the Java they are written in to C#/.NET. Read the main document first; the rules, layers and package shapes are the same in both languages.

---

## Table of Contents

1. [Principle](#principle)
2. [Packages](#packages)
3. [Building Blocks](#building-blocks)
4. [Ports and Use Cases](#ports-and-use-cases)
5. [Declaring Contexts and Relationships](#declaring-contexts-and-relationships)
6. [Solution and Project Layout](#solution-and-project-layout)
7. [Framework Concepts](#framework-concepts)
8. [Language Idioms](#language-idioms)
9. [Governance](#governance)
10. [What Differs on Purpose](#what-differs-on-purpose)

---

## Principle

The architecture is language-neutral; its *spelling* is not. A DCA code base in C# reads as C#:
interfaces carry the `I` prefix, asynchronous ports end in `Async`, attributes replace package
annotations, projects replace packages as the physical module boundary. Everything that matters
to the architecture stays: the four layers and their dependency direction, one folder per use case,
ports defined inside and implemented outside, a bounded context that is a deep module, and the
same rule ids (`DCA-TAC-001`, `DCA-USE-009`, …) checked by the same catalog.

Rule of thumb: **roles, folders and rule ids are shared; names follow the host language.**

## Packages

| | Java | .NET |
|---|---|---|
| Building blocks | `dev.domaincentric:dca-building-blocks` (Maven Central) | `DomainCentric.BuildingBlocks` (NuGet) |
| Architecture rules | `dev.domaincentric:dca-archunit` (ArchUnit, JUnit 5 base class) | `DomainCentric.ArchRules` (ArchUnitNET) + `DomainCentric.ArchRules.Xunit` |
| Root package / namespace | `dev.domaincentric.dca.buildingblocks` | `DomainCentric.BuildingBlocks` |
| Dependencies of the building blocks | none | none (`netstandard2.1`, `net8.0`, `net10.0`) |

```kotlin
// Gradle
implementation("dev.domaincentric:dca-building-blocks:0.1.2")
testImplementation("dev.domaincentric:dca-archunit:0.3.0")
```

```
# .NET
dotnet add package DomainCentric.BuildingBlocks
dotnet add package DomainCentric.ArchRules.Xunit      # in the architecture test project
```

## Building Blocks

The tactical markers, one to one. Java package `ddd.tactical`, .NET namespace `Ddd.Tactical`.

| Concept | Java | C# |
|---|---|---|
| Identifier | `Id` | `IId` — implemented by a `readonly record struct` |
| Value object | `Value` | `IValue` — implemented by a `record` |
| Entity | `Entity<T extends Entity<T, ID>, ID extends Id>` | `IEntity<TSelf, TId>` (+ non-generic `IEntity` for reflection) |
| Aggregate root | `AggregateRoot<T, ID>` | `IAggregateRoot<TSelf, TId>` (+ non-generic `IAggregateRoot`) |
| Event-collecting base class | `BaseAggregateRoot<T, ID>` | `AggregateRootBase<TSelf, TId>` |
| Domain event | `DomainEvent` (`eventId()`, `occurredOn()`) | `IDomainEvent` (`EventId`, `OccurredOn`) — a `record` |
| Integration event | `IntegrationEvent` + `@IntegrationEventType(name, version)` | `IIntegrationEvent` + `[IntegrationEventType(name, Version = …)]` |
| Domain service | `DomainService` | `IDomainService` |
| Domain gateway | `DomainGateway` | `IDomainGateway` |
| Factory | `Factory` | `IFactory` |
| Specification | `Specification<T>` (`isSatisfiedBy`) | `ISpecification<T>` (`IsSatisfiedBy`) |
| Timestamps, ids | `java.time.Instant`, `java.util.UUID` | `DateTimeOffset`, `Guid` |
| Absence | `Optional<T>` | nullable reference `T?` |

The self-referencing generics (`TSelf`) are kept in C# for parity with the Java signatures, so the
templates and rules read the same in both languages; idiomatic C# would often write `IAggregateRoot<TId>`.

```java
public record OrderId(UUID value) implements Id {}
public class Order extends BaseAggregateRoot<Order, OrderId> { … }
```

```csharp
public readonly record struct OrderId(Guid Value) : IId;
public sealed class Order : AggregateRootBase<Order, OrderId> { … }
```

## Ports and Use Cases

Java package `hexagonal.port.in` / `.out`, .NET namespace `Hexagonal.Ports.In` / `.Out`. **.NET ports are
async only** — there is no synchronous twin — while the domain layer stays synchronous (a `DCA-NET` rule
enforces both).

| Concept | Java | C# |
|---|---|---|
| Input port marker | `InputPort` | `IInputPort` |
| Use case contract | `UseCase<INPUT, OUTPUT>` — `OUTPUT execute(INPUT)` | `IUseCase<TInput, TOutput>` — `Task<TOutput> ExecuteAsync(TInput, CancellationToken)` |
| Use case input port | `PlaceOrderInputPort extends UseCase<PlaceOrderCommand, PlaceOrderResult>` | `IPlaceOrderInputPort : IUseCase<PlaceOrderCommand, PlaceOrderResult>` |
| Use case implementation | `PlaceOrderUseCase implements PlaceOrderInputPort` (`@Service`) | `PlaceOrderUseCase : IPlaceOrderInputPort` (plain class, registered in DI) |
| Command / Query / Result | `record` | `sealed record` |
| Output port marker | `OutputPort` | `IOutputPort` |
| Repository | `Repository<T, ID>` — `findById`, `save`, `deleteById` | `IRepository<TAggregate, TId>` — `FindByIdAsync`, `SaveAsync`, `DeleteByIdAsync` |
| Store | `Store` | `IStore` |
| Domain event publisher | `DomainEventPublisher` — `publish`, `publishAndClearEvents` | `IDomainEventPublisher` — `PublishAsync`, `PublishAndClearEventsAsync` |
| Integration event publisher | `IntegrationEventPublisher` | `IIntegrationEventPublisher` — `PublishAsync` |
| Transaction boundary | `application.TransactionBoundary` — `inTransaction(Supplier<T>)` | `Application.Transactions.ITransactionBoundary` — `InTransactionAsync<T>(Func<Task<T>>)` |
| Context-specific output port | `OrderRepository extends Repository<Order, OrderId>` in `application/shared/` | `IOrderRepository : IRepository<Order, OrderId>` in `Application/Shared/` |

```java
// order/application/placeorder/
public interface PlaceOrderInputPort extends UseCase<PlaceOrderCommand, PlaceOrderResult> {}
public record PlaceOrderCommand(CustomerId customerId, List<LineItemData> items) {}
public record PlaceOrderResult(OrderId orderId, OrderStatus status) {}
```

```csharp
// Order/Application/PlaceOrder/
public interface IPlaceOrderInputPort : IUseCase<PlaceOrderCommand, PlaceOrderResult> { }
public sealed record PlaceOrderCommand(CustomerId CustomerId, IReadOnlyList<LineItemData> Items);
public sealed record PlaceOrderResult(OrderId OrderId, OrderStatus Status);
```

## Declaring Contexts and Relationships

Java declares a context on its root package; C# has no namespace-level attributes, so the declaration
sits on **one marker class directly in the context's root namespace**. The rules discover contexts by
finding that class. Java package `ddd.strategic` (+ `.relationships`), .NET `Ddd.Strategic` (+ `.Relationships`).

| Java (`package-info.java`) | C# (marker class) |
|---|---|
| `@BoundedContext(name, description)` | `[BoundedContext(name, Description = …)]` |
| `@SharedKernel(description)` | `[SharedKernel(Description = …)]` |
| `@OpenHostService(context, description)` | `[OpenHostService(context, Description = …)]` |
| `@Upstream(context, translation, via)` — repeatable via `@Upstreams` | `[Upstream(context, translation, params via)]` — `AllowMultiple` |
| `@ExternalUpstream(name, translation, interaction, contractPackages, …)` | `[ExternalUpstream(name, translation, interaction) { ContractNamespaces, Protocol, Exchanges, Rationale, Status }]` |
| `@Partnership(context, rationale)` | `[Partnership(context, Rationale = …)]` |
| `Upstream.Translation.ANTI_CORRUPTION_LAYER / CONFORMIST` | `Translation.AntiCorruptionLayer / Conformist` |
| `Upstream.Consumes.API / EVENTS` | `Consumes.Api / Events` |
| `Upstream.Status.IMPLEMENTED / PLANNED` | `UpstreamStatus.Implemented / Planned` |
| `ExternalUpstream.Interaction.OUTBOUND / INBOUND` | `Interaction.Outbound / Inbound` |

```java
// com/company/project/cart/package-info.java
@BoundedContext(name = "Shopping Cart", description = "Carts and their items")
@Upstream(context = "product", translation = Upstream.Translation.ANTI_CORRUPTION_LAYER,
          via = Upstream.Consumes.API, rationale = "Product data is translated into cart's own types")
@Partnership(context = "checkout", rationale = "CartCompletionTrigger contract evolves jointly")
package com.company.project.cart;
```

```csharp
// Company.Project.Cart/CartContext.cs
namespace Company.Project.Cart;

[BoundedContext("Shopping Cart", Description = "Carts and their items")]
[Upstream("Product", Translation.AntiCorruptionLayer, Consumes.Api,
          Rationale = "Product data is translated into cart's own types")]
[Partnership("Checkout", Rationale = "ICartCompletionTrigger contract evolves jointly")]
public static class CartContext { }
```

The context map — tables plus a Mermaid diagram rendered from these declarations — exists in both
libraries (`ContextMapRenderer`), and the `contextmap` rules verify that declarations and real
dependencies agree.

## Solution and Project Layout

Java keeps every context in one Gradle module and separates them by package; Spring Modulith (or the
`strategic` rules) makes the boundary real. .NET makes it physical: **one project per bounded context**,
plus one for the shared kernel, one for global infrastructure and one host. The folders inside a
context project are the layers, PascalCase.

| Java | .NET |
|---|---|
| `com.company.project.order` (package) | `Company.Project.Order` (project + namespace) |
| `order/domain/model/` | `Order/Domain/Model/` |
| `order/application/placeorder/` | `Order/Application/PlaceOrder/` |
| `order/application/{feature}/{usecase}/` | `Order/Application/{Feature}/{UseCase}/` |
| `order/application/shared/` | `Order/Application/Shared/` |
| `order/adapter/incoming/web/` · `api/` · `event/` | `Order/Adapter/Incoming/Web/` · `Api/` · `Event/` |
| `order/adapter/outgoing/persistence/` | `Order/Adapter/Outgoing/Persistence/` |
| `order/infrastructure/` (optional `@Configuration`) | `Order/Infrastructure/` — `AddOrderContext(this IServiceCollection)` |
| `order/api/` (published in-process contract) | `Order/Api/` |
| `order/events/` (published integration events) | `Order/Events/` |
| `sharedkernel/` | `Company.Project.SharedKernel/` |
| `infrastructure/` (global) | `Company.Project.Infrastructure/` (composition root) |
| `@SpringBootApplication` class | `Company.Project.Web/` — `Program.cs`, views, static assets |
| `src/test-architecture/` | `tests/Company.Project.ArchitectureTests/` |

Use case folders are lowercase in Java (`placeorder`) because Java packages are; PascalCase in C#
(`PlaceOrder`) because .NET namespaces are. Feature folders follow the same rule (`cartrecovery` /
`CartRecovery`). The rules read whatever the host language's convention produces.

## Framework Concepts

| Concern | Java / Spring | .NET / ASP.NET Core |
|---|---|---|
| Component registration | `@Service`, `@Component`, component scan | explicit `services.AddScoped<IPlaceOrderInputPort, PlaceOrderUseCase>()` in the context's `Infrastructure/` |
| Configuration per context | `@Configuration` class in `{context}/infrastructure/` | extension method `Add{Context}Context()` called by the composition root |
| Module verification | Spring Modulith `ApplicationModules.verify()` | project references (a context cannot reference another's internals) + the `DCA-STR` / `DCA-CYC` rules |
| Transaction boundary | `@Transactional` on the use case, or `TransactionBoundary.inTransaction(...)` (`DCA-USE-012`) | `ITransactionBoundary.InTransactionAsync(...)` or a decorator around `IUseCase` — no attribute; `DCA-USE-012` checks that every entry path to a saving, deleting or publishing method passes through the boundary call (`DCA-USE-013` is not applicable) |
| Domain event dispatch | `ApplicationEventPublisher`; `@ApplicationModuleListener` / `@TransactionalEventListener(AFTER_COMMIT)` | in-process dispatcher behind `IDomainEventPublisher`; consumers subscribe explicitly |
| Integration events | Modulith event publication registry, or outbox | outbox table / `Channel<T>` queue drained after commit, with retry |
| Event consumer | `@ApplicationModuleListener void on(OrderCompletedEvent e)` | `*EventConsumer` class registered as a subscriber; async |
| Web adapter | `@Controller` `*PageController`, `@RestController` `*Resource` | MVC `*PageController : Controller`, `[ApiController]` `*Resource` / `*Controller` |
| Security context | `SecurityContextHolder` behind an `IdentityProvider` port | `HttpContext.User` behind an `IIdentityProvider` port; own `AuthenticationHandler` |
| Validation | Bean Validation on commands at the adapter edge | DataAnnotations / FluentValidation at the adapter edge |
| Persistence (in-memory phase) | `ConcurrentHashMap` repository | `ConcurrentDictionary` repository |
| Persistence (SQL) | JPA/JDBC in `adapter/outgoing/persistence/` | EF Core / Dapper in `Adapter/Outgoing/Persistence/` |
| Build / test | Gradle, JUnit 5 | `dotnet build` / `dotnet test`, xUnit |

The rules do not care which framework you register with — they check that framework types stay out of
`domain` and `application`, resolved by *role* through `DcaLayout.withFrameworkAnnotations(...)` /
`WithFrameworkTypes(...)`. Java ships presets for Spring (default), Jakarta EE, Quarkus, Micronaut and none; .NET
ships ASP.NET Core (default) and none. A Jakarta or Quarkus project therefore reads the Java column with CDI's
`@ApplicationScoped` for `@Service`, `jakarta.transaction.Transactional` for `@Transactional`, `@Path` for
`@RestController` and `@Observes` for `@EventListener` — the rule ids and texts are the same.

## Language Idioms

| Java | C# |
|---|---|
| `record` for values, commands, results, events | `record` (reference) for values and events, `readonly record struct` for ids, `sealed record` for commands/results |
| `sealed interface` + `permits` | `abstract record` hierarchy or discriminated pattern matching; no `permits` |
| Checked/unchecked exceptions | exceptions only; domain exceptions are unchecked either way |
| `Optional<T>` return | `T?` with nullable reference types enabled |
| `final` class | `sealed` class |
| `static` factory `Order.create(...)` | same, or `Order.Create(...)` |
| Package-private | `internal` (project scope — coarser than a package) |
| `var` | `var` |
| Text blocks `"""` | raw string literals `"""` |
| `List.of(...)` immutability | `IReadOnlyList<T>`, `ImmutableArray<T>` |

## Governance

| | Java | .NET |
|---|---|---|
| Base class | `DcaArchitectureTest` (JUnit 5, dynamic tests) | `DcaArchitectureTest` (xUnit, one theory case per rule) |
| Layout | `DcaLayout.forBasePackage("com.company.project")` | `DcaLayout.ForRootNamespace("Company.Project")` |
| Layout options | `withIncomingSubpackage`, `withUseCaseSuffix`, `withControllerSuffix`, `allowingInDomain`, `withFrameworkAnnotations` (presets `spring`, `jakarta`, `quarkus`, `micronaut`, `none`) | `WithIncomingSegment`, `WithUseCaseSuffix`, `WithRestControllerSuffix`, `AllowingInDomain`, `WithFrameworkTypes` (presets `AspNetCore`, `None`) |
| Selection | `additionalSelection()` → `DcaRuleSelection` | `AdditionalSelection` → `DcaRuleSelection` |
| Properties file | `dca-archunit.properties` on the test class path | `dca-archunit.properties` next to the test assembly (copy to output) |
| Dials | scope, severity, exceptions, **baseline** (`frozen`) | scope, severity, exceptions — no baseline (ArchUnitNET has no `FreezingArchRule`) |
| Build flavour | any | **Debug** — optimized builds hide async dependencies and are refused |
| Without the base class | `DcaRules.checkAll(DcaArchitecture.load(layout))` | `DcaRules.CheckAll(DcaArchitecture.Load(layout, assemblies))` |
| Rule ids | `DCA-<SET>-<NNN>` | identical; plus `DCA-NET-001..006`; four Java rules that check only a container stereotype are *not applicable* |

See [ArchUnit Governance](./archunit-governance.md) for the rule categories and the tuning dials.

## What Differs on Purpose

- **Async ports, synchronous domain.** Every .NET port method is `Task`-based and takes a
  `CancellationToken`; aggregates, values and domain services never are. The Java ports are synchronous.
- **Physical modules.** A .NET context is a project; a Java context is a package. Both are verified
  the same way, but only the .NET compiler refuses a cross-context reference to an `internal` type.
- **No `package-info`.** The context marker class is the one file a Java reader will not recognise.
- **No baseline dial** in .NET governance; lower a rule to a warning instead.
- **Transactions are explicit** in .NET (`ITransactionBoundary`, or a decorator around `IUseCase`);
  Java may use `@Transactional`. `DCA-USE-012` demands the boundary in both languages for every use case
  that saves or deletes an aggregate or publishes domain events — in Java it also guards Spring's
  after-commit relay, which is skipped silently without an active transaction; in .NET the evidence is
  the `InTransactionAsync` call or the configured transactional attribute on every entry path.
- **Container attributes** (`@Upstreams`, `@Partnerships`) do not exist in C# — attributes repeat.

Everything not listed here is the same architecture, spelled the way the language spells it.
