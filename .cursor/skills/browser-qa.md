---
name: mattermost-browser-qa
description: Browser-based QA reproduction and visual verification for the Mattermost webapp using agent-browser CLI
---

# Mattermost Browser QA Skill

This skill teaches you how to use the `agent-browser` CLI to interact with a running Mattermost instance for QA reproduction and visual verification. It builds on the agent-browser skill (see `.cursor/skills/agent-browser/SKILL.md` for full CLI reference).

## Environment

- **Mattermost URL**: `http://localhost:8065`
- **Browser**: agent-browser manages its own headless Chromium (installed via `agent-browser install --with-deps`)
- **All commands use**: `agent-browser <command>` (no `--cdp` flag needed; agent-browser launches and manages its own browser)

## Quick Start

```bash
# 1. Open Mattermost
agent-browser open http://localhost:8065

# 2. Take a snapshot to see interactive elements
agent-browser snapshot -i

# 3. Interact with elements using refs (@e1, @e2, etc.)
agent-browser click @e1

# 4. Always re-snapshot after interactions (refs become stale)
agent-browser snapshot -i
```

## Admin Login

Default dev admin credentials (created via `make cursor-cloud-setup-admin`):
- **Username**: `admin`
- **Password**: `Admin@1234`

If sample data was injected (`make inject-test-data`):
- **Username**: `sysadmin`
- **Password**: `Sys@dmin-sample1`

### Login Flow

```bash
agent-browser open http://localhost:8065/login
agent-browser snapshot -i

# Find the login input (look for input with name="loginId" or placeholder containing "Email" or "Username")
# Find the password input (look for password type input)
# Find the submit button (look for button with text "Log in")

agent-browser fill @eLoginInput "admin"
agent-browser fill @ePasswordInput "Admin@1234"
agent-browser click @eLoginButton
agent-browser wait --load networkidle
agent-browser snapshot -i
```

After login, you may be redirected to:
- `/preparing-workspace` (first-time onboarding wizard) - complete or skip it
- `/dev-team/channels/town-square` (default channel) - you are ready

### Save Login State (Optional)

To avoid re-logging in across multiple QA sessions:
```bash
agent-browser state save /tmp/mm-auth.json
# Later:
agent-browser state load /tmp/mm-auth.json
```

## First-Time Server Setup

On a fresh Mattermost install with no users, the preferred setup is via mmctl:

```bash
cd server
./scripts/wait-for-system-start.sh
bin/mmctl user create --email admin@example.com --username admin --password 'Admin@1234' --system-admin --email-verified --local
bin/mmctl team create --name dev-team --display-name "Dev Team" --local
bin/mmctl team users add dev-team admin --local
```

Or use the make target:
```bash
cd server && make cursor-cloud-setup-admin
```

If you need to set up via browser instead (e.g., testing the signup flow):
1. Navigate to `http://localhost:8065` - it will redirect to `/signup_user_complete`
2. Fill in email, username, password
3. The first account automatically becomes system admin
4. Complete or skip the onboarding wizard

## Key UI Elements

### Login Page (`/login`)
- Login input: `data-testid="login-id-input"`
- Password input: class `login-body-card-form-password-input`
- Submit button: class `login-body-card-form-button-submit`, text "Log in"

### Channel View (Main App)
- **Sidebar channels**: Each channel link has `aria-label` with channel name
- **Message input (center)**: `id="post_textbox"`
- **Reply input (RHS thread)**: `id="reply_textbox"`
- **RHS container**: `id="sidebar-right"`
- **Post elements**: `.post` class with `data-testid` attributes

### Sending a Message

```bash
# Navigate to a channel (e.g., Town Square)
agent-browser open http://localhost:8065/dev-team/channels/town-square
agent-browser wait --load networkidle
agent-browser snapshot -i

# Find and fill the message input (id="post_textbox")
agent-browser fill @eMessageInput "Test message from QA"
agent-browser press Enter
agent-browser wait --load networkidle

# Verify the message appeared
agent-browser snapshot -i
# Look for "Test message from QA" in the snapshot output
```

### Opening a Thread / RHS

```bash
# Hover over a post to reveal action buttons, then click reply
# Or: click the reply count/icon on a post
agent-browser snapshot -i
# Find the reply button/icon for the target post
agent-browser click @eReplyButton
agent-browser wait --load networkidle
agent-browser snapshot -i
# Verify id="sidebar-right" is now visible in the snapshot
```

### Navigating Channels

```bash
# Option 1: Direct URL navigation
agent-browser open http://localhost:8065/dev-team/channels/off-topic

# Option 2: Click channel in sidebar
agent-browser snapshot -i
# Find channel with aria-label containing the channel name
agent-browser click @eChannelLink
```

## Verification Strategies

### Functional Verification (Accessibility Tree)

Use `snapshot -i` to check:
- Element exists on the page
- Text content is correct
- Buttons/links are interactive
- Form fields have expected values

```bash
agent-browser snapshot -i
# Parse the output for expected text, elements, or structure
```

### Visual Verification (Screenshots)

Use screenshots for:
- Layout correctness
- Styling/CSS issues
- Visual regressions
- Element alignment
- Color and theme issues

```bash
# Full page screenshot
agent-browser screenshot /tmp/qa-screenshot.png

# Full scrollable page
agent-browser screenshot --full /tmp/qa-full.png

# Then read the screenshot file to analyze it visually
```

### Combined Approach (Recommended)

For thorough QA, always use both:
1. `snapshot -i` to verify functional correctness (elements exist, text is right)
2. `screenshot /tmp/step-N.png` to verify visual correctness (layout, styling)

## Common QA Workflows

### Reproduce a Bug Report

1. Start with a clean state (login, navigate to relevant page)
2. Follow the bug reproduction steps using agent-browser commands
3. Take a screenshot at each step for documentation
4. Use `snapshot -i` to identify the state of UI elements
5. Compare actual vs. expected behavior

### Verify a Fix

1. Apply the code fix
2. Restart the server if needed (`make cursor-cloud-run-server`)
3. Repeat the reproduction steps
4. Verify the bug no longer occurs (both functionally and visually)
5. Take "after" screenshots

### Write a Playwright E2E Test

After reproducing and fixing a bug, consider adding a Playwright test:

```bash
cd e2e-tests/playwright
# Run existing tests
npx playwright test --grep "relevant test pattern"
# Write new test in specs/ directory
```

## Error Recovery

### Page not loading
```bash
# Verify Mattermost server is running
curl -s http://localhost:8065/api/v4/system/ping
# If not, check the Mattermost Server terminal
```

### Stale refs
After any page navigation, form submission, or dynamic content change, ALWAYS re-run:
```bash
agent-browser snapshot -i
```
Refs from previous snapshots are invalidated.

### Element not found in snapshot
Try scoping the snapshot to a specific area:
```bash
agent-browser snapshot -i -s "#sidebar-right"
agent-browser snapshot -i -s ".post-list"
agent-browser snapshot -i -C  # include cursor-interactive divs
```

### JavaScript evaluation for debugging
```bash
# Check current URL
agent-browser get url

# Get page title
agent-browser get title

# Run custom JS
agent-browser eval "document.querySelector('#post_textbox')?.value"
```
