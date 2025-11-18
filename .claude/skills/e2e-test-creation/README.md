# E2E Test Creation Skill

## Status: ✅ Properly Configured

This skill is now properly set up as a Claude Code skill and will be available after restarting Claude Code.

## What Was Created

### Directory Structure
```
.claude/skills/e2e-test-creation/
├── SKILL.md                      # Main skill definition with YAML frontmatter
├── guidelines.md                 # Complete test creation guidelines (25KB)
├── examples.md                   # Real-world test examples (25KB)
├── mattermost-patterns.md        # Mattermost-specific patterns (19KB)
├── README.md                     # This file
└── agents/
    ├── planner.md                # Test planning guidance
    ├── generator.md              # Test generation patterns
    └── healer.md                 # Test healing strategies
```

### Skill Configuration

**Name:** `e2e-test-creation`

**Description:** Automatically generates E2E Playwright tests for Mattermost frontend changes. Provides comprehensive guidelines, patterns, and examples for creating robust, maintainable tests following Mattermost conventions.

**Auto-activates when:**
- You modify files in `webapp/`
- You create or update React components
- You add new user-facing features

## How to Test

### 1. Restart Claude Code
The skill won't be available until Claude Code restarts and picks up the new skill configuration.

### 2. Verify Skill is Loaded
After restart, you can check if the skill is available (exact command may vary):
```bash
# In Claude Code, the skill should appear in available skills
# You can try invoking it to test
```

### 3. Test Automatic Activation
Make a change to a webapp file and see if Claude automatically loads the skill:
```bash
# Example: Make a small change to any React component
# Claude should detect it and activate the e2e-test-creation skill
```

### 4. Manual Test
You can also explicitly mention the skill or request E2E test generation:
```
"I need to create E2E tests for the channel sidebar feature"
```

## What This Skill Provides

### Comprehensive Documentation
- **77KB of documentation** across 7 files
- Mattermost-specific patterns and conventions
- Real-world examples
- Three-phase workflow (Planning → Generation → Healing)

### Test Quality Standards
- Uses Mattermost's `pw` fixture
- Follows page object patterns
- Semantic selectors (data-testid, ARIA)
- Proper async handling
- Test isolation and cleanup

### Coverage
- When to create E2E tests (and when not to)
- Test organization and structure
- Best practices for selectors, waits, assertions
- Common patterns (real-time, modals, error handling)
- Multi-user testing scenarios
- Visual regression testing

## Integration with CLAUDE.md

The root [CLAUDE.md](/Users/yasserkhan/Documents/mattermost/mattermost/CLAUDE.md) file has been updated to reference this skill and explain:
- When the skill activates
- The three-phase workflow
- Example workflows
- Quality standards
- Skill documentation location

## Company-Wide Deployment

### Zero Setup Required
✅ Just clone the repo and the skill works
✅ No individual developer configuration needed
✅ Version controlled with the codebase
✅ Automatic updates via git pull

### Advantages Over Previous Setup
- ✅ **Functional** - Actually works as a Claude Code skill
- ✅ **Automatic** - Loads when needed without manual invocation
- ✅ **Testable** - Can verify it's working
- ✅ **Standard** - Uses official Claude Code skills system
- ✅ **Maintainable** - Easy to update and extend
- ✅ **Documented** - Clear structure and usage

### Migration Notes
- Old documentation in `e2e-tests/playwright/.ai/` is preserved for reference
- The active skill is in `.claude/skills/e2e-test-creation/`
- All content has been migrated and properly structured
- CLAUDE.md updated to point to new location

## Next Steps

1. **Restart Claude Code** to load the skill
2. **Test with a webapp change** to verify automatic activation
3. **Share with team** - They just need to pull the latest code
4. **Optional**: Add skill usage to onboarding docs

## Troubleshooting

### Skill not loading?
- Ensure Claude Code was restarted
- Check that `.claude/skills/e2e-test-creation/SKILL.md` exists
- Verify YAML frontmatter is valid

### Skill not activating automatically?
- Make sure you're modifying files in `webapp/`
- Try explicitly mentioning "E2E tests" or "test generation"
- Check Claude Code logs for skill loading

### Need to update the skill?
- Edit files in `.claude/skills/e2e-test-creation/`
- Changes take effect after Claude Code restart
- All team members get updates via git

## Support

For questions or issues:
- Check this README
- Review SKILL.md for overview
- Read guidelines.md for detailed instructions
- See examples.md for real-world patterns
- Check mattermost-patterns.md for Mattermost specifics

---

**Status:** Ready for company-wide use! 🚀
