// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * Script to generate sample handwritten-style test images for E2E testing.
 * Run with: npx ts-node generate_test_images.ts
 *
 * Creates PNG images that simulate:
 * - Whiteboard with handwritten notes
 * - Meeting notes
 * - Simple diagram with labels
 */

import * as fs from 'fs';
import * as path from 'path';

import {chromium} from '@playwright/test';

interface TestImage {
    name: string;
    description: string;
    expectedText: string;
    svg: string;
    width: number;
    height: number;
}

const HANDWRITING_FONT = 'cursive, "Comic Sans MS", "Bradley Hand", fantasy';

const testImages: TestImage[] = [
    {
        name: 'whiteboard_meeting_notes',
        description: 'Whiteboard with meeting notes',
        expectedText: 'Meeting Notes\n- Review Q4 goals\n- Discuss budget\n- Team updates',
        width: 800,
        height: 600,
        svg: `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600">
            <!-- Whiteboard background -->
            <rect width="800" height="600" fill="#f5f5f5"/>
            <rect x="20" y="20" width="760" height="560" fill="white" stroke="#ccc" stroke-width="2" rx="5"/>

            <!-- Title -->
            <text x="100" y="80" font-family="${HANDWRITING_FONT}" font-size="36" fill="#2c5282" transform="rotate(-2 100 80)">
                Meeting Notes
            </text>

            <!-- Underline -->
            <path d="M 95 90 Q 200 95 350 88" stroke="#2c5282" stroke-width="2" fill="none"/>

            <!-- Bullet points -->
            <circle cx="80" cy="160" r="6" fill="#e53e3e"/>
            <text x="100" y="168" font-family="${HANDWRITING_FONT}" font-size="24" fill="#333" transform="rotate(1 100 168)">
                Review Q4 goals
            </text>

            <circle cx="80" cy="220" r="6" fill="#e53e3e"/>
            <text x="100" y="228" font-family="${HANDWRITING_FONT}" font-size="24" fill="#333" transform="rotate(-1 100 228)">
                Discuss budget
            </text>

            <circle cx="80" cy="280" r="6" fill="#e53e3e"/>
            <text x="100" y="288" font-family="${HANDWRITING_FONT}" font-size="24" fill="#333" transform="rotate(0.5 100 288)">
                Team updates
            </text>

            <!-- Doodle/arrow -->
            <path d="M 450 150 Q 500 120 550 150 L 540 140 M 550 150 L 540 160"
                  stroke="#38a169" stroke-width="3" fill="none"/>
            <text x="560" y="155" font-family="${HANDWRITING_FONT}" font-size="18" fill="#38a169">
                Important!
            </text>

            <!-- Box around action items -->
            <rect x="400" y="200" width="320" height="150" fill="none" stroke="#dd6b20" stroke-width="2" stroke-dasharray="5,5" rx="10"/>
            <text x="420" y="240" font-family="${HANDWRITING_FONT}" font-size="20" fill="#dd6b20">
                Action Items:
            </text>
            <text x="440" y="280" font-family="${HANDWRITING_FONT}" font-size="18" fill="#333">
                1. Send report by Friday
            </text>
            <text x="440" y="320" font-family="${HANDWRITING_FONT}" font-size="18" fill="#333">
                2. Schedule follow-up
            </text>
        </svg>`,
    },
    {
        name: 'handwritten_todo_list',
        description: 'Handwritten todo list on paper',
        expectedText: 'To Do Today\n☐ Write documentation\n☐ Fix bug #123\n☑ Code review\n☐ Deploy to staging',
        width: 600,
        height: 800,
        svg: `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="800" viewBox="0 0 600 800">
            <!-- Paper background with lines -->
            <rect width="600" height="800" fill="#fffef0"/>
            <defs>
                <pattern id="lines" patternUnits="userSpaceOnUse" width="600" height="30">
                    <line x1="0" y1="29" x2="600" y2="29" stroke="#d4e5ed" stroke-width="1"/>
                </pattern>
            </defs>
            <rect width="600" height="800" fill="url(#lines)"/>

            <!-- Red margin line -->
            <line x1="80" y1="0" x2="80" y2="800" stroke="#ffcccc" stroke-width="2"/>

            <!-- Title -->
            <text x="100" y="60" font-family="${HANDWRITING_FONT}" font-size="32" fill="#1a365d" transform="rotate(-1 100 60)">
                To Do Today
            </text>

            <!-- Todo items -->
            <rect x="100" y="100" width="20" height="20" fill="none" stroke="#333" stroke-width="2"/>
            <text x="135" y="118" font-family="${HANDWRITING_FONT}" font-size="22" fill="#333">
                Write documentation
            </text>

            <rect x="100" y="160" width="20" height="20" fill="none" stroke="#333" stroke-width="2"/>
            <text x="135" y="178" font-family="${HANDWRITING_FONT}" font-size="22" fill="#333">
                Fix bug #123
            </text>

            <rect x="100" y="220" width="20" height="20" fill="none" stroke="#333" stroke-width="2"/>
            <path d="M 102 230 L 110 238 L 118 222" stroke="#38a169" stroke-width="3" fill="none"/>
            <text x="135" y="238" font-family="${HANDWRITING_FONT}" font-size="22" fill="#666" text-decoration="line-through">
                Code review
            </text>

            <rect x="100" y="280" width="20" height="20" fill="none" stroke="#333" stroke-width="2"/>
            <text x="135" y="298" font-family="${HANDWRITING_FONT}" font-size="22" fill="#333">
                Deploy to staging
            </text>

            <!-- Note at bottom -->
            <text x="100" y="400" font-family="${HANDWRITING_FONT}" font-size="18" fill="#e53e3e" transform="rotate(2 100 400)">
                * Priority: High!
            </text>
        </svg>`,
    },
    {
        name: 'simple_diagram',
        description: 'Simple diagram with labels',
        expectedText: 'System Architecture\nClient → API → Database\nCache layer for performance',
        width: 800,
        height: 500,
        svg: `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="500" viewBox="0 0 800 500">
            <!-- Background -->
            <rect width="800" height="500" fill="#fafafa"/>

            <!-- Title -->
            <text x="300" y="50" font-family="${HANDWRITING_FONT}" font-size="28" fill="#2d3748" transform="rotate(-1 300 50)">
                System Architecture
            </text>
            <path d="M 295 60 Q 400 65 530 58" stroke="#2d3748" stroke-width="2" fill="none"/>

            <!-- Client box -->
            <rect x="50" y="150" width="140" height="80" fill="#bee3f8" stroke="#3182ce" stroke-width="2" rx="10"/>
            <text x="85" y="200" font-family="${HANDWRITING_FONT}" font-size="24" fill="#2c5282">
                Client
            </text>

            <!-- Arrow 1 -->
            <path d="M 190 190 L 270 190" stroke="#333" stroke-width="2" fill="none"/>
            <polygon points="280,190 270,185 270,195" fill="#333"/>

            <!-- API box -->
            <rect x="290" y="150" width="140" height="80" fill="#c6f6d5" stroke="#38a169" stroke-width="2" rx="10"/>
            <text x="340" y="200" font-family="${HANDWRITING_FONT}" font-size="24" fill="#276749">
                API
            </text>

            <!-- Arrow 2 -->
            <path d="M 430 190 L 510 190" stroke="#333" stroke-width="2" fill="none"/>
            <polygon points="520,190 510,185 510,195" fill="#333"/>

            <!-- Database box -->
            <rect x="530" y="150" width="160" height="80" fill="#fed7d7" stroke="#e53e3e" stroke-width="2" rx="10"/>
            <text x="560" y="200" font-family="${HANDWRITING_FONT}" font-size="24" fill="#c53030">
                Database
            </text>

            <!-- Cache annotation -->
            <ellipse cx="360" cy="320" rx="120" ry="40" fill="none" stroke="#805ad5" stroke-width="2" stroke-dasharray="5,5"/>
            <text x="280" y="328" font-family="${HANDWRITING_FONT}" font-size="18" fill="#553c9a">
                Cache layer
            </text>

            <!-- Arrow to cache -->
            <path d="M 360 230 L 360 280" stroke="#805ad5" stroke-width="2" stroke-dasharray="3,3"/>

            <!-- Note -->
            <text x="500" y="400" font-family="${HANDWRITING_FONT}" font-size="16" fill="#666" transform="rotate(2 500 400)">
                * for performance
            </text>
        </svg>`,
    },
    {
        name: 'quick_notes',
        description: 'Quick handwritten notes',
        expectedText: 'Ideas:\n- New feature brainstorm\n- User feedback integration\n- Performance improvements',
        width: 500,
        height: 400,
        svg: `<svg xmlns="http://www.w3.org/2000/svg" width="500" height="400" viewBox="0 0 500 400">
            <!-- Sticky note background -->
            <rect width="500" height="400" fill="#fff59d"/>
            <rect x="0" y="0" width="500" height="30" fill="#ffee58"/>

            <!-- Fold corner effect -->
            <polygon points="450,0 500,0 500,50" fill="#fdd835"/>

            <!-- Title -->
            <text x="40" y="80" font-family="${HANDWRITING_FONT}" font-size="32" fill="#333" transform="rotate(-2 40 80)">
                Ideas:
            </text>

            <!-- Notes -->
            <text x="50" y="140" font-family="${HANDWRITING_FONT}" font-size="22" fill="#555" transform="rotate(1 50 140)">
                - New feature brainstorm
            </text>

            <text x="50" y="190" font-family="${HANDWRITING_FONT}" font-size="22" fill="#555" transform="rotate(-0.5 50 190)">
                - User feedback integration
            </text>

            <text x="50" y="240" font-family="${HANDWRITING_FONT}" font-size="22" fill="#555" transform="rotate(0.5 50 240)">
                - Performance improvements
            </text>

            <!-- Star doodle -->
            <polygon points="420,320 425,340 445,340 430,352 435,372 420,360 405,372 410,352 395,340 415,340"
                     fill="#ff8f00" stroke="#f57c00" stroke-width="1"/>
        </svg>`,
    },
];

// Generate HTML file that can be opened in browser to save as PNG
function generateHtmlViewer(): string {
    const imageCards = testImages
        .map(
            (img, index) => `
        <div class="card">
            <h3>${img.name}</h3>
            <p>${img.description}</p>
            <div class="image-container" id="container-${index}">
                ${img.svg}
            </div>
            <div class="expected">
                <strong>Expected text:</strong>
                <pre>${img.expectedText}</pre>
            </div>
            <button onclick="downloadImage(${index}, '${img.name}')">Download PNG</button>
        </div>
    `,
        )
        .join('\n');

    return `<!DOCTYPE html>
<html>
<head>
    <title>Test Image Generator</title>
    <style>
        body { font-family: Arial, sans-serif; padding: 20px; background: #f0f0f0; }
        .card { background: white; padding: 20px; margin: 20px 0; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .image-container { border: 1px solid #ddd; margin: 10px 0; display: inline-block; }
        .image-container svg { display: block; }
        .expected { background: #f9f9f9; padding: 10px; margin: 10px 0; border-radius: 4px; }
        .expected pre { white-space: pre-wrap; margin: 5px 0; }
        button { background: #4299e1; color: white; border: none; padding: 10px 20px; border-radius: 4px; cursor: pointer; }
        button:hover { background: #3182ce; }
        h1 { color: #2d3748; }
    </style>
</head>
<body>
    <h1>Handwritten Test Images for E2E Testing</h1>
    <p>Click the download button to save each image as PNG.</p>

    ${imageCards}

    <script>
        async function downloadImage(index, name) {
            const container = document.getElementById('container-' + index);
            const svg = container.querySelector('svg');

            // Create canvas
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');

            // Get SVG dimensions
            const width = parseInt(svg.getAttribute('width'));
            const height = parseInt(svg.getAttribute('height'));
            canvas.width = width;
            canvas.height = height;

            // Convert SVG to data URL
            const svgData = new XMLSerializer().serializeToString(svg);
            const svgBlob = new Blob([svgData], {type: 'image/svg+xml;charset=utf-8'});
            const url = URL.createObjectURL(svgBlob);

            // Draw to canvas and download
            const img = new Image();
            img.onload = function() {
                ctx.fillStyle = 'white';
                ctx.fillRect(0, 0, width, height);
                ctx.drawImage(img, 0, 0);
                URL.revokeObjectURL(url);

                // Download
                const link = document.createElement('a');
                link.download = name + '.png';
                link.href = canvas.toDataURL('image/png');
                link.click();
            };
            img.src = url;
        }
    </script>
</body>
</html>`;
}

// Generate JSON file with test image metadata
function generateMetadata(): object {
    return {
        description: 'Test images for Image AI E2E testing',
        generatedAt: new Date().toISOString(),
        images: testImages.map((img) => ({
            name: img.name,
            filename: `${img.name}.png`,
            description: img.description,
            expectedText: img.expectedText,
        })),
    };
}

// Generate PNG files using Playwright
async function generatePngFiles(): Promise<void> {
    const fixturesDir = __dirname;

    // eslint-disable-next-line no-console
    console.log('Launching browser to generate PNG files...');
    const browser = await chromium.launch();
    const context = await browser.newContext();

    for (const img of testImages) {
        // eslint-disable-next-line no-console
        console.log(`Generating ${img.name}.png...`);

        const page = await context.newPage();

        // Set viewport to match image size
        await page.setViewportSize({width: img.width, height: img.height});

        // Create HTML page with SVG
        const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    * { margin: 0; padding: 0; }
                    body { width: ${img.width}px; height: ${img.height}px; overflow: hidden; }
                    svg { display: block; }
                </style>
            </head>
            <body>${img.svg}</body>
            </html>
        `;

        await page.setContent(html);

        // Take screenshot as PNG
        const pngPath = path.join(fixturesDir, `${img.name}.png`);
        await page.screenshot({path: pngPath, type: 'png'});

        await page.close();
    }

    await browser.close();
    // eslint-disable-next-line no-console
    console.log('Done generating PNG files!');
}

// Main execution
async function main(): Promise<void> {
    const fixturesDir = __dirname;

    // Write HTML viewer
    const htmlPath = path.join(fixturesDir, 'test_images_viewer.html');
    fs.writeFileSync(htmlPath, generateHtmlViewer());
    // eslint-disable-next-line no-console
    console.log(`Generated: ${htmlPath}`);

    // Write metadata JSON
    const metadataPath = path.join(fixturesDir, 'test_images_metadata.json');
    fs.writeFileSync(metadataPath, JSON.stringify(generateMetadata(), null, 2));
    // eslint-disable-next-line no-console
    console.log(`Generated: ${metadataPath}`);

    // Generate PNG files using Playwright
    await generatePngFiles();

    // Remove old SVG files
    for (const img of testImages) {
        const svgPath = path.join(fixturesDir, `${img.name}.svg`);
        if (fs.existsSync(svgPath)) {
            fs.unlinkSync(svgPath);
            // eslint-disable-next-line no-console
            console.log(`Removed: ${svgPath}`);
        }
    }
}

// eslint-disable-next-line no-console
main().catch(console.error);

export {testImages};
export type {TestImage};
