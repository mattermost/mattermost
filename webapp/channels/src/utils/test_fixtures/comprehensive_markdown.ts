// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * Comprehensive Markdown Test Fixtures
 *
 * Shared test data for markdown round-trip testing.
 * Used by: markdown_roundtrip.test.ts, markdown_full_roundtrip.test.ts, E2E tests
 *
 * This ensures all tests use the same comprehensive document that covers
 * all markdown features and edge cases.
 */

/**
 * Comprehensive markdown document covering all features.
 * Based on the architecture.md structure that revealed the original bugs.
 */
export const COMPREHENSIVE_MARKDOWN = `# Claude Code Development System Architecture

## 1. Prerequisites

### CLI Tools

\`\`\`bash
# Codex CLI (OpenAI) - for multi-LLM review
npm install -g @openai/codex

# Gemini CLI (Google) - for multi-LLM review
npm install -g @anthropic/gemini-cli
\`\`\`

### MCP Servers

| MCP | Purpose |
| --- | --- |
| \`seq-server\` | Sequential thinking/reasoning |
| \`gemini-cli\` | Gemini LLM access |
| \`codex-native\` | OpenAI Codex access |
| \`postgres-server\` | PostgreSQL queries |

**Load on Demand**: MCPs start when first invoked. Run \`/mcp\` to see status.

---

## 2. Tools

### Agents

**Total: 148 agents** (142 user + 6 project)

#### Tier 1a: Universal (Always Run)

| Agent | Purpose |
| --- | --- |
| \`simplicity-reviewer\` | Over-engineering, YAGNI |
| \`design-flaw-finder\` | Logical flaws |
| \`race-condition-finder\` | Concurrency bugs, data races |

### Skills (Symmetric Pairs)

| Action | Skill | Purpose |
| --- | --- | --- |
| **Plan** | \`/create-plan\` | Generate plan (auto-detects MM → layer template) |
| **Review Plan** | \`/review-plan\` | Multi-LLM plan validation |
| **Code** | \`/create-code\` | Implement from approved plan (TDD workflow) |

---

## 3. Workflow

### Manual Flow (Recommended)

1. Plan Creation
2. Plan Review (built into /create-plan)
3. Plan Finalization
4. Implementation
5. Code Review

> **Important**: Always follow the research → plan → implement sequence.

### Task Lists

- [x] Completed task
- [ ] Pending task
- [x] Another completed task

### Callout Example

> **Info**
> This is important information that users should know.

### Code Examples

\`\`\`javascript
import { foo } from 'bar';

function example() {
    const x = 1;
    return x * 2;
}
\`\`\`

\`\`\`python
def hello():
    print("Hello, World!")
    return True
\`\`\`

\`\`\`typescript
interface User {
    name: string;
    email: string;
}
\`\`\`

### Links and Images

Check the [documentation](https://docs.example.com) for more info.

![Logo](https://example.com/logo.png)

### Inline Formatting

This text has **bold**, *italic*, ~~strikethrough~~, and \`inline code\`.

Combined: ***bold and italic*** text.

### Mentions

Hey @john.doe and @jane_smith, please check ~town-square for updates.

### Bullet List

- First bullet item
- Second bullet item
- Third bullet item

### Unicode and Emoji

Hello 世界! Welcome to the documentation 🎉

### Nested Lists

- Level 1
  - Level 2
    - Level 3
      - Level 4

1. First
   1. Nested first
   2. Nested second
2. Second
3. Third

### Blockquote with Formatting

> This is a **bold** quote with *italic* and \`code\`.
>
> It spans multiple paragraphs.
`;

/**
 * TipTap JSON representation of the comprehensive document.
 * This is what the document looks like after being parsed by TipTap.
 */
export const COMPREHENSIVE_TIPTAP_DOC = {
    type: 'doc',
    content: [
        {type: 'heading', attrs: {level: 1}, content: [{type: 'text', text: 'Claude Code Development System Architecture'}]},

        {type: 'heading', attrs: {level: 2}, content: [{type: 'text', text: '1. Prerequisites'}]},

        {type: 'heading', attrs: {level: 3}, content: [{type: 'text', text: 'CLI Tools'}]},

        {
            type: 'codeBlock',
            attrs: {language: 'bash'},
            content: [{type: 'text', text: '# Codex CLI (OpenAI) - for multi-LLM review\nnpm install -g @openai/codex\n\n# Gemini CLI (Google) - for multi-LLM review\nnpm install -g @anthropic/gemini-cli'}],
        },

        {type: 'heading', attrs: {level: 3}, content: [{type: 'text', text: 'MCP Servers'}]},

        {
            type: 'table',
            content: [
                {
                    type: 'tableRow',
                    content: [
                        {type: 'tableHeader', content: [{type: 'paragraph', content: [{type: 'text', text: 'MCP'}]}]},
                        {type: 'tableHeader', content: [{type: 'paragraph', content: [{type: 'text', text: 'Purpose'}]}]},
                    ],
                },
                {
                    type: 'tableRow',
                    content: [
                        {type: 'tableCell', content: [{type: 'paragraph', content: [{type: 'text', marks: [{type: 'code'}], text: 'seq-server'}]}]},
                        {type: 'tableCell', content: [{type: 'paragraph', content: [{type: 'text', text: 'Sequential thinking/reasoning'}]}]},
                    ],
                },
                {
                    type: 'tableRow',
                    content: [
                        {type: 'tableCell', content: [{type: 'paragraph', content: [{type: 'text', marks: [{type: 'code'}], text: 'gemini-cli'}]}]},
                        {type: 'tableCell', content: [{type: 'paragraph', content: [{type: 'text', text: 'Gemini LLM access'}]}]},
                    ],
                },
                {
                    type: 'tableRow',
                    content: [
                        {type: 'tableCell', content: [{type: 'paragraph', content: [{type: 'text', marks: [{type: 'code'}], text: 'codex-native'}]}]},
                        {type: 'tableCell', content: [{type: 'paragraph', content: [{type: 'text', text: 'OpenAI Codex access'}]}]},
                    ],
                },
                {
                    type: 'tableRow',
                    content: [
                        {type: 'tableCell', content: [{type: 'paragraph', content: [{type: 'text', marks: [{type: 'code'}], text: 'postgres-server'}]}]},
                        {type: 'tableCell', content: [{type: 'paragraph', content: [{type: 'text', text: 'PostgreSQL queries'}]}]},
                    ],
                },
            ],
        },

        {
            type: 'paragraph',
            content: [
                {type: 'text', marks: [{type: 'bold'}], text: 'Load on Demand'},
                {type: 'text', text: ': MCPs start when first invoked. Run '},
                {type: 'text', marks: [{type: 'code'}], text: '/mcp'},
                {type: 'text', text: ' to see status.'},
            ],
        },

        {type: 'horizontalRule'},

        {type: 'heading', attrs: {level: 2}, content: [{type: 'text', text: '2. Tools'}]},

        {type: 'heading', attrs: {level: 3}, content: [{type: 'text', text: 'Agents'}]},

        {
            type: 'paragraph',
            content: [
                {type: 'text', marks: [{type: 'bold'}], text: 'Total: 148 agents'},
                {type: 'text', text: ' (142 user + 6 project)'},
            ],
        },

        {type: 'heading', attrs: {level: 4}, content: [{type: 'text', text: 'Tier 1a: Universal (Always Run)'}]},

        {
            type: 'table',
            content: [
                {
                    type: 'tableRow',
                    content: [
                        {type: 'tableHeader', content: [{type: 'paragraph', content: [{type: 'text', text: 'Agent'}]}]},
                        {type: 'tableHeader', content: [{type: 'paragraph', content: [{type: 'text', text: 'Purpose'}]}]},
                    ],
                },
                {
                    type: 'tableRow',
                    content: [
                        {type: 'tableCell', content: [{type: 'paragraph', content: [{type: 'text', marks: [{type: 'code'}], text: 'simplicity-reviewer'}]}]},
                        {type: 'tableCell', content: [{type: 'paragraph', content: [{type: 'text', text: 'Over-engineering, YAGNI'}]}]},
                    ],
                },
                {
                    type: 'tableRow',
                    content: [
                        {type: 'tableCell', content: [{type: 'paragraph', content: [{type: 'text', marks: [{type: 'code'}], text: 'design-flaw-finder'}]}]},
                        {type: 'tableCell', content: [{type: 'paragraph', content: [{type: 'text', text: 'Logical flaws'}]}]},
                    ],
                },
                {
                    type: 'tableRow',
                    content: [
                        {type: 'tableCell', content: [{type: 'paragraph', content: [{type: 'text', marks: [{type: 'code'}], text: 'race-condition-finder'}]}]},
                        {type: 'tableCell', content: [{type: 'paragraph', content: [{type: 'text', text: 'Concurrency bugs, data races'}]}]},
                    ],
                },
            ],
        },

        {type: 'heading', attrs: {level: 3}, content: [{type: 'text', text: 'Skills (Symmetric Pairs)'}]},

        {
            type: 'table',
            content: [
                {
                    type: 'tableRow',
                    content: [
                        {type: 'tableHeader', content: [{type: 'paragraph', content: [{type: 'text', text: 'Action'}]}]},
                        {type: 'tableHeader', content: [{type: 'paragraph', content: [{type: 'text', text: 'Skill'}]}]},
                        {type: 'tableHeader', content: [{type: 'paragraph', content: [{type: 'text', text: 'Purpose'}]}]},
                    ],
                },
                {
                    type: 'tableRow',
                    content: [
                        {type: 'tableCell', content: [{type: 'paragraph', content: [{type: 'text', marks: [{type: 'bold'}], text: 'Plan'}]}]},
                        {type: 'tableCell', content: [{type: 'paragraph', content: [{type: 'text', marks: [{type: 'code'}], text: '/create-plan'}]}]},
                        {type: 'tableCell', content: [{type: 'paragraph', content: [{type: 'text', text: 'Generate plan (auto-detects MM → layer template)'}]}]},
                    ],
                },
                {
                    type: 'tableRow',
                    content: [
                        {type: 'tableCell', content: [{type: 'paragraph', content: [{type: 'text', marks: [{type: 'bold'}], text: 'Review Plan'}]}]},
                        {type: 'tableCell', content: [{type: 'paragraph', content: [{type: 'text', marks: [{type: 'code'}], text: '/review-plan'}]}]},
                        {type: 'tableCell', content: [{type: 'paragraph', content: [{type: 'text', text: 'Multi-LLM plan validation'}]}]},
                    ],
                },
                {
                    type: 'tableRow',
                    content: [
                        {type: 'tableCell', content: [{type: 'paragraph', content: [{type: 'text', marks: [{type: 'bold'}], text: 'Code'}]}]},
                        {type: 'tableCell', content: [{type: 'paragraph', content: [{type: 'text', marks: [{type: 'code'}], text: '/create-code'}]}]},
                        {type: 'tableCell', content: [{type: 'paragraph', content: [{type: 'text', text: 'Implement from approved plan (TDD workflow)'}]}]},
                    ],
                },
            ],
        },

        {type: 'horizontalRule'},

        {type: 'heading', attrs: {level: 2}, content: [{type: 'text', text: '3. Workflow'}]},

        {type: 'heading', attrs: {level: 3}, content: [{type: 'text', text: 'Manual Flow (Recommended)'}]},

        {
            type: 'orderedList',
            attrs: {start: 1},
            content: [
                {type: 'listItem', content: [{type: 'paragraph', content: [{type: 'text', text: 'Plan Creation'}]}]},
                {type: 'listItem', content: [{type: 'paragraph', content: [{type: 'text', text: 'Plan Review (built into /create-plan)'}]}]},
                {type: 'listItem', content: [{type: 'paragraph', content: [{type: 'text', text: 'Plan Finalization'}]}]},
                {type: 'listItem', content: [{type: 'paragraph', content: [{type: 'text', text: 'Implementation'}]}]},
                {type: 'listItem', content: [{type: 'paragraph', content: [{type: 'text', text: 'Code Review'}]}]},
            ],
        },

        {
            type: 'blockquote',
            content: [
                {
                    type: 'paragraph',
                    content: [
                        {type: 'text', marks: [{type: 'bold'}], text: 'Important'},
                        {type: 'text', text: ': Always follow the research → plan → implement sequence.'},
                    ],
                },
            ],
        },

        {type: 'heading', attrs: {level: 3}, content: [{type: 'text', text: 'Task Lists'}]},

        {
            type: 'taskList',
            content: [
                {type: 'taskItem', attrs: {checked: true}, content: [{type: 'paragraph', content: [{type: 'text', text: 'Completed task'}]}]},
                {type: 'taskItem', attrs: {checked: false}, content: [{type: 'paragraph', content: [{type: 'text', text: 'Pending task'}]}]},
                {type: 'taskItem', attrs: {checked: true}, content: [{type: 'paragraph', content: [{type: 'text', text: 'Another completed task'}]}]},
            ],
        },

        {type: 'heading', attrs: {level: 3}, content: [{type: 'text', text: 'Code Examples'}]},

        {
            type: 'codeBlock',
            attrs: {language: 'javascript'},
            content: [{type: 'text', text: "import { foo } from 'bar';\n\nfunction example() {\n    const x = 1;\n    return x * 2;\n}"}],
        },

        {
            type: 'codeBlock',
            attrs: {language: 'python'},
            content: [{type: 'text', text: 'def hello():\n    print("Hello, World!")\n    return True'}],
        },

        {
            type: 'codeBlock',
            attrs: {language: 'typescript'},
            content: [{type: 'text', text: 'interface User {\n    name: string;\n    email: string;\n}'}],
        },

        {type: 'heading', attrs: {level: 3}, content: [{type: 'text', text: 'Links and Images'}]},

        {
            type: 'paragraph',
            content: [
                {type: 'text', text: 'Check the '},
                {type: 'text', marks: [{type: 'link', attrs: {href: 'https://docs.example.com'}}], text: 'documentation'},
                {type: 'text', text: ' for more info.'},
            ],
        },

        {
            type: 'paragraph',
            content: [
                {type: 'image', attrs: {src: 'https://example.com/logo.png', alt: 'Logo'}},
            ],
        },

        {type: 'heading', attrs: {level: 3}, content: [{type: 'text', text: 'Inline Formatting'}]},

        {
            type: 'paragraph',
            content: [
                {type: 'text', text: 'This text has '},
                {type: 'text', marks: [{type: 'bold'}], text: 'bold'},
                {type: 'text', text: ', '},
                {type: 'text', marks: [{type: 'italic'}], text: 'italic'},
                {type: 'text', text: ', '},
                {type: 'text', marks: [{type: 'strike'}], text: 'strikethrough'},
                {type: 'text', text: ', and '},
                {type: 'text', marks: [{type: 'code'}], text: 'inline code'},
                {type: 'text', text: '.'},
            ],
        },

        {
            type: 'paragraph',
            content: [
                {type: 'text', text: 'Combined: '},
                {type: 'text', marks: [{type: 'bold'}, {type: 'italic'}], text: 'bold and italic'},
                {type: 'text', text: ' text.'},
            ],
        },

        {type: 'heading', attrs: {level: 3}, content: [{type: 'text', text: 'Mentions'}]},

        {
            type: 'paragraph',
            content: [
                {type: 'text', text: 'Hey '},
                {type: 'mention', attrs: {id: 'john.doe', label: 'john.doe'}},
                {type: 'text', text: ' and '},
                {type: 'mention', attrs: {id: 'jane_smith', label: 'jane_smith'}},
                {type: 'text', text: ', please check '},
                {type: 'channelMention', attrs: {id: 'town-square', label: 'town-square'}},
                {type: 'text', text: ' for updates.'},
            ],
        },

        {type: 'heading', attrs: {level: 3}, content: [{type: 'text', text: 'Bullet List'}]},

        {
            type: 'bulletList',
            content: [
                {type: 'listItem', content: [{type: 'paragraph', content: [{type: 'text', text: 'First bullet item'}]}]},
                {type: 'listItem', content: [{type: 'paragraph', content: [{type: 'text', text: 'Second bullet item'}]}]},
                {type: 'listItem', content: [{type: 'paragraph', content: [{type: 'text', text: 'Third bullet item'}]}]},
            ],
        },

        {type: 'heading', attrs: {level: 3}, content: [{type: 'text', text: 'Unicode and Emoji'}]},

        {type: 'paragraph', content: [{type: 'text', text: 'Hello 世界! Welcome to the documentation 🎉'}]},
    ],
};

/**
 * Expected elements that MUST be present in the exported markdown.
 * Used to verify round-trip preservation.
 */
export const EXPECTED_MARKDOWN_ELEMENTS = [

    // Headings (note: 1. becomes 1\. to prevent list parsing)
    '# Claude Code Development System Architecture',
    '## 1\\. Prerequisites',
    '### CLI Tools',
    '### MCP Servers',

    // Code blocks with languages
    '```bash',
    '```javascript',
    '```python',
    '```typescript',
    'npm install -g @openai/codex',

    // Tables (compact format)
    '| MCP | Purpose |',
    '| --- | --- |',
    '`seq-server`',
    '`gemini-cli`',

    // Ordered lists (unescaped)
    '1.',
    '2.',
    '3.',
    'Plan Creation',
    'Implementation',

    // Task lists
    '[x] Completed task',
    '[ ] Pending task',

    // Horizontal rules
    '---',

    // Inline formatting
    '**bold**',
    '*italic*',
    '~~strikethrough~~',
    '`inline code`',

    // Links and images
    '[documentation](https://docs.example.com)',
    '![Logo](https://example.com/logo.png)',

    // Mentions
    '@john.doe',
    '@jane_smith',
    '~town-square',

    // Bullet list
    '- First bullet item',
    '- Second bullet item',

    // Unicode
    'Hello 世界',
    '🎉',

    // Blockquote
    '>',
    'Important',
];

/**
 * Elements that should NOT appear in the exported markdown.
 * These indicate bugs in the round-trip process.
 *
 * Note: Escaped periods like 1\. are NOT bugs - they're valid markdown
 * that prevents numbers from being interpreted as list items.
 */
export const FORBIDDEN_MARKDOWN_ELEMENTS = [

    // Double newlines inside table rows (indicates broken table formatting)
    '|\n\n|',
];
