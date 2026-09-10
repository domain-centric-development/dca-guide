# Delivering a story: backlog, stages, gates

Domain-Centric Architecture says how an application is shaped. This document says how one piece of
behaviour gets built in it when an AI agent does most of the typing — and how anyone can tell,
afterwards, whether it was really built.

The rule the whole process rests on: **what enforces the process must not live in the tool.** An
agent that judges its own work reports success; a check that lives in one editor's configuration
does not exist for the next person. So the process is carried by two things only — files in the
repository, and commands the build can run. Which agent, editor or model executes it is then a
detail that may change without the process changing.

## Table of Contents

- [The backlog contract](#the-backlog-contract)
- [Outcome events](#outcome-events)
- [The stages and their hand-over files](#the-stages-and-their-hand-over-files)
- [Gates](#gates)
- [What the project declares](#what-the-project-declares)
- [Escalation: the three answers a run may not give itself](#escalation-the-three-answers-a-run-may-not-give-itself)
- [Starting where you are](#starting-where-you-are)

## The backlog contract

The backlog is markdown with front matter, one file per item, readable and reviewable without any
tooling — no database, and no JSON as the source of truth.

```
backlog/
  <epic>/
    epic.md          the epic
    <story>.md       one story
```

An **epic** carries four mandatory fields, and a story whose epic is missing one of them is
refused before any planning starts:

| Field | Meaning |
|---|---|
| `intent` | why the epic exists — the problem, not the solution |
| `goal` | what changes for the user when it is delivered |
| `metric` | the **outcome event** that measures it (see below) |
| `domain_contact` | who answers domain questions for this epic |

This is not bureaucracy. A stage that cannot read the intent invents one, and an invented intent is
indistinguishable from a stated one once it is in the code.

A **story** names the bounded context it changes — a context the project's context map already
carries — and states its acceptance criteria as observable end-user behaviour, one per line with a
**key**:

```markdown
## Acceptance criteria

- shows-empty-state: A reader who has recorded nothing sees an invitation to start, not an error.
- lists-newest-first: The entries appear with the most recent first.

## Assumptions

- open: Does an archived entry still count towards the list?
```

The key is lowercase, hyphenated and names the behaviour. It is committed: the test stage records it
next to the test that proves it, and the gate joins the two on it. A running number would point at
nothing the moment the list is reordered.

`## Assumptions` is the asynchronous channel to the domain contact — one line per assumption, `open:`
or `answered:`. An assumption is a question, never a decision the team took itself. A story whose
criterion silently answers one of its own open assumptions is not ready; that contradiction is worth
finding before the code exists, not after.

A `status` field (`draft` / `approved` / `superseded`) carries the one thing no script can check: a
human released this story for building. The most expensive mistake is well-built wrong code.

## Outcome events

An epic's `metric` is a **domain or integration event whose publication in production is the
evidence that the epic delivered**. Not a story count, not a burndown, not "feature shipped".

The reason is that a story can be complete and an epic still worthless. Every criterion may be met,
every test green, the documentation current — and nobody uses the thing, so the problem in the
epic's `intent` is untouched. A story count measures the team's motion; an outcome event measures
the change in the system's behaviour that the epic existed for.

Because DCA applications already publish domain events for the facts that matter, the metric is
usually a name that exists:

```
metric: OrderPlaced          # the epic's point was that orders can be placed at all
metric: CartRecovered        # the epic's point was that abandoned carts come back
metric: StockChanged         # the epic's point was that an operator reacts before stock runs out
```

Where the event does not exist yet, that is a finding rather than a problem: the event is part of
the work, and naming it in the epic is what makes the epic measurable. Where an application keeps an
event publication log — a record of the events it published, which the event-driven patterns in this
guide produce anyway — that log is the measuring point, and no separate analytics apparatus is
needed to answer whether an epic delivered.

Two failure modes to avoid. An event named after the *implementation* ("row inserted", "endpoint
called") measures that code ran, not that anything happened for anyone. And an event that fires on
the way in ("checkout started") measures intent, not outcome; the outcome is the fact at the end of
the flow.

## The stages and their hand-over files

One story runs through six stages. Every stage is a **closed assignment**: it reads the story and
its predecessor's file, and it writes exactly one file of its own. No stage relies on a
conversation, so a stage can run in a fresh context, in a separate process, or on another day
without changing the result.

| Stage | Reads | Writes |
|---|---|---|
| plan | the story, the glossary and context map if present | `tasks/<story>/plan.md` |
| test | the story, `plan.md` | `tasks/<story>/tests.md` — with the criterion-to-test table |
| build | the story, `plan.md`, `tests.md` | `tasks/<story>/build.md` |
| tidy | the story, `plan.md`, `build.md`, the green code | `tasks/<story>/tidy.md` |
| judge | the story, all predecessors, the diff | `tasks/<story>/judge.md` — with a verdict |
| document | the story, all predecessors, the project's documents | `tasks/<story>/document.md` |

The **plan** names the elements that change — aggregates, value objects, use cases with their ports,
adapters — in the project's own vocabulary, and picks the shape of the end-user test per criterion
from what the project can run *today*. It backs every statement about the code with a file and a
line. It writes no code.

The **test** stage writes one end-user test per acceptance criterion, plus unit tests for the
invariants the story introduces, and records the mapping:

```markdown
| criterion | test |
| --- | --- |
| shows-empty-state | com.example.reporting.MonthlyReportPageTest#showsEmptyState |
```

It adds only the stubs the test sources need to compile, and a stub **refuses to answer** — it
throws rather than returning a value, even an empty one. A stub that returns the answer a criterion
expects makes the test green before any code exists, and a green test at this point proves nothing.

The **build** stage makes those tests pass with the smallest change that works, following the plan's
change list. An element the plan did not name is a sign the plan was wrong: it is noted, not quietly
added. It never changes a test to make it pass.

The **tidy** stage is the refactor half of red–green–refactor, which the build stage deliberately
leaves undone. It works only inside the story's footprint, changes no test and changes no behaviour.
A tidy stage that changes nothing and says why is finished, not skipped.

The **judge** stage reviews the change from three perspectives that always run — the model, the
boundaries, the craft — with a file and a line behind every finding, and returns one of three
verdicts (below). A project may add further perspectives; it cannot switch the three off, because a
review without the boundaries is not a review of a domain-centric architecture.

The **document** stage brings the glossary, the context map and the project's reader documentation
in line with what the story changed, and it carries the same duty of proof as the code: every path,
file, class and command it names must exist, checked rather than remembered, and written as it
resolves from the project root.

## Gates

Between the stages runs a **gate**: a deterministic check, callable from the command line and from
CI, that verifies what a stage may not decide for itself. It is not a review and it has no opinion;
it either finds the evidence or it does not.

| Before | The gate checks |
|---|---|
| plan | the epic is complete; the story is well-formed, released, and its context is on the map |
| after test | every criterion is mapped to a test; the test exists in the sources; the test sources compile; **every mapped test is red** |
| after build | every mapped test is green **and was recorded red by the test stage**; the architecture suite passes; the formatter passes |
| after tidy | the same checks again — the stage's whole claim is that nothing changed |
| after document | every path and identifier the stage claims exists; every glossary row says how it was checked |

Three details in there are worth more than they look.

**A missing test looks exactly like a red one at the runner.** So the gate first finds the test in
the sources; without that, "red before the build" certifies nothing.

**A run that matched no test at all exits successfully on some runners and unsuccessfully on
others.** Neither outcome is evidence. So a mapped test is run with the command that covers the
source set the test actually lives in, and a test in a source set no command covers is a
configuration error rather than a verdict.

**A test that was never red proves nothing.** The test stage records which selectors it saw fail;
the build gate accepts a green test only if it is in that record. This is what closes the gap
between "the criterion is met" and "something green exists".

A command the project has not declared is **skipped and named**, never failed. A gate that fails on
something nobody configured gets switched off, and then there is no governance at all.

The same commands belong on the **commit** as well. Tool configurations do not travel between
editors, but every tool commits through version control, so a pre-commit check that runs the
project's own compile, test, architecture and format commands is the boundary that holds for
everyone. Keep it to what a developer will wait for; a check that takes minutes gets bypassed, and
then it guards nothing.

## What the project declares

Nothing above knows how your project builds. That knowledge lives in one file the project owns —
build and test commands, one entry per test source set, the architecture suite, the formatter — plus
the backlog, the glossary and the context map it keeps anyway. A stage asks the project; it never
assumes a build tool, a test framework or a directory layout.

Two consequences. Adding a capability (a formatter, a second test source set, another review
perspective) is a line in that file, not an edit to a stage. And a stage that would break in a
project without your domain in it is wrong: the process is general, the project's knowledge is the
project's.

## Escalation: the three answers a run may not give itself

The judge returns exactly one of three verdicts, and the third is the reason this list exists:

- **pass** — the criteria are met and no confirmed defect blocks them.
- **changes-requested** — confirmed defects go back to the build stage with their evidence. Count
  the rounds and stop at three: a loop that will not converge needs a human, not a fourth attempt.
- **story-conflict** — the story or the plan is wrong. This never goes back to the build stage. A
  correction that changes an agreed criterion must not happen silently; the story is the contract,
  and a human decides it.

Two more questions belong to a human by construction, and a run that meets one of them stops and
says so instead of answering it:

- **A new bounded context, or a new relationship between contexts.** That is a decision about
  language boundaries and ownership, recorded as a decision and reflected on the context map — never
  smuggled in by a story.
- **A surface the story's actor does not have.** If the criteria can only be observed through a page
  or an endpoint the context does not offer, adding one is a product decision, and where the surface
  needs a guard it is an authorisation decision as well. A guard nobody decided is a guard no test
  holds.

## Starting where you are

**Empty means green.** In a project with no backlog, no glossary and no context map, nothing above
fails on absence: each stage says which file to create, and the gate reports what it skipped and
why. The first story is written, and the process works from there.

**Brownfield stays brownfield.** The contract applies to *new* items. An existing backlog is not
migrated wholesale and existing tests are not renamed: rewriting finished work would invent intents,
goals and outcome events nobody ever stated, and every one of those epics would then fail the gate
for good reason. The gate only ever looks at the story it is called with.
