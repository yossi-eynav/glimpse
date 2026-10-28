# Specification Quality Checklist: Terms of Service and Privacy Policy

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-10-28
**Feature**: [spec.md](../spec.md)

## Content Quality

- [x] No implementation details (languages, frameworks, APIs)
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed

## Requirement Completeness

- [x] No [NEEDS CLARIFICATION] markers remain
- [x] Requirements are testable and unambiguous
- [x] Success criteria are measurable
- [x] Success criteria are technology-agnostic (no implementation details)
- [x] All acceptance scenarios are defined
- [x] Edge cases are identified
- [x] Scope is clearly bounded
- [x] Dependencies and assumptions identified

## Feature Readiness

- [x] All functional requirements have clear acceptance criteria
- [x] User scenarios cover primary flows
- [x] Feature meets measurable outcomes defined in Success Criteria
- [x] No implementation details leak into specification

## Notes

- **Iteration 1** had 3 [NEEDS CLARIFICATION] markers: the product name and publisher, the
  contact email, and the governing law. The owner resolved them on 2026-10-28: Glimpse, published
  by an individual developer; yossi.eynav@gmail.com; and Israel.
- **Data-handling facts**: the spec names them (only the photos picked, the email, tokens
  encrypted with a Keychain-held key, data kept on the Mac, sent only to Google). The documents
  must state these facts to users, so they are content requirements, not implementation choices.
- **Not legal advice**: the "lawyer review" assumption marks the documents as drafts.
- Items marked incomplete require spec updates before `/speckit-clarify` or `/speckit-plan`
