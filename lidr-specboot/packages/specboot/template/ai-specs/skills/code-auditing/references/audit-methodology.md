# Code Audit Methodology

This document provides a comprehensive, systematic approach to code quality auditing. Follow these phases for thorough analysis.

## Phase 0: Pre-Analysis Setup

Before analyzing code, establish the context:

### 1. Project Configuration
- **Package files**: package.json, requirements.txt, go.mod, pom.xml, etc.
- **Tech stack**: Identify languages, frameworks, and core libraries
- **Linting configs**: eslint, prettier, black, golint, etc.
- **Project docs**: CLAUDE.md, README.md for project-specific guidelines

### 2. Baseline Checks
Run existing linting and testing:
```bash
# JavaScript/TypeScript
npm run lint
npm run typecheck
npm test

# Python
black --check .
flake8
pytest

# Go
go vet ./...
golint ./...
```

Document existing errors/warnings as baseline.

### 3. Documentation Loading
Use Context7 to pre-load documentation for identified core libraries:
```
mcp__context7__resolve-library-id  → Get library ID
mcp__context7__query-docs    → Load current best practices
```

## Phase 1: Discovery

### File Identification
Find all code files by type:
```
*.js, *.ts, *.jsx, *.tsx  (JavaScript/TypeScript)
*.py                       (Python)
*.java                     (Java)
*.go                       (Go)
*.rs                       (Rust)
*.rb                       (Ruby)
```

### Organization
- Group files by module/feature for contextual analysis
- Create a tracking list for systematic progress
- Prioritize core business logic over utilities

## Phase 2: File-by-File Analysis

For each file, analyze for the following categories:

### Dead Code
- Unused functions and methods
- Unused variables and imports
- Unreachable code blocks
- Commented-out code
- Deprecated features still present

### Code Smells & Anti-Patterns
- Functions longer than 50 lines
- High cyclomatic complexity (> 10)
- Deeply nested conditionals (> 3 levels)
- Magic numbers without constants
- Copy-paste code duplication
- God objects/functions doing too much
- Long parameter lists (> 5 params)

### Security Vulnerabilities
- Hardcoded secrets, API keys, passwords
- SQL injection vulnerabilities
- XSS (Cross-Site Scripting) risks
- Command injection risks
- Insecure deserialization
- Missing input validation
- Information disclosure in errors

### Performance Issues
- O(n²) or worse algorithms in hot paths
- Missing database indexes
- N+1 query patterns
- Unnecessary synchronous operations
- Missing caching for expensive operations
- Large memory allocations in loops
- Blocking I/O in async contexts

### TypeScript/Type Safety Issues
- Missing type annotations
- Excessive use of `any` type
- Type assertions that could be avoided
- Custom types duplicating official @types/* packages
- Missing null/undefined checks

### Async/Promise Issues
- Missing `await` keywords
- Unhandled promise rejections
- Callback hell that should use async/await
- Fire-and-forget promises without error handling

### Memory Leaks
- Event listeners not removed on cleanup
- Timers (setInterval, setTimeout) not cleared
- Large objects retained unnecessarily
- Closures holding references too long
- DOM references kept after element removal

### Error Handling
- Empty catch blocks
- Catch-and-ignore patterns
- Missing try/catch in async code
- Inconsistent error types
- Generic error messages hiding root cause

## Phase 3: Best Practices Verification

### Context7 Documentation Check
For every major library identified:

1. **Resolve library ID**:
   ```
   mcp__context7__resolve-library-id: "react"
   ```

2. **Get current best practices**:
   ```
   mcp__context7__query-docs: {
     "context7CompatibleLibraryID": "/facebook/react",
     "topic": "hooks best practices"
   }
   ```

3. **Focus areas**:
   - Migration guides between versions
   - Deprecated features and replacements
   - Performance best practices
   - Security considerations
   - Common pitfalls and anti-patterns

### GitHub Research
Use `gh` CLI to research real-world usage:

```bash
# Search for patterns
gh search code "useEffect cleanup" --language=typescript

# Check repository health
gh repo view [library] --json stargazersCount,updatedAt,openIssues

# Look for security advisories
gh api /repos/{owner}/{repo}/security-advisories
```

### Cross-Reference Findings
- Compare actual implementation vs official documentation
- Identify deviations from recommended patterns
- Note outdated patterns that need modernization
- Flag anti-patterns explicitly discouraged in docs

## Phase 3.5: TypeScript Types Verification

For TypeScript projects, perform additional type analysis:

### Check for Duplicate Types
Search for custom interfaces that mirror official types:
- React types (React.FC, React.Component, event types)
- Node.js types (Buffer, Process, Global)
- DOM types (HTMLElement, Event types)
- Express types (Request, Response)
- Popular library types (lodash, axios, etc.)

### Verify @types Packages
```bash
# Check if official types exist
npm view @types/[library] types

# Verify installed @types versions
npm ls @types/*
```

### Common Issues
- Custom `IRequest` when `express.Request` exists
- Custom event types when React provides them
- Duplicating `@types/node` built-in types

## Phase 4: Pattern Detection

Look for recurring issues across the codebase:

### Cross-File Patterns
- Same anti-pattern repeated in multiple files
- Duplicated utility functions
- Inconsistent error handling approaches
- Different coding styles in different modules

### Abstraction Opportunities
- Repeated code that could be a utility function
- Common patterns that could be hooks (React)
- Cross-cutting concerns needing middleware

### Inconsistencies
- Mixed async styles (callbacks, promises, async/await)
- Inconsistent naming conventions
- Different error handling strategies
- Varying code organization patterns

## Phase 5: Library Recommendations

For custom implementations, find mature replacements:

### Discovery Process
1. **Check existing libraries first** - Use Context7 to see if current libraries already provide needed functionality
2. **Search package registries** - npm, PyPI, crates.io, etc.
3. **Verify library health**:
   - Recent commits (active development)
   - Open issues (responsiveness)
   - Download stats (community adoption)
   - Security advisories (vulnerability history)

### Evaluation Criteria
- **Maintenance**: Last commit < 6 months
- **Adoption**: Significant download/star count
- **Security**: No unaddressed vulnerabilities
- **Bundle size**: Important for frontend code
- **API stability**: Semantic versioning, migration guides
- **Documentation**: Clear examples and API docs

### Common Replacements
| Custom Implementation | Recommended Library |
|----------------------|---------------------|
| Date manipulation | date-fns, dayjs |
| HTTP client | axios, ky |
| Form validation | zod, yup |
| State management | zustand, jotai |
| Deep cloning | lodash/cloneDeep, structuredClone |
| UUID generation | uuid, nanoid |
| Retry logic | p-retry, async-retry |

## Phase 6: Report Generation

### Report Structure

#### Executive Summary (2-3 paragraphs)
- Total files analyzed
- High-level findings overview
- Key risks and recommendations

#### Critical Issues (Immediate Action)
For each:
- File path and line number
- Issue description
- Security/stability impact
- Fix example
- Effort estimate

#### High Priority Issues
- Performance bottlenecks
- Maintainability problems
- Missing error handling

#### Medium Priority Issues
- Best practices violations
- Code quality concerns
- Type safety improvements

#### Low Priority Issues
- Style inconsistencies
- Minor improvements
- Documentation gaps

#### Library Recommendations
For each suggested replacement:
- Current custom code location
- Recommended library
- Migration effort
- Bundle size impact

#### Quick Wins
Low-effort, high-value fixes:
- < 30 minutes to implement
- High impact on quality/security

#### Action Plan
Prioritized steps with:
- Effort estimates (S/M/L/XL)
- Dependencies between tasks
- Suggested sprint allocation

### Report Format Requirements

Each issue should include:
```markdown
### [PRIORITY] Issue Title
**Location:** `src/auth/login.js:42`

**Problem:**
Description of the issue and why it matters.

**Before:**
```javascript
// problematic code
```

**After:**
```javascript
// fixed code
```

**Effort:** S (< 30 min) | M (1-4 hours) | L (4-8 hours) | XL (> 8 hours)
```

## Tool Usage Reference

### Context7
```
# Resolve library ID first
mcp__context7__resolve-library-id: "express"

# Then get documentation
mcp__context7__query-docs: {
  "context7CompatibleLibraryID": "/expressjs/express",
  "topic": "middleware"
}
```

### GitHub CLI
```bash
# Repository health
gh repo view owner/repo --json stargazersCount,updatedAt

# Code search
gh search code "pattern" --language=javascript

# Issues search
gh search issues "memory leak" --repo=owner/repo
```

### Package Research
Use `mcp__fetch__fetch` for package registry pages:
- npmjs.com/package/[name]
- pypi.org/project/[name]

## Common Pitfalls to Avoid

1. **Don't rely on assumptions** - Always verify with documentation
2. **Don't suggest outdated patterns** - Check current best practices
3. **Don't recommend unmaintained libraries** - Verify activity
4. **Don't ignore project conventions** - Respect CLAUDE.md guidelines
5. **Don't break functionality** - Ensure fixes are safe
6. **Don't over-engineer** - Consider cost/benefit ratio
7. **Don't skip TypeScript type checks** - Types are documentation
8. **Don't ignore bundle size** - Frontend performance matters

## Performance Optimization

For large codebases:
- **Parallel processing**: Analyze multiple files simultaneously
- **Batch operations**: Group similar checks together
- **Selective scanning**: Focus on changed files first
- **Cache documentation**: Reuse Context7 lookups
- **Progressive reporting**: Provide interim results
