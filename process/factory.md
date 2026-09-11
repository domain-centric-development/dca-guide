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
- [Building one: what actually holds](#building-one-what-actually-holds)
- [Starting where you are](#starting-where-you-are)

## The backlog contract

The backlog is markdown with front matter, one file per item, readable and reviewable without any
tooling — no database, and no JSON as the source of truth.

```text
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

```text
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

**Neither an exit code nor a message says that a test ran.** An exit code says how a process
ended; a runner that never found the test can exit exactly like one whose test failed, and a
crashed test host does too. Output is no better: a runner that prints "no tests found for
<selector>" says something different for every selector while executing nothing. The only artefact
that states what was *executed* is the runner's report — and every ecosystem can write one in a
format two parsers cover, so requiring it costs a project a flag, not a rewrite. Where a stack
genuinely has none, weaken the check explicitly and print that weakening next to every verdict it
produces; a silent weakening is the same as none.

**A report is evidence only if it is *this* run's and *this* test's.** Two ways to be wrong about
a report, and both look like a pass. A file left by an earlier run still lies where the reader
looks, so a runner that finds nothing now inherits yesterday's verdict — which means a report
counts only where its content changed or its timestamp is younger than the invocation, read against
the filesystem's own clock rather than the process's. And a report that names a *sibling* of the
mapped test says nothing about it: where a runner reports display names instead of method names,
the mapping has to come from the declaration in the code, never from membership of the same class.
Not even a single reported case settles it — a filtered run is no promise that the filter was
honoured, so that one case may be the sibling, and attributing it would let one test's outcome
decide another's criterion. Either a name matches, or there is no evidence.

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

## Building one: what actually holds

Everything above is the shape. This is why it is that shape — each rule with the failure it
prevents, because a rule without its failure gets dropped the first time it is inconvenient.

### Evidence, never assertion

**An agent's report about its own work is not evidence.** It is the one sentence the whole
construction rests on. Every claim that decides whether a story is done must be checkable by
something that does not want the answer to be yes: a script, a build, a file on disk.

**A stage is finished when its file exists** — not when a delegation reports success. A mechanism
that says "done" and produced nothing has to be indistinguishable from one that stalled, or the
run waits for something that will never arrive. Check for the artefact; where it is missing, do
the stage differently and say that you did.

**A missing test looks exactly like a red test at the runner.** Both come back as failure. So
before "the test is red" means anything, the test has to be *found in the sources*. Without that
step, an empty test table and a correct one produce the same green run.

**A run that matched no test at all is not a verdict.** It exits successfully on some runners and
unsuccessfully on others — so one stack reads it as a passing test and another as a failing one,
and both are wrong. Therefore: pick the command from *where the test actually lives*, declare one
command per test source set, and treat "no declared command covers this test" as a configuration
error rather than a result.

**A test that was never red proves nothing.** Green after the code exists is only evidence if the
same test failed before it. Record which tests were seen failing, and require that record before
accepting green — otherwise a criterion with a mistyped, misplaced or trivially-true test is
certified as met.

**A stub must refuse to answer.** It throws; it never returns a value, not even an empty list. For
a criterion whose expected answer *is* the empty case, a stub returning empty makes the test green
before any code exists — and that test will never fail again.

**A report names what happened, not what the script can do.** A run that lists six stages after
one of them ran is the same self-assessment as an agent grading itself, in a place nobody thinks
to distrust.

### State lives in files

**Anything the run needs to remember is a file.** The round counter, the record of which tests
were red, which stage is next, what the reviewer decided. An orchestrator that remembers cannot be
resumed, cannot be handed to another tool, and cannot be checked afterwards — and its memory is the
one part of the run nobody can audit.

**A repeat round must be able to read why the last one was refused.** Hand the refusal on as a
file the stage is told to read. A stage that repeats blind reproduces exactly what was rejected,
and the loop burns rounds on it.

**An answer that exists only in a reply is lost.** A scoping decision, an assumption the domain
expert settled, a reason for a deviation: if it is not written where the next run will look, the
same question comes back in a month with a different answer.

### One source, or two truths

**Never copy what you can point at.** A copied skill folder, a vendored knowledge catalog, a
duplicated template: each is a second truth that drifts silently, and the drift is invisible
precisely because both copies look right. Point at the source; where a copy is unavoidable, make
its staleness visible and say when it needs renewing.

**A copy that must exist gets a freshness statement, not trust.** Naming a knowledge source means
vouching that it is current — a citation from a stale catalog makes a wrong rule id look verified.
Whoever reads it cannot tell; whoever wrote it must.

**Instructions have a size budget.** Tools stop reading project documents at a limit and truncate
without a word, so an instruction past that point does not exist for them while its author
believes it is in force. Keep the always-loaded file short and put the detail in documents it
points at.

### Where a run must stop

**Three verdicts, not two.** Pass and "fix this" are not enough: the third case is that the *story*
is wrong. That one must never go back to the builder, because a correction that silently changes an
agreed criterion replaces the contract with an opinion.

**A plan may not invent a way in for its actor.** If the criteria can only be observed through a
page, an endpoint or a consumer the system does not have, adding one is a product decision — and
where that surface needs a guard, an authorisation decision too. Both belong to a human. A guard
that arrives as a side effect of a story is a guard nobody reviewed and no test holds.

**A new boundary is not a story.** A new bounded context, or a new relationship between contexts,
is a decision about language and ownership. Recorded, then reflected on the map; never smuggled in
by the first story that needs it.

**The enforcement boundary is the commit.** Tool configurations do not travel between tools, and
whoever changes tools loses them silently. The commit is the one gate everybody passes through, so
the project's own compile, test, architecture and format commands belong there — narrow enough that
nobody has a reason to bypass it, because a bypassed check guards nothing.

### Configuration, not knowledge

**A command the project has not declared is skipped and named, never failed.** A gate that fails on
something nobody configured gets switched off within a week, and then there is no governance at
all. Skipping loudly keeps the gate installed and the gap visible.

**The process knows no project.** Build commands, test source sets, runners, formatters, the
reviewer for a perspective: all of it is the project's, in one file the project owns. A stage that
would break in a system without your domain in it is not a stage, it is a local habit.

**Model and effort are the tool's business, and a broken default must not stop the run.** Keep them
out of the process, and let the environment supply them — otherwise the pipeline is unusable
wherever a default provider happens to be unavailable.

### Doctrine has to decide

**Where guidance can be read two ways, two builders produce two designs.** Two teams given the same
story, the same conventions and the same reference produced a repository finder and a composable
rule object — both defensible, because the decision guide let two of its own criteria fire at once
and never said which wins. The fix is not in either code base: it is in the sentence that failed to
decide.

**Fix a divergence at its source, or it returns.** Reconciling the two code bases leaves the
ambiguity in place for the next pair. Sharpen the rule, the guidance or the checkable constraint —
and record which one you sharpened.

**Reviewing follows use, not stock.** A body of guidance is too large to review as a whole and most
of it is never load-bearing. What a delivery run actually cites is the list worth reading; a
proposal that decided a design question is the finding, and the rest can wait.

### Verifying the machinery itself

**The checker needs a checker.** The gate is the argument for everything else, so it earns tests of
its own: fixtures where every check must refuse what it should refuse. Defects found by running
real stories cost an hour apiece; the same defects fail a fixture in milliseconds.

**A regression test that does not fail on the bug is decoration.** Put the defect back, watch the
test go red, then remove it again. A test written from the fix rather than from the failure usually
asserts the wrong thing.

**Make the orchestration testable without a model.** Give the tool invocation a seam that a test can
replace, or the loop — the part where a skipped stage or a false success hides — can only be
exercised by burning real runs.

**A verification names its own blind spots.** What it could not observe is not what it found to be
fine. A report that hides the difference invites exactly the trust it has not earned.

## Starting where you are

**Empty means green.** In a project with no backlog, no glossary and no context map, nothing above
fails on absence: each stage says which file to create, and the gate reports what it skipped and
why. The first story is written, and the process works from there.

**Brownfield stays brownfield.** The contract applies to *new* items. An existing backlog is not
migrated wholesale and existing tests are not renamed: rewriting finished work would invent intents,
goals and outcome events nobody ever stated, and every one of those epics would then fail the gate
for good reason. The gate only ever looks at the story it is called with.
