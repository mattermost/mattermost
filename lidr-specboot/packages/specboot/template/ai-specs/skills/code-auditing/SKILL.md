---
name: code-auditing
description: Task-focused project skill.
version: 1.0.0
---
# Code Auditing Skill

Comprehensive methodology for systematic code quality audits.

## When to Use

- Comprehensive code quality audits
- Security vulnerability assessments
- Technical debt identification
- Pre-release code reviews
- Best practices verification
- Library and dependency audits

## Audit Phases

### Phase 0: Pre-Analysis Setup
1. Check for project configuration files (package.json, tsconfig.json, etc.)
2. Identify tech stack and main libraries
3. Check for linting/formatting configs
4. Run existing linting/testing commands as baseline
5. Load documentation for identified core libraries

### Phase 1: Discovery
1. Find all code files by type
2. Create tracking list for each file
3. Group files by module/feature for contextual analysis

### Phase 2: File-by-File Analysis
For each file, analyze for:
- Dead code (unused functions, variables, imports)
- Code smells and anti-patterns
- Custom implementations that could use established libraries
- Security vulnerabilities
- Performance issues
- Outdated patterns or deprecated APIs
- Missing error handling
- Overly complex functions
- Duplicate code

### Phase 3: Best Practices Verification
For every library and framework:
1. Retrieve official documentation
2. Compare implementation against official patterns
3. Identify deviations from recommendations
4. Note outdated usage patterns
5. Flag discouraged anti-patterns

### Phase 4: Pattern Detection
Look for recurring issues:
- Common anti-patterns across files
- Duplicated logic that could be abstracted
- Inconsistent coding styles
- Missing error handling patterns

### Phase 5: Library Recommendations
For custom implementations:
1. Check if current libraries provide the functionality
2. Search for mature ecosystem packages
3. Verify library health (commits, issues, activity)
4. Check compatibility with project setup

### Phase 6: Comprehensive Report
Generate detailed report with:
- Executive summary
- Critical issues requiring immediate attention
- File-by-file findings
- Prioritized action plan
- Effort estimates
- Library recommendations

## Issue Priority Levels

- **Critical** - Security vulnerabilities, broken functionality
- **High Priority** - Performance bottlenecks, unmaintainable code
- **Medium Priority** - Code quality, best practices deviations
- **Low Priority** - Style, minor improvements
- **Quick Wins** - Less than 30 minutes to fix

## Analysis Categories

### Security
- Hardcoded secrets
- SQL injection risks
- XSS vulnerabilities
- Missing input validation
- Exposed sensitive data

### Performance
- Inefficient algorithms
- Blocking operations
- Memory leaks
- Missing caching opportunities
- N+1 query patterns

### TypeScript/Type Safety
- Missing type annotations
- Use of `any` type
- Custom types duplicating official types
- Missing @types packages

### Async/Promise Issues
- Missing await keywords
- Unhandled promise rejections
- Callback hell

### Dead Code
- Unused imports and exports
- Unused functions, classes, and methods
- Unused variables and types
- Unreachable code blocks
- Unused files (not imported anywhere)
- Unused dependencies

**Tools:**
- JavaScript/TypeScript: `npx knip --reporter json`
- Python: `deadcode . --dry`

**Important:** Always verify tool findings before reporting. Check for:
- Dynamic imports (`import(variable)`)
- Framework patterns (React components, decorators)
- Re-exports for public API
- Entry points (CLI scripts, serverless handlers)

## Resources

See the reference documents for complete methodologies:

- `references/audit-methodology.md` - Full 6-phase audit process with detailed checklists
- `references/dead-code-methodology.md` - Dead code detection tools, verification, and cleanup workflows

## Quick Reference

### Before Starting
- [ ] Read project configuration files
- [ ] Identify tech stack and libraries
- [ ] Run existing linters as baseline
- [ ] Create file tracking list

### During Audit
- [ ] Mark files as in-progress
- [ ] Analyze each category systematically
- [ ] Note specific line numbers
- [ ] Document before/after examples
- [ ] Mark files as completed

### After Audit
- [ ] Categorize all findings by priority
- [ ] Generate comprehensive report
- [ ] Save report to project root
- [ ] Provide brief console summary
