// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/* eslint-disable no-console */

import fs from 'node:fs';
import path from 'node:path';

import chalk from 'chalk';

const MATTERMOST_URL_PATTERN = /https?:\/\/[^"'\s<>()]*mattermost\.com[^"'\s<>()]*/g;

const SOURCE_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx'];

const DIRECTORIES_TO_SCAN = [
    'channels/src',
    'platform/client/src',
    'platform/components/src',
    'platform/mattermost-redux/src',
];

function getAllSourceFiles(dir, excludeTests = true) {
    const files = [];

    function walk(currentDir) {
        if (!fs.existsSync(currentDir)) {
            return;
        }

        const entries = fs.readdirSync(currentDir, {withFileTypes: true});

        for (const entry of entries) {
            const fullPath = path.join(currentDir, entry.name);

            if (entry.isDirectory()) {
                if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === 'coverage') {
                    continue;
                }
                walk(fullPath);
            } else if (entry.isFile()) {
                const ext = path.extname(entry.name);
                if (!SOURCE_EXTENSIONS.includes(ext)) {
                    continue;
                }

                if (excludeTests && (entry.name.includes('.test.') || entry.name.includes('.spec.'))) {
                    continue;
                }

                files.push(fullPath);
            }
        }
    }

    walk(dir);
    return files;
}

function extractUrls(filePath) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const matches = content.match(MATTERMOST_URL_PATTERN) || [];

    return matches.map((url) => {
        let cleanUrl = url;
        cleanUrl = cleanUrl.replace(/[',;)}\]]+$/, '');
        cleanUrl = cleanUrl.replace(/\\n$/, '');
        return cleanUrl;
    });
}

function findAllMattermostUrls(rootDir, excludeTests = true) {
    const urlMap = new Map();

    for (const dir of DIRECTORIES_TO_SCAN) {
        const fullDir = path.join(rootDir, dir);
        const files = getAllSourceFiles(fullDir, excludeTests);

        for (const file of files) {
            const urls = extractUrls(file);
            for (const url of urls) {
                if (!urlMap.has(url)) {
                    urlMap.set(url, []);
                }
                urlMap.get(url).push(path.relative(rootDir, file));
            }
        }
    }

    return urlMap;
}

async function checkUrl(url, retries = 2) {
    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            const response = await fetch(url, {
                method: 'HEAD',
                redirect: 'follow',
                signal: AbortSignal.timeout(10000),
            });

            if (response.status === 405) {
                const getResponse = await fetch(url, {
                    method: 'GET',
                    redirect: 'follow',
                    signal: AbortSignal.timeout(10000),
                });
                return {
                    url,
                    status: getResponse.status,
                    ok: getResponse.ok,
                };
            }

            return {
                url,
                status: response.status,
                ok: response.ok,
            };
        } catch (error) {
            if (attempt === retries) {
                return {
                    url,
                    status: 0,
                    ok: false,
                    error: error.message,
                };
            }
            await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
        }
    }
}

async function checkUrls(urls, concurrency = 5, silentProgress = false) {
    const results = [];
    const urlList = Array.from(urls.keys());

    for (let i = 0; i < urlList.length; i += concurrency) {
        const batch = urlList.slice(i, i + concurrency);
        const batchResults = await Promise.all(batch.map((url) => checkUrl(url)));
        results.push(...batchResults);

        if (!silentProgress) {
            const completed = Math.min(i + concurrency, urlList.length);
            process.stderr.write(`\rChecking URLs: ${completed}/${urlList.length}`);
        }
    }
    if (!silentProgress) {
        process.stderr.write('\n');
    }

    return results;
}

function printResults(results, urlMap) {
    const broken = results.filter((r) => !r.ok);
    const working = results.filter((r) => r.ok);

    console.log('\n' + chalk.bold('=== External Link Check Results ===\n'));

    if (broken.length === 0) {
        console.log(chalk.green.bold(`✓ All ${working.length} mattermost.com URLs are accessible\n`));
        return 0;
    }

    console.log(chalk.green(`✓ ${working.length} URLs are accessible`));
    console.log(chalk.red(`✗ ${broken.length} URLs are broken\n`));

    console.log(chalk.red.bold('Broken URLs:\n'));

    for (const result of broken) {
        const statusText = result.error ? `Error: ${result.error}` : `HTTP ${result.status}`;
        console.log(chalk.red(`  ${result.url}`));
        console.log(chalk.gray(`    Status: ${statusText}`));
        console.log(chalk.gray(`    Found in:`));
        for (const file of urlMap.get(result.url)) {
            console.log(chalk.gray(`      - ${file}`));
        }
        console.log();
    }

    return 1;
}

function generateMarkdownSummary(results, urlMap) {
    const broken = results.filter((r) => !r.ok);
    const working = results.filter((r) => r.ok);

    const lines = [];

    lines.push('## External Link Check Results\n');

    if (broken.length === 0) {
        lines.push(`✅ **All ${working.length} mattermost.com URLs are accessible**\n`);
        return lines.join('\n');
    }

    lines.push(`| Status | Count |`);
    lines.push(`|--------|-------|`);
    lines.push(`| ✅ Working | ${working.length} |`);
    lines.push(`| ❌ Broken | ${broken.length} |`);
    lines.push('');

    lines.push('### Broken URLs\n');
    lines.push('| URL | Status | Files |');
    lines.push('|-----|--------|-------|');

    for (const result of broken) {
        const statusText = result.error ? `Error: ${result.error}` : `HTTP ${result.status}`;
        const files = urlMap.get(result.url).map((f) => `\`${f}\``).join(', ');
        lines.push(`| ${result.url} | ${statusText} | ${files} |`);
    }

    lines.push('');
    return lines.join('\n');
}

async function main() {
    const args = process.argv.slice(2);
    const includeTests = args.includes('--include-tests');
    const jsonOutput = args.includes('--json');
    const markdownOutput = args.includes('--markdown');

    const rootDir = process.cwd();

    if (!markdownOutput) {
        console.log(chalk.inverse.bold(' Checking mattermost.com links in webapp... ') + '\n');

        if (includeTests) {
            console.log(chalk.yellow('Including test files in scan\n'));
        }
    }

    const urlMap = findAllMattermostUrls(rootDir, !includeTests);

    if (!markdownOutput) {
        console.log(`Found ${chalk.bold(urlMap.size)} unique mattermost.com URLs\n`);
    }

    if (urlMap.size === 0) {
        if (markdownOutput) {
            console.log('## External Link Check Results\n\n⚠️ No URLs found to check');
        } else {
            console.log(chalk.yellow('No URLs found to check'));
        }
        return 0;
    }

    const results = await checkUrls(urlMap, 5, markdownOutput);

    if (markdownOutput) {
        console.log(generateMarkdownSummary(results, urlMap));
        return results.filter((r) => !r.ok).length > 0 ? 1 : 0;
    }

    if (jsonOutput) {
        const output = {
            total: results.length,
            working: results.filter((r) => r.ok).length,
            broken: results.filter((r) => !r.ok).map((r) => ({
                url: r.url,
                status: r.status,
                error: r.error,
                files: urlMap.get(r.url),
            })),
        };
        console.log(JSON.stringify(output, null, 2));
        return output.broken.length > 0 ? 1 : 0;
    }

    return printResults(results, urlMap);
}

main().then((exitCode) => {
    process.exitCode = exitCode;
}).catch((error) => {
    console.error(chalk.red('Error:'), error);
    process.exitCode = 1;
});
