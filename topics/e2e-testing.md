# E2E Testing for Domain-Centric Architecture

Practical guide for browser-based end-to-end testing using Playwright with data-test attributes and the Page Object Pattern.

---

## Table of Contents

- [Introduction](#introduction)
- [Data-Test Attributes](#data-test-attributes)
- [Page Object Pattern](#page-object-pattern)
- [Test Organization](#test-organization)
- [Writing E2E Tests](#writing-e2e-tests)
- [One test per acceptance criterion](#one-test-per-acceptance-criterion)
- [Best Practices](#best-practices)
- [Anti-Patterns](#anti-patterns)
- [CI/CD Integration](#cicd-integration)
- [Related Documentation](#related-documentation)

---

## Introduction

E2E tests verify the complete user journey through your application. In domain-centric architecture, E2E tests sit at the top of the testing pyramid—few in number but critical for validating full-stack behavior.

**When to use E2E tests:**
- Critical user flows (checkout, authentication)
- Cross-bounded context interactions
- Smoke tests for deployments

**When NOT to use E2E tests:**
- Testing domain logic (use unit tests)
- Testing use case orchestration (use application tests)
- Testing every edge case (slow and brittle)

---

## Data-Test Attributes

### The Problem

Brittle selectors couple tests to UI implementation details:

```java
// ❌ BAD: Breaks on text/CSS changes
page.locator("button:has-text('Add to Cart')").click();
page.locator(".product-card").first().click();
page.locator("a:has-text('View Details')").click();
```

### The Solution

Use `data-test` attributes to create a stable test contract:

```html
<!-- Template -->
<button data-test="product-add-to-cart-button">Add to Cart</button>
<a href="/products/1" data-test="product-view-details-link">View Details</a>
```

```java
// ✅ GOOD: Stable selectors
page.locator("[data-test='product-add-to-cart-button']").click();
page.locator("[data-test='product-view-details-link']").first().click();
```

### Naming Convention

Pattern: `{context}-{element}-{action}` (kebab-case)

| Element Type | Pattern | Example |
|--------------|---------|---------|
| Buttons | `{context}-{action}-button` | `product-add-to-cart-button` |
| Links | `{context}-{target}-link` | `cart-checkout-link` |
| Inputs | `{context}-{field}-input` | `buyer-email-input` |
| Containers | `{context}-{name}-container` | `product-card-container` |
| Forms | `{context}-{name}-form` | `buyer-info-form` |

### Examples by Feature

**Product Catalog:**
- `product-card-container`
- `product-view-details-link`
- `product-add-to-cart-button`
- `product-detail-container`

**Shopping Cart:**
- `cart-item-container`
- `cart-checkout-link`
- `cart-remove-item-button`

**Checkout:**
- `buyer-email-input`
- `buyer-continue-button`
- `checkout-place-order-button`
- `confirmation-message`

### Template Integration

```html
<!-- Before -->
<div class="product-card">
  <a href="/products/1">View Details</a>
  <button>Add to Cart</button>
</div>

<!-- After -->
<div class="product-card" data-test="product-card-container">
  <a href="/products/1" data-test="product-view-details-link">View Details</a>
  <button data-test="product-add-to-cart-button">Add to Cart</button>
</div>
```

---

## Page Object Pattern

### Why Page Objects?

Page Objects encapsulate page-specific selectors and interactions, providing:

- **Single point of change** - Selectors defined once per page
- **Readable tests** - Tests read like business workflows
- **Type-safe navigation** - Compiler catches invalid transitions
- **Reusability** - Page objects shared across test classes

### Design Rules

1. **One page object per page/view** - Each distinct page gets its own class
2. **Fluent API** - Navigation methods return the target page object
3. **URL validation** - Constructors validate expected URL pattern (fail-fast)
4. **Centralized selectors** - All `data-test` values are private constants
5. **No assertions in page objects** - Page objects return data; tests assert

### Structure

```text
src/test-e2e/java/com/company/project/e2e/pages/
├── BasePage.java              # Common methods for all pages
├── ProductCatalogPage.java    # Product listing interactions
├── ProductDetailPage.java     # Product detail and add to cart
├── CartPage.java              # Shopping cart operations
├── BuyerInfoPage.java         # Checkout: buyer information
├── DeliveryPage.java          # Checkout: delivery address
├── PaymentPage.java           # Checkout: payment selection
├── ReviewPage.java            # Checkout: order review
└── ConfirmationPage.java      # Order confirmation
```

### BasePage Implementation

```java
public abstract class BasePage {
    protected static final String BASE_URL = System.getProperty("e2e.baseUrl", "http://localhost:8080");
    protected final Page page;

    protected BasePage(Page page, String expectedUrlPattern) {
        this.page = page;
        page.waitForURL(BASE_URL + expectedUrlPattern);
    }

    protected BasePage(Page page) {
        this.page = page;
    }

    protected void click(String dataTest) {
        page.locator("[data-test='" + dataTest + "']").click();
    }

    protected void clickFirst(String dataTest) {
        page.locator("[data-test='" + dataTest + "']").first().click();
    }

    protected void fill(String name, String value) {
        page.locator("input[name='" + name + "']").fill(value);
    }

    protected void waitFor(String dataTest) {
        page.locator("[data-test='" + dataTest + "']").first().waitFor();
    }

    protected boolean exists(String dataTest) {
        return page.locator("[data-test='" + dataTest + "']").count() > 0;
    }

    protected boolean pageContains(String text) {
        return page.locator("body").textContent().contains(text);
    }
}
```

### Example Page Object

```java
public class BuyerInfoPage extends BasePage {
    private static final String URL_PATTERN = "/checkout/buyer";
    private static final String CONTINUE_BUTTON = "buyer-continue-button";
    private static final String LOGIN_LINK = "buyer-login-link";

    public BuyerInfoPage(Page page) {
        super(page, URL_PATTERN);
    }

    public BuyerInfoPage fillBuyerInfo(String email, String firstName,
                                        String lastName, String phone) {
        fill("email", email);
        fill("firstName", firstName);
        fill("lastName", lastName);
        fill("phone", phone);
        return this;
    }

    public DeliveryPage continueToDelivery() {
        click(CONTINUE_BUTTON);
        return new DeliveryPage(page);
    }

    public LoginPage goToLogin() {
        click(LOGIN_LINK);
        return new LoginPage(page);
    }

    public boolean hasValidationErrors() {
        return pageContains("valid email") || pageContains("error");
    }
}
```

### Example: ProductCatalogPage

```java
public class ProductCatalogPage extends BasePage {
    private static final String URL_PATTERN = "/products";
    private static final String PRODUCT_CARD = "product-card";
    private static final String VIEW_DETAILS_LINK = "product-view-details-link";

    public ProductCatalogPage(Page page) {
        super(page, URL_PATTERN);
        waitFor(PRODUCT_CARD);
    }

    public static ProductCatalogPage navigateTo(Page page) {
        page.navigate(BASE_URL + URL_PATTERN);
        return new ProductCatalogPage(page);
    }

    public ProductDetailPage viewFirstProduct() {
        clickFirst(VIEW_DETAILS_LINK);
        return new ProductDetailPage(page);
    }

    public boolean hasProducts() {
        return exists(PRODUCT_CARD);
    }
}
```

---

## Test Organization

### Directory Structure

```text
src/test-e2e/java/com/company/project/e2e/
├── BaseE2ETest.java           # Common test setup
├── CheckoutGuestE2ETest.java  # Guest checkout flow tests
├── CheckoutLoginE2ETest.java  # Authenticated checkout tests
└── pages/                     # Page objects
    ├── BasePage.java
    ├── ProductCatalogPage.java
    └── ...
```

### BaseE2ETest Setup

```java
public abstract class BaseE2ETest {
    protected static final String BASE_URL = System.getProperty("e2e.baseUrl", "http://localhost:8080");
    protected static final boolean HEADLESS = Boolean.parseBoolean(System.getProperty("e2e.headless", "true"));

    protected static Playwright playwright;
    protected static Browser browser;
    protected BrowserContext context;
    protected Page page;

    @BeforeAll
    static void launchBrowser() {
        playwright = Playwright.create();
        browser = playwright.chromium().launch(
            new BrowserType.LaunchOptions().setHeadless(HEADLESS)
        );
    }

    @AfterAll
    static void closeBrowser() {
        if (browser != null) browser.close();
        if (playwright != null) playwright.close();
    }

    @BeforeEach
    void createContextAndPage() {
        context = browser.newContext();
        page = context.newPage();
    }

    @AfterEach
    void closeContext() {
        if (context != null) context.close();
    }

    protected void navigateTo(String path) {
        page.navigate(BASE_URL + path);
    }

    protected void waitForUrl(String urlPattern) {
        page.waitForURL(BASE_URL + urlPattern);
    }

    protected String getCurrentPath() {
        return page.url().replace(BASE_URL, "");
    }
}
```

---

## Writing E2E Tests

### Complete Test Example

```java
@DisplayName("Guest Checkout E2E Tests")
class CheckoutGuestE2ETest extends BaseE2ETest {

    @Test
    @DisplayName("Complete checkout flow as guest user")
    void completeGuestCheckoutFlow() {
        // Step 1: Browse catalog and add product
        ProductCatalogPage catalog = ProductCatalogPage.navigateTo(page);
        ProductDetailPage detail = catalog.viewFirstProduct();
        detail.addToCart();

        // Step 2: Verify cart and start checkout
        CartPage cart = CartPage.navigateTo(page);
        assertTrue(cart.hasItems(), "Cart should have at least one item");

        // Step 3: Fill buyer information
        BuyerInfoPage buyer = cart.proceedToCheckout();
        DeliveryPage delivery = buyer
            .fillBuyerInfo("guest@example.com", "Test", "Guest", "+1-555-0100")
            .continueToDelivery();

        // Step 4: Fill delivery information
        PaymentPage payment = delivery
            .fillAddress("123 Main Street", "Springfield", "12345", "US", "IL")
            .selectFirstShippingOption()
            .continueToPayment();

        // Step 5: Select payment
        ReviewPage review = payment
            .selectFirstPaymentProvider()
            .continueToReview();

        // Step 6: Verify and place order
        assertTrue(review.showsEmail("guest@example.com"));
        ConfirmationPage confirmation = review.placeOrder();

        // Step 7: Verify confirmation
        assertTrue(confirmation.isOrderConfirmed());
    }
}
```

### Test Characteristics

- **Readable** - Tests read like user stories
- **Isolated** - Each test starts with fresh browser context
- **Focused** - One flow per test
- **Verifiable** - Clear assertions at key points

---

## One test per acceptance criterion

An end-user test earns its cost when it is the evidence for a stated criterion, and it is easiest to
keep honest when the mapping is explicit: **one end-user test per acceptance criterion of a story**,
recorded next to the criterion's key rather than guessed from test names.

```markdown
| criterion | test |
| --- | --- |
| shows-empty-state | com.example.reporting.MonthlyReportPageTest#showsEmptyState |
| lists-newest-first | com.example.reporting.MonthlyReportPageTest#listsNewestFirst |
```

Three rules keep that mapping meaningful.

**The criterion's key never appears in the test.** Not in its name, not in a display name, not in a
comment. A test says what the user can observe (`showsEmptyState`), and the link between criterion
and test lives in the table alone. A key written into a test name pins the test to a story that will
be closed long before the test is deleted.

**Red for the right reason, before the code exists.** A new end-user test must fail on its
*assertion*, not on a missing class or a wiring error, and it must not be green before the behaviour
is built. A test that is green too early proves nothing about the criterion — and the most common
cause is a stub that returns the very answer the criterion expects, so a stub should throw instead of
answering.

**No later step edits it.** The code changes until the test passes; the test does not change until
the criterion does. A test rewritten to match the implementation has stopped being evidence.

### When there is no browser to drive

A criterion still needs an end-user test when the story has no user interface — and the right shape
is then the highest level the project can actually run today, not a browser runner installed for the
occasion:

| The story delivers | The end-user test drives |
|---|---|
| a server-rendered page or a client app | the browser, through Page Objects (the rest of this document) |
| an HTTP API | the running application over HTTP, asserting status and payload |
| a message consumer | the message, published as a producer would, asserting the effect |
| a scheduled job | the job's entry point, with the clock or trigger the project uses |
| a use case with no surface yet | the input port in the wired application, with the note that no surface exists |

The last row is a real answer, not a fallback to be embarrassed about: a criterion whose actor has
no way in yet is a scoping question, and inventing a page or an endpoint to make a test possible
delivers a surface nobody specified — including, where it needs a guard, an authorisation decision
nobody reviewed. Test at the highest level that exists, say so, and let the missing surface be
decided as its own piece of work.

Adding a test framework the project does not have is a stack decision, never part of delivering a
story.

---

## Best Practices

### 1. Keep Tests Focused
One user flow per test. If a test does multiple things, split it.

### 2. Use Descriptive Names
```java
@DisplayName("Guest checkout completes with confirmation number")
void completeGuestCheckoutFlow() { }
```

### 3. Fail Fast with URL Validation
Page objects validate URLs in constructors to catch navigation errors immediately.

### 4. Prefer Explicit Waits
```java
// ✅ GOOD: Wait for specific element
waitFor("product-card-container");

// ❌ BAD: Arbitrary sleep
Thread.sleep(1000);
```

### 5. Test Only Critical Paths
E2E tests are expensive. Reserve them for:
- Happy path user journeys
- Critical business flows
- Cross-context integration

### 6. Run Headless in CI
```bash
./gradlew test-e2e -De2e.headless=true
```

---

## Anti-Patterns

### ❌ Brittle Selectors
```java
// ❌ BAD: Coupled to text and CSS
page.locator("button:has-text('Add to Cart')").click();
page.locator(".btn-primary").click();
```

### ❌ Assertions in Page Objects
```java
// ❌ BAD: Page object making assertions
public class CartPage extends BasePage {
    public void verifyItemCount(int expected) {
        assertEquals(expected, getItemCount()); // Don't!
    }
}

// ✅ GOOD: Return data, let tests assert
public class CartPage extends BasePage {
    public int getItemCount() {
        return page.locator("[data-test='cart-item']").count();
    }
}
```

### ❌ Hardcoded Waits
```java
// ❌ BAD: Arbitrary delay
Thread.sleep(2000);

// ✅ GOOD: Wait for condition
page.waitForURL(BASE_URL + "/checkout/buyer");
waitFor("buyer-info-form");
```

### ❌ Testing Everything with E2E
```java
// ❌ BAD: Testing validation logic with E2E
@Test
void shouldRejectInvalidEmailFormat() { ... }

// ✅ GOOD: Test validation in unit tests, E2E for happy paths
```

### ❌ Duplicate Selectors
```java
// ❌ BAD: Selectors scattered across tests
page.locator("[data-test='product-add-to-cart-button']").click();
// ... later in another test
page.locator("[data-test='product-add-to-cart-button']").click();

// ✅ GOOD: Centralized in page object
public class ProductDetailPage extends BasePage {
    private static final String ADD_TO_CART_BUTTON = "product-add-to-cart-button";

    public void addToCart() {
        click(ADD_TO_CART_BUTTON);
    }
}
```

---

## CI/CD Integration

### Gradle Configuration

```groovy
// build.gradle
sourceSets {
    'test-e2e' {
        java.srcDirs = ['src/test-e2e/java']
        resources.srcDirs = ['src/test-e2e/resources']
        compileClasspath += sourceSets.main.output
        runtimeClasspath += sourceSets.main.output
    }
}

task 'test-e2e'(type: Test) {
    testClassesDirs = sourceSets.'test-e2e'.output.classesDirs
    classpath = sourceSets.'test-e2e'.runtimeClasspath

    systemProperty 'e2e.baseUrl', System.getProperty('e2e.baseUrl', 'http://localhost:8080')
    systemProperty 'e2e.headless', System.getProperty('e2e.headless', 'true')
}
```

### Running Tests

```bash
# Run with defaults (headless, localhost:8080)
./gradlew test-e2e

# Run against staging environment
./gradlew test-e2e -De2e.baseUrl=https://staging.example.com

# Run with visible browser (debugging)
./gradlew test-e2e -De2e.headless=false
```

### CI Pipeline Example

```yaml
e2e-tests:
  stage: test
  services:
    - name: application:latest
      alias: app
  script:
    - ./gradlew test-e2e -De2e.baseUrl=http://app:8080 -De2e.headless=true
  artifacts:
    when: always
    paths:
      - build/reports/test-e2e/
```

---

## Related Documentation

- [ArchUnit Governance](./archunit-governance.md) - Architecture testing
