# ArchUnit Governance for Domain-Centric Architecture

**Automated Architectural Testing and Enforcement**

> **Prerequisites:** This document shows how to implement automated architecture testing for [Domain-Centric Architecture](./README.md) using ArchUnit. Read the main document first for core patterns and rules.

---

## Table of Contents

1. [Introduction](#introduction)
2. [Setup and Configuration](#setup-and-configuration)
3. [Core Rule Categories](#core-rule-categories)
4. [Complete Test Suites](#complete-test-suites)
5. [Context-Specific Rule Sets](#context-specific-rule-sets)
6. [Adoption Path (Tiers)](#adoption-path-tiers)
7. [Tuning the Rule Catalog](#tuning-the-rule-catalog)
8. [Best Practices](#best-practices)
9. [CI/CD Integration](#cicd-integration)
10. [Common Pitfalls and Solutions](#common-pitfalls-and-solutions)

---

## Introduction

### What is ArchUnit?

**ArchUnit** is a Java library that allows you to test your architecture using unit tests. It verifies that your code follows defined architectural rules by analyzing compiled classes. **ArchUnitNET** is its .NET port; the DCA rule catalog exists for both, under the same rule ids (see [.NET: ArchUnitNET](#net-archunitnet)).

**Key Capabilities:**
- ✅ Enforce layer dependencies
- ✅ Verify package structure
- ✅ Check naming conventions
- ✅ Validate framework independence
- ✅ Ensure DDD pattern compliance
- ✅ Detect cyclic dependencies

### Why Use ArchUnit for Domain-Centric Architecture?

**Problem Without ArchUnit:**
- Architecture erodes over time ("broken window theory")
- Violations discovered late in code review or production
- Inconsistent application of patterns across team
- New developers may not understand architectural rules
- Refactoring introduces accidental violations

**Solution With ArchUnit:**
- Architecture violations fail the build immediately
- Continuous enforcement on every commit
- Executable documentation of architecture rules
- Onboarding tool for new developers
- Confident refactoring with safety net

### Benefits

1. **Prevents Architectural Drift** - Rules enforced automatically on every build
2. **Living Documentation** - Architecture rules as executable tests
3. **Early Detection** - Catch violations before code review
4. **Team Alignment** - Explicit, verifiable architectural guidelines
5. **Confident Refactoring** - Safety net when restructuring code
6. **Reduced Code Review** - Automated checks reduce manual review burden

---

## Setup and Configuration

The DCA rules ship as a library — `dev.domaincentric:dca-archunit` — pinned to the building blocks
your code implements (`dev.domaincentric:dca-building-blocks`). A project adds one dependency and one
test class; the rule categories below explain what that class checks and serve as templates for the
project-specific rules you add next to it.

### Gradle Dependency

```kotlin
dependencies {
    implementation("dev.domaincentric:dca-building-blocks:0.1.2")
    testImplementation("dev.domaincentric:dca-archunit:0.3.0")     // brings ArchUnit
    testImplementation("org.junit.jupiter:junit-jupiter")
}
```

### Maven Dependency

```xml
<dependency>
    <groupId>dev.domaincentric</groupId>
    <artifactId>dca-archunit</artifactId>
    <version>0.3.0</version>
    <scope>test</scope>
</dependency>
```

### Basic Test Class Structure

```java
package com.company.project;

import dev.domaincentric.dca.archunit.DcaLayout;
import dev.domaincentric.dca.archunit.junit.DcaArchitectureTest;

/**
 * Runs the whole DCA rule catalog against this code base.
 * Every rule appears as one dynamic test, named "[DCA-TAC-001] Aggregate roots must …".
 */
class ArchitectureTest extends DcaArchitectureTest {

    @Override
    protected DcaLayout layout() {
        return DcaLayout.forBasePackage("com.company.project");
    }
}
```

That is the complete test. `DcaLayout` tells the rules where your code lives; its defaults are the
package conventions of this guide (`domain`, `application`, `adapter/incoming`, `adapter/outgoing`,
`infrastructure`, `*UseCase`, `*InputPort`). Deviations are declared, not hidden:

```java
DcaLayout.forBasePackage("com.company.project")
    .withIncomingSubpackage("in")                 // adapter/in instead of adapter/incoming
    .withOutgoingSubpackage("out")
    .withUseCaseSuffix("ApplicationService")
    .withControllerSuffix("Page")
    .allowingInDomain("org.jmolecules..")         // extra third-party packages tolerated in the domain
    .withFrameworkAnnotations(FrameworkAnnotations.spring());
```

Without JUnit — from any test framework or a build step:

```java
DcaArchitecture arch = DcaArchitecture.load(DcaLayout.forBasePackage("com.company.project"));
DcaRules.checkAll(arch);          // throws on the first violated rule; checkAll(arch, selection) to tune
```

Which rules run, and how strictly, is the subject of [Tuning the Rule Catalog](#tuning-the-rule-catalog).

### Adding Project-Specific Rules

The library covers the architecture; your project has rules of its own (a forbidden legacy package, a
naming rule for a protocol). Write them with plain ArchUnit next to the catalog test:

```java
package com.company.project;

import com.tngtech.archunit.core.importer.ImportOption;
import com.tngtech.archunit.junit.AnalyzeClasses;
import com.tngtech.archunit.junit.ArchTest;
import com.tngtech.archunit.lang.ArchRule;

import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.*;

@AnalyzeClasses(
    packages = "com.company.project",
    importOptions = {
        ImportOption.DoNotIncludeTests.class,
        ImportOption.DoNotIncludeJars.class
    }
)
public class ProjectRulesTest {

    @ArchTest
    static final ArchRule no_legacy_persistence =
        noClasses()
            .that().resideInAPackage("..domain..")
            .should().dependOnClassesThat()
                .resideInPackage("com.company.legacy..");
}
```

**Key Annotations:**
- `@AnalyzeClasses` - Defines which packages to analyze
- `@ArchTest` - Marks a field or method as an architecture test
- `importOptions` - Excludes tests and external libraries from analysis

The rule categories below are written in this plain form: they show what each `DCA-*` rule
checks and how to express a rule of the same kind yourself.

### .NET: ArchUnitNET

The same catalog exists for C# — `DomainCentric.ArchRules` on ArchUnitNET, with the xUnit base
class `DomainCentric.ArchRules.Xunit`. Rule ids are identical to the Java library's, so a team, a
review checklist or a knowledge base can speak of `DCA-TAC-001` in either language.

```
dotnet add package DomainCentric.BuildingBlocks            # production projects
dotnet add package DomainCentric.ArchRules.Xunit           # the architecture test project
```

```csharp
using System.Reflection;
using DomainCentric.ArchRules;
using DomainCentric.ArchRules.Xunit;

public sealed class ArchitectureTest : DcaArchitectureTest
{
    protected override DcaLayout Layout => DcaLayout.ForRootNamespace("Company.Project");

    protected override IEnumerable<Assembly> Assemblies =>
        new[] { typeof(Company.Project.Cart.CartContext).Assembly, typeof(Program).Assembly };
}
```

Every rule runs as its own theory case named by id. The rules work on namespaces, so one project
per bounded context is fine — pass all assemblies. Differences worth knowing:

- **Debug builds only.** `DcaArchitecture.Load` refuses optimized assemblies: the compiler emits async
  state machines as structs there, and ArchUnitNET drops them, which would hide every dependency
  that occurs only inside an `async` method. `dotnet test` builds Debug by default.
- **Context declaration** is a marker class in the context's root namespace carrying
  `[BoundedContext]`, not a `package-info`.
- **Java rules that check only a Spring annotation** are listed as *not applicable*; six `DCA-NET`
  rules exist only for .NET (synchronous domain, `Async` suffix on port methods, one `ExecuteAsync`,
  records for values and ids).
- **No baseline dial** (`frozen`): ArchUnitNET has no `FreezingArchRule`; lower such rules to a warning
  instead. The `dca-archunit.properties` keys are otherwise the same.

---

## Core Rule Categories

Each category below corresponds to one or more rule sets of the library (`layered`/`onion`, `hexagonal`,
`tactical`, `strategic`, `naming`, `cycles`, `contextmap`, …). The code is what the library runs,
written out in plain ArchUnit so you can read what a rule checks — and copy its shape for a rule of
your own.

### 1. Layer Dependency Rules

Enforce that dependencies only point inward toward the domain.

```java
@ArchTest
static final ArchRule domain_should_not_depend_on_outer_layers =
    noClasses()
        .that().resideInAPackage("..domain..")
        .should().dependOnClassesThat()
            .resideInAnyPackage(
                "..application..",
                "..adapter..",
                "..infrastructure.."
            )
        .because("Domain must be independent of outer layers");

@ArchTest
static final ArchRule application_should_not_depend_on_adapters =
    noClasses()
        .that().resideInAPackage("..application..")
        .should().dependOnClassesThat()
            .resideInAnyPackage("..adapter..", "..infrastructure..")
        .because("Application should only depend on domain");

@ArchTest
static final ArchRule adapters_should_not_depend_on_infrastructure =
    noClasses()
        .that().resideInAPackage("..adapter..")
        .should().dependOnClassesThat()
            .resideInPackage("..infrastructure..")
        .because("Adapters should not depend on infrastructure layer");

@ArchTest
static final ArchRule layered_architecture_is_respected =
    layeredArchitecture()
        .consideringAllDependencies()

        .layer("Domain").definedBy("..domain..")
        .layer("Application").definedBy("..application..")
        .layer("Adapter").definedBy("..adapter..")
        .layer("Infrastructure").definedBy("..infrastructure..")

        .whereLayer("Domain").mayNotAccessAnyLayer()
        .whereLayer("Application").mayOnlyAccessLayers("Domain")
        .whereLayer("Adapter").mayOnlyAccessLayers("Application", "Domain")
        .whereLayer("Infrastructure").mayAccessAnyLayer()

        .because("Dependencies must point inward toward domain");
```

### 2. Framework Independence Rules

Ensure domain and application layers remain framework-agnostic.

```java
@ArchTest
static final ArchRule domain_should_be_framework_agnostic =
    noClasses()
        .that().resideInAPackage("..domain..")
        .should().dependOnClassesThat()
            .resideInAnyPackage(
                "org.springframework..",
                "jakarta.persistence..",
                "javax.persistence..",
                "org.hibernate..",
                "jakarta.validation..",
                "javax.validation.."
            )
        .because("Domain must be framework-agnostic");

@ArchTest
static final ArchRule domain_should_not_use_jpa_annotations =
    noFields()
        .that().areDeclaredInClassesThat().resideInAPackage("..domain..")
        .should().beAnnotatedWith("jakarta.persistence.Entity")
        .orShould().beAnnotatedWith("jakarta.persistence.Id")
        .orShould().beAnnotatedWith("jakarta.persistence.Column")
        .orShould().beAnnotatedWith("jakarta.persistence.Table")
        .orShould().beAnnotatedWith("jakarta.persistence.ManyToOne")
        .orShould().beAnnotatedWith("jakarta.persistence.OneToMany")
        .because("Domain should not use JPA annotations - use separate persistence model");

@ArchTest
static final ArchRule application_should_be_framework_agnostic =
    noClasses()
        .that().resideInAPackage("..application..")
        .should().dependOnClassesThat()
            .resideInAnyPackage(
                "org.springframework.web..",
                "jakarta.ws.rs..",
                "org.springframework.data.."
            )
        .because("Application layer should not depend on web or persistence frameworks");

@ArchTest
static final ArchRule application_layer_can_use_minimal_spring =
    classes()
        .that().resideInAPackage("..application..")
        .should().onlyDependOnClassesThat()
            .resideInAnyPackage(
                "..domain..",
                "..application..",
                "..sharedkernel..",
                "java..",
                "org.springframework.stereotype..",  // @Service is acceptable
                "org.springframework.transaction.."   // @Transactional is acceptable (pragmatic)
            )
        .because("Application can use minimal Spring annotations for pragmatism");
```

### 3. DDD Pattern Rules

Validate proper implementation of DDD tactical patterns.

```java
@ArchTest
static final ArchRule aggregates_should_implement_aggregate_root =
    classes()
        .that().haveSimpleNameEndingWith("Aggregate")
        .or().areAnnotatedWith("AggregateRoot")  // If you have custom annotation
        .should().implement(AggregateRoot.class)
        .because("Aggregates must implement AggregateRoot marker interface");

@ArchTest
static final ArchRule value_objects_should_be_immutable =
    classes()
        .that().implement(Value.class)
        .should().haveOnlyFinalFields()
        .andShould().haveOnlyPrivateConstructors()  // Force factory methods
        .because("Value Objects must be immutable");

// The Entity marker already declares id(), so requiring the method checks what the
// compiler enforces. What is worth checking is that the identity is a value object:
// a field whose *type* implements the Id marker. Matching on a field *name* ending in
// "id" accepts valid, paid and uuid, and passes an entity that has no identity at all.
@ArchTest
static void entities_should_have_an_identity_field(JavaClasses classes) {
    var violations = classes.stream()
        .filter(c -> c.isAssignableTo(Entity.class) && !c.isInterface() && !c.getModifiers().contains(ABSTRACT))
        .filter(c -> c.getAllFields().stream().noneMatch(f -> f.getRawType().isAssignableTo(Id.class)))
        .map(JavaClass::getName)
        .toList();

    assertThat(violations)
        .as("Entities must hold their identity as a field typed as an Id value object")
        .isEmpty();
}

@ArchTest
static final ArchRule domain_events_should_be_immutable =
    classes()
        .that().implement(DomainEvent.class)
        .should().haveOnlyFinalFields()
        .because("Domain Events must be immutable (they represent past facts)");

@ArchTest
static final ArchRule domain_services_should_be_stateless =
    classes()
        .that().implement(DomainService.class)
        .should().haveOnlyFinalFields()
        .because("Domain Services should be stateless");

@ArchTest
static final ArchRule aggregates_should_be_in_domain_model =
    classes()
        .that().implement(AggregateRoot.class)
        .should().resideInAPackage("..domain.model..")
        .because("Aggregates belong in domain model package");

@ArchTest
static final ArchRule domain_events_should_be_in_domain_event_package =
    classes()
        .that().implement(DomainEvent.class)
        .should().resideInAPackage("..domain.event..")
        .because("Domain Events belong in domain event package");
```

**Publishing the events is the use case's obligation.** Raising an event and storing the aggregate
are two halves of one operation: an aggregate that is saved while still holding its events loses
them, and — with an identity-mapped or in-memory repository, where the same instance stays around —
they may be published later by an unrelated use case, out of context. Structural rules cannot see
this, but a custom `ArchCondition` can:

```java
ArchCondition<JavaClass> publishAfterSaving =
    new ArchCondition<>("publish the aggregate's domain events after saving it") {
        @Override
        public void check(JavaClass item, ConditionEvents events) {
            boolean saves = item.getMethodCallsFromSelf().stream()
                .anyMatch(call -> call.getTarget().getName().equals("save")
                    && call.getTargetOwner().isAssignableTo(Repository.class));
            if (!saves) {
                return;
            }
            boolean publishes = item.getMethodCallsFromSelf().stream()
                .anyMatch(call -> call.getTarget().getName().equals("publishAndClearEvents")
                    && call.getTargetOwner().isAssignableTo(DomainEventPublisher.class));
            events.add(publishes
                ? SimpleConditionEvent.satisfied(item, item.getSimpleName() + " publishes after saving")
                : SimpleConditionEvent.violated(item,
                    item.getSimpleName() + " saves an aggregate without publishing its domain events"));
        }
    };

@ArchTest
static final ArchRule use_cases_that_save_must_publish =
    classes()
        .that().resideInAPackage("..application..")
        .and().haveSimpleNameEndingWith("UseCase")
        .and().areNotInterfaces()
        .should(publishAfterSaving)
        .because("Unpublished events are lost, and events left on a stored aggregate may surface later out of context");
```

This condition looks at the class as a whole, which is enough to teach the idea. Two things it does
not see: a publication in one method covers a save in an *unrelated* method, and a helper shared by
two entry methods appears to connect them. A production version — the published `DCA-USE-009` rule
does this — follows the calls within the class and judges every *entry path*: each entry point that
reaches a `save` — a method callable from outside the class, or one nothing in the class calls — must
also reach a `publishAndClearEvents`; a public method stays an entry point when a wrapper calls it. Even
then, bytecode does not say in which order the two calls run or that they concern the same aggregate,
and ArchUnit attributes a lambda's body to the enclosing method; those remain review checks.

Note the rule demands the call **unconditionally**, not only where an event is expected: whether an
action raised one is the aggregate's business, and a use case that publishes only "when needed"
breaks silently the day an aggregate starts raising an event it did not raise before.

### 4. Naming Convention Rules

Enforce consistent naming across the codebase.

```java
@ArchTest
static final ArchRule input_ports_should_follow_naming =
    classes()
        .that().resideInAPackage("..application..")
        .and().areInterfaces()
        .and().areAssignableTo(InputPort.class)
        .and().doNotHaveSimpleName("InputPort")
        .and().doNotHaveSimpleName("UseCase")
        .should().haveSimpleNameEndingWith("InputPort")
        .because("Input ports are matched by marker, not by package: DCA places each input port "
               + "in its own use-case folder, so there is no ..application.port.in.. to point at");

@ArchTest
static final ArchRule use_case_implementations_should_follow_naming =
    classes()
        .that().implement(InputPort.class)
        .and().areNotInterfaces()
        .should().haveSimpleNameEndingWith("UseCase")
        .orShould().haveSimpleNameEndingWith("Service")
        .because("Use case implementations should follow naming conventions");

@ArchTest
static final ArchRule repositories_should_follow_naming =
    classes()
        .that().areAssignableTo(Repository.class)
        .and().areInterfaces()
        .should().haveSimpleNameEndingWith("Repository")
        .because("Repository interfaces should end with 'Repository'");

@ArchTest
static final ArchRule repository_adapters_should_follow_naming =
    classes()
        .that().implement(Repository.class)
        .and().areNotInterfaces()
        .should().haveSimpleNameEndingWith("RepositoryAdapter")
        .orShould().haveSimpleNameEndingWith("RepositoryImpl")
        .because("Repository implementations should follow naming conventions");

@ArchTest
static final ArchRule commands_should_follow_naming =
    classes()
        .that().resideInAPackage("..application..")
        .and().areRecords()
        .should().haveSimpleNameEndingWith("Command")
        .orShould().haveSimpleNameEndingWith("Query")
        .because("Input models should be named Command or Query");

@ArchTest
static final ArchRule results_should_follow_naming =
    classes()
        .that().resideInAPackage("..application..")
        .and().areRecords()
        .and().haveSimpleNameMatching(".*Result.*")
        .should().haveSimpleNameEndingWith("Result")
        .because("Output models should end with 'Result'");
```

**What a result may carry (`DCA-USE-015`).** A result is the use case's answer, not a handle on the model:
values, enriched models and read models may cross the boundary, aggregate roots and entities may not. The
check walks the record's components transitively — nested records, part records anywhere in the application
layer (`application/shared` included), and the type arguments of `List<T>`, `Optional<T>` and `Map<K,V>` — because part records are named
by content (`CartItemSummary`), not `*Result`, and would otherwise slip past a name-based selection:

```java
@ArchTest
static void results_should_not_expose_aggregate_roots_or_entities(JavaClasses classes) {
    var violations = classes.stream()
        .filter(c -> c.getSimpleName().endsWith("Result")
                  && c.getPackageName().contains(".application."))
        .flatMap(result -> identityBearingComponents(result).stream()
            .map(path -> result.getSimpleName() + " exposes " + path))
        .toList();

    assertThat(violations)
        .as("A result carries values, never aggregate roots or entities")
        .isEmpty();
}

// walks fields, record components and generic type arguments; recurses into records of the
// same package; reports the path to the first type assignable to AggregateRoot or Entity
private static List<String> identityBearingComponents(JavaClass result) { /* ... */ }
```

### 5. Port and Adapter Rules

Verify proper implementation of hexagonal architecture.

```java
@ArchTest
static final ArchRule input_ports_should_be_interfaces =
    classes()
        .that().haveSimpleNameEndingWith("InputPort")
        .should().beInterfaces()
        .because("Input ports must be interfaces");

@ArchTest
static final ArchRule output_ports_should_be_interfaces =
    classes()
        .that().resideInAPackage("..application.shared..")
        .and().areNotRecords()  // Exclude nested result records
        .should().beInterfaces()
        .because("Output ports live in application.shared and must be interfaces");

@ArchTest
static final ArchRule adapters_should_implement_ports =
    classes()
        .that().resideInAPackage("..adapter.outgoing..")
        .and().areNotInterfaces()
        .should().implement(OutputPort.class)  // If you have OutputPort marker
        .orShould().beAnnotatedWith("Component")
        .orShould().beAnnotatedWith("Repository")
        .because("Outbound adapters should implement output ports");

// A driving adapter drives the application *through its port*. Depending on the
// application package is not enough to express that: the use case class lives there
// too, so the rule below has to name the implementation and forbid it.
@ArchTest
static final ArchRule input_adapters_should_depend_on_input_ports_not_use_case_classes =
    noClasses()
        .that().resideInAPackage("..adapter.incoming..")
        .should().dependOnClassesThat(
            describe(
                "are use case implementations rather than input ports",
                javaClass -> !javaClass.isInterface() && javaClass.isAssignableTo(InputPort.class)))
        .because("Injecting the concrete use case couples the adapter to one realisation, "
            + "defeats the Dependency Inversion Principle the port exists for, and makes the "
            + "adapter untestable without the real use case and everything it depends on");

// An incoming adapter translates external input, calls an input port and formats its
// result. A domain service in its constructor means it derives business facts itself —
// the use case owns that collaboration and puts the outcome into the result. Outgoing
// adapters are deliberately not selected: repositories construct and reconstitute
// domain objects while implementing output ports.
@ArchTest
static final ArchRule incoming_adapters_should_not_depend_on_domain_services =
    noClasses()
        .that().resideInAPackage("..adapter.incoming..")
        .should().dependOnClassesThat().areAssignableTo(DomainService.class)
        .because("Injecting or invoking a domain service bypasses the application boundary; "
            + "the use case owns that collaboration and puts its outcome into the result");

@ArchTest
static final ArchRule adapters_should_not_depend_on_each_other =
    noClasses()
        .that().resideInAPackage("..adapter.incoming..")
        .should().dependOnClassesThat()
            .resideInPackage("..adapter.outgoing..")
        .andShould().dependOnClassesThat()
            .resideInPackage("..adapter.incoming..")
        .because("Adapters should not depend on each other directly");
```

**What a repository may hand back.** The often-quoted form of this rule is "repository methods
return Aggregate Roots". As a positive requirement it is wrong: a repository legitimately returns a
`boolean` from an `existsBy...`, a count, a page wrapper, or a Value Object composed for one use case
— Vernon's *use-case optimal query*. The invariant worth enforcing is the prohibition. A repository
must not hand out an Entity that is **not** an Aggregate Root, because a caller holding one can
mutate part of an aggregate without passing its root, and the root's invariants never run.

```java
@ArchTest
static void repositories_should_not_expose_non_root_entities(JavaClasses classes) {
    var violations = classes.stream()
        .filter(c -> c.isInterface() && c.isAssignableTo(Repository.class))
        .flatMap(repo -> repo.getMethods().stream())
        .flatMap(m -> typesInvolvedIn(m.getReturnType()).stream()
            .filter(t -> t.isAssignableTo(Entity.class) && !t.isAssignableTo(AggregateRoot.class))
            .map(t -> m.getFullName() + " exposes " + t.getName()))
        .toList();

    assertThat(violations).isEmpty();
}

// Recursive, because the forbidden type is almost never the raw return type.
private static List<JavaClass> typesInvolvedIn(JavaType type) {
    var involved = new ArrayList<JavaClass>();
    var erasure = type.toErasure();
    involved.add(erasure);
    erasure.tryGetComponentType().ifPresent(involved::add);
    if (type instanceof JavaParameterizedType p) {
        p.getActualTypeArguments().forEach(arg -> involved.addAll(typesInvolvedIn(arg)));
    } else if (type instanceof JavaWildcardType w) {
        w.getUpperBounds().forEach(bound -> involved.addAll(typesInvolvedIn(bound)));
    }
    return involved;
}
```

The traversal is the whole rule. A tempting shortcut — enumerate `List`, `Set` and `Collection` by
name and call `tryGetComponentType()` on the raw type — inspects nothing at all: that method resolves
**array** component types, so it returns empty for every collection. Add `Optional` to the name list
and `Map<K, List<X>>` still walks through. Walk the type arguments instead and there is no list to
keep current.

Note the type-parameter side needs no rule. `Repository<T extends AggregateRoot<T, ID>, ID extends Id>`
already makes a repository for a non-root entity a compile error.

**Repository vs. Store.** Both are output ports, but they promise different things: a `Repository`
manages an Aggregate Root by identity (`findById`, `save`, `delete`), a `Store` records or queries
operational data that has no aggregate lifecycle (`record`, `count`, `exists`). Without rules the
distinction is doctrine only — a `*Store` can quietly grow a `findById` and nothing fails.

```java
@ArchTest
static final ArchRule stores_should_extend_the_store_marker =
    classes()
        .that().areInterfaces()
        .and().haveSimpleNameEndingWith("Store")
        .and().doNotHaveSimpleName("Store")
        .should().beAssignableTo(Store.class)
        .andShould().notBeAssignableTo(Repository.class)
        .because("Repository is reserved for Aggregate Roots");

@ArchTest
static final ArchRule store_interfaces_should_be_shared_output_ports =
    classes()
        .that().areInterfaces()
        .and().areAssignableTo(Store.class)
        .and().doNotHaveSimpleName("Store")
        .should().resideInAPackage("..application.shared..")
        .because("A Store is an output port — the contract belongs to the application layer");

@ArchTest
static final ArchRule store_implementations_should_be_outgoing_adapters =
    classes()
        .that().areNotInterfaces()
        .and().areAssignableTo(Store.class)
        .should().resideInAPackage("..adapter.outgoing..")
        .because("Store implementations are outgoing adapters");
```

The fourth rule cannot be written as a fluent `ArchRule` — it inspects method names on the matched
interfaces, so it is expressed as a plain assertion:

```java
@ArchTest
static void stores_should_not_have_repository_methods(JavaClasses classes) {
    var violations = classes.stream()
        .filter(c -> c.isInterface()
                  && c.isAssignableTo(Store.class)
                  && !c.getSimpleName().equals("Store"))
        .flatMap(store -> store.getMethods().stream())
        .filter(m -> Set.of("findById", "save", "deleteById", "delete").contains(m.getName()))
        .map(m -> m.getFullName() + " — Repository semantics on a Store")
        .toList();

    assertThat(violations)
        .as("Stores use record/count/exists semantics, not findById/save")
        .isEmpty();
}
```

If a Store legitimately needs `findById`, the stored object has identity — rename the port to
`*Repository` and model the object as an Aggregate Root.

### 6. Shared Kernel Rules

Ensure Shared Kernel remains independent and minimal.

```java
// Contexts are discovered, not enumerated. Discovery needs the imported classes, so the
// rule is a method-style test — a static-field rule is built before any classes exist.
@ArchTest
static void shared_kernel_should_not_depend_on_any_context(JavaClasses classes) {
    noClasses()
        .that().resideInAPackage("..sharedkernel..")
        .should().dependOnClassesThat(
            resideInAnyPackage(boundedContextPatterns(classes))
                .and(not(resideInAPackage("..sharedkernel.."))))
        .because("Shared Kernel must be independent - no dependencies on bounded contexts")
        .check(classes);
}

// Every bounded context marks its root package once:
//
//   @BoundedContext
//   package com.company.project.order;
//
// The helper turns those markers into ArchUnit package patterns. A context added
// tomorrow is discovered on the next run — nothing to register.
private static String[] boundedContextPatterns(JavaClasses classes) {
    return StreamSupport.stream(classes.spliterator(), false)
        .filter(c -> c.getSimpleName().equals("package-info"))
        .filter(c -> c.isAnnotatedWith(BoundedContext.class))
        .map(c -> c.getPackageName() + "..")
        .distinct()
        .sorted()
        .toArray(String[]::new);
}

@ArchTest
static final ArchRule shared_kernel_should_not_use_frameworks =
    noClasses()
        .that().resideInAPackage("..sharedkernel..")
        .should().dependOnClassesThat()
            .resideInAnyPackage(
                "org.springframework..",
                "jakarta..",
                "javax..",
                "org.hibernate.."
            )
        .because("Shared Kernel must be framework-agnostic");

// Discovered, not enumerated: one rule per context, forbidding every other context.
// A context added tomorrow is covered without being registered here.
@ArchTest
static void bounded_contexts_should_not_depend_on_each_other(JavaClasses classes) {
    var contexts = List.of(boundedContextPatterns(classes));   // the helper defined above
    for (String source : contexts) {
        String[] others = contexts.stream().filter(c -> !c.equals(source)).toArray(String[]::new);
        if (others.length == 0) continue;
        noClasses()
            .that().resideInAPackage(source)
            .should().dependOnClassesThat().resideInAnyPackage(others)
            .allowEmptyShould(true)
            .because("Bounded contexts must not have direct dependencies on each other")
            .check(classes);
    }
}
```

**Three traps worth naming, because each produces a rule that can never fail.**

*Enumerating contexts.* `resideInAPackage("..order..")` versus a hand-written list of the other
three works until somebody adds a fifth context — which is then unguarded, silently. Discover the
contexts instead (a marker annotation on `package-info.java` is enough) and generate one rule per
context. The rule set then grows with the codebase.

*Excluding the shared kernel by pattern.* A shared kernel has its own `domain/` package, so
forbidding `..sharedkernel..` from depending on `..domain..` forbids it from using **its own**
`Money` and `ProductId`. The same cuts the other way: every context's domain must be able to reach
`sharedkernel.domain..`, so a per-context isolation rule must not treat the shared kernel as a
foreign context. Discovery solves this for free — the shared kernel carries a different marker than
a bounded context, so it never lands among the forbidden targets and needs no allow-list.

*Selecting by declaration.* If the isolation rule iterates over the *declared* contexts — the
packages that carry the marker — a module that owns `domain/`, `application/` and `adapter/` but
declares nothing is outside the rule twice over: its imports are never checked, and nobody is
forbidden to import its internals. It passes the whole suite for lack of a subject. Select
**structurally** instead: every package that owns a layer is a module, declared or not, and is both
a source and a forbidden target. What the marker decides is membership of the context map, not
whether the module is isolated. The allow-list is a package convention too — a module's `api/`
(synchronous, in-process) and `events/` (asynchronous) packages are the only part of it a neighbour's
adapter may depend on. Package names, not framework annotations, so the rule holds without any
module system on the class path, and a module that deliberately is *not* a bounded context (one that
borrows a foreign system's language, say) needs no declaration to be governed.

*And use `dependOnClassesThat`, never `accessClassesThat`.* ArchUnit counts an access as a method
call or field access. A field, parameter or record component of a forbidden type is a dependency,
not an access, so an isolation rule written with `accessClassesThat` stays green while a class holds
the forbidden type outright.

### 7. Cyclic Dependency Rules

Detect and prevent circular dependencies.

```java
@ArchTest
static final ArchRule no_cycles_in_packages =
    slices()
        .matching("com.company.project.(*)..")
        .should().beFreeOfCycles()
        .because("Cyclic dependencies make code hard to understand and maintain");

@ArchTest
static final ArchRule no_cycles_between_bounded_contexts =
    slices()
        .matching("com.company.project.(*).(*)..")   // every context, not a fixed list
        .should().beFreeOfCycles()
        .because("Bounded contexts should not have cyclic dependencies");

// Inside one context: the packages directly below application/ — the features in a grouped layout
// (application/{feature}/{usecase}), the use cases in a flat one — must not depend on each other in
// a circle. application/shared is the context-wide port package and is not a slice. Catalog: DCA-CYC-005.
@ArchTest
static final ArchRule no_cycles_between_features =
    slices()
        .matching("com.company.project.order.application.(*)..")
        .ignoreDependency(alwaysTrue(), resideInAPackage("..application.shared.."))
        .should().beFreeOfCycles()
        .because("A cycle between two features means the grouping does not carry its weight");
```

A second structural rule keeps the feature level legible: within one module the use-case packages use *one*
depth — all `application.<usecase>` or all `application.<feature>.<usecase>` — never a mixture, and never a
use case directly in `application` or nested deeper than a feature (`DCA-USE-014`). Both rules check package
shape only; they infer nothing about bounded contexts or aggregate ownership.


### 8. Context Map Rules

Context relationships are declared on each context's `package-info.java` (`@Upstream`,
`@ExternalUpstream`, `@Partnership`). Because the declarations are plain annotations, ArchUnit can
check them against the real dependency graph — the context map becomes *executable*.

```java
@Test
void implemented_upstreams_are_backed_by_code() {
    for (var context : boundedContextPackages()) {
        for (Upstream upstream : packageAnnotations(context, Upstream.class)) {
            if (upstream.status() != Upstream.Status.IMPLEMENTED) continue;   // PLANNED is exempt
            String target = contextPackage(upstream.context());
            classes().that().resideInAPackage(context + "..")
                .should().dependOnClassesThat().resideInAPackage(target + "..")
                .because("Context '" + context + "' declares @Upstream(" + upstream.context()
                    + ") as IMPLEMENTED — a declaration without a dependency is stale; mark it PLANNED or remove it")
                .check(classes);
        }
    }
}

@Test
void cross_context_dependencies_require_a_declaration() {
    for (var context : boundedContextPackages()) {
        Set<String> declared = declaredUpstreamsAndPartners(context);
        for (var other : boundedContextPackages()) {
            if (other.equals(context) || declared.contains(other)) continue;
            noClasses().that().resideInAPackage(context + "..")
                .should().dependOnClassesThat().resideInAPackage(other + "..")
                .because("Context '" + context + "' depends on '" + other
                    + "' without declaring it — add @Upstream(context = ..., translation = ..., via = ...)")
                .check(classes);
        }
    }
}

@Test
void conformist_contract_types_never_reach_the_domain() {
    for (var context : boundedContextPackages()) {
        for (Upstream upstream : packageAnnotations(context, Upstream.class)) {
            if (upstream.translation() != Upstream.Translation.CONFORMIST) continue;
            noClasses().that().resideInAPackage(context + ".domain..")
                .should().dependOnClassesThat().resideInAPackage(contextPackage(upstream.context()) + "..")
                .because("Conformism does not suspend domain purity — the domain layer stays free of upstream types")
                .check(classes);
        }
    }
}
```

The full set (13 rules) also verifies that declarations are well-formed (target exists, never self,
unique per channel), that `@Partnership` is symmetric, that Anti-Corruption-Layer contract types stay
inside the translating adapter, and — when Spring Modulith is used — that `@Upstream` declarations and
`allowedDependencies` agree. A companion test renders `docs/context-map.md` (table + Mermaid) from the
same annotations, so the diagram can never contradict the code.

`packageAnnotations()` reads repeatable annotations from the `package-info` class:

```java
static <T extends Annotation> List<T> packageAnnotations(String packageName, Class<T> type) {
    try {
        return List.of(Class.forName(packageName + ".package-info").getAnnotationsByType(type));
    } catch (ClassNotFoundException e) {
        return List.of();
    }
}
```

---

## Complete Test Suites

### Suite 1: Layer Dependency Test

```java
package com.company.project.architecture;

import com.tngtech.archunit.core.importer.ImportOption;
import com.tngtech.archunit.junit.AnalyzeClasses;
import com.tngtech.archunit.junit.ArchTest;
import com.tngtech.archunit.lang.ArchRule;

import static com.tngtech.archunit.library.Architectures.layeredArchitecture;

/**
 * Verifies layer dependency rules for Domain-Centric Architecture.
 */
@AnalyzeClasses(packages = "com.company.project", importOptions = ImportOption.DoNotIncludeTests.class)
public class LayerDependencyTest {

    @ArchTest
    static final ArchRule layered_architecture_is_respected =
        layeredArchitecture()
            .consideringAllDependencies()

            .layer("Domain").definedBy("..domain..")
            .layer("Application").definedBy("..application..")
            .layer("Adapter").definedBy("..adapter..")
            .layer("Infrastructure").definedBy("..infrastructure..")
            .layer("SharedKernel").definedBy("..sharedkernel..")

            .whereLayer("Domain").mayOnlyAccessLayers("SharedKernel")
            .whereLayer("Application").mayOnlyAccessLayers("Domain", "SharedKernel")
            .whereLayer("Adapter").mayOnlyAccessLayers("Application", "Domain", "SharedKernel")
            .whereLayer("Infrastructure").mayAccessAnyLayer()
            .whereLayer("SharedKernel").mayNotAccessAnyLayer()

            .because("Dependencies must follow Domain-Centric Architecture rules");
}
```

### Suite 2: Framework Independence Test

```java
package com.company.project.architecture;

import com.tngtech.archunit.core.importer.ImportOption;
import com.tngtech.archunit.junit.AnalyzeClasses;
import com.tngtech.archunit.junit.ArchTest;
import com.tngtech.archunit.lang.ArchRule;

import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.*;

/**
 * Ensures domain and application remain framework-independent.
 */
@AnalyzeClasses(packages = "com.company.project", importOptions = ImportOption.DoNotIncludeTests.class)
public class FrameworkIndependenceTest {

    @ArchTest
    static final ArchRule domain_is_framework_independent =
        noClasses()
            .that().resideInAPackage("..domain..")
            .should().dependOnClassesThat()
                .resideInAnyPackage(
                    "org.springframework..",
                    "jakarta..",
                    "javax..",
                    "org.hibernate.."
                );

    @ArchTest
    static final ArchRule domain_does_not_use_jpa =
        noMethods()
            .that().areDeclaredInClassesThat().resideInAPackage("..domain..")
            .should().beAnnotatedWith("jakarta.persistence.Entity")
            .orShould().beAnnotatedWith("jakarta.persistence.Id");

    @ArchTest
    static final ArchRule shared_kernel_is_framework_independent =
        noClasses()
            .that().resideInAPackage("..sharedkernel..")
            .should().dependOnClassesThat()
                .resideInAnyPackage("org.springframework..", "jakarta..", "javax..");
}
```

### Suite 3: DDD Pattern Test

```java
package com.company.project.architecture;

import com.company.project.sharedkernel.domain.marker.*;
import com.tngtech.archunit.core.importer.ImportOption;
import com.tngtech.archunit.junit.AnalyzeClasses;
import com.tngtech.archunit.junit.ArchTest;
import com.tngtech.archunit.lang.ArchRule;

import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.*;

/**
 * Verifies DDD tactical patterns are correctly implemented.
 */
@AnalyzeClasses(packages = "com.company.project", importOptions = ImportOption.DoNotIncludeTests.class)
public class DddPatternTest {

    @ArchTest
    static final ArchRule value_objects_are_immutable =
        classes()
            .that().implement(Value.class)
            .should().haveOnlyFinalFields()
            .because("Value Objects must be immutable");

    @ArchTest
    static final ArchRule domain_events_are_immutable =
        classes()
            .that().implement(DomainEvent.class)
            .should().haveOnlyFinalFields()
            .because("Domain Events represent past facts and must be immutable");

    // The Entity marker already declares id(), so requiring the method checks what the
    // compiler enforces. What is worth checking is that the identity is a value object:
    // a field whose *type* implements the Id marker. Matching on a field *name* ending in
    // "id" accepts valid, paid and uuid, and passes an entity that has no identity at all.
    @ArchTest
    static void entities_should_have_an_identity_field(JavaClasses classes) {
        var violations = classes.stream()
            .filter(c -> c.isAssignableTo(Entity.class) && !c.isInterface() && !c.getModifiers().contains(ABSTRACT))
            .filter(c -> c.getAllFields().stream().noneMatch(f -> f.getRawType().isAssignableTo(Id.class)))
            .map(JavaClass::getName)
            .toList();

        assertThat(violations)
            .as("Entities must hold their identity as a field typed as an Id value object")
            .isEmpty();
    }

    @ArchTest
    static final ArchRule aggregates_are_in_domain_model =
        classes()
            .that().implement(AggregateRoot.class)
            .should().resideInAPackage("..domain.model..")
            .because("Aggregates belong in the domain model");
}
```

### Suite 4: Naming Convention Test

```java
package com.company.project.architecture;

import com.tngtech.archunit.core.importer.ImportOption;
import com.tngtech.archunit.junit.AnalyzeClasses;
import com.tngtech.archunit.junit.ArchTest;
import com.tngtech.archunit.lang.ArchRule;

import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.*;

/**
 * Enforces naming conventions across the codebase.
 */
@AnalyzeClasses(packages = "com.company.project", importOptions = ImportOption.DoNotIncludeTests.class)
public class NamingConventionTest {

    @ArchTest
    static final ArchRule input_ports_follow_naming =
        classes()
            .that().areInterfaces()
            .and().resideInAPackage("..application..")
            .and().haveSimpleNameEndingWith("InputPort")
            .should().bePublic()
            .because("Input ports should be public interfaces");

    @ArchTest
    static final ArchRule repositories_follow_naming =
        classes()
            .that().areInterfaces()
            .and().haveSimpleNameEndingWith("Repository")
            .should().resideInAPackage("..application..")
            .because("Repository interfaces belong in application layer");

    @ArchTest
    static final ArchRule use_cases_follow_naming =
        classes()
            .that().areNotInterfaces()
            .and().haveSimpleNameEndingWith("UseCase")
            .should().resideInAPackage("..application..")
            .because("Use cases belong in application layer");
}
```

---

## Context-Specific Rule Sets

Not every bounded context warrants the full rule set. A core context with a rich domain model benefits from all tactical rules; a simple supporting context (lookup data, basic admin CRUD) implemented as transaction script or active record would only fight rules written for aggregates it does not have.

**Approach:** Each context declares its pattern style in an ADR:

- **Domain-model contexts** — full tactical rule set: framework-free domain, aggregate rules, value-object immutability, domain-event immutability, etc.
- **Transaction-script contexts** — structural baseline only: layer dependencies, no package cycles, bounded-context isolation

Scope the tactical rules to the declared domain-model contexts:

```java
// Contexts that committed to a rich domain model (per ADR).
// Transaction-script contexts (e.g., backoffice) are intentionally absent.
private static final String[] DOMAIN_MODEL_CONTEXTS = {
    "..order.domain..",
    "..pricing.domain..",
    "..inventory.domain.."
};

@ArchTest
static final ArchRule value_objects_in_domain_model_contexts_are_immutable =
    classes()
        .that().resideInAnyPackage(DOMAIN_MODEL_CONTEXTS)
        .and().implement(Value.class)
        .should().haveOnlyFinalFields()
        .because("Domain-model contexts committed to immutable Value Objects (see ADR)");
```

The structural baseline (layer dependencies, cycles, context isolation) still applies to **every** context — only the tactical DDD rules are scoped.

---

## Adoption Path (Tiers)

Introduce rules in tiers, ordered by how statically verifiable and how settled each rule is — not all at once.

### Tier 1 — Enforce Immediately

Fully static, high consensus, no project-specific conventions needed:

- Dependencies point inward; domain layer is framework-free
- No package cycles
- Bounded-context isolation (no direct cross-context imports)
- Aggregates reference other aggregates by ID only
- Repository interface/implementation split (interface in application, implementation in adapter)
- Transactions only in the application layer
- No remote-capable output port called inside a `@Transactional` use case (only `Repository`, `Store`, event publishers, `TransactionBoundary`)
- Value-object immutability
- Controllers never reach repositories directly

### Tier 2 — Needs Project Conventions

Verifiable only after the team agrees on marker interfaces/annotations and a package contract:

- DTO boundaries (adapters do not leak domain objects outward)
- Published-language / integration-event rules
- No public setters in domain classes
- No injected repositories or services inside aggregates
- Event shape and publishing rules
- Naming conventions

### Tier 3 — Warning-Level Fitness Functions

Trends to observe, not pass/fail gates — report instead of failing the build (the *severity* dial in
[Tuning the Rule Catalog](#tuning-the-rule-catalog)):

- Component size (classes per context or package)
- Coupling metrics: instability, abstractness, distance from the main sequence (ArchUnit metrics API, `com.tngtech.archunit.library.metrics`)
- Naming heuristics (e.g., flagging `*Manager` or `*Util` classes in the domain)

### Not Statically Testable

Some rules cannot be expressed as static checks at all. They belong in ADRs and review checklists:

- Aggregates designed around true invariants, not data convenience
- One aggregate modified per transaction
- Saga / process-manager design
- Pattern selection per context (domain model vs transaction script) — see [Context-Specific Rule Sets](#context-specific-rule-sets)

---

## Tuning the Rule Catalog

Whether the rules are hand-written or come from a rule library, a team adopting them on an existing
code base needs four dials. Without them the rule set is an all-or-nothing proposition, and a single
rule a team disagrees with is enough to make them abandon the whole thing.

| Dial | What it does | When to use it |
|------|--------------|----------------|
| **Scope** | run only some rule sets or rule ids | staged adoption — start with cycles and layer dependencies |
| **Severity** | report a violation without failing the build | a rule the team has committed to but not yet satisfied |
| **Exceptions** | tolerate individual violations of an otherwise enforced rule | one legacy package, generated code, a documented carve-out |
| **Baseline** | accept today's violations, fail only on new ones | large existing code bases, rule by rule |

Two properties matter more than the mechanism:

1. **A lowered rule stays visible.** Deleting a test for a rule the team decided against loses the
   decision. Reporting the rule as skipped, together with the reason, keeps it in the run and in the
   report where the next reader will find it.
2. **A typo must fail.** Configuration that silently ignores an unknown rule id will eventually leave
   a rule enforced that someone believes is switched off. Identifiers are therefore written in full
   (`DCA-NAM-002`, never the abbreviated `NAM-002`), and an unknown one aborts the run.

The library implements this as `DcaRuleSelection` — overridden in the test class — plus, for teams
that would rather not touch test code, a `dca-archunit.properties` file on the test class path:

```java
class ArchitectureTest extends DcaArchitectureTest {
    @Override
    protected DcaRuleSelection additionalSelection() {
        return DcaRuleSelection.all()
            .onlySets("cycles", "layered", "hexagonal")             // scope
            .excluding("DCA-NAM-002", "no DI framework in this project")   // off, with the reason
            .warning("DCA-TAC-009", "value objects are being made final")  // reported, does not fail
            .ignoringViolationsMatching("DCA-STR-003", ".*legacy.*")       // documented exception
            .frozen("DCA-ONI-002")                                         // baseline
            .withFreezeStore(Path.of("arch/frozen"));
    }
}
```

```properties
dca.rules.sets              = cycles,layered,hexagonal
dca.rules.off               = DCA-NAM-002
dca.rule.DCA-NAM-002.reason = no DI framework in this project
dca.rules.warn              = DCA-TAC-009
dca.rules.warn.sets         = naming
dca.rule.DCA-STR-003.ignore = .*legacy.*
dca.rule.DCA-STR-003.ignore.1 = Generated.{1,3}Client
dca.rules.freeze            = DCA-ONI-002
dca.rules.freeze.store      = arch/frozen
```

Both sources combine: the file is the base, `additionalSelection()` is merged on top, and the later
entry wins per rule id. Override `additionalSelection()`, not `selection()` — the latter *replaces*
the file. A lowered or excluded rule stays in the report, marked with the reason. The .NET library reads
the same file next to the test assembly; it has no `freeze` dial (see [.NET: ArchUnitNET](#net-archunitnet)).

An `ignore` value is one regular expression as written — commas are part of it — and a second
exception for the same rule uses an indexed key (`.ignore.1`, `.ignore.2`, …). Lists of rule ids and
set names are comma-separated.

With hand-written rules the same dials exist in cruder form: scope is which test classes you keep,
severity is a rule you evaluate and log instead of asserting, exceptions are extra `and()` predicates
or ArchUnit's `archunit_ignore_patterns.txt`, and the baseline is `FreezingArchRule` (see
[Freeze Violations for Legacy Code](#4-freeze-violations-for-legacy-code)).

**What none of the dials should be used for:** hiding a rule that is genuinely violated in new code.
Every lowered rule carries a reason, and the reason is the thing worth reviewing.

---

## Best Practices

### 1. Organize Tests by Category

Create separate test classes for different rule categories:
- `LayerDependencyTest` - Layer dependency rules
- `FrameworkIndependenceTest` - Framework usage rules
- `DddPatternTest` - DDD pattern implementation
- `NamingConventionTest` - Naming standards
- `PortAdapterTest` - Hexagonal architecture rules

### 2. Use Descriptive Test Names and Messages

```java
// ❌ Bad - Vague
@ArchTest
static final ArchRule rule1 =
    noClasses().that().resideInAPackage("..domain..").should().dependOnClassesThat()...;

// ✅ Good - Descriptive
@ArchTest
static final ArchRule domain_should_not_depend_on_infrastructure =
    noClasses()
        .that().resideInAPackage("..domain..")
        .should().dependOnClassesThat().resideInPackage("..infrastructure..")
        .because("Domain must remain independent of infrastructure concerns");
```

### 3. Start Simple, Add Rules Incrementally

Don't try to add all rules at once:
1. Start with basic layer dependency rules
2. Add framework independence rules
3. Add DDD pattern rules
4. Add naming convention rules
5. Add custom business-specific rules

### 4. Freeze Violations for Legacy Code

If adding ArchUnit to an existing codebase with violations:

```java
@ArchTest
static final ArchRule domain_is_framework_independent =
    FreezingArchRule.freeze(
        noClasses()
            .that().resideInAPackage("..domain..")
            .should().dependOnClassesThat().resideInAnyPackage("org.springframework..")
    );
```

This allows you to:
- Prevent new violations
- Fix existing violations incrementally
- Track progress over time

Freezing needs a single `ArchRule` to build the baseline from. A check that iterates — one rule per
bounded context, say — has no single rule to freeze; lower it to a warning instead (see
[Tuning the Rule Catalog](#tuning-the-rule-catalog)).

### 5. Exclude Generated Code

```java
@AnalyzeClasses(
    packages = "com.company.project",
    importOptions = {
        ImportOption.DoNotIncludeTests.class,
        ImportOption.DoNotIncludeJars.class
    }
)
```

Or create custom import options:

```java
public class DoNotIncludeGenerated implements ImportOption {
    @Override
    public boolean includes(Location location) {
        return !location.contains("/generated/");
    }
}
```

---

## CI/CD Integration

### Maven Integration

ArchUnit tests run automatically with:
```bash
mvn clean verify
```

### Gradle Integration

```bash
./gradlew test
```

### GitHub Actions Example

```yaml
name: Architecture Tests

on: [push, pull_request]

jobs:
  architecture-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Set up JDK 17
        uses: actions/setup-java@v3
        with:
          java-version: '17'
          distribution: 'temurin'
      - name: Run Architecture Tests
        run: mvn test -Dtest=*ArchitectureTest
```

### GitLab CI Example

```yaml
architecture-tests:
  stage: test
  script:
    - mvn test -Dtest=*ArchitectureTest
  only:
    - merge_requests
    - main
```

---

## Common Pitfalls and Solutions

### Pitfall 1: Tests Failing for Test Code

**Problem:** ArchUnit analyzes test code and finds violations

**Solution:** Exclude tests from analysis
```java
@AnalyzeClasses(
    packages = "com.company.project",
    importOptions = ImportOption.DoNotIncludeTests.class
)
```

### Pitfall 2: Too Many Rules at Once

**Problem:** Adding all rules to legacy codebase causes hundreds of failures

**Solution:** Use `FreezingArchRule` or add rules incrementally
```java
@ArchTest
static final ArchRule frozen_rule =
    FreezingArchRule.freeze(your_rule_here);
```

### Pitfall 3: False Positives from Generated Code

**Problem:** Generated classes (e.g., from Lombok, MapStruct) violate rules

**Solution:** Create custom import option to exclude generated code
```java
public class ExcludeGenerated implements ImportOption {
    @Override
    public boolean includes(Location location) {
        return !location.contains("/generated/") &&
               !location.contains("/lombok/");
    }
}
```

### Pitfall 4: Package Patterns Not Matching

**Problem:** Rule doesn't catch violations due to incorrect package pattern

**Solution:** Use `..` for any number of subpackages
```java
// ❌ Wrong - matches only direct children
"com.company.project.domain"

// ✅ Right - matches any depth
"..domain.."
```

### Pitfall 5: Slow Test Execution

**Problem:** ArchUnit tests take too long to run

**Solution:**
- Cache imported classes
- Split into multiple test classes
- Run architecture tests separately in CI pipeline

---

## Additional Resources

- **ArchUnit User Guide:** https://www.archunit.org/userguide/html/000_Index.html
- **ArchUnit Examples:** https://github.com/TNG/ArchUnit-Examples
- **Domain-Centric Architecture:** [./README.md](./README.md)
- **Architecture Reference Guide:** [./architecture-reference-guide.md](./architecture-reference-guide.md)

---

**Next Steps:**
1. Add ArchUnit dependency to your project
2. Create basic `ArchitectureTest` class
3. Start with layer dependency rules
4. Run tests and fix violations
5. Add more rules incrementally
6. Integrate into CI/CD pipeline

**Remember:** ArchUnit is a tool to help enforce architectural decisions. The rules should reflect your team's agreed-upon architecture, not arbitrary constraints.
