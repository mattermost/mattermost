---
agent: playwright-test-planner
description: Create test plan
---

Create test plan for posting a message to a channel in Mattermost.

- Seed file: `specs/functional/ai-assisted/seed.spec.ts`
- Test plan: `specs/functional/ai-assisted/coverage.plan.md`
- Feature: Channel messaging with auto-translation support
- Scenarios:
  - User posts message to public channel
  - User posts message to private channel
  - Message appears translated for users with auto-translation enabled
  - System handles concurrent message posts
