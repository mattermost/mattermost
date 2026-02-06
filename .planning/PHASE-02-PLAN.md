# Phase 2: Repository Extraction & Publishing - Execution Plan

**Status:** Ready for implementation
**Estimated effort:** 2-3 hours
**Owner:** Claude

---

## Overview

Migrate `@mattermost/llm-testing-providers` from monorepo to standalone repository with npm publishing.

---

## Step 1: Create New Repository

**Goal:** Set up standalone GitHub repo with initial structure

### Tasks
1. Create GitHub repository: `mattermost-llm-testing-providers`
2. Initialize with LICENSE (Apache 2.0), CONTRIBUTING.md
3. Create directory structure
4. Set up branch protection rules (main branch)

**Deliverable:** Empty repo with proper config
**Depends on:** User GitHub access

---

## Step 2: Migrate Code with Clean History

**Goal:** Transfer Phase 1 work to new repo with clean git history

### Tasks
1. Initialize new repo locally
2. Copy code from monorepo `packages/llm-testing-providers/` to new repo
3. Create initial commit with Phase 1 work
4. Add CHANGELOG.md (starting at 0.1.0)
5. Update README.md for standalone usage
6. Create CHANGELOG entry for initial release

**Deliverable:** Code in new repo with complete README and CHANGELOG
**Depends on:** Step 1

---

## Step 3: Set Up CI/CD (GitHub Actions)

**Goal:** Automated testing and publishing workflow

### Tasks
1. Create `.github/workflows/test.yml`
   - Trigger: push and pull_request
   - Run: lint, build, test
   - Nodes: 16, 18, 20 (LTS versions)

2. Create `.github/workflows/publish.yml`
   - Trigger: git tags (v0.*.*)
   - Run: build, publish to npm
   - Requires: npm token secret

3. Add npm configuration
   - Create `.npmignore` (exclude src/, tests/, workflows)
   - Update `package.json` with correct npm fields
   - Add `npm run build` to package.json scripts

**Deliverable:** Automated test and publish workflows
**Depends on:** Step 2

---

## Step 4: Test Standalone Usage

**Goal:** Verify new repo works independently

### Tasks
1. Publish 0.1.0 to npm (or local npm link test)
2. Create test project that imports `@mattermost/llm-testing-providers`
3. Verify imports work correctly
4. Run example code from README
5. Test both Anthropic and Ollama providers

**Deliverable:** Verified standalone usage
**Depends on:** Step 3

---

## Step 5: Update Monorepo to Use npm Package

**Goal:** Replace local package with npm dependency

### Tasks
1. Remove `packages/llm-testing-providers/` from monorepo
2. Add `@mattermost/llm-testing-providers` to `e2e-tests/playwright/lib/package.json`
3. Update `tsconfig.json` references if needed
4. Run monorepo tests to verify imports still work
5. Update `README.md` if it mentions local llm package

**Deliverable:** Monorepo using npm package
**Depends on:** Step 4

---

## Step 6: Documentation & Communication

**Goal:** Clear documentation for users and maintainers

### Tasks
1. Update standalone README with:
   - Quick start (Anthropic, Ollama)
   - Installation instructions
   - Development setup
   - Contributing guidelines
   - Roadmap (multi-provider support)

2. Create maintainer docs:
   - Release process
   - Version bumping
   - npm publishing
   - Dependency updates

3. Update monorepo docs:
   - Link to standalone repo
   - Note about npm dependency
   - Examples pointing to standalone repo docs

**Deliverable:** Complete documentation
**Depends on:** Step 5

---

## Step 7: Verification & Cleanup

**Goal:** Final verification and cleanup

### Tasks
1. Verify monorepo tests pass with npm package
2. Verify standalone repo CI/CD works
3. Test npm installation in fresh environment
4. Clean up any temporary files
5. Create release notes for 0.1.0
6. Tag release in standalone repo (v0.1.0)

**Deliverable:** Production-ready code and docs
**Depends on:** Step 6

---

## Success Criteria

- ✅ New repository created and populated
- ✅ CI/CD pipelines working (test and publish)
- ✅ Version 0.1.0 published to npm
- ✅ Monorepo successfully imports from npm package
- ✅ All monorepo tests passing
- ✅ Documentation complete and accurate
- ✅ Standalone repo documentation complete
- ✅ Clear upgrade path documented

---

## Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| npm publishing fails | Test with local `npm link` first, dry-run publish |
| Import breaks in monorepo | Test locally before committing, pin version |
| CI/CD not working | Test workflows in feature branch first |
| Missing npm config | Use template from similar Mattermost packages |

---

## Rollback Plan

If issues occur:
1. Keep `packages/llm-testing-providers/` in monorepo temporarily
2. Both repo and npm package can coexist
3. Monorepo can revert to local import if needed
4. Release new version of npm package with fixes

---

## Timeline

Estimated duration: **2-3 hours**

| Phase | Duration | Status |
|-------|----------|--------|
| Steps 1-2 | 30 min | Ready |
| Step 3 | 30 min | Ready |
| Step 4 | 30 min | Ready |
| Step 5 | 30 min | Ready |
| Steps 6-7 | 45 min | Ready |

---

## Next: Approve & Start

Ready to proceed with execution?

**Yes:** Start Step 1 (create GitHub repo)
**No:** Return to Phase 2 Context discussion
