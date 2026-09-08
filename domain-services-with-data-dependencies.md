# Domain Services with Data Dependencies

> **Context:** Domain-Centric Architecture · Pricing Bounded Context
> **Audience:** Developers implementing Domain Services that need external data access

---

## Problem Statement

Domain Services are by definition **stateless** and belong to the Domain Layer — the innermost ring of the architecture. They have **no outward dependencies**. But what happens when a Domain Service needs additional data to perform its calculation?

**Concrete example:** A `BundleDiscountService` is supposed to calculate a discount that depends on the product's category. The category-to-price mapping, however, does not live in the current Aggregate — it has to be loaded on demand.

```java
// The problem: the Domain Service needs data it does not have
public final class BundleDiscountService implements DomainService {

    public Price calculateBundleDiscount(ProductId productId, Price basePrice) {
        // Where does the category information come from?
        // The Domain Layer must not know any Repositories or Adapters!
        CategoryDiscount discount = ???;
        return applyDiscount(basePrice, discount);
    }
}
```

The Dependency Rule forbids the Domain Layer to access the Application Layer or Adapters. Yet the Domain Service has to get hold of the data.

---

## Default Rule: Pure Domain Services (90% of Cases)

In most cases the right solution is: **the Application Service (Use Case) orchestrates.** It loads all required data through Output Ports and hands it to the Domain Service as parameters.

```java
// Application Layer — the Use Case orchestrates
public class CalculateBundleDiscountUseCase implements CalculateBundleDiscountInputPort {

    private final ProductPriceRepository productPriceRepository;
    private final BundleDiscountService bundleDiscountService;

    @Override
    public DiscountResult execute(DiscountCommand command) {
        ProductPrice productPrice = productPriceRepository
            .findByProductId(command.productId())
            .orElseThrow();

        // The Domain Service receives all data as parameters — pure, testable, simple
        Price discountedPrice = bundleDiscountService.calculateBundleDiscount(
            productPrice.price(),
            productPrice.category(),
            command.bundleSize()
        );

        return new DiscountResult(discountedPrice);
    }
}
```

```java
// Domain Layer — pure Domain Service, no dependencies
public final class BundleDiscountService implements DomainService {

    public Price calculateBundleDiscount(Price basePrice, Category category, int bundleSize) {
        int discountPercentage = category.bundleDiscountFor(bundleSize);
        return basePrice.applyDiscount(discountPercentage);
    }
}
```

**This is the preferred approach.** It keeps the Domain Service pure and testable. Only when the orchestration in the Use Case becomes too complex, or when the domain logic itself has to decide which data it needs, do the following alternatives come into play.

---

## Approach 1: DomainGateway Pattern

### Concept

A **DomainGateway** is a narrow, read-only interface in the Domain Layer, phrased in the **Ubiquitous Language**. It allows the Domain Service to load specific data on demand without violating the Dependency Rule.

**Important distinctions:**
- A DomainGateway is a **tactical DDD pattern** — it belongs in the Domain Layer
- It is **not an OutputPort** — OutputPorts belong to the Application Layer (Hexagonal Architecture)
- It is **not a Repository** — Repositories manage Aggregate Roots with their full lifecycle (CRUD)
- A DomainGateway is **read-only** and returns only the data the Domain Service needs for its calculation

### Marker Interface

`DomainGateway` is one of the tactical building blocks the `dca-building-blocks` library ships — you
implement it, you do not write it:

```java
package dev.domaincentric.dca.buildingblocks.ddd.tactical;

/**
 * Marker interface for Domain Gateways.
 *
 * <p>A Domain Gateway is a narrow, read-only interface defined in the domain layer
 * that allows Domain Services to retrieve data needed for domain logic.
 * Unlike Repositories (which manage aggregate lifecycle via OutputPort),
 * Domain Gateways are tactical DDD patterns focused purely on data lookup.
 *
 * <p><b>Characteristics:</b>
 * <ul>
 *   <li>Read-only — no mutations, no save/delete operations
 *   <li>Narrow — only the data the domain logic needs, not entire aggregates
 *   <li>Named in Ubiquitous Language — e.g., CategoryPriceLookup, TaxRateResolver
 *   <li>Defined in domain layer, implemented by adapters
 *   <li>Should NOT have Spring annotations in the interface
 * </ul>
 *
 * <p><b>Naming conventions:</b> {@code *Lookup}, {@code *Resolver}, {@code *Provider}
 *
 * @see DomainService
 */
public interface DomainGateway {}
```

**Where it sits among the building blocks:**

```
dev.domaincentric.dca.buildingblocks.ddd.tactical     (the library; .NET: DomainCentric.BuildingBlocks.Ddd.Tactical → IDomainGateway)
├── DomainService
├── DomainGateway               ← this one
├── AggregateRoot
├── Entity
├── Value
└── ...
```

### Naming Conventions

| Suffix       | Usage                                                | Example                     |
|--------------|------------------------------------------------------|-----------------------------|
| `*Lookup`    | Simple data query (key → value)                      | `CategoryPriceLookup`       |
| `*Resolver`  | Resolution with logic (e.g. fallback, hierarchy)     | `TaxRateResolver`           |
| `*Provider`  | Provision of contextual data                         | `ExchangeRateProvider`      |

### Complete Code Example

**1. DomainGateway Interface (Domain Layer)**

```java
package com.company.project.pricing.domain.gateway;

import com.company.project.pricing.domain.model.CategoryDiscount;
import com.company.project.sharedkernel.domain.model.ProductId;
import dev.domaincentric.dca.buildingblocks.ddd.tactical.DomainGateway;
import java.util.Optional;

/**
 * Looks up category-based discount rates for products.
 */
public interface CategoryPriceLookup extends DomainGateway {

    Optional<CategoryDiscount> discountForProduct(ProductId productId);
}
```

**2. Domain Value Object (Domain Layer)**

```java
package com.company.project.pricing.domain.model;

import dev.domaincentric.dca.buildingblocks.ddd.tactical.Value;

public record CategoryDiscount(String categoryName, int discountPercentage) implements Value {

    public CategoryDiscount {
        if (discountPercentage < 0 || discountPercentage > 100) {
            throw new IllegalArgumentException(
                "Discount percentage must be between 0 and 100");
        }
    }
}
```

**3. Domain Service with DomainGateway (Domain Layer)**

```java
package com.company.project.pricing.domain.service;

import com.company.project.pricing.domain.gateway.CategoryPriceLookup;
import com.company.project.pricing.domain.model.CategoryDiscount;
import com.company.project.sharedkernel.domain.model.Price;
import com.company.project.sharedkernel.domain.model.ProductId;
import dev.domaincentric.dca.buildingblocks.ddd.tactical.DomainService;

public final class BundleDiscountService implements DomainService {

    private final CategoryPriceLookup categoryPriceLookup;

    public BundleDiscountService(CategoryPriceLookup categoryPriceLookup) {
        this.categoryPriceLookup = categoryPriceLookup;
    }

    public Price calculateBundleDiscount(ProductId productId, Price basePrice, int bundleSize) {
        int discountPercentage = categoryPriceLookup.discountForProduct(productId)
            .map(CategoryDiscount::discountPercentage)
            .map(base -> base + bonusForBundleSize(bundleSize))
            .orElse(bonusForBundleSize(bundleSize));

        return basePrice.applyDiscount(discountPercentage);
    }

    private int bonusForBundleSize(int bundleSize) {
        if (bundleSize >= 10) return 15;
        if (bundleSize >= 5) return 10;
        if (bundleSize >= 3) return 5;
        return 0;
    }
}
```

**4. Adapter Implementation (Adapter Layer)**

```java
package com.company.project.pricing.adapter.outgoing.categorylookup;

import com.company.project.pricing.domain.gateway.CategoryPriceLookup;
import com.company.project.pricing.domain.model.CategoryDiscount;
import com.company.project.sharedkernel.domain.model.ProductId;
import java.util.Map;
import java.util.Optional;
import org.springframework.stereotype.Component;

@Component
class InMemoryCategoryPriceLookup implements CategoryPriceLookup {

    private final Map<ProductId, CategoryDiscount> categoryDiscounts;

    InMemoryCategoryPriceLookup(Map<ProductId, CategoryDiscount> categoryDiscounts) {
        this.categoryDiscounts = categoryDiscounts;
    }

    @Override
    public Optional<CategoryDiscount> discountForProduct(ProductId productId) {
        return Optional.ofNullable(categoryDiscounts.get(productId));
    }
}
```

**5. Wiring in the Use Case (Application Layer)**

```java
package com.company.project.pricing.application.calculatebundlediscount;

import com.company.project.pricing.domain.gateway.CategoryPriceLookup;
import com.company.project.pricing.domain.service.BundleDiscountService;
import com.company.project.sharedkernel.domain.model.Price;

public class CalculateBundleDiscountUseCase implements CalculateBundleDiscountInputPort {

    private final BundleDiscountService bundleDiscountService;

    public CalculateBundleDiscountUseCase(CategoryPriceLookup categoryPriceLookup) {
        this.bundleDiscountService = new BundleDiscountService(categoryPriceLookup);
    }

    @Override
    public DiscountResult execute(DiscountCommand command) {
        Price discountedPrice = bundleDiscountService.calculateBundleDiscount(
            command.productId(),
            command.basePrice(),
            command.bundleSize()
        );
        return new DiscountResult(discountedPrice);
    }
}
```

### Data Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Adapter Layer                                                               │
│                                                                             │
│  InMemoryCategoryPriceLookup ──implements──▶ CategoryPriceLookup (Domain)  │
│                                                                             │
└──────────────────────────────────────────────────┬──────────────────────────┘
                                                   │
┌──────────────────────────────────────────────────┼──────────────────────────┐
│ Application Layer                                │                          │
│                                                  │                          │
│  CalculateBundleDiscountUseCase                  │ injects                  │
│      │                                           │                          │
│      │ creates with gateway ─────────────────────┘                          │
│      ▼                                                                      │
└──────┼──────────────────────────────────────────────────────────────────────┘
       │
┌──────┼──────────────────────────────────────────────────────────────────────┐
│ Domain Layer                                                                │
│      ▼                                                                      │
│  BundleDiscountService                                                      │
│      │                                                                      │
│      │──▶ CategoryPriceLookup.discountForProduct(productId)                │
│      │                          │                                           │
│      │◀── CategoryDiscount ◀────┘                                           │
│      │                                                                      │
│      └──▶ Price (calculated)                                                │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Distinction: DomainGateway vs. Repository

| Aspect              | Repository                              | DomainGateway                            |
|---------------------|-----------------------------------------|------------------------------------------|
| **Marker**          | `extends OutputPort`                    | `extends DomainGateway`                  |
| **Layer**           | Application Layer (Output Port)         | Domain Layer (tactical pattern)          |
| **Responsibility**  | Aggregate lifecycle (CRUD)              | Read-only data query                     |
| **Scope**           | Whole Aggregate Root                    | Narrow slice of data                     |
| **Mutations**       | `save()`, `deleteById()`               | None                                     |
| **Used by**         | Use Cases (Application Layer)           | Domain Services (Domain Layer)           |
| **Implemented by**  | Outgoing Adapter                        | Outgoing Adapter                         |

### Pros and Cons

**Pros:**
- The Domain Service can decide on its own which data it needs and when
- The interface is phrased in the Ubiquitous Language — explicit in the domain model
- Easy to test: mock the DomainGateway in the unit test
- Well suited for complex domain logic with conditional data queries

**Cons:**
- Introduces a dependency into the Domain Layer (albeit an abstract one)
- Can be abused as a "back door" — discipline required
- More classes: interface + implementation + marker
- Not established as a pattern in all DDD literature

---

## Approach 2: Strategy/Callback Pattern

### Concept

The Domain Service receives the data retrieval as a **functional parameter** (Strategy). The Application Service passes a lambda or method reference that supplies the data. The Domain Layer defines no interface — the dependency exists only at call time.

### Complete Code Example

**1. Domain Service with Functional Parameter (Domain Layer)**

```java
package com.company.project.pricing.domain.service;

import com.company.project.pricing.domain.model.CategoryDiscount;
import com.company.project.sharedkernel.domain.model.Price;
import com.company.project.sharedkernel.domain.model.ProductId;
import dev.domaincentric.dca.buildingblocks.ddd.tactical.DomainService;
import java.util.Optional;
import java.util.function.Function;

public final class BundleDiscountService implements DomainService {

    public Price calculateBundleDiscount(
            ProductId productId,
            Price basePrice,
            int bundleSize,
            Function<ProductId, Optional<CategoryDiscount>> discountLookup) {

        int discountPercentage = discountLookup.apply(productId)
            .map(CategoryDiscount::discountPercentage)
            .map(base -> base + bonusForBundleSize(bundleSize))
            .orElse(bonusForBundleSize(bundleSize));

        return basePrice.applyDiscount(discountPercentage);
    }

    private int bonusForBundleSize(int bundleSize) {
        if (bundleSize >= 10) return 15;
        if (bundleSize >= 5) return 10;
        if (bundleSize >= 3) return 5;
        return 0;
    }
}
```

**2. Wiring in the Use Case (Application Layer)**

```java
package com.company.project.pricing.application.calculatebundlediscount;

import com.company.project.pricing.application.shared.ProductPriceRepository;
import com.company.project.pricing.domain.model.CategoryDiscount;
import com.company.project.pricing.domain.service.BundleDiscountService;
import com.company.project.sharedkernel.domain.model.Price;

public class CalculateBundleDiscountUseCase implements CalculateBundleDiscountInputPort {

    private final ProductPriceRepository productPriceRepository;
    private final BundleDiscountService bundleDiscountService = new BundleDiscountService();

    public CalculateBundleDiscountUseCase(ProductPriceRepository productPriceRepository) {
        this.productPriceRepository = productPriceRepository;
    }

    @Override
    public DiscountResult execute(DiscountCommand command) {
        Price discountedPrice = bundleDiscountService.calculateBundleDiscount(
            command.productId(),
            command.basePrice(),
            command.bundleSize(),
            productId -> productPriceRepository.findByProductId(productId)
                .map(pp -> new CategoryDiscount(pp.category(), pp.categoryDiscountPercentage()))
        );
        return new DiscountResult(discountedPrice);
    }
}
```

### Variant: Dedicated Functional Interface Instead of `java.util.function.Function`

If the signature `Function<ProductId, Optional<CategoryDiscount>>` is too generic, a dedicated functional interface can improve readability:

```java
package com.company.project.pricing.domain.service;

import com.company.project.pricing.domain.model.CategoryDiscount;
import com.company.project.sharedkernel.domain.model.ProductId;
import java.util.Optional;

@FunctionalInterface
public interface CategoryDiscountLookup {
    Optional<CategoryDiscount> lookup(ProductId productId);
}
```

The Domain Service then uses:

```java
public Price calculateBundleDiscount(
        ProductId productId,
        Price basePrice,
        int bundleSize,
        CategoryDiscountLookup discountLookup) {

    int discountPercentage = discountLookup.lookup(productId)
        // ...
}
```

The call in the Use Case stays identical — Java's lambda compatibility ensures that the lambda automatically matches the functional interface.

**Recommendation:** Use a dedicated functional interface when:
- The method is used more than once
- The generic signature `Function<A, B>` hurts readability
- You want to document the method (Javadoc on the interface)

### Data Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Application Layer                                                           │
│                                                                             │
│  CalculateBundleDiscountUseCase                                             │
│      │                                                                      │
│      │ calls with lambda: productId -> repository.find(...)                │
│      │                                    │                                 │
│      ▼                                    ▼                                 │
└──────┼──────────────────────────────┬─────┼─────────────────────────────────┘
       │                              │     │
┌──────┼──────────────────────────────┼─────┼─────────────────────────────────┐
│ Domain Layer                        │     │                                 │
│      ▼                              │     │                                 │
│  BundleDiscountService              │     │                                 │
│      │                              │     │                                 │
│      │──▶ discountLookup.apply(id) ─┘     │                                 │
│      │         (lambda callback)          │                                 │
│      │                                    │                                 │
│      │◀── CategoryDiscount ◀──────────────┘                                 │
│      │                                                                      │
│      └──▶ Price (calculated)                                                │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Pros and Cons

**Pros:**
- **Zero dependencies** in the Domain Layer — not even an abstract interface
- The Domain Service remains a true pure object (stateless, no fields)
- Maximum testability: define the lambda inline in the test
- No additional marker interface needed
- Lightweight — no additional classes

**Cons:**
- The method signature becomes longer and more complex
- Less explicit: `Function<ProductId, Optional<CategoryDiscount>>` is not immediately understandable
- Callback logic can clutter the Use Case
- No place for Javadoc on the contract (with `java.util.function.Function`)
- With several data sources: parameter explosion

---

## Comparison: When to Use Which Approach

| Criterion                        | Pure Domain Service     | DomainGateway              | Strategy/Callback          |
|----------------------------------|-------------------------|----------------------------|----------------------------|
| **Complexity of data query**     | Simple (1-2 sources)    | Medium to complex          | Simple (1 source)          |
| **Dependencies in the domain**   | None                    | Abstract interface         | None                       |
| **Testability**                  | Trivial                 | Mock the gateway           | Lambda inline              |
| **Readability**                  | Very good               | Good (explicit interface)  | Moderate (long signatures) |
| **Reusability**                  | High                    | High (interface shared)    | Low (per call)             |
| **Number of classes**            | Minimal                 | +2 (interface + impl)      | Optional +1 (func. interf.)|
| **Domain model explicitness**    | —                       | High (Ubiquitous Language) | Low                        |
| **Recommended when...**          | Data can be loaded up front | Domain decides what data it needs, several services share the same query | Single, simple query used by one service |

### Decision Tree

```
START: Domain Service needs data it does not have
   │
   ├─ Can the Application Service load all data up front?
   │     YES → Pure Domain Service (default)
   │     │
   │     NO ↓
   │
   ├─ Does the Domain Service decide dynamically which data it needs?
   │     YES → DomainGateway Pattern
   │     │
   │     NO ↓
   │
   ├─ Is it a single, simple data query?
   │     YES → Strategy/Callback Pattern
   │     │
   │     NO ↓
   │
   └─ Do several Domain Services need the same query?
         YES → DomainGateway Pattern (reusable interface)
         NO → Strategy/Callback Pattern (lightweight)
```

---

## ArchUnit Governance

### DomainGateway Rules

```java
@ArchTest
static final ArchRule domain_gateways_must_be_read_only =
    classes().that().implement(DomainGateway.class)
        .should().haveOnlyFinalFields()
        .andShould().notHaveModifier(JavaModifier.ABSTRACT)
        .because("DomainGateways are read-only lookup interfaces implemented by adapters");

@ArchTest
static final ArchRule domain_gateways_must_reside_in_domain_layer =
    classes().that().implement(DomainGateway.class)
        .and().areInterfaces()
        .should().resideInAnyPackage("..domain.gateway..")
        .because("DomainGateway interfaces belong to the domain layer");

@ArchTest
static final ArchRule domain_gateway_interfaces_must_not_extend_output_port =
    classes().that().implement(DomainGateway.class)
        .should().notImplement(OutputPort.class)
        .because("DomainGateways are tactical DDD patterns, not hexagonal OutputPorts");
```

### Strategy/Callback Rules

Since the Strategy/Callback Pattern defines no interface of its own in the Domain Layer, the existing ArchUnit rules are already sufficient:

```java
// Existing rule: the Domain Layer has no outward dependencies
@ArchTest
static final ArchRule domain_layer_has_no_outward_dependencies =
    classes().that().resideInAnyPackage("..domain..")
        .should().onlyDependOnClassesThat()
        .resideInAnyPackage("..domain..", "..sharedkernel..", "java..")
        .because("Domain layer must not depend on application, adapter, or infrastructure layers");
```

This rule automatically ensures that:
- No `Function` parameter refers to Adapter or Application classes
- The domain uses only `java.util.function.*` (allowed under `java..`)
- No hidden dependencies are smuggled in through lambdas

### Additional Governance for Dedicated Functional Interfaces

```java
@ArchTest
static final ArchRule functional_interfaces_in_domain_must_be_annotated =
    classes().that().resideInAnyPackage("..domain..")
        .and().areInterfaces()
        .and().haveSimpleNameNotEndingWith("DomainGateway")
        .and().areAnnotatedWith(FunctionalInterface.class)
        .should().resideInAnyPackage("..domain.service..", "..domain..")
        .because("Domain functional interfaces should be co-located with their Domain Services");
```

---

## References

- [Domain-Driven Design](https://www.domainlanguage.com/ddd/) — Eric Evans (2003), Chapter 5
- [Implementing Domain-Driven Design](https://www.informit.com/store/implementing-domain-driven-design-9780321834577) — Vaughn Vernon (2013), Chapter 7
