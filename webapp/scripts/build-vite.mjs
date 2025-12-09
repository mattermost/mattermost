// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/* eslint-disable no-console */

import chalk from 'chalk';
import concurrently from 'concurrently';
import {execSync} from 'child_process';
import fs from 'fs';
import path from 'path';
import {fileURLToPath} from 'url';

import {getExitCode, getPlatformCommands} from './utils.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webappDir = path.resolve(__dirname, '..');
const channelsDir = path.resolve(webappDir, 'channels');
const distDir = path.resolve(channelsDir, 'dist');

// Check for flags
const skipPackages = process.argv.includes('--skip-packages');
const verbose = process.argv.includes('--verbose') || process.env.CI === 'true';

// Log prefix for consistent output with other packages
const PREFIX = chalk.cyan('[channels]');
const log = (msg = '') => console.log(msg ? `${PREFIX} ${msg}` : '');
const logError = (msg) => console.error(`${PREFIX} ${msg}`);
const timestamp = () => new Date().toLocaleTimeString('en-US', {hour12: false});

async function buildAll() {
    const startTime = Date.now();

    log(chalk.inverse.bold(`Build started at ${timestamp()}`));
    log();

    if (!skipPackages) {
        console.log(chalk.inverse.bold('Building subpackages...') + '\n');

        try {
            const {result} = concurrently(
                getPlatformCommands('build'),
                {
                    killOthers: 'failure',
                },
            );

            await result;
        } catch (closeEvents) {
            console.error(chalk.inverse.bold.red('Failed to build subpackages'), closeEvents);
            console.log(chalk.yellow('\nTip: Run with --skip-packages to skip subpackage builds if they are already built.\n'));
            return getExitCode(closeEvents);
        }

        log(chalk.inverse.bold('Subpackages built! Building web app with Vite...'));
        log();
    } else {
        log(chalk.yellow('Skipping subpackage builds (--skip-packages flag used)'));
        log(chalk.inverse.bold('Building web app with Vite...'));
        log();
    }

    let modulesTransformed = 0;
    let hasChunkWarning = false;
    let oversizedChunks = [];

    // Read chunkSizeWarningLimit from vite.config.ts (default: 1000 kB)
    let chunkSizeLimit = 1000;
    try {
        const viteConfigPath = path.resolve(channelsDir, 'vite.config.ts');
        const viteConfigContent = fs.readFileSync(viteConfigPath, 'utf-8');
        const limitMatch = viteConfigContent.match(/chunkSizeWarningLimit:\s*(\d+)/);
        if (limitMatch) {
            chunkSizeLimit = parseInt(limitMatch[1], 10);
        }
    } catch {
        // Use default if config cannot be read
    }

    try {
        // Build channels with Vite
        // Always use --logLevel info to capture chunk sizes, but only display in verbose mode
        const output = execSync('npx vite build --logLevel info 2>&1', {
            cwd: channelsDir,
            encoding: 'utf-8',
            env: {
                ...process.env,
                NODE_ENV: 'production',
            },
        });

        // Check for chunk size warning
        hasChunkWarning = output.includes('chunks are larger than');

        // Extract oversized chunks from output (format: "dist/chunks/name.hash.js    1,234.56 kB")
        // Only parse when there's a warning and not in verbose mode
        if (hasChunkWarning && !verbose) {
            const chunkRegex = /dist\/[\w/.-]+\.js\s+([\d,]+\.?\d*)\s*kB/g;
            let match;
            while ((match = chunkRegex.exec(output)) !== null) {
                const sizeStr = match[1].replace(/,/g, '');
                const sizeKB = parseFloat(sizeStr);
                if (sizeKB >= chunkSizeLimit) {
                    const fileName = match[0].split(/\s+/)[0].split('/').pop();
                    oversizedChunks.push({name: fileName, size: sizeKB});
                }
            }
            // Sort by size descending
            oversizedChunks.sort((a, b) => b.size - a.size);
        }

        // Print the output (chunk listing only shown in verbose mode)
        if (verbose) {
            // Prefix each line of Vite output
            output.split('\n').forEach((line) => {
                if (line.trim()) {
                    log(line);
                }
            });
        }

        // Extract modules transformed count from output (e.g., "6886 modules transformed")
        const modulesMatch = output.match(/(\d+)\s+modules?\s+transformed/i);
        if (modulesMatch) {
            modulesTransformed = parseInt(modulesMatch[1], 10);
        }
    } catch (error) {
        // execSync throws on non-zero exit, but also returns stdout
        if (error.stdout) {
            error.stdout.split('\n').forEach((line) => {
                if (line.trim()) {
                    log(line);
                }
            });
        }
        logError(chalk.inverse.bold.red('Failed to build web app with Vite') + ' ' + error.message);
        return 1;
    }

    // Static assets are now copied by vite-plugin-static-copy during the Vite build
    // See viteStaticCopy configuration in vite.config.ts

    const buildTime = ((Date.now() - startTime) / 1000).toFixed(2);

    // Display bundle size summary
    // Skip "Largest JS chunks" if we'll show oversized chunks separately
    const showLargestChunks = !hasChunkWarning || verbose;
    log();
    log(chalk.inverse.bold('Bundle Size Summary'));
    log();
    displayBundleSize(distDir, modulesTransformed, showLargestChunks, log);

    // Show oversized chunks and tip if chunk size warning was present and not in verbose mode
    if (hasChunkWarning && !verbose && oversizedChunks.length > 0) {
        log();
        log(chalk.yellow.bold(`Chunks exceeding ${chunkSizeLimit} kB (build.chunkSizeWarningLimit):`));
        const formatSize = (kb) => {
            if (kb >= 1024) {
                return (kb / 1024).toFixed(1) + ' MB';
            }
            return kb.toFixed(1) + ' KB';
        };
        for (const chunk of oversizedChunks) {
            const sizeStr = formatSize(chunk.size).padStart(10);
            const isI18n = chunk.name.includes('i18n');
            const note = isI18n ? chalk.gray('(translations)') : chalk.red('(consider code-splitting)');
            log(`  ${chalk.yellow(sizeStr)}  ${chunk.name} ${note}`);
        }
        log();
        log(chalk.yellow('Tip: Run with --verbose to see all chunk sizes, or VITE_BUNDLE_ANALYZER=true for visual analysis.'));
    }

    log();
    log(chalk.inverse.bold.green(`✓ built in ${buildTime}s at ${timestamp()}`));
    log(`Output: ${distDir}`);

    return 0;
}

/**
 * Calculate and display bundle size summary with best practice indicators
 *
 * Best practices for web bundle sizes (initial load):
 * - JS: < 200KB ideal, < 500KB acceptable, > 1MB needs optimization
 * - CSS: < 50KB ideal, < 100KB acceptable
 * - Total initial load: < 1MB ideal for good performance
 *
 * Note: These are for INITIAL load. Lazy-loaded chunks can be larger.
 * Large apps like Mattermost naturally have larger bundles due to features.
 */
function displayBundleSize(dir, modulesTransformed = 0, showLargestChunks = true, log = console.log) {
    const sizes = {js: 0, css: 0, maps: 0, assets: 0, total: 0};
    const largestFiles = [];
    let fileCount = 0;

    function walkDir(currentPath) {
        const entries = fs.readdirSync(currentPath, {withFileTypes: true});
        for (const entry of entries) {
            const fullPath = path.join(currentPath, entry.name);
            if (entry.isDirectory()) {
                walkDir(fullPath);
            } else {
                fileCount++;
                const stat = fs.statSync(fullPath);
                const size = stat.size;
                sizes.total += size;

                if (entry.name.endsWith('.map')) {
                    sizes.maps += size;
                } else if (entry.name.endsWith('.js')) {
                    sizes.js += size;
                    largestFiles.push({name: entry.name, size});
                } else if (entry.name.endsWith('.css')) {
                    sizes.css += size;
                } else {
                    sizes.assets += size;
                }
            }
        }
    }

    try {
        walkDir(dir);

        // Sort largest files and take top 5
        largestFiles.sort((a, b) => b.size - a.size);
        const top5 = largestFiles.slice(0, 5);

        const formatSize = (bytes) => {
            if (bytes >= 1024 * 1024) {
                return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
            }
            return (bytes / 1024).toFixed(1) + ' KB';
        };

        // Size status indicator based on best practices
        const getJsStatus = (bytes) => {
            const mb = bytes / (1024 * 1024);
            // For large apps, thresholds are higher
            if (mb < 20) return chalk.green('✓');
            if (mb < 50) return chalk.yellow('○');
            return chalk.red('●');
        };

        const getCssStatus = (bytes) => {
            const kb = bytes / 1024;
            if (kb < 500) return chalk.green('✓');
            if (kb < 2000) return chalk.yellow('○');
            return chalk.red('●');
        };

        // Display modules transformed if available
        if (modulesTransformed > 0) {
            log(`${chalk.bold('Modules:')}      ${modulesTransformed.toLocaleString()} transformed`);
        }
        log(`${chalk.bold('Files:')}        ${fileCount.toLocaleString()} output files`);
        log('');
        log(`${chalk.bold('Total:')}        ${formatSize(sizes.total)}`);
        log(`${chalk.cyan('JS (min):')}     ${formatSize(sizes.js)} ${getJsStatus(sizes.js)}`);
        log(`${chalk.magenta('CSS:')}          ${formatSize(sizes.css)} ${getCssStatus(sizes.css)}`);
        log(`${chalk.gray('Source maps:')}  ${formatSize(sizes.maps)}`);
        log(`${chalk.yellow('Assets:')}       ${formatSize(sizes.assets)}`);

        if (showLargestChunks && top5.length > 0) {
            log();
            log(chalk.bold('Largest JS chunks:'));
            for (const file of top5) {
                const sizeStr = formatSize(file.size).padStart(10);
                const sizeMB = file.size / (1024 * 1024);
                // Warn if individual chunk > 2MB (except i18n which contains all translations)
                const isI18n = file.name.includes('i18n');
                const status = isI18n ? chalk.gray('(translations)') :
                    sizeMB > 2 ? chalk.yellow('(consider code-splitting)') : '';
                log(`  ${sizeStr}  ${file.name} ${status}`);
            }
        }

        // Best practices legend
        log();
        log(chalk.gray('Legend: ✓ good  ○ acceptable  ● needs optimization'));
    } catch (error) {
        log(chalk.yellow('Could not calculate bundle size:') + ' ' + error.message);
    }
}

buildAll().then((exitCode) => {
    process.exitCode = exitCode;
});
