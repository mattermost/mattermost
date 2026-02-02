#!/usr/bin/env npx tsx
// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * Autonomous Testing CLI
 *
 * A complete test automation pipeline that:
 * 1. Explores the UI using Playwright's accessibility tree
 * 2. Generates tests based on UI context + specifications
 * 3. Runs the tests
 * 4. Heals failing tests automatically
 *
 * Usage:
 *   npx tsx autonomous-cli.ts generate "auto-translation" --scenarios 5
 *   npx tsx autonomous-cli.ts heal specs/functional/ai-assisted/
 *   npx tsx autonomous-cli.ts run specs/functional/ai-assisted/
 */

import {existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync} from 'fs';
import {resolve, join, basename, dirname} from 'path';
import {execSync, spawn, spawnSync} from 'child_process';

import {config, getBaseUrl, getCredentials} from './autonomous-config';

// =============================================================================
// ARGUMENT PARSING
// =============================================================================

interface ParsedArgs {
    command: string;
    feature?: string;
    specFile?: string;
    scenarios?: number;
    outputDir?: string;
    dryRun?: boolean;
    baseUrl?: string;
    headless?: boolean; // Default is headed, use --headless to disable
    browser?: 'chrome' | 'chromium' | 'firefox' | 'webkit'; // Default is chrome
    project?: string; // Playwright project to use
    parallel?: boolean; // Run exploration/healing in parallel
    verbose?: boolean; // Show detailed logs
}

function parseArgs(): ParsedArgs {
    const args = process.argv.slice(2);
    const result: ParsedArgs = {command: args[0] || 'help', browser: 'chrome'};

    for (let i = 1; i < args.length; i++) {
        const arg = args[i];

        if (arg === '--spec' || arg === '-s') {
            result.specFile = args[++i];
        } else if (arg === '--scenarios' || arg === '-n') {
            result.scenarios = parseInt(args[++i], 10);
        } else if (arg === '--output' || arg === '-o') {
            result.outputDir = args[++i];
        } else if (arg === '--dry-run') {
            result.dryRun = true;
        } else if (arg === '--base-url' || arg === '-u') {
            result.baseUrl = args[++i];
        } else if (arg === '--headless') {
            result.headless = true;
        } else if (arg === '--browser' || arg === '-b') {
            result.browser = args[++i] as 'chrome' | 'chromium' | 'firefox' | 'webkit';
        } else if (arg === '--project' || arg === '-p') {
            result.project = args[++i];
        } else if (arg === '--parallel') {
            result.parallel = true;
        } else if (arg === '--verbose' || arg === '-v') {
            result.verbose = true;
        } else if (!arg.startsWith('-') && !result.feature) {
            result.feature = arg;
        }
    }

    return result;
}

// =============================================================================
// INPUT VALIDATION
// =============================================================================

/**
 * Validate that a path does not contain directory traversal sequences
 */
function isPathSafe(filePath: string): boolean {
    const normalized = resolve(filePath);
    // Check for directory traversal patterns
    if (filePath.includes('..')) {
        return false;
    }
    return true;
}

/**
 * Validate input arguments and throw if invalid
 */
function validateArgs(parsedArgs: ParsedArgs): void {
    // Validate scenarios is a positive number
    if (parsedArgs.scenarios !== undefined) {
        if (isNaN(parsedArgs.scenarios) || parsedArgs.scenarios < 1) {
            throw new Error('--scenarios must be a positive number (>= 1)');
        }
    }

    // Validate spec file path is safe and exists (when provided)
    if (parsedArgs.specFile) {
        if (!isPathSafe(parsedArgs.specFile)) {
            throw new Error('Spec file path contains invalid path traversal');
        }
        if (!existsSync(resolve(parsedArgs.specFile))) {
            throw new Error(`Spec file not found: ${parsedArgs.specFile}`);
        }
    }

    // Validate output directory path is safe (when provided)
    if (parsedArgs.outputDir) {
        if (!isPathSafe(parsedArgs.outputDir)) {
            throw new Error('Output directory path contains invalid path traversal');
        }
    }

    // Validate base URL format (when provided)
    if (parsedArgs.baseUrl) {
        try {
            new URL(parsedArgs.baseUrl);
        } catch {
            throw new Error(`Invalid base URL format: ${parsedArgs.baseUrl}`);
        }
    }

    // Validate browser is valid
    if (parsedArgs.browser) {
        const validBrowsers = ['chrome', 'chromium', 'firefox', 'webkit'];
        if (!validBrowsers.includes(parsedArgs.browser)) {
            throw new Error(`Invalid browser: ${parsedArgs.browser}. Valid options: ${validBrowsers.join(', ')}`);
        }
    }
}

// =============================================================================
// HELP
// =============================================================================

function printHelp(): void {
    console.log(`
Autonomous Testing CLI - Explore, Generate, Run, Heal
======================================================

A complete test automation pipeline using Playwright + AI.

COMMANDS:
  auto <spec>          Full pipeline: convert → generate → run → heal
  generate <feature>   Explore UI → Generate tests → Run → Heal
  heal <test-path>     Fix failing tests automatically
  run <test-path>      Run tests and show results
  explore <feature>    Explore UI based on feature hints
  convert <spec>       Convert PDF/MD spec to Playwright markdown

  mcp-plan <spec>      Show instructions for @planner agent (Claude Code)
  mcp-generate <spec>  Show instructions for @generator agent (Claude Code)
  mcp-heal <path>      Show instructions for @healer agent (Claude Code)

OPTIONS:
  --spec, -s <file>    Specification file (PDF, MD, or JSON)
  --scenarios, -n <N>  Number of scenarios to generate (default: 5)
  --output, -o <dir>   Output directory
  --base-url, -u <url> Base URL to test (default: http://localhost:8065)
  --headless           Run browser in headless mode (default: headed)
  --browser, -b <name> Browser: chrome (default), chromium, firefox, webkit
  --project, -p <name> Playwright project (e.g., chrome, iphone)
  --verbose, -v        Show detailed logs
  --dry-run            Preview without writing/running

EXAMPLES:
  # Full autonomous pipeline from PDF spec
  npx tsx autonomous-cli.ts auto --spec "UX-Spec.pdf" --scenarios 5

  # Generate tests from feature description
  npx tsx autonomous-cli.ts generate "auto-translation" --scenarios 5

  # Generate from markdown spec
  npx tsx autonomous-cli.ts generate --spec specs/auto-translation.md

  # Fix failing tests
  npx tsx autonomous-cli.ts heal specs/functional/ai-assisted/

  # Run tests
  npx tsx autonomous-cli.ts run specs/functional/ai-assisted/ --project chrome

  # Convert PDF to markdown spec
  npx tsx autonomous-cli.ts convert "UX-Spec.pdf"

OUTPUT:
  Generated tests are saved to: specs/functional/ai-assisted/<feature>/

ENVIRONMENT:
  ANTHROPIC_API_KEY           Required for AI features
  AUTONOMOUS_ALLOW_PDF_UPLOAD Required for PDF specs (set to 'true')
  PW_BASE_URL                 Base URL (default: http://localhost:8065)
  MM_USERNAME                 Login username (default: sysadmin)
  MM_PASSWORD                 Login password (default: Sys@dmin-sample1)
`);
}

// =============================================================================
// UI EXPLORATION (using Playwright accessibility tree)
// =============================================================================

interface ExploreOptions {
    headless?: boolean;
    login?: {
        username: string;
        password: string;
    };
}

/**
 * Cookie structure required by Playwright's storageState
 */
interface PlaywrightCookie {
    name: string;
    value: string;
    domain: string;
    path: string;
    expires: number;
    httpOnly: boolean;
    secure: boolean;
    sameSite: 'Strict' | 'Lax' | 'None';
}

/**
 * Login via API and get storage state (like the real tests do)
 * This bypasses the landing page by setting __landingPageSeen__ in localStorage
 */
async function loginViaAPI(
    baseUrl: string,
    username: string,
    password: string,
): Promise<{
    cookies: PlaywrightCookie[];
    localStorage: Array<{name: string; value: string}>;
    token: string;
    defaultTeam: string;
    userId: string;
}> {
    const response = await fetch(`${baseUrl}/api/v4/users/login`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
        },
        body: JSON.stringify({
            login_id: username,
            password: password,
            token: '',
            deviceId: '',
        }),
    });

    if (!response.ok) {
        throw new Error(`Login failed: ${response.status} ${response.statusText}`);
    }

    // Get user data from response body
    const userData = await response.json();
    const userId = userData.id;

    // Get token from response header
    const token = response.headers.get('token') || '';

    if (!token) {
        throw new Error('No auth token received from login');
    }

    // Fetch user's teams to get default team
    const teamsResponse = await fetch(`${baseUrl}/api/v4/users/me/teams`, {
        headers: {
            'Authorization': `Bearer ${token}`,
        },
    });

    if (!teamsResponse.ok) {
        throw new Error(`Failed to fetch teams: ${teamsResponse.status}`);
    }

    const teams = await teamsResponse.json();
    if (!teams || teams.length === 0) {
        throw new Error('User has no teams');
    }

    const defaultTeam = teams[0].name; // First team is default

    // Node.js fetch doesn't expose Set-Cookie properly, so we get token from header
    // and construct cookies manually
    const cookies: PlaywrightCookie[] = [];
    const domain = new URL(baseUrl).hostname;
    const isSecure = baseUrl.startsWith('https');

    // Default cookie properties
    const cookieDefaults = {
        domain,
        path: '/',
        expires: -1, // Session cookie
        httpOnly: true,
        secure: isSecure,
        sameSite: 'Lax' as const,
    };

    // Add auth token cookie
    if (token) {
        cookies.push({
            name: 'MMAUTHTOKEN',
            value: token,
            ...cookieDefaults,
        });
    }

    // Add user ID cookie
    if (userId) {
        cookies.push({
            name: 'MMUSERID',
            value: userId,
            ...cookieDefaults,
            httpOnly: false, // MMUSERID is not httpOnly
        });
    }

    // Also try parsing Set-Cookie header as fallback (works in some Node versions)
    const setCookieHeader = response.headers.get('set-cookie') || '';
    if (!token && setCookieHeader) {
        const tokenMatch = setCookieHeader.match(/MMAUTHTOKEN=([^;]+)/);
        if (tokenMatch) {
            cookies.push({
                name: 'MMAUTHTOKEN',
                value: tokenMatch[1],
                ...cookieDefaults,
            });
        }
    }

    // Return localStorage to bypass landing page
    const localStorage = [{name: '__landingPageSeen__', value: 'true'}];

    return {cookies, localStorage, token, defaultTeam, userId};
}

// =============================================================================
// TEST GENERATION WITH UI CONTEXT
// =============================================================================

async function generateWithUIContext(parsedArgs: ParsedArgs): Promise<string> {
    const {feature, specFile, scenarios = config.defaults.scenarios} = parsedArgs;
    const baseUrl = getBaseUrl(parsedArgs.baseUrl);

    if (!feature && !specFile) {
        throw new Error('Please provide a feature description or --spec file');
    }

    if (!process.env.ANTHROPIC_API_KEY) {
        throw new Error('ANTHROPIC_API_KEY environment variable is required');
    }

    // Get credentials from config
    const {username, password} = getCredentials();

    // Step 1: Process spec FIRST to understand what to explore
    let specContent = '';
    let featureContext = feature || '';

    if (specFile) {
        console.log('\n📄 Step 1: Processing specification...');
        specContent = await processSpecFile(specFile);
        console.log(`  ✓ Extracted feature requirements from spec`);

        // Extract feature name/context from spec if not provided
        if (!feature) {
            featureContext = extractFeatureFromSpec(specContent);
            console.log(`  ✓ Feature identified: ${featureContext}`);
        }
    }

    // Step 2: Explore application UI organically
    console.log('\n📱 Step 2: Exploring application UI organically...');
    console.log(`  Feature hints: ${featureContext}`);

    let uiContext = '';
    try {
        const snapshot = await exploreOrganically(baseUrl, {
            headless: parsedArgs.headless,
            login: {username, password},
            featureHints: featureContext,
            browser: parsedArgs.browser,
            maxDepth: parsedArgs.parallel ? config.exploration.parallelMaxDepth : config.exploration.maxDepth,
            maxPages: config.exploration.maxPages,
            verbose: parsedArgs.verbose,
        });
        uiContext = snapshot;
        console.log(`  ✓ Organic exploration complete`);
    } catch (e) {
        const error = e as Error;
        console.log(`  ⚠️  Could not explore UI: ${error.message}`);
        if (parsedArgs.verbose) {
            console.log(`  Stack: ${error.stack}`);
        }
        console.log('  ℹ️  Continuing with repo patterns only');
    }

    // Step 3: Get repo context
    console.log('\n📚 Step 3: Loading repo patterns...');
    const repoContext = await getRepoContext();

    // Step 4: Generate tests with full context
    console.log('\n🤖 Step 4: Generating tests with AI...');
    const prompt = buildFullContextPrompt({
        feature: featureContext || 'Feature from specification',
        specContent,
        uiContext,
        repoContext,
        scenarios,
        baseUrl,
    });

    const {AnthropicProvider} = await import('./lib/src/autonomous/llm/anthropic_provider');
    const provider = new AnthropicProvider({
        apiKey: process.env.ANTHROPIC_API_KEY!,
        model: config.ai.model,
    });

    const response = await provider.generateText(prompt, {
        maxTokens: config.ai.maxTokens,
        temperature: config.ai.temperature,
    });

    return extractCodeFromResponse(response.text);
}

/**
 * Extract feature name from spec content
 */
function extractFeatureFromSpec(specContent: string): string {
    // Look for feature name patterns
    const patterns = [
        /Feature:\s*(.+?)(?:\n|$)/i,
        /^#\s*(.+?)(?:\n|$)/m,
        /name['":\s]+(.+?)(?:['"\n,}])/i,
    ];

    for (const pattern of patterns) {
        const match = specContent.match(pattern);
        if (match) {
            return match[1].trim().slice(0, 100);
        }
    }

    return 'Feature from specification';
}

interface OrganicExploreOptions {
    headless?: boolean;
    login: {username: string; password: string};
    featureHints: string;
    browser?: 'chrome' | 'chromium' | 'firefox' | 'webkit';
    maxDepth?: number;
    maxPages?: number;
    verbose?: boolean;
}

/**
 * Organically explore UI by clicking relevant links and discovering pages
 * Uses BFS to explore pages based on feature hints
 */
async function exploreOrganically(
    baseUrl: string,
    options: OrganicExploreOptions
): Promise<string> {
    const playwright = await import('playwright');
    const verbose = options.verbose ?? false;
    const maxDepth = options.maxDepth ?? 2;
    const maxPages = options.maxPages ?? 10;

    // Launch browser
    let browser;
    if (options.browser === 'chrome') {
        browser = await playwright.chromium.launch({
            headless: options.headless ?? false,
            channel: 'chrome',
        });
        if (verbose) console.log('  Browser: Google Chrome');
    } else if (options.browser === 'firefox') {
        browser = await playwright.firefox.launch({headless: options.headless ?? false});
        if (verbose) console.log('  Browser: Firefox');
    } else if (options.browser === 'webkit') {
        browser = await playwright.webkit.launch({headless: options.headless ?? false});
        if (verbose) console.log('  Browser: WebKit');
    } else {
        browser = await playwright.chromium.launch({headless: options.headless ?? false});
        if (verbose) console.log('  Browser: Chromium');
    }

    try {
        // Login and get starting point
        console.log(`  Logging in as ${options.login.username} via API...`);
        const {cookies, localStorage, defaultTeam} = await loginViaAPI(
            baseUrl,
            options.login.username,
            options.login.password
        );
        console.log(`  ✓ Got default team: ${defaultTeam}`);

        const context = await browser.newContext({
            storageState: {
                cookies,
                origins: [{origin: baseUrl, localStorage}],
            },
        });

        const page = await context.newPage();

        // Start at authenticated page
        const startUrl = `${baseUrl}/${defaultTeam}/channels/town-square`;
        console.log(`  Navigating to authenticated page: ${startUrl}`);
        await page.goto(startUrl, {waitUntil: 'networkidle', timeout: 30000});
        await page.waitForTimeout(2000);

        // Verify we're actually logged in
        if (page.url().includes('/login')) {
            throw new Error('Authentication failed - redirected to login page');
        }

        console.log(`  ✓ Starting exploration from: ${page.url()}`);

        // Track what we've seen
        const discoveries: Array<{url: string; depth: number; title: string; elements: any[]; text: string; interactions: string[]}> = [];
        const visited = new Set<string>();
        const queue: Array<{url: string; depth: number}> = [
            {url: page.url(), depth: 0}
        ];

        // BFS exploration
        while (queue.length > 0 && discoveries.length < maxPages) {
            const {url, depth} = queue.shift()!;

            if (visited.has(url) || depth > maxDepth) continue;
            visited.add(url);

            if (verbose) {
                console.log(`  [Depth ${depth}] Exploring: ${url}`);
            }

            // Navigate to page
            try {
                await page.goto(url, {waitUntil: 'networkidle', timeout: 15000});
                await page.waitForTimeout(1000);
            } catch (e) {
                if (verbose) console.log(`  ⚠️  Navigation failed: ${(e as Error).message}`);
                continue;
            }

            // Capture page state
            const snapshot = await capturePageSnapshot(page, options.featureHints);
            discoveries.push({
                url,
                depth,
                ...snapshot,
            });

            // Find clickable elements that might be relevant
            if (depth < maxDepth) {
                const links = await findRelevantLinks(page, options.featureHints);

                for (const link of links) {
                    if (!visited.has(link.href) && discoveries.length < maxPages) {
                        queue.push({url: link.href, depth: depth + 1});
                    }
                }
            }
        }

        await browser.close();

        console.log(`  ✓ Explored ${discoveries.length} pages`);

        return JSON.stringify({
            teamName: defaultTeam,
            startUrl,
            featureContext: options.featureHints,
            discoveries,
        }, null, 2);

    } catch (error) {
        await browser.close();
        throw error;
    }
}

/**
 * Helper to find relevant links on current page based on feature hints
 */
async function findRelevantLinks(
    page: any,
    featureHints: string
): Promise<Array<{href: string; text: string}>> {
    const links = await page.locator('a[href^="/"], button[data-href]').all();
    const relevant: Array<{href: string; text: string}> = [];
    const hints = featureHints.toLowerCase().split(/\s+/);

    for (const link of links.slice(0, 50)) { // Limit to first 50 links
        try {
            const text = await link.textContent({timeout: 1000});
            const href = await link.getAttribute('href') ||
                        await link.getAttribute('data-href');

            if (!href || !text) continue;

            // Check if link is relevant to feature
            const combined = `${text} ${href}`.toLowerCase();
            const isRelevant = hints.some(hint =>
                hint.length > 3 && combined.includes(hint)
            );

            if (isRelevant) {
                // Make href absolute using URL API for safety
                let absoluteHref: string;
                if (href.startsWith('http')) {
                    absoluteHref = href;
                } else {
                    try {
                        const pageUrl = new URL(page.url());
                        absoluteHref = `${pageUrl.origin}${href}`;
                    } catch {
                        // If URL parsing fails, skip this link
                        continue;
                    }
                }

                relevant.push({href: absoluteHref, text: text.trim()});
            }
        } catch (e) {
            // Skip this link
        }
    }

    return relevant;
}

/**
 * Capture a detailed snapshot of the current page
 */
async function capturePageSnapshot(page: any, featureHints: string): Promise<{title: string; elements: any[]; text: string; interactions: string[]}> {
    const title = await page.title();

    // Get interactive elements with test IDs and aria labels
    const elements = await page.evaluate(() => {
        const results: Array<{tag: string; text: string; role: string; testId?: string; ariaLabel?: string; className?: string}> = [];
        const selectors = 'button, a, input, select, textarea, [role="button"], [role="link"], [role="menuitem"], [role="tab"], [data-testid], .post, .post-message, [class*="translate"], [class*="language"]';

        document.querySelectorAll(selectors).forEach((el) => {
            const text = (el as HTMLElement).innerText?.slice(0, 100) || '';
            const role = el.getAttribute('role') || el.tagName.toLowerCase();
            const testId = el.getAttribute('data-testid') || undefined;
            const ariaLabel = el.getAttribute('aria-label') || undefined;
            const className = el.className?.toString().slice(0, 100) || undefined;

            if (text.trim() || testId || ariaLabel) {
                results.push({
                    tag: el.tagName.toLowerCase(),
                    text: text.trim(),
                    role,
                    testId,
                    ariaLabel,
                    className,
                });
            }
        });

        return results.slice(0, 150);
    });

    // Get visible text
    const text = await page.evaluate(() => {
        const body = document.body;
        return body ? body.innerText.slice(0, 4000) : '';
    });

    return {title, elements, text, interactions: []};
}

/**
 * Try to interact with elements related to the feature
 */
async function processSpecFile(specFile: string): Promise<string> {
    const resolvedPath = resolve(specFile);
    if (!existsSync(resolvedPath)) {
        throw new Error(`Spec file not found: ${resolvedPath}`);
    }

    if (specFile.endsWith('.pdf')) {
        if (!process.env.AUTONOMOUS_ALLOW_PDF_UPLOAD) {
            throw new Error('Set AUTONOMOUS_ALLOW_PDF_UPLOAD=true for PDF specs');
        }

        const {createAnthropicBridge} = await import('./lib/src/spec-bridge');
        const bridge = createAnthropicBridge(process.env.ANTHROPIC_API_KEY!, 'specs');
        const result = await bridge.convertToPlaywrightSpecs(resolvedPath);

        return result.features
            .map(
                (f) =>
                    `Feature: ${f.name}\n${f.description}\n\nScenarios:\n${f.scenarios.map((s) => `- ${s.name}: Given ${s.given}, When ${s.when}, Then ${s.then}`).join('\n')}`,
            )
            .join('\n\n');
    }

    return readFileSync(resolvedPath, 'utf-8');
}

async function getRepoContext(): Promise<string> {
    const contextParts: string[] = [];
    const basePath = __dirname;

    // Include example test files
    const exampleTests = [
        'specs/functional/channels/channel_banner/channel_banner.spec.ts',
        'specs/functional/channels/scheduled_messages/scheduled_messages.spec.ts',
    ];

    for (const testPath of exampleTests) {
        const fullPath = join(basePath, testPath);
        if (existsSync(fullPath)) {
            // Only include first 100 lines of each example
            const content = readFileSync(fullPath, 'utf-8').split('\n').slice(0, 100).join('\n');
            contextParts.push(`\n--- Example Test: ${testPath} ---\n${content}`);
        }
    }

    // Include page object definitions
    const pageObjects = [
        {path: 'lib/src/ui/pages/channels.ts', name: 'ChannelsPage', lines: 200},
        {path: 'lib/src/ui/components/channels/channel_settings/channel_settings_modal.ts', name: 'ChannelSettingsModal', lines: 100},
        {path: 'lib/src/ui/components/channels/channel_settings/configuration_settings.ts', name: 'ConfigurationSettings', lines: 100},
    ];

    for (const {path, name, lines} of pageObjects) {
        const fullPath = join(basePath, path);
        if (existsSync(fullPath)) {
            const content = readFileSync(fullPath, 'utf-8').split('\n').slice(0, lines).join('\n');
            contextParts.push(`\n--- Page Object: ${name} ---\n${content}`);
        }
    }

    // Add explicit API documentation
    contextParts.push(`
--- AVAILABLE APIs SUMMARY ---

ChannelsPage methods:
- goto(teamName?, channelName?) - navigate to channel
- toBeVisible() - wait for page
- postMessage(message, files?) - post message
- getLastPost() - returns ChannelsPost
- replyToLastPost(message) - reply in thread, returns {rootPost, sidebarRight, lastPost}
- openChannelSettings() - returns ChannelSettingsModal
- openSettings() - returns SettingsModal
- newChannel(name, type) - create channel
- openUserAccountMenu() - returns UserAccountMenu

ChannelSettingsModal methods:
- toBeVisible()
- close()
- openInfoTab() - returns InfoSettings
- openConfigurationTab() - returns ConfigurationSettings

ConfigurationSettings methods (ONLY THESE EXIST):
- toBeVisible()
- save()
- enableChannelBanner()
- disableChannelBanner()
- setChannelBannerText(text)
- setChannelBannerTextColor(color)

NOTE: If a feature needs methods that DON'T EXIST above, either:
1. Add a TODO comment explaining the missing method
2. Use this.container.locator() or this.container.getByTestId() patterns
`);

    return contextParts.join('\n');
}

function buildFullContextPrompt(options: {
    feature: string;
    specContent: string;
    uiContext: string;
    repoContext: string;
    scenarios: number;
    baseUrl: string;
}): string {
    // Check if scenarios.md exists (from plan-from-pdf command)
    let plannedScenarios = '';
    try {
        const scenariosPath = '.claude/scenarios.md';
        if (existsSync(scenariosPath)) {
            plannedScenarios = readFileSync(scenariosPath, 'utf-8');
        }
    } catch (e) {
        // Scenarios file doesn't exist, continue without it
    }

    return `You are a Playwright test generator for Mattermost. Generate ${options.scenarios} test scenarios.

FEATURE TO TEST:
${options.feature}

${options.specContent ? `SPECIFICATION:\n${options.specContent}\n` : ''}

${plannedScenarios ? `PLANNED SCENARIOS (from @playwright-test-planner):\n${plannedScenarios}\n` : ''}

${options.uiContext ? `LIVE UI CONTEXT (accessibility snapshots from the running app):\n${options.uiContext}\n` : ''}

MATTERMOST E2E FRAMEWORK PATTERNS (MUST FOLLOW EXACTLY):
${options.repoContext}

CRITICAL RULES - READ CAREFULLY:

1. IMPORTS - Use ONLY these imports:
   \`\`\`typescript
   import {expect, test} from '@mattermost/playwright-lib';
   import type {ChannelsPage} from '@mattermost/playwright-lib';
   \`\`\`

2. TEST SETUP - Use this exact pattern:
   \`\`\`typescript
   const {user, adminUser, adminClient, team} = await pw.initSetup();
   const {page, channelsPage} = await pw.testBrowser.login(user);
   await channelsPage.goto();
   await channelsPage.toBeVisible();
   \`\`\`

3. AVAILABLE PAGE OBJECT METHODS (use ONLY these - DO NOT invent new methods):
   - channelsPage.goto(teamName?, channelName?) - navigate to channel
   - channelsPage.toBeVisible() - wait for page to load
   - channelsPage.postMessage(message) - post a message
   - channelsPage.getLastPost() - get last post component
   - channelsPage.replyToLastPost(message) - reply in thread
   - channelsPage.openChannelSettings() - opens ChannelSettingsModal
   - channelsPage.openSettings() - opens SettingsModal
   - channelsPage.newChannel(name, type) - create channel ('O'=public, 'P'=private)
   - channelsPage.openUserAccountMenu() - opens user menu

4. AVAILABLE COMPONENTS (access via channelsPage.xxx):
   - channelsPage.centerView - main channel view
   - channelsPage.sidebarLeft - left sidebar with channels
   - channelsPage.sidebarRight - thread view
   - channelsPage.channelSettingsModal - channel settings dialog
   - channelsPage.settingsModal - user settings dialog
   - channelsPage.postDotMenu - post actions menu

5. POST METHODS (from channelsPage.getLastPost()):
   - post.container - the post element
   - post.body - post content
   - post.hover() - hover over post
   - post.reply() - open thread

6. NEVER DO THESE:
   - DO NOT use page.locator() for inline selectors - use existing components
   - DO NOT invent methods like "configurationTab.enableAutoTranslation()"
   - DO NOT use pw.page - use the page returned from login
   - DO NOT use non-existent duration values like "five_sec"

7. DURATION VALUES (use ONLY these exact values with pw.duration.xxx):
   - half_sec (500ms), one_sec (1s), two_sec (2s), four_sec (4s), ten_sec (10s)
   - half_min (30s), one_min (1m), two_min (2m), four_min (4m)
   - DO NOT USE: five_sec, three_sec, fifteen_sec (these DO NOT exist!)

8. UTILITY FUNCTIONS:
   - pw.random.id() - generate random ID
   - pw.wait(pw.duration.xxx) - explicit wait (use sparingly)
   - pw.waitUntil(async () => boolean, {timeout}) - wait for condition
   - pw.duration.xxx - timing constants (ONLY the values listed above)

9. LICENSE AND FEATURE FLAG PATTERNS:
   \`\`\`typescript
   // For licensed features:
   test.beforeEach(async ({pw}) => {
       await pw.ensureLicense();
       await pw.skipIfNoLicense();
   });

   // For feature flags - USE THIS for features behind flags:
   test.beforeEach(async ({pw}) => {
       await pw.skipIfFeatureFlagNotSet('FeatureFlagName'); // e.g., 'AutoTranslation'
   });
   \`\`\`

10. IF A FEATURE DOESN'T HAVE EXISTING PAGE OBJECT SUPPORT:
    - Add a TODO comment explaining what component/method would be needed
    - Use basic interactions via page object where possible
    - DO NOT create complex inline locator chains

EXAMPLE OF CORRECT TEST:
\`\`\`typescript
test('User can post a message', async ({pw}) => {
    const {user} = await pw.initSetup();
    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto();
    await channelsPage.toBeVisible();

    const message = \`Test message \${pw.random.id()}\`;
    await channelsPage.postMessage(message);

    await pw.waitUntil(
        async () => {
            const post = await channelsPage.getLastPost();
            const content = await post.container.textContent();
            return content?.includes(message);
        },
        {timeout: pw.duration.ten_sec},
    );

    const lastPost = await channelsPage.getLastPost();
    await expect(lastPost.body).toContainText(message);
});
\`\`\`

MATTERMOST FRAMEWORK CONVENTIONS (CRITICAL):
- File naming: kebab-case (e.g., auto-translation.spec.ts)
- Class naming: PascalCase (e.g., ChannelSettingsPage)
- Method naming: camelCase (e.g., openChannelSettings)
- Test structure: Use test.describe() for feature grouping, test() for individual tests
- Assertions: Prefer Playwright's expect() with locator matchers
- Test isolation: Each test should be independent, setup via initSetup()
- License features: Use pw.skipIfNoLicense() in beforeEach
- Feature flags: Use pw.skipIfFeatureFlagNotSet('FlagName') in beforeEach
- Random data: Always use pw.random.id() for unique identifiers
- Waits: Use pw.waitUntil() for conditions, avoid arbitrary timeouts

WHEN SCENARIOS PROVIDED FROM @playwright-test-planner:
- Use the planned scenarios as a guide for test structure
- Follow the Given-When-Then structure from scenarios
- Expand scenarios with framework-specific implementation details
- Ensure all acceptance criteria are covered by tests

Generate a COMPLETE TypeScript test file. Include copyright header. Follow the patterns EXACTLY.`;
}

function extractCodeFromResponse(response: string): string {
    const match = response.match(/```(?:typescript|ts)?\s*([\s\S]+?)```/);
    return match ? match[1].trim() : response.trim();
}

// =============================================================================
// TEST RUNNING
// =============================================================================

interface RunTestsOptions {
    headless?: boolean;
    project?: string;
    verbose?: boolean;
}

async function runTests(testPath: string, options: RunTestsOptions = {}): Promise<{passed: boolean; output: string; failedTests: string[]}> {
    console.log(`\n▶️  Running tests: ${testPath}`);

    // Get the directory where this CLI script is located
    const scriptDir = __dirname;

    // Use the project's local playwright via node_modules
    const playwrightBin = join(scriptDir, 'node_modules', '.bin', 'playwright');
    const args = ['test', testPath, '--reporter=list'];
    if (!options.headless) {
        args.push('--headed'); // Default is headed
    }
    // Default to chrome project to avoid running on all projects
    const project = options.project || 'chrome';
    args.push(`--project=${project}`);
    console.log(`  Using project: ${project}`);

    // Use spawnSync with array arguments to prevent shell injection
    const result = spawnSync(playwrightBin, args, {
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout: 300000, // 5 minutes
        cwd: scriptDir,
    });

    const output = (result.stdout || '') + '\n' + (result.stderr || '');

    if (result.status === 0) {
        return {passed: true, output, failedTests: []};
    }

    // Extract failed test names for better logging
    const failedTests: string[] = [];
    const failedMatches = output.matchAll(/✘\s+\d+\s+\[.+?\]\s+›\s+(.+)$/gm);
    for (const match of failedMatches) {
        if (match[1]) failedTests.push(match[1].trim());
    }

    if (options.verbose && failedTests.length > 0) {
        console.log('\n  Failed tests:');
        for (const test of failedTests) {
            console.log(`    ❌ ${test}`);
        }
    }

    return {passed: false, output, failedTests};
}

// =============================================================================
// TEST HEALING
// =============================================================================

async function healTests(testPath: string, testOutput: string): Promise<string> {
    console.log('\n🔧 Healing failing tests...');

    if (!process.env.ANTHROPIC_API_KEY) {
        throw new Error('ANTHROPIC_API_KEY required for healing');
    }

    // Read the failing test file
    const resolvedPath = resolve(testPath);
    let testCode = '';

    if (existsSync(resolvedPath) && resolvedPath.endsWith('.ts')) {
        testCode = readFileSync(resolvedPath, 'utf-8');
    } else {
        // Find .spec.ts files in directory
        const files = readdirSync(resolvedPath).filter((f) => f.endsWith('.spec.ts'));
        if (files.length > 0) {
            testCode = readFileSync(join(resolvedPath, files[0]), 'utf-8');
        }
    }

    if (!testCode) {
        throw new Error('Could not find test file to heal');
    }

    // Get UI context for healing (use headless for speed during healing)
    const baseUrl = config.baseUrl;
    const {username, password} = getCredentials();

    let uiContext = '';
    try {
        uiContext = await exploreOrganically(baseUrl, {
            headless: true, // Use headless for speed during healing
            login: {username, password},
            featureHints: '',
            browser: config.defaults.browser,
            maxDepth: config.exploration.healingMaxDepth,
            maxPages: config.exploration.healingMaxPages,
        });
        console.log('  ✓ Captured current UI state');
    } catch (e) {
        const error = e as Error;
        console.log(`  ℹ️  Could not get UI context: ${error.message}`);
        console.log('  ℹ️  Will heal based on error output only');
    }

    // Get framework context for healing
    const repoContext = await getRepoContext();

    const prompt = `You are a Playwright test healer for Mattermost E2E tests. Fix the failing test based on the error output.

CURRENT TEST CODE:
\`\`\`typescript
${testCode}
\`\`\`

TEST OUTPUT (with errors):
\`\`\`
${testOutput.slice(0, 4000)}
\`\`\`

${uiContext ? `CURRENT UI STATE:\n${uiContext.slice(0, 3000)}\n` : ''}

MATTERMOST E2E FRAMEWORK PATTERNS:
${repoContext.slice(0, 2000)}

COMMON FIXES:
- Update selectors to match current UI (use existing page object methods, not inline selectors)
- Add waitFor() or pw.waitUntil() before assertions
- Use correct duration values: pw.duration.half_sec, one_sec, two_sec, four_sec, ten_sec, half_min, one_min
- Fix expected values based on actual behavior
- Add missing setup steps (pw.initSetup(), login, goto)
- Ensure using correct imports: @mattermost/playwright-lib
- Follow page object patterns, don't invent new methods
- Use pw.random.id() for unique identifiers
- If feature requires license: add pw.skipIfNoLicense()
- If feature requires flag: add pw.skipIfFeatureFlagNotSet('FlagName')

CRITICAL: Follow Mattermost framework conventions exactly. Use ONLY methods that exist in the page objects.

Return the COMPLETE fixed test file. Keep the same structure but fix the issues.`;

    const {AnthropicProvider} = await import('./lib/src/autonomous/llm/anthropic_provider');
    const provider = new AnthropicProvider({
        apiKey: process.env.ANTHROPIC_API_KEY!,
        model: config.ai.model,
    });

    const response = await provider.generateText(prompt, {
        maxTokens: config.ai.maxTokens,
        temperature: config.ai.healingTemperature,
    });

    return extractCodeFromResponse(response.text);
}

// =============================================================================
// MAIN COMMANDS
// =============================================================================

async function commandGenerate(parsedArgs: ParsedArgs): Promise<void> {
    const {feature, specFile, scenarios = config.defaults.scenarios, outputDir, dryRun, verbose} = parsedArgs;

    console.log('🚀 Autonomous Test Generation Pipeline');
    console.log('=====================================');
    console.log(`Feature: ${feature || 'from spec'}`);
    console.log(`Scenarios: ${scenarios}`);
    console.log(`Browser: ${parsedArgs.browser || 'chrome'}`);
    if (parsedArgs.project) console.log(`Project: ${parsedArgs.project}`);

    // Generate tests with UI context
    const generatedCode = await generateWithUIContext(parsedArgs);

    if (dryRun) {
        console.log('\n--- DRY RUN: Generated Code ---\n');
        console.log(generatedCode);
        return;
    }

    // Create better test file names based on feature and spec
    const featureName = feature || extractFeatureNameFromSpec(specFile) || 'generated';
    const featureSlug = featureName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_|_$/g, '')
        .slice(0, 50); // Limit length

    // Generate timestamp for unique naming
    const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const targetDir = outputDir || `specs/functional/ai-assisted/${featureSlug}`;
    const targetFile = join(targetDir, `${featureSlug}.spec.ts`);

    mkdirSync(targetDir, {recursive: true});
    writeFileSync(targetFile, generatedCode, 'utf-8');
    console.log(`\n✅ Generated: ${targetFile}`);

    // Run the tests
    console.log('\n▶️  Step 5: Running generated tests...');
    let result = await runTests(targetDir, {
        headless: parsedArgs.headless,
        project: parsedArgs.project,
        verbose,
    });

    if (result.passed) {
        console.log('\n✅ All tests passed!');
        return;
    }

    // Heal failing tests (up to 3 attempts)
    for (let attempt = 1; attempt <= 3; attempt++) {
        console.log(`\n🔧 Step 6: Healing attempt ${attempt}/3...`);

        if (verbose && result.failedTests.length > 0) {
            console.log('  Failing tests to heal:');
            for (const test of result.failedTests) {
                console.log(`    - ${test}`);
            }
        }

        try {
            const healedCode = await healTests(targetDir, result.output);
            writeFileSync(targetFile, healedCode, 'utf-8');
            console.log(`  Updated: ${targetFile}`);
        } catch (healError) {
            const error = healError as Error;
            console.log(`  ⚠️  Healing failed: ${error.message}`);
            if (verbose) {
                console.log(`  Stack: ${error.stack}`);
            }
            continue;
        }

        result = await runTests(targetDir, {
            headless: parsedArgs.headless,
            project: parsedArgs.project,
            verbose,
        });

        if (result.passed) {
            console.log(`\n✅ Tests passed after ${attempt} healing attempt(s)!`);
            return;
        }
    }

    console.log('\n⚠️  Tests still failing after 3 healing attempts.');
    console.log('Manual intervention may be needed.');
    console.log(`\nTest file: ${targetFile}`);
    console.log('\n--- Last Error Output ---');
    console.log(result.output.slice(0, 3000));

    if (result.failedTests.length > 0) {
        console.log('\n--- Failed Tests Summary ---');
        for (const test of result.failedTests) {
            console.log(`  ❌ ${test}`);
        }
    }
}

/**
 * Extract a meaningful feature name from spec file
 */
function extractFeatureNameFromSpec(specFile?: string): string | undefined {
    if (!specFile) return undefined;

    // Get base name without extension
    const baseName = basename(specFile)
        .replace(/\.(pdf|md|json)$/i, '')
        .replace(/[-_]/g, ' ')
        .trim();

    // Try to extract meaningful name from common spec naming patterns
    // e.g., "DES-UX Specs- Auto-translation MVP" -> "auto_translation"
    const patterns = [
        /(?:spec[s]?[-_:\s]*)?(.+?)(?:[-_\s]+(?:mvp|v\d|spec|test))?$/i,
    ];

    for (const pattern of patterns) {
        const match = baseName.match(pattern);
        if (match && match[1]) {
            return match[1].trim();
        }
    }

    return baseName;
}

async function commandHeal(parsedArgs: ParsedArgs): Promise<void> {
    const testPath = parsedArgs.feature;
    const {verbose} = parsedArgs;

    if (!testPath) {
        console.error('Usage: npx tsx autonomous-cli.ts heal <test-path>');
        process.exit(1);
    }

    console.log('🔧 Test Healing Pipeline');
    console.log('========================');
    console.log(`Target: ${testPath}`);
    console.log(`Browser: ${parsedArgs.browser || 'chrome'}`);
    if (parsedArgs.project) console.log(`Project: ${parsedArgs.project}`);

    // Run tests first to get error output
    let result = await runTests(testPath, {
        headless: parsedArgs.headless,
        project: parsedArgs.project,
        verbose,
    });

    if (result.passed) {
        console.log('\n✅ All tests already passing!');
        return;
    }

    console.log(`\n❌ Found ${result.failedTests.length || 'some'} failing test(s)`);
    if (verbose && result.failedTests.length > 0) {
        for (const test of result.failedTests) {
            console.log(`    - ${test}`);
        }
    }

    // Heal and retry (up to 3 attempts)
    for (let attempt = 1; attempt <= 3; attempt++) {
        console.log(`\n🔧 Healing attempt ${attempt}/3...`);

        let healedCode: string;
        try {
            healedCode = await healTests(testPath, result.output);
        } catch (healError) {
            const error = healError as Error;
            console.log(`  ⚠️  Healing failed: ${error.message}`);
            if (verbose) {
                console.log(`  Stack: ${error.stack}`);
            }
            continue;
        }

        // Find the test file to update
        const resolvedPath = resolve(testPath);
        let targetFile = resolvedPath;

        if (!targetFile.endsWith('.ts')) {
            const files = readdirSync(resolvedPath).filter((f) => f.endsWith('.spec.ts'));
            if (files.length > 0) {
                targetFile = join(resolvedPath, files[0]);
            }
        }

        writeFileSync(targetFile, healedCode, 'utf-8');
        console.log(`  Updated: ${targetFile}`);

        result = await runTests(testPath, {
            headless: parsedArgs.headless,
            project: parsedArgs.project,
            verbose,
        });

        if (result.passed) {
            console.log(`\n✅ Tests passed after ${attempt} healing attempt(s)!`);
            return;
        }

        if (verbose && result.failedTests.length > 0) {
            console.log('  Still failing:');
            for (const test of result.failedTests) {
                console.log(`    ❌ ${test}`);
            }
        }
    }

    console.log('\n⚠️  Tests still failing after 3 healing attempts.');
    console.log('Manual intervention may be needed.');
    console.log('\n--- Last Error Output ---');
    console.log(result.output.slice(0, 3000));

    if (result.failedTests.length > 0) {
        console.log('\n--- Failed Tests Summary ---');
        for (const test of result.failedTests) {
            console.log(`  ❌ ${test}`);
        }
    }
}

async function commandRun(parsedArgs: ParsedArgs): Promise<void> {
    const testPath = parsedArgs.feature || `${config.defaults.outputDir}/`;
    const {verbose} = parsedArgs;

    console.log('▶️  Running Tests');
    console.log('==================');
    console.log(`Target: ${testPath}`);
    console.log(`Browser: ${parsedArgs.browser || config.defaults.browser}`);
    if (parsedArgs.project) console.log(`Project: ${parsedArgs.project}`);

    const result = await runTests(testPath, {
        headless: parsedArgs.headless,
        project: parsedArgs.project,
        verbose,
    });

    console.log(result.output);

    if (result.passed) {
        console.log('\n✅ All tests passed!');
    } else {
        console.log('\n❌ Some tests failed.');

        if (result.failedTests.length > 0) {
            console.log('\nFailed tests:');
            for (const test of result.failedTests) {
                console.log(`  ❌ ${test}`);
            }
        }

        console.log('\nRun "npx tsx autonomous-cli.ts heal <path>" to auto-fix.');
        process.exit(1);
    }
}

async function commandExplore(parsedArgs: ParsedArgs): Promise<void> {
    const baseUrl = getBaseUrl(parsedArgs.baseUrl);
    const {username, password} = getCredentials();

    // Feature hint can be passed as argument
    const featureHint = parsedArgs.feature || '';

    console.log('🔍 Exploring application UI organically...');
    console.log(`  Base URL: ${baseUrl}`);
    console.log(`  Browser: ${parsedArgs.browser || config.defaults.browser}`);
    console.log(`  Feature hint: ${featureHint || '(none)'}`);

    const snapshot = await exploreOrganically(baseUrl, {
        headless: parsedArgs.headless,
        login: {username, password},
        featureHints: featureHint,
        browser: parsedArgs.browser,
        maxDepth: parsedArgs.parallel ? config.exploration.parallelMaxDepth : config.exploration.maxDepth,
        maxPages: config.exploration.maxPages,
        verbose: parsedArgs.verbose,
    });
    console.log(snapshot);
}

async function commandExploreAndSave(parsedArgs: ParsedArgs): Promise<void> {
    const baseUrl = getBaseUrl(parsedArgs.baseUrl);
    const {username, password} = getCredentials();
    const featureHint = parsedArgs.feature || '';

    console.log('🔍 Exploring and saving results for agent use...');
    console.log(`  Feature: ${featureHint || '(general exploration)'}`);

    const explorationData = await exploreOrganically(baseUrl, {
        headless: parsedArgs.headless,
        login: {username, password},
        featureHints: featureHint,
        browser: parsedArgs.browser,
        maxDepth: config.exploration.maxDepth,
        maxPages: config.exploration.maxPages,
        verbose: parsedArgs.verbose,
    });

    // Save exploration results in .claude/ directory for Claude Code to access
    const outputPath = '.claude/exploration-context.md';
    const markdown = formatExplorationAsMarkdown(JSON.parse(explorationData));

    writeFileSync(outputPath, markdown, 'utf-8');
    console.log(`\n✅ Exploration saved to: ${outputPath}`);
    console.log('   Claude Code can now use this context with Playwright agents');
    console.log('   Use @playwright-test-planner or @playwright-test-generator with this context');
}

function formatExplorationAsMarkdown(data: any): string {
    return `# UI Exploration Results

## Feature Context
${data.featureContext || 'General exploration'}

## Team & Starting Point
- Team: ${data.teamName}
- Start URL: ${data.startUrl}

## Discovered Pages

${data.discoveries.map((d: any, i: number) => `
### Page ${i + 1}: ${d.title || 'Unknown'}
- **URL**: ${d.url}
- **Depth**: ${d.depth}
- **Interactive Elements**: ${d.elements.length}

#### Key Elements
${d.elements.slice(0, 20).map((el: any) =>
    `- **${el.role}**: ${el.text || el.ariaLabel || el.testId || 'unlabeled'}`
).join('\n')}

${d.interactions && d.interactions.length > 0 ? `#### Interactions Discovered\n${d.interactions.join('\n')}` : ''}
`).join('\n---\n')}

## Next Steps

Use this exploration data with:
- \`@playwright-generator\` to generate tests based on discovered UI
- \`@playwright-healer\` to fix failing tests with current UI context

The Playwright agents now have context about the actual UI structure discovered during organic exploration.
`;
}

async function commandPlanFromPDF(parsedArgs: ParsedArgs): Promise<void> {
    const pdfPath = parsedArgs.feature;

    if (!pdfPath) {
        console.error('Usage: npx tsx autonomous-cli.ts plan-from-pdf <pdf-file>');
        process.exit(1);
    }

    if (!existsSync(pdfPath)) {
        console.error(`File not found: ${pdfPath}`);
        process.exit(1);
    }

    console.log('📄 PDF → Scenarios → @planner Pipeline');
    console.log(`   Processing: ${basename(pdfPath)}\n`);

    // Step 1: Parse PDF to extract scenarios
    console.log('Step 1/3: Parsing PDF specification...');
    const {createAnthropicBridge, createOllamaBridge} = await import('./lib/src/spec-bridge');

    const bridge = process.env.ANTHROPIC_API_KEY
        ? createAnthropicBridge(process.env.ANTHROPIC_API_KEY)
        : createOllamaBridge('deepseek-r1:7b');

    const features = await bridge.parseSpec(resolve(pdfPath));

    if (features.length === 0) {
        console.error('   ❌ No features extracted from PDF');
        process.exit(1);
    }

    console.log(`   ✓ Extracted ${features.length} feature(s) with ${features.reduce((sum, f) => sum + f.scenarios.length, 0)} scenario(s)`);

    // Step 2: Save scenarios to .claude/scenarios.md for @planner
    console.log('\nStep 2/3: Saving scenarios for @playwright-test-planner...');
    const scenariosPath = '.claude/scenarios.md';
    mkdirSync(dirname(scenariosPath), {recursive: true});

    const scenariosMarkdown = formatScenariosForPlanner(features, pdfPath);
    writeFileSync(scenariosPath, scenariosMarkdown, 'utf-8');
    console.log(`   ✓ Saved to: ${scenariosPath}`);

    // Step 3: Provide next steps
    console.log('\nStep 3/3: Next steps with @playwright-test-planner:');
    console.log('   1. The PDF scenarios are now available in .claude/scenarios.md');
    console.log('   2. Use Claude Code with @playwright-test-planner to:');
    console.log('      - Explore additional scenarios around these base scenarios');
    console.log('      - Expand test coverage based on the framework patterns');
    console.log('      - Generate comprehensive test plans');
    console.log('\n   Example Claude Code prompt:');
    console.log('   "@playwright-test-planner review scenarios.md and expand test coverage');
    console.log('    for the auto-translation feature using Mattermost framework conventions"');
    console.log('\n✅ Pipeline ready! Use Claude Code to continue with @playwright-test-planner');
}

function formatScenariosForPlanner(features: any[], sourcePdf: string): string {
    const lines: string[] = [];

    lines.push('# Test Scenarios for Playwright Test Planner\n');
    lines.push(`**Source**: ${basename(sourcePdf)}`);
    lines.push(`**Generated**: ${new Date().toISOString()}`);
    lines.push('**Purpose**: Base scenarios for @playwright-test-planner to expand and enhance\n');
    lines.push('---\n');

    lines.push('## Instructions for @playwright-test-planner\n');
    lines.push('These scenarios were extracted from the PDF specification. Your task is to:');
    lines.push('1. Review these base scenarios and understand the feature requirements');
    lines.push('2. Explore additional edge cases and user flows around these scenarios');
    lines.push('3. Expand test coverage considering Mattermost framework conventions:');
    lines.push('   - Use Page Object Model patterns from `support/ui/pages/`');
    lines.push('   - Follow naming conventions (kebab-case for files, PascalCase for classes)');
    lines.push('   - Leverage existing components (ChannelsPage, AdminConsole, etc.)');
    lines.push('4. Generate comprehensive test plans that include:');
    lines.push('   - Happy path scenarios');
    lines.push('   - Error handling scenarios');
    lines.push('   - Accessibility considerations');
    lines.push('   - Multi-language support testing (if applicable)');
    lines.push('   - Permission-based scenarios (different user roles)\n');
    lines.push('---\n');

    for (const feature of features) {
        lines.push(`## Feature: ${feature.name}\n`);

        if (feature.description) {
            lines.push(`**Description**: ${feature.description}\n`);
        }

        lines.push(`**Priority**: ${feature.priority}`);

        if (feature.targetUrls.length > 0) {
            lines.push(`**Target URLs**: ${feature.targetUrls.join(', ')}`);
        }

        lines.push('');

        if (feature.acceptanceCriteria.length > 0) {
            lines.push('### Acceptance Criteria\n');
            for (const criterion of feature.acceptanceCriteria) {
                lines.push(`- ${criterion}`);
            }
            lines.push('');
        }

        if (feature.scenarios.length > 0) {
            lines.push('### Base Scenarios\n');
            for (let i = 0; i < feature.scenarios.length; i++) {
                const scenario = feature.scenarios[i];
                lines.push(`#### Scenario ${i + 1}: ${scenario.name}\n`);
                lines.push(`**Priority**: ${scenario.priority}\n`);

                if (scenario.given) {
                    lines.push(`**Given**: ${scenario.given}`);
                }
                if (scenario.when) {
                    lines.push(`**When**: ${scenario.when}`);
                }
                if (scenario.then) {
                    lines.push(`**Then**: ${scenario.then}`);
                }
                lines.push('');
            }
        }

        lines.push('---\n');
    }

    lines.push('## Framework Context\n');
    lines.push('Mattermost E2E Framework follows these conventions:\n');
    lines.push('- **Page Objects**: Defined in `support/ui/pages/` using class-based patterns');
    lines.push('- **Components**: Reusable UI components in `support/ui/components/`');
    lines.push('- **Test Data**: Fixtures and factories in `support/test_data/`');
    lines.push('- **File Naming**: kebab-case for files (e.g., `channel-settings.spec.ts`)');
    lines.push('- **Class Naming**: PascalCase for classes (e.g., `ChannelSettingsPage`)');
    lines.push('- **Method Naming**: camelCase for methods (e.g., `openChannelSettings()`)');
    lines.push('- **Test Structure**: Use `test.describe()` for grouping, `test()` for individual tests');
    lines.push('- **Assertions**: Prefer Playwright assertions like `expect(locator).toBeVisible()`\n');

    return lines.join('\n');
}

async function commandConvert(parsedArgs: ParsedArgs): Promise<void> {
    const specFile = parsedArgs.feature;

    if (!specFile) {
        console.error('Usage: npx tsx autonomous-cli.ts convert <spec-file>');
        process.exit(1);
    }

    if (!existsSync(specFile)) {
        console.error(`File not found: ${specFile}`);
        process.exit(1);
    }

    console.log(`Converting: ${basename(specFile)}`);

    const {createAnthropicBridge, createOllamaBridge} = await import('./lib/src/spec-bridge');

    const bridge = process.env.ANTHROPIC_API_KEY
        ? createAnthropicBridge(process.env.ANTHROPIC_API_KEY, 'specs')
        : createOllamaBridge('deepseek-r1:7b', 'specs');

    const result = await bridge.convertToPlaywrightSpecs(resolve(specFile), 'specs');

    console.log(`\n✅ Converted ${result.features.length} feature(s), ${result.totalScenarios} scenario(s)`);
    for (const path of result.specPaths) {
        console.log(`  - ${path}`);
    }
}

// =============================================================================
// MCP COMMANDS (Print instructions for interactive Claude Code use)
// =============================================================================

/**
 * MCP Plan command - prints instructions for using @planner in Claude Code
 */
async function commandMCPPlan(parsedArgs: ParsedArgs): Promise<void> {
    const specFile = parsedArgs.specFile || parsedArgs.feature;
    const baseUrl = getBaseUrl(parsedArgs.baseUrl);

    console.log('🎯 MCP Plan - @planner Agent');
    console.log('============================');
    console.log(`\nMCP agents require interactive Claude Code sessions.`);
    console.log(`\nTo use @planner, run Claude Code and use this prompt:\n`);
    console.log(`┌─────────────────────────────────────────────────────────────────┐`);
    console.log(`│  @playwright-test-planner                                       │`);
    console.log(`│  Explore ${baseUrl} and create a test plan.`);
    if (specFile) {
        console.log(`│  Base the plan on the spec: ${specFile}`);
    }
    console.log(`│  Save the plan to specs/plan.md                                 │`);
    console.log(`└─────────────────────────────────────────────────────────────────┘`);
    console.log(`\nAlternatively, use the 'generate' command for direct LLM generation:`);
    console.log(`  npx tsx autonomous-cli.ts generate --spec "${specFile || 'your-spec.md'}" --scenarios 5`);
}

/**
 * MCP Generate command - prints instructions for using @generator in Claude Code
 */
async function commandMCPGenerate(parsedArgs: ParsedArgs): Promise<void> {
    const specFile = parsedArgs.specFile || parsedArgs.feature;
    const baseUrl = getBaseUrl(parsedArgs.baseUrl);

    console.log('⚡ MCP Generate - @generator Agent');
    console.log('===================================');
    console.log(`\nMCP agents require interactive Claude Code sessions.`);
    console.log(`\nTo use @generator, run Claude Code and use this prompt:\n`);
    console.log(`┌─────────────────────────────────────────────────────────────────┐`);
    console.log(`│  @playwright-test-generator                                     │`);
    console.log(`│  Generate tests for ${baseUrl}`);
    if (specFile) {
        console.log(`│  Based on spec: ${specFile}`);
    }
    console.log(`│  Save tests to specs/functional/ai-assisted/<feature>/         │`);
    console.log(`└─────────────────────────────────────────────────────────────────┘`);
    console.log(`\nAlternatively, use the 'generate' command for direct LLM generation:`);
    console.log(`  npx tsx autonomous-cli.ts generate --spec "${specFile || 'your-spec.md'}" --scenarios 5`);
}

/**
 * MCP Heal command - prints instructions for using @healer in Claude Code
 */
async function commandMCPHeal(parsedArgs: ParsedArgs): Promise<void> {
    const testPath = parsedArgs.feature || `${config.defaults.outputDir}/`;

    console.log('🔧 MCP Heal - @healer Agent');
    console.log('===========================');
    console.log(`\nMCP agents require interactive Claude Code sessions.`);
    console.log(`\nTo use @healer, run Claude Code and use this prompt:\n`);
    console.log(`┌─────────────────────────────────────────────────────────────────┐`);
    console.log(`│  @playwright-test-healer                                        │`);
    console.log(`│  Debug and fix failing tests in ${testPath}`);
    console.log(`└─────────────────────────────────────────────────────────────────┘`);
    console.log(`\nAlternatively, use the 'heal' command for direct LLM healing:`);
    console.log(`  npx tsx autonomous-cli.ts heal ${testPath}`);
}

/**
 * Auto command - full pipeline: convert → generate → run → heal (using direct LLM)
 */
async function commandAuto(parsedArgs: ParsedArgs): Promise<void> {
    const specFile = parsedArgs.specFile || parsedArgs.feature;
    const baseUrl = getBaseUrl(parsedArgs.baseUrl);
    const scenarios = parsedArgs.scenarios || config.defaults.scenarios;
    const {verbose, headless, project} = parsedArgs;

    console.log('🚀 Autonomous Test Pipeline');
    console.log('===========================');
    console.log(`Spec: ${specFile || '(none)'}`);
    console.log(`Base URL: ${baseUrl}`);
    console.log(`Scenarios: ${scenarios}`);

    // Step 1: Convert spec if PDF
    let specPath = specFile;
    if (specFile && specFile.endsWith('.pdf')) {
        console.log('\n📄 Step 1: Converting PDF to Markdown spec...');

        if (!process.env.AUTONOMOUS_ALLOW_PDF_UPLOAD) {
            console.log('  ⚠️  Set AUTONOMOUS_ALLOW_PDF_UPLOAD=true for PDF specs');
            process.exit(1);
        }

        const {createAnthropicBridge} = await import('./lib/src/spec-bridge');
        const bridge = createAnthropicBridge(process.env.ANTHROPIC_API_KEY!, 'specs');
        const result = await bridge.convertToPlaywrightSpecs(resolve(specFile), 'specs');
        specPath = result.specPaths[0];
        console.log(`  ✓ Converted to: ${specPath}`);
    } else if (specFile) {
        console.log('\n📄 Step 1: Using spec file directly');
        console.log(`  ✓ Spec: ${specFile}`);
    } else {
        console.log('\n📄 Step 1: No spec file provided');
    }

    // Step 2: Generate tests using direct LLM
    console.log('\n⚡ Step 2: Generating tests...');
    await commandGenerate({
        ...parsedArgs,
        specFile: specPath,
        dryRun: false,
    });

    // Step 3: Run tests
    console.log('\n▶️  Step 3: Running generated tests...');
    const testDir = `${config.defaults.outputDir}/`;

    if (!existsSync(testDir)) {
        console.log(`  ⚠️  Test directory not found: ${testDir}`);
        console.log('  Tests may have been written to a different location.');
        return;
    }

    let runResult = await runTests(testDir, {
        headless,
        project: project || config.defaults.browser,
        verbose,
    });

    if (runResult.passed) {
        console.log('\n✅ All tests passed!');
        return;
    }

    // Step 4: Heal failing tests (up to configured attempts)
    let healAttempts = 0;
    const maxHealAttempts = config.defaults.maxHealAttempts;

    while (!runResult.passed && healAttempts < maxHealAttempts) {
        healAttempts++;
        console.log(`\n🔧 Step 4: Healing attempt ${healAttempts}/${maxHealAttempts}...`);

        try {
            const healedCode = await healTests(testDir, runResult.output);

            // Find the test file to update
            const files = readdirSync(testDir).filter((f) => f.endsWith('.spec.ts'));
            if (files.length > 0) {
                const targetFile = join(testDir, files[0]);
                writeFileSync(targetFile, healedCode, 'utf-8');
                console.log(`  Updated: ${targetFile}`);
            }
        } catch (healError) {
            console.log(`  ⚠️  Healing failed: ${(healError as Error).message}`);
            continue;
        }

        // Re-run tests
        runResult = await runTests(testDir, {
            headless,
            project: project || config.defaults.browser,
            verbose,
        });

        if (runResult.passed) {
            console.log(`\n✅ Tests passed after ${healAttempts} healing attempt(s)!`);
            return;
        }
    }

    console.log('\n⚠️  Tests still failing after healing attempts.');
    console.log('Manual intervention may be needed.');

    if (runResult.failedTests.length > 0) {
        console.log('\nFailed tests:');
        for (const test of runResult.failedTests) {
            console.log(`  ❌ ${test}`);
        }
    }

    console.log('\n💡 For interactive debugging with MCP agents, use Claude Code:');
    console.log(`   @playwright-test-healer fix failing tests in ${testDir}`);
}

// =============================================================================
// MAIN
// =============================================================================

async function main(): Promise<void> {
    const parsedArgs = parseArgs();

    try {
        // Validate inputs before processing (skip for help command)
        if (parsedArgs.command !== 'help' && parsedArgs.command !== '--help' && parsedArgs.command !== '-h') {
            validateArgs(parsedArgs);
        }

        switch (parsedArgs.command) {
            case 'generate':
            case 'gen':
            case 'g':
                await commandGenerate(parsedArgs);
                break;

            case 'heal':
            case 'fix':
            case 'h':
                await commandHeal(parsedArgs);
                break;

            case 'run':
            case 'r':
                await commandRun(parsedArgs);
                break;

            case 'explore':
            case 'exp':
            case 'e':
                await commandExplore(parsedArgs);
                break;

            case 'explore-save':
            case 'es':
                await commandExploreAndSave(parsedArgs);
                break;

            case 'plan-from-pdf':
            case 'pfp':
            case 'plan':
                await commandPlanFromPDF(parsedArgs);
                break;

            case 'convert':
            case 'conv':
            case 'c':
                await commandConvert(parsedArgs);
                break;

            // MCP-based commands
            case 'auto':
            case 'a':
                await commandAuto(parsedArgs);
                break;

            case 'mcp-plan':
            case 'mp':
                await commandMCPPlan(parsedArgs);
                break;

            case 'mcp-generate':
            case 'mg':
                await commandMCPGenerate(parsedArgs);
                break;

            case 'mcp-heal':
            case 'mh':
                await commandMCPHeal(parsedArgs);
                break;

            case 'help':
            case '--help':
            case '-h':
            case undefined:
                printHelp();
                break;

            default:
                console.error(`Unknown command: ${parsedArgs.command}`);
                printHelp();
                process.exit(1);
        }
    } catch (error) {
        console.error('\n❌ Error:', (error as Error).message);
        process.exit(1);
    }
}

main();
