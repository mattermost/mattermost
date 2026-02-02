# Autonomous E2E Testing System

A specification-driven testing system that bridges PDF/Markdown specs with Playwright's native agents for test planning, generation, and healing.

## Quick Start

```bash
# 1. Convert your PDF specification to Playwright-compatible markdown
ANTHROPIC_API_KEY=sk-ant-... AUTONOMOUS_ALLOW_PDF_UPLOAD=true \
  npx tsx autonomous-cli.ts convert "My Feature Spec.pdf"

# 2. Use Playwright's native agents to generate and run tests
# In VS Code or Claude:
#   @planner explore http://localhost:8065 and enhance test plans
#   @generator create tests from specs/
#   @healer fix any failing tests

# 3. Run the generated tests
npx playwright test
```

## Architecture

This system uses a simple bridge architecture:

```
PDF/MD/JSON Specs → SpecificationParser → Playwright Markdown → Playwright Agents
                                                                      ↓
                                                        Planner → Generator → Healer
                                                        (maintained by Playwright team)
```

**Key Benefits:**
- ~200 lines of custom code (down from ~5000)
- Production-ready test healing via Playwright's built-in agents
- Verified test generation (Playwright agents compile and test)
- Minimal maintenance burden

## Specification Formats

### 1. PDF Specifications

Upload your PRDs, design docs, or feature specs as PDFs with screenshots, mockups, and diagrams.

```bash
ANTHROPIC_API_KEY=sk-ant-... AUTONOMOUS_ALLOW_PDF_UPLOAD=true \
  npx tsx autonomous-cli.ts convert "docs/feature-specs/direct-messaging-v2.pdf"
```

**What the system extracts:**
- ✅ Feature names and descriptions
- ✅ Business scenarios (Given-When-Then format)
- ✅ Acceptance criteria
- ✅ Priority levels
- ✅ Related metadata

**Requirements:**
- Vision-capable LLM (Claude) for PDF parsing
- PDF must contain readable text (not scanned images without OCR)
- Set `AUTONOMOUS_ALLOW_PDF_UPLOAD=true` to consent to sending PDF to LLM

### 2. Markdown Specifications

Human-readable specs with embedded screenshots and Given-When-Then scenarios.

**Example: `specs/features/emoji-picker.md`**

```markdown
# Feature: Emoji Picker Enhancement

**Priority**: High
**Target URLs**: `/channels/*`, `/messages/*`

## Description
Users can quickly insert emojis with an improved picker.

## Business Scenarios

### Scenario 1: Open Emoji Picker
**Priority**: Must-have
- **Given**: User is composing a message
- **When**: User clicks the emoji icon
- **Then**: Emoji picker opens within 500ms

## Acceptance Criteria
- Picker opens in < 500ms
- Search updates instantly
```

### 3. JSON Specifications

Structured format for programmatic spec generation.

```json
{
  "feature": "Message Reactions",
  "priority": "high",
  "scenarios": [
    {
      "name": "User adds reaction to message",
      "given": "User sees a message in channel",
      "when": "User clicks reaction icon and selects emoji",
      "then": "Emoji reaction appears under message",
      "priority": "must-have"
    }
  ],
  "acceptanceCriteria": [
    "Reactions appear within 1 second",
    "Count updates in real-time"
  ]
}
```

## CLI Commands

```bash
# Convert specification to Playwright markdown
npx tsx autonomous-cli.ts convert <spec-file>

# Validate a specification
npx tsx autonomous-cli.ts validate <spec-file>

# View specification summary
npx tsx autonomous-cli.ts summary <spec-file>

# Show help
npx tsx autonomous-cli.ts help
```

## Workflow

### Step 1: Convert Your Specification

```bash
# For PDF specs (requires ANTHROPIC_API_KEY)
ANTHROPIC_API_KEY=sk-ant-... AUTONOMOUS_ALLOW_PDF_UPLOAD=true \
  npx tsx autonomous-cli.ts convert "My Feature Spec.pdf"

# For Markdown/JSON specs (can use free Ollama)
npx tsx autonomous-cli.ts convert "specs/feature.md"
```

Output is written to `specs/` directory.

### Step 2: Use Playwright Agents

In VS Code with Playwright extension, or with Claude:

```
@planner explore http://localhost:8065 and create test plans from specs/
@generator create tests from the spec files in specs/
```

### Step 3: Run Tests

```bash
npx playwright test
```

### Step 4: Heal Failing Tests

When tests fail due to UI changes:

```
@healer fix the failing tests in tests/generated/
```

## LLM Provider Options

### Anthropic (Required for PDF)

```bash
export ANTHROPIC_API_KEY=sk-ant-...
```

Features: Vision support for PDF parsing, high-quality extraction.

### Ollama (Free, Local)

```bash
# Install Ollama
curl -fsSL https://ollama.com/install.sh | sh
ollama pull deepseek-r1:7b
```

Features: Free, runs locally, complete privacy.
Limitations: No vision support (can't parse PDFs).

## Programmatic API

```typescript
import {SpecBridge, createAnthropicBridge} from './lib/src/spec-bridge';

// Create bridge with Anthropic provider
const bridge = createAnthropicBridge(process.env.ANTHROPIC_API_KEY);

// Convert PDF to Playwright specs
const result = await bridge.convertToPlaywrightSpecs('spec.pdf', 'specs/');

console.log(`Created ${result.specPaths.length} spec files`);
console.log(`Total scenarios: ${result.totalScenarios}`);
```

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `ANTHROPIC_API_KEY` | Anthropic API key for PDF parsing | For PDFs |
| `AUTONOMOUS_ALLOW_PDF_UPLOAD` | Consent to send PDF to LLM | For PDFs |
| `OLLAMA_BASE_URL` | Ollama API URL (default: http://localhost:11434) | For Ollama |

## Security

When using PDF parsing, the document is sent to an external LLM provider.

**Ensure your PDF does NOT contain:**
- Internal API keys or credentials
- Sensitive architecture details
- Production URLs or IP addresses
- Personal Identifying Information (PII)
- Proprietary business information

See [SECURITY.md](./SECURITY.md) for more details.

**What was kept:**
- `spec_parser.ts` - PDF/MD/JSON parsing (8.5/10 quality)
- `llm/` - LLM providers for PDF extraction
- `types.ts` - Type definitions

## Support

- **Issues**: https://github.com/mattermost/mattermost/issues
- **Docs**: https://docs.mattermost.com
- **Community**: https://community.mattermost.com

## License

Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
See LICENSE.txt for license information.
