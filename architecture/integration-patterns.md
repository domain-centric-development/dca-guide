# Integration Patterns

## Same Bounded Context
- Direct method calls within aggregate
- Domain events for cross-aggregate communication
- Use case coordinates multiple aggregates
- Eventual consistency between aggregates

## Different Bounded Contexts
- Anti-Corruption Layer for external models
- Open Host Service for synchronous queries
- Domain events via message broker
- REST API with DTOs
- Shared Kernel (minimal, coordinated)

## A Bounded Context Is a Deep Module

A bounded context is a *deep module* in the sense of Ousterhout (*A Philosophy of Software
Design*): a lot of implementation behind a deliberately small interface. Its public surface is
the set of input ports, the integration events it publishes and the trigger interfaces it
defines for its suppliers — nothing else. Aggregates, use cases, adapters and read models
stay inside. The architecture rules make this depth enforceable rather than a convention:
no raw import crosses a context boundary, and every published relationship is declared on
`package-info.java` and verified.

Depth is measured at the context, not at the package. The many small use-case packages
inside a context are its interior, not shallow modules of their own. The payoff is the same
for every reader of the code: a person — or a coding agent without memory of previous
sessions — understands a context from its ports and records alone and touches the interior
only when working there.

## Declaring Context Relationships in Code

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

Rules the declarations enable (see [ArchUnit Governance](../topics/archunit-governance.md)):

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

## Open Host Service Pattern

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

### Provider: REST API (Canonical)

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

### Provider: In-Process Service (Modulith Optimization)

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

### Consumer: Output Port + Adapter (Same for Both)

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

> **Note:** For multi-service integration patterns, see [Deployment Patterns](../topics/deployment-patterns.md)

## Composite Adapter Pattern

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

## Domain services over supplied facts

An aggregate answers questions about its own state. When a calculation combines facts from other aggregates or
contexts, the use case retrieves them through output ports and passes immutable snapshots to a domain service.
Moving a lookup behind a resolver/callback parameter does not change who owns the calculation. Neither the aggregate
nor the service receives a repository or remote port. A domain-owned `DomainGateway` is an explicit exception with
an effect and dependency rationale; a pure algorithmic strategy is different from a hidden external lookup.

```java
// Domain service: the use case has already retrieved the article facts.
public final class CartPricing implements DomainService {
    public record Line(ProductId productId, Quantity quantity) implements Value {}

    public Money calculateTotal(List<Line> lines, Map<ProductId, ArticlePrice> facts) {
        Money total = Money.euro(0);
        for (Line line : lines) {
            total = total.add(facts.get(line.productId()).price().multiply(line.quantity().value()));
        }
        return total;
    }
}
```

The service owns the external-fact calculation; the aggregate owns the state transition. Pass the assessment or facts
into that transition, then save and publish in the use case. Presentation enrichment stays a separate value model.
`DCA-TAC-002` checks fields, not semantic responsibility: callback parameters need manual review. No marker proves
that an operation belongs on a particular object.

## Enriched Read Model Pattern

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

**Note:** An enriched read model is a Value Object, not an Aggregate. It has no lifecycle or events.
Its name follows the domain: `ExtendedCart` and `CartWithCurrentPrices` are equally valid
alternatives to `EnrichedCart`. Neither an `Enriched` prefix nor record syntax defines the
role. Implement `Value` and follow its identity, immutability and equality contracts;
immutable classes with equality are valid too. Enrichment itself is guidance.

## Factory for Cross-Context Assembly

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


## Optional events and reliable delivery

Events are optional: an aggregate that never registers a fact needs no publisher dependency. `DCA-USE-009`
exempts a save only when the repository type argument and the aggregate's complete hierarchy can be inspected
and no registration is found; unresolved arguments, incomplete scans and undecidable external helpers retain the check.
Contracts belong in the configured `{context}/events/` segment. Translators belong in an outgoing adapter named after its channel — `event/` when delivery is in-process, `messaging/` once transport or an outbox relay lives there;
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
