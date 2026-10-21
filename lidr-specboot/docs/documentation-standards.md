---
description: Standards and best practices for technical documentation in this project, including documentation structure, update processes, and language rules.
globs:
alwaysApply: true
---
# Rules and Patterns for documentation and AI specs

## Introduction
Technical documentation applies to all the documentation relative to the project, such as the data model, README, API specs, and other MD docs that describe how the project is structured, runs, and operates.
AI specs refers to the documents that explain AI agents how to behave, document, plan, code, etc, which includes team agreements, standards and conventions.

## General rules
- ALWAYS WRITE IN ENGLISH, including comments and any explanation in the files. This applies both to creating new documentation and updating existing one, and it also applies to documentation within the code (comments, explanations of functions or fields, etc.).



## Technical Documentation
Before making any commit or git push, or if you're asked to document a commit, you must ALWAYS review which technical documentation should be updated.

When updating documentation, I will:
1. Review all recent changes in the codebase
2. Identify which documentation files need updates based on the changes. Some clear examples:
   - For data model changes: Update data model definition section in data-model.md
   - For API changes: Update api-spec.yml
   - For changes in libraries, database migrations, or anything that changes the installation process, update *-standards.md
3. Update each affected documentation file in English, maintaining consistency with existing documentation
4. Ensure all documentation is properly formatted and follows the established structure
5. Verify that all changes are accurately reflected in the documentation
6. Report which files were updated and what changes were made

## AI specs

This rule establishes a mandatory process for the AI to:
*   Learn from user feedback, guidance, and suggestions during interactions.
*   Identify opportunities to improve existing Development Rules based on these learnings proactively.
*   Keep the AI's assistance aligned with evolving project needs and user expectations.
*   Incorporate user feedback into the AI's operational framework to maximize its value.

This rule is applicable after any interaction where the user provides explicit or implicit feedback, suggestions, corrections, new information, or expresses preferences. **The AI MUST actively analyze all user interactions for such learning opportunities, not only passively waiting for direct feedback, to proactively refine its understanding and the project's best practices.**

### Common Pitfalls and Anti-Patterns to be avoided by the AI

*   **Skipping Approval Process:** Applying rule modifications without obtaining explicit user review and approval first.
*   **Unlinked Proposals:** Proposing rule changes without clearly connecting them to the specific user feedback or insights gained from the interaction.
*   **Imprecise Modifications:** Suggesting modifications without precisely identifying which rule or specific sections within a rule should be changed, hindering effective user review.
*   **Unaddressed Feedback:** Not initiating the learning and review process when the user provides relevant feedback that could improve the rules.
*   **Scope Creep:** Updating multiple unrelated rules simultaneously or making changes that exceed the scope of the feedback received.
*   **Unprompted Rule Changes:** Modifying rules proactively when there is no direct connection to user feedback or a learning opportunity. Rule updates should be reactive and feedback-driven.
*   **Missing Update Confirmation:** Failing to notify the user after a rule modification has been successfully implemented following their approval.