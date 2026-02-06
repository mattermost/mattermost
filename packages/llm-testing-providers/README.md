# LLM Testing Providers

Framework-agnostic library for integrating Language Learning Models (LLMs) into test automation frameworks.

## Overview

`@mattermost/llm-testing-providers` provides a unified interface for working with multiple LLM providers:

- **Anthropic Claude** - Premium quality, vision support, fast responses
- **Ollama** - Free, local execution, privacy-first
- **OpenAI** - Coming soon
- **Custom providers** - Extensible architecture for any OpenAI-compatible API

## Features

- 🔌 **Pluggable architecture** - Switch providers without changing application code
- 💰 **Cost-aware** - Track token usage and estimate costs
- 🎨 **Vision support** - Analyze screenshots and images (Claude)
- ⚡ **Streaming** - Real-time text generation
- 🔀 **Hybrid mode** - Mix free and premium providers for cost optimization
- 📊 **Usage stats** - Monitor requests, tokens, costs, and performance

## Installation

```bash
npm install @mattermost/llm-testing-providers
```

## Quick Start

### Basic Usage

```typescript
import { AnthropicProvider, OllamaProvider } from '@mattermost/llm-testing-providers';

// Use Anthropic Claude
const claude = new AnthropicProvider({
    apiKey: process.env.ANTHROPIC_API_KEY
});

const response = await claude.generateText('Explain quantum computing');
console.log(response.text);
console.log(`Cost: $${response.cost.toFixed(4)}`);

// Use Ollama (free, local)
const ollama = new OllamaProvider({
    model: 'deepseek-r1:7b'
});

const response = await ollama.generateText('What is 2+2?');
console.log(response.text); // Free!
```

### Factory Pattern

```typescript
import { LLMProviderFactory } from '@mattermost/llm-testing-providers';

// Auto-detect from environment
const provider = await LLMProviderFactory.createFromEnv();

// Create specific provider
const anthropic = LLMProviderFactory.create({
    type: 'anthropic',
    config: { apiKey: process.env.ANTHROPIC_API_KEY }
});

// Create from string
const ollama = LLMProviderFactory.createFromString('ollama:deepseek-r1:14b');
```

### Hybrid Mode (Free + Premium)

```typescript
import { LLMProviderFactory } from '@mattermost/llm-testing-providers';

// Use free Ollama for most tasks, fall back to Claude for vision
const provider = LLMProviderFactory.createHybrid({
    primary: {
        type: 'ollama',
        config: { model: 'deepseek-r1:7b' }
    },
    fallback: {
        type: 'anthropic',
        config: { apiKey: process.env.ANTHROPIC_API_KEY }
    },
    useFallbackFor: ['vision'] // Only use Claude for image analysis
});

// This uses Ollama (free)
const text = await provider.generateText('Analyze this code');

// This uses Claude (vision capability)
const analysis = await provider.analyzeImage([...], 'Compare these screenshots');

// Check cost savings
const breakdown = (provider as any).getProviderBreakdown();
console.log(breakdown.costSavings); // e.g., "$45.23 saved (75% reduction)"
```

### Vision Analysis

```typescript
const claude = new AnthropicProvider({
    apiKey: process.env.ANTHROPIC_API_KEY
});

const response = await claude.analyzeImage(
    [{
        data: fs.readFileSync('screenshot.png', 'base64'),
        mimeType: 'image/png',
        description: 'Login page screenshot'
    }],
    'Does this match our design spec? Any accessibility issues?'
);

console.log(response.text);
console.log(`Vision analysis cost: $${response.cost.toFixed(4)}`);
```

### Streaming

```typescript
const provider = new OllamaProvider();

for await (const chunk of provider.streamText('Write a poem')) {
    process.stdout.write(chunk); // Real-time output
}
```

## Provider Comparison

| Feature | Anthropic Claude | Ollama | OpenAI |
|---------|------------------|--------|--------|
| Vision | ✅ Yes | ❌ No | ⚠️ Limited |
| Cost | $3-15 per 1M tokens | Free | $0.01-0.06 per 1K tokens |
| Speed | ~800ms | ~3000ms | ~1200ms |
| Streaming | ✅ Yes | ✅ Yes | ✅ Yes |
| Local | ❌ No | ✅ Yes | ❌ No |
| Setup | API key | Local install | API key |

## Cost Optimization

### Hybrid Strategy

Use Ollama for ~80% of requests (free) and Claude for ~20% (vision, complex tasks):

```
Pure Claude:  $80/month
Pure Ollama:  $0/month (no vision)
Hybrid:       $20/month ← 75% savings!
```

### Usage Statistics

```typescript
const stats = provider.getUsageStats();
console.log(`Requests: ${stats.requestCount}`);
console.log(`Total tokens: ${stats.totalTokens.toLocaleString()}`);
console.log(`Total cost: $${stats.totalCost.toFixed(2)}`);
console.log(`Avg response: ${stats.averageResponseTimeMs.toFixed(0)}ms`);
console.log(`Failed: ${stats.failedRequests}`);
```

## Environment Variables

```bash
# Provider selection
LLM_PROVIDER=anthropic           # or 'ollama'
ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_MODEL=claude-sonnet-4-5-20250929

# Ollama configuration
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=deepseek-r1:7b
```

## Setup Guides

### Anthropic Claude

```bash
# 1. Get API key from https://console.anthropic.com
# 2. Set environment variable
export ANTHROPIC_API_KEY=sk-ant-...

# 3. Test
node -e "
import { checkAnthropicSetup } from '@mattermost/llm-testing-providers';
const result = await checkAnthropicSetup(process.env.ANTHROPIC_API_KEY);
console.log(result);
"
```

### Ollama (Free, Local)

```bash
# 1. Install Ollama
curl -fsSL https://ollama.com/install.sh | sh

# 2. Pull a model
ollama pull deepseek-r1:7b

# 3. Start Ollama (runs on localhost:11434)
ollama serve

# 4. Test
node -e "
import { checkOllamaSetup } from '@mattermost/llm-testing-providers';
const result = await checkOllamaSetup();
console.log(result);
"
```

## Error Handling

```typescript
import { LLMProviderError, UnsupportedCapabilityError } from '@mattermost/llm-testing-providers';

try {
    const response = await provider.analyzeImage([...], 'Analyze this');
} catch (error) {
    if (error instanceof UnsupportedCapabilityError) {
        console.log(`Provider doesn't support vision, trying fallback...`);
    } else if (error instanceof LLMProviderError) {
        console.log(`API error: ${error.message}`);
        console.log(`Provider: ${error.provider}`);
        console.log(`Status: ${error.statusCode}`);
    }
}
```

## License

Apache 2.0 - See LICENSE.txt

## Contributing

Contributions welcome! Please follow Mattermost contributor guidelines.

## Support

- **Issues**: GitHub Issues
- **Documentation**: https://github.com/mattermost/mattermost
- **Community**: https://mattermost.com/community
