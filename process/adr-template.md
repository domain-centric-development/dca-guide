# ADR-NNN: [Short Title of Decision]

**Date:** YYYY-MM-DD
**Status:** [Proposed | Accepted | Deprecated | Superseded by ADR-XXX]
**Decision Makers:** [Names or team]
**Technical Story:** [Ticket/Issue ID if applicable]

---

## Context

Describe the context and background of the decision:
- What is the problem or situation that requires a decision?
- What are the forces at play (technical, business, organizational)?
- What constraints exist (time, resources, technology)?
- What is the current state that led to this decision?

**Example:**
> We need to decide how to organize use cases in the application layer. The current flat structure is becoming difficult to navigate as the number of use cases grows. We have 15+ use cases in a single package, and developers are finding it hard to locate related files (command, response, port interface, and implementation).

---

## Decision

State the decision clearly and concisely:
- What have you decided to do?
- What is the chosen solution?
- Be specific and unambiguous

**Example:**
> We will organize each use case in its own dedicated folder within the application layer, grouping all related files (InputPort interface, UseCase implementation, Command/Query, and Result) together.
>
> **Structure:**
> ```
> application/
> ├── createorder/
> │   ├── CreateOrderInputPort.java
> │   ├── CreateOrderUseCase.java
> │   ├── CreateOrderCommand.java
> │   └── CreateOrderResult.java
> └── shared/
>     └── OrderRepository.java
> ```

---

## Rationale

Explain why this decision was made:
- Why is this the best choice given the context?
- What makes this solution appropriate?
- How does it address the problem stated in the Context?
- What were the key factors in the decision?

**Example:**
> This structure provides:
> 1. **Better Organization:** All files related to a use case are co-located, making it easier to find and modify them together
> 2. **Single Responsibility:** Each folder represents one business operation
> 3. **Scalability:** As the application grows, the structure remains organized and navigable
> 4. **Reduced Cognitive Load:** Developers can focus on one use case at a time without being distracted by unrelated files
> 5. **Team Collaboration:** Multiple developers can work on different use cases with minimal merge conflicts

---

## Consequences

Document the consequences of this decision:

### Positive Consequences (Benefits)
- What improvements will result from this decision?
- What problems does it solve?
- What new capabilities does it enable?

**Example:**
- ✅ Improved code organization and discoverability
- ✅ Easier onboarding for new team members
- ✅ Better alignment with Single Responsibility Principle
- ✅ Clearer structure for growing codebases
- ✅ Reduced merge conflicts when multiple developers work on different use cases

### Negative Consequences (Tradeoffs/Costs)
- What are the downsides or costs of this decision?
- What complexity does it introduce?
- What technical debt might it create?
- What alternatives were rejected and why?

**Example:**
- ⚠️ More folders and deeper nesting compared to flat structure
- ⚠️ Requires refactoring effort to migrate existing code
- ⚠️ IDE navigation may require more clicks to reach files
- ⚠️ New developers need to learn this pattern (though it's straightforward)

### Risks
- What could go wrong?
- What assumptions are we making?
- What dependencies does this create?

**Example:**
- 📌 Risk: Team might create too many small use cases, leading to over-fragmentation
  - **Mitigation:** Establish guidelines for when to combine vs. split use cases
- 📌 Risk: Inconsistent naming conventions across use case folders
  - **Mitigation:** Document naming standards and enforce via code review

---

## Alternatives Considered

List and briefly describe alternatives that were considered but not chosen:

### Alternative 1: [Name]
**Description:** Brief explanation of the alternative

**Pros:**
- Advantage 1
- Advantage 2

**Cons:**
- Disadvantage 1
- Disadvantage 2

**Why Rejected:** Reason for not choosing this option

**Example:**
### Alternative 1: Keep Flat Structure with Naming Prefixes
**Description:** Continue with all use case files in a single `application/` directory, but use consistent naming prefixes (e.g., `CreateOrder_*`, `FindOrder_*`)

**Pros:**
- No refactoring needed
- Simpler folder structure

**Cons:**
- Doesn't solve the core problem of too many files in one place
- Relies on naming conventions which can be inconsistently applied
- Still difficult to navigate as codebase grows

**Why Rejected:** Doesn't address the root cause of the navigation problem

---

### Alternative 2: [Name]
**Description:** Brief explanation

**Pros:**
- Advantage 1

**Cons:**
- Disadvantage 1

**Why Rejected:** Reason

---

## Related Decisions

Document relationships to other ADRs:
- **Supersedes:** ADR-XXX (if this replaces a previous decision)
- **Superseded by:** ADR-XXX (if this has been replaced)
- **Related to:** ADR-XXX, ADR-YYY (connected decisions)
- **Depends on:** ADR-XXX (prerequisite decisions)

**Example:**
- **Related to:** ADR-012 (Payment Retry Policy) - This decision builds on the retry window it defines
- **Depends on:** ADR-002 (Payment Provider Abstraction) - Retries must go through the provider port

---

## Implementation Notes

Optional section for implementation guidance:
- What needs to be done to implement this decision?
- Are there specific steps or milestones?
- What documentation needs updating?
- What team communication is needed?

**Example:**
1. Create new use case folder structure for all new use cases immediately
2. Migrate existing use cases incrementally during feature work (no big-bang refactoring)
3. Update architecture documentation to reflect new structure
4. Add ArchUnit tests to enforce the pattern
5. Communicate decision to all team members in next team meeting

---

## Review Date

Optional: Specify when this decision should be reviewed
- **Next Review:** YYYY-MM-DD
- **Trigger for Review:** [Event or condition that would trigger a review]

**Example:**
- **Next Review:** 2025-06-01 (after 6 months of usage)
- **Trigger for Review:** If we need to support more than 50 use cases, re-evaluate if this structure still scales

---

## References

Links to additional information:
- [Link to discussion/meeting notes]
- [Link to relevant documentation]
- [Link to code examples]
- [Link to external resources]

**Example:**
- [Hexagonal Architecture Patterns](https://alistair.cockburn.us/hexagonal-architecture/)
- [Clean Architecture - Use Cases](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html)
- [Team discussion in Slack thread](https://example.slack.com/archives/...)
- [GitHub issue #123](https://github.com/...)

---

## Notes

Any additional context, clarifications, or information that doesn't fit elsewhere.

**Example:**
> This pattern is already in use in the payment context. See `/docs/architecture/adr/adr-012-payment-retry-policy.md` for a similar decision.

---

## Template Metadata

**ADR Template Version:** 1.0
**Last Updated:** 2025-01-13

---

## How to Use This Template

1. **Copy this template** to create a new ADR
2. **Number your ADR** sequentially (ADR-001, ADR-002, etc.)
3. **Use a descriptive title** that clearly indicates what is being decided
4. **Fill in all sections** - even if brief, each section provides valuable context
5. **Keep it concise** - ADRs should be readable in 5-10 minutes
6. **Update the status** as the decision evolves (Proposed → Accepted → Deprecated/Superseded)
7. **Store in version control** - ADRs are part of your codebase history
8. **Review and update** - ADRs are living documents that can be updated as understanding evolves

### When to Write an ADR

Create an ADR when:
- ✅ Making a significant architectural decision
- ✅ Choosing between multiple viable alternatives
- ✅ Making decisions that are difficult or expensive to reverse
- ✅ Establishing patterns that will be used throughout the codebase
- ✅ Making decisions that affect multiple teams or system components
- ✅ Decisions that will have long-term impact (6+ months)

Don't create an ADR for:
- ❌ Trivial or easily reversible decisions
- ❌ Implementation details that don't affect architecture
- ❌ Team processes (use different documentation)
- ❌ Decisions that are obvious or have no alternatives

### Best Practices

- **Write ADRs collaboratively** - Involve stakeholders in the decision
- **Be specific** - Vague decisions lead to inconsistent implementation
- **Document the why** - The rationale is often more important than the decision itself
- **Keep it objective** - Present facts and tradeoffs, not opinions
- **Update when superseded** - Mark old ADRs as deprecated, don't delete them
- **Reference ADRs in code** - Link to relevant ADRs in comments or documentation
