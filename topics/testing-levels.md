# Test Levels in Domain-Centric Architecture

This document defines the three test levels a story's scenarios are tested at, which scenario goes to which
level, and the three kinds of end-to-end test that are easy to mix up.

---

## Table of Contents

- [The three levels](#the-three-levels)
- [The happy path end to end, the rest integrated](#the-happy-path-end-to-end-the-rest-integrated)
- [Integrated, not integrated against another system](#integrated-not-integrated-against-another-system)
- [Smoke test, happy-path test, journey test](#smoke-test-happy-path-test-journey-test)
- [Test shapes](#test-shapes)
- [Related Documentation](#related-documentation)

---

## The three levels

| Level | What it runs | What it proves |
|---|---|---|
| **unit** | one aggregate, value object or domain service, no framework | an invariant the domain must never break |
| **integration** | a use case through the wired application — its input port or its HTTP surface — with real adapters and persistence as the project runs it in tests; an external system stubbed at the protocol | a scenario's `Then` as the user states it, and every adapter the use case passes through |
| **e2e** | the running application through its page, in a browser | that the page is wired to the use case, and what only a browser can observe |

**Rule: a scenario is tested at the lowest level that observes its `Then` from outside.**

The layering makes the integration level strong. The domain is free of framework types, adapters translate at
the edge, a use case sits behind an input port. A scenario whose `Then` is a business outcome or a response is
fully observable below the page, through the same adapters a browser test would pass. What is left to a browser
is what the page does after it has loaded: a countdown, a script's reaction to a click, a notification.

**Rule: the end-to-end suite starts the application itself, on a free port.** A suite that drives an
application someone started beforehand tests whatever happens to answer on that address: another service on
the port turns every test red, a missing one skips them all, and neither says anything about the page. A suite
that starts its own application brings what it needs — an external system as a stub it starts first, the
database the application's tests already use — and runs the same on a laptop, in CI and in a pipeline's gate.
The same tests may still be pointed at a deployment by naming its address; that is a check of the deployment,
not the suite's normal run.

## The happy path end to end, the rest integrated

**Rule: one scenario per story is the happy path. It gets the e2e test; every other scenario is integrated.**

The happy path is the scenario that shows what the story is for, as its author would demonstrate it. It is
marked where the story is written (`#### <key> (happy path)`), not picked later by whoever plans the tests: the
person who knows what the story is for is there when it is written, and two plans cannot pick differently.

One e2e test per story covers the page's wiring once. A browser test per scenario tests the same wiring again,
runs slower and fails for reasons that have nothing to do with the scenario. In a delivery pipeline the cost is
higher still: every mapped test runs several times — red before the build, green after it, once more before
the commit — and a flaky test makes the gate itself non-deterministic.

A scenario whose `Then` only a browser can observe is the exception, and the plan says why
(`browser-only: <why>`). A pipeline gate can check the rule: an end-user test for any other scenario is
refused.

An adapter's translation in all its cases — a refusal from the provider, a timeout, a malformed body — is
reached by the integration tests of the scenarios that name those cases. A case the adapter handles and no
scenario names is not a criterion; it gets an integration test of its own, beside the unit tests for the
invariants.

## Integrated, not integrated against another system

**Rule: an external system is stubbed at the protocol, never mocked at the port and never called for real.**

An integration test of an outgoing adapter runs the adapter against a real HTTP server on a free port that
answers what the test arranges (WireMock in Java, WireMock.Net in .NET). The adapter builds its request and
reads the status and body exactly as it does in production, so the test proves the translation.

Two alternatives look similar and prove less:

- **A mock of the port** replaces the adapter itself. The test then covers everything except the one thing the
  change is about — the translation. When a story changes an adapter, mocking its port is a defect in the test.
- **A shared or real instance** of the other system makes the test pass or fail on that system's state and
  availability. Spotify calls this an *integrated test*: "a test that will pass or fail based on the correctness
  of another system". It belongs in a staging check, not in the suite a change must pass.

## Smoke test, happy-path test, journey test

All three drive the running application end to end. They answer different questions and belong to different
places.

| | Smoke test | Happy-path e2e test | Journey test |
|---|---|---|---|
| question | does the system run at all? | does this story do what it promises? | does the critical flow still work? |
| scope | broad and shallow: the application starts, a page or endpoint answers | one flow, the story's own surface | one flow across stories and contexts, to the epic's outcome |
| assertions | barely more than "no error, page there" | the scenario's `Then` | the business outcome — the epic's outcome event |
| belongs to | the setup of the project and of each test runner | a story, as a criterion | an epic, as a guard |
| proof that it works | broken once on purpose at setup | red before the build | none — when it can be written, every step exists |
| runs | after the setup, and whenever the runner changes | with the story's tests | in CI |

**A journey is defined by an epic, not by the product description.** An epic states an intent and names its
outcome event — the fact at the end of the flow. Its journey is that flow, walked end to end until the outcome
event is published, and it can only be written once the stories that build its steps are delivered. Before the
first line of code nobody can say which flow that will be; an epic without a journey has decided against one.

A journey test is a regression guard. It is green when it is written, which a criterion may never be, so it is
not a story's criterion but an item of its own that depends on the stories it walks. A journey run against a
deployed environment with synthetic data works as a post-deploy check; that is operations, not development.

## Test shapes

The pyramid (Cohn, Fowler) asks for many unit tests and few UI tests; the trophy (Kent C. Dodds) for mostly
integration tests; the honeycomb (Spotify) for integration tests at the service boundary and no integrated
tests against other systems. Martin Fowler points out that much of the debate is vocabulary: what one team
calls a sociable unit test, another calls an integration test. The levels above use the words in the sense of
the table at the top.

A recent position starts with end-to-end tests, because agents make them cheap to write. That is an argument
about writing tests. In a pipeline that runs every test several times per story, the cost is in running them,
and the part that carries over is "cover the critical path end to end" — the happy path per story, the journey
per epic.

## Related Documentation

- [E2E Testing](e2e-testing.md) — the craft of the browser test itself: data-test attributes, Page Objects
- [ArchUnit Governance](archunit-governance.md) — the architecture tests, a level of their own beside these three
