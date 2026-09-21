// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import Constants from './constants';
import {highlight, renderLineNumbers} from './syntax_highlighting';

const LANGUAGE = 'cpp';

// The largest code block that a post can carry to the highlighter.
const MAX_POST_SIZED_LENGTH = 16000;

// An input at the scale that the code file preview accepts.
const ATTACHMENT_SIZED_LENGTH = 100000;

// The largest input the code file preview will ever hand over.
const PREVIEW_CEILING_LENGTH = Constants.CODE_PREVIEW_MAX_FILE_SIZE;

// A length that is small enough to always be highlighted, so that measurements taken
// with it describe the highlighting path rather than the plain text path.
const HIGHLIGHTED_BLOCK_LENGTH = 4000;

// Roughly how many highlighted blocks a few posts' worth of code puts into one render.
const BLOCKS_IN_VIEW = 12;

// Time budgets, in milliseconds, for a single call and for a run of consecutive calls.
const MAX_SINGLE_BLOCK_MS = 150;
const MAX_ATTACHMENT_MS = 500;
const MAX_BATCH_MS = 1000;
const MAX_LINE_NUMBERS_MS = 750;

// A block short enough to be highlighted does real work, so it is given a more generous
// ceiling than one that is only escaped.
const MAX_HIGHLIGHTED_BLOCK_MS = 400;

// How much longer than a single block the main thread may stay busy without letting a
// queued task run, and the floor below which that comparison is only measuring noise.
const MAX_OCCUPANCY_RATIO = 3;
const MIN_OCCUPANCY_MS = 50;

// How much more a block of one unbroken character run may cost than an equally
// sized block of ordinary multi-line source.
const MAX_COST_RATIO = 5;

// How much the cost may grow when the input length doubles.
const SCALING_BASE_LENGTH = 8000;
const MAX_GROWTH_RATIO = 3;

// Durations below this are dominated by noise, so they are used as the floor of
// any ratio to keep a fast reference measurement from inflating the result.
const MIN_DENOMINATOR_MS = 5;

const MEASUREMENT_RUNS = 3;
const BATCH_SIZE = 20;

// A language the code block offers but for which no grammar can be loaded, so that highlighting
// it reaches the highlighter and fails there rather than being turned away up front.
const LANGUAGE_WITHOUT_GRAMMAR = 'text';

const HTML_SENTINEL = '<script>alert(1)</script><img src=x onerror=alert(1)>';
const RAW_HTML_FRAGMENTS = ['<script>', '</script>', '<img src=x onerror='];

const SHORT_SOURCE = [
    '#include <cstdint>',
    '',
    'uint32_t compute_checksum(const uint8_t* buffer, size_t buffer_length) {',
    '    uint32_t total = 0;',
    '    for (size_t i = 0; i < buffer_length; ++i) {',
    '        total = (total << 3) ^ buffer[i];',
    '    }',
    '    return total;',
    '}',
].join('\n');

// A single unbroken run of identifier characters, with no whitespace or punctuation.
function singleRunSource(length: number, filler = 'x'): string {
    return filler.repeat(length);
}

// Ordinary multi-line source of a given length, with realistic line lengths.
function realisticSource(length: number): string {
    const lines: string[] = [];
    let size = 0;

    for (let i = 0; size < length; i++) {
        const declaration = `int compute_value_${i}(int alpha, int beta) { return (alpha * ${i}) + beta - 7; }`;
        const comment = `// helper routine number ${i} used by this translation unit`;

        lines.push(declaration, comment);
        size += declaration.length + comment.length + 2;
    }

    return lines.join('\n').slice(0, length);
}

function round(milliseconds: number): number {
    return Math.round(milliseconds * 10) / 10;
}

async function measure(lang: string, code: string): Promise<number> {
    const start = performance.now();
    await highlight(lang, code);
    return performance.now() - start;
}

// Takes the fastest of several runs so that scheduling noise cannot inflate a measurement.
async function measureBest(lang: string, code: string, runs = MEASUREMENT_RUNS): Promise<number> {
    let bestMs = Number.POSITIVE_INFINITY;

    for (let i = 0; i < runs; i++) {
        // eslint-disable-next-line no-await-in-loop
        const durationMs = await measure(lang, code);
        bestMs = Math.min(bestMs, durationMs);
    }

    return bestMs;
}

// Collapses a timing to a value that can be compared against a fixed expectation while
// still carrying the measurement itself, so a failure reports the numbers behind it.
function budgetReport(withinBudget: boolean, measurement: string): string {
    return withinBudget ? 'within budget' : `over budget: ${measurement}`;
}

// A block that is always highlighted and that ends in source the highlighter marks up, so
// that a measurement taken with it cannot be satisfied by returning the input as plain text.
function highlightedBlock(index: number): string {
    const filler = singleRunSource(HIGHLIGHTED_BLOCK_LENGTH - SHORT_SOURCE.length - 1 - index) + singleRunSource(index, 'y');

    return `${filler}\n${SHORT_SOURCE}`;
}

// Keeps a task queued at all times and records the longest interval in which that task could
// not run, which is the length of the longest stretch of work the main thread did without
// coming back to the queue. When nothing ever gets to run, that interval is the whole period.
function startTaskQueueProbe() {
    const startedAt = performance.now();
    let lastRunAt = startedAt;
    let longestBlockedMs = 0;
    let probing = true;

    const tick = () => {
        if (!probing) {
            return;
        }

        const now = performance.now();
        longestBlockedMs = Math.max(longestBlockedMs, now - lastRunAt);
        lastRunAt = now;
        setTimeout(tick, 0);
    };
    setTimeout(tick, 0);

    return function stop(): number {
        probing = false;
        return Math.max(longestBlockedMs, performance.now() - lastRunAt);
    };
}

describe('utils/syntax_highlighting large inputs', () => {
    beforeAll(async () => {
        // The first call for a language pays a one time module load cost that is not part of what is measured.
        await highlight(LANGUAGE, SHORT_SOURCE);
    });

    test('should cost no more than a small multiple of equally sized multi-line source', async () => {
        const controlMs = await measureBest(LANGUAGE, realisticSource(MAX_POST_SIZED_LENGTH));
        const singleRunMs = await measureBest(LANGUAGE, singleRunSource(MAX_POST_SIZED_LENGTH));

        const ratio = singleRunMs / Math.max(controlMs, MIN_DENOMINATOR_MS);

        expect(budgetReport(
            ratio <= MAX_COST_RATIO,
            `${MAX_POST_SIZED_LENGTH} characters of one unbroken run took ${round(singleRunMs)} ms ` +
            `against ${round(controlMs)} ms for multi-line source of the same length, ` +
            `a ratio of ${round(ratio)}x where at most ${MAX_COST_RATIO}x is allowed`,
        )).toBe('within budget');
    });

    test('should complete a maximum post sized block within a fixed time budget', async () => {
        const durationMs = await measureBest(LANGUAGE, singleRunSource(MAX_POST_SIZED_LENGTH));

        expect(budgetReport(
            durationMs < MAX_SINGLE_BLOCK_MS,
            `${MAX_POST_SIZED_LENGTH} characters of one unbroken run took ${round(durationMs)} ms ` +
            `where at most ${MAX_SINGLE_BLOCK_MS} ms is allowed`,
        )).toBe('within budget');
    });

    test('should complete a sequence of maximum post sized blocks within a total time budget', async () => {
        const blocks = Array.from(
            {length: BATCH_SIZE},
            (_, i) => singleRunSource(MAX_POST_SIZED_LENGTH - i) + singleRunSource(i, 'y'),
        );

        const start = performance.now();
        for (const block of blocks) {
            // eslint-disable-next-line no-await-in-loop
            await highlight(LANGUAGE, block);
        }
        const totalMs = performance.now() - start;

        expect(budgetReport(
            totalMs < MAX_BATCH_MS,
            `${BATCH_SIZE} consecutive blocks of ${MAX_POST_SIZED_LENGTH} characters took ${round(totalMs)} ms in total ` +
            `where at most ${MAX_BATCH_MS} ms is allowed`,
        )).toBe('within budget');
    }, 300000);

    test('should not grow more than proportionally when the input length doubles', async () => {
        const baseMs = await measureBest(LANGUAGE, singleRunSource(SCALING_BASE_LENGTH));
        const doubledMs = await measureBest(LANGUAGE, singleRunSource(SCALING_BASE_LENGTH * 2));

        const growth = doubledMs / Math.max(baseMs, MIN_DENOMINATOR_MS);

        expect(budgetReport(
            growth <= MAX_GROWTH_RATIO,
            `${SCALING_BASE_LENGTH} characters took ${round(baseMs)} ms and ${SCALING_BASE_LENGTH * 2} characters ` +
            `took ${round(doubledMs)} ms, a growth of ${round(growth)}x where at most ${MAX_GROWTH_RATIO}x is allowed`,
        )).toBe('within budget');
    }, 300000);

    test('should complete an attachment sized input within a fixed time budget', async () => {
        const durationMs = await measure(LANGUAGE, singleRunSource(ATTACHMENT_SIZED_LENGTH));

        expect(budgetReport(
            durationMs < MAX_ATTACHMENT_MS,
            `${ATTACHMENT_SIZED_LENGTH} characters of one unbroken run took ${round(durationMs)} ms ` +
            `where at most ${MAX_ATTACHMENT_MS} ms is allowed`,
        )).toBe('within budget');
    }, 600000);
});

describe('utils/syntax_highlighting output', () => {
    test.each([
        {
            name: 'a short multi-line block',
            code: SHORT_SOURCE,
            identifiers: ['compute_checksum', 'buffer_length'],
        },
        {
            name: 'a multi-kilobyte multi-line block',
            code: realisticSource(4000),
            identifiers: ['compute_value_0', 'compute_value_5'],
        },
    ])('should return highlighted markup for $name', async ({code, identifiers}) => {
        const result = await highlight(LANGUAGE, code);

        expect(result).toContain('class="hljs-');
        for (const identifier of identifiers) {
            expect(result).toContain(identifier);
        }
    });

    test.each([
        {
            name: 'a short block',
            code: `int main() { const char* s = "${HTML_SENTINEL}"; return 0; }`,
        },
        {
            name: 'an oversized block',
            code: singleRunSource(MAX_POST_SIZED_LENGTH) + HTML_SENTINEL,
        },
    ])('should escape HTML in the returned markup for $name', async ({code}) => {
        const result = await highlight(LANGUAGE, code);

        for (const fragment of RAW_HTML_FRAGMENTS) {
            expect(result).not.toContain(fragment);
        }
        expect(result).toContain('&lt;script&gt;');
    }, 300000);

    test('should return escaped code for an unsupported language', async () => {
        const result = await highlight('not-a-real-language', '<script>alert(1)</script>');

        expect(result).toBe('&lt;script&gt;alert(1)&lt;/script&gt;');
    });

    test('should return escaped code for a language whose grammar cannot be loaded', async () => {
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

        const result = await highlight(LANGUAGE_WITHOUT_GRAMMAR, '<script>alert(1)</script>');

        expect(result).toBe('&lt;script&gt;alert(1)&lt;/script&gt;');
        consoleSpy.mockRestore();
    });
});

describe('utils/syntax_highlighting scheduling', () => {
    beforeAll(async () => {
        await highlight(LANGUAGE, SHORT_SOURCE);
    });

    test.each([
        {
            name: 'when every block starts in the same render',
            dispatch: (blocks: string[]) => Promise.all(blocks.map((block) => highlight(LANGUAGE, block))),
        },
        {
            name: 'when each block starts after the previous one finishes',
            dispatch: async (blocks: string[]) => {
                const results: string[] = [];
                for (const block of blocks) {
                    // eslint-disable-next-line no-await-in-loop
                    results.push(await highlight(LANGUAGE, block));
                }
                return results;
            },
        },
    ])('should let a queued task run between blocks $name', async ({dispatch}) => {
        const blocks = Array.from({length: BLOCKS_IN_VIEW}, (_, i) => highlightedBlock(i));

        const singleBlockMs = await measureBest(LANGUAGE, blocks[0]);
        const budgetMs = Math.max(singleBlockMs * MAX_OCCUPANCY_RATIO, MIN_OCCUPANCY_MS);

        const stop = startTaskQueueProbe();
        const results = await dispatch(blocks);
        const blockedMs = stop();

        // Every block has to have gone down the highlighting path, otherwise the measurement
        // above describes the plain text path and says nothing about what is being asserted.
        for (const result of results) {
            expect(result).toContain('class="hljs-');
        }

        expect(budgetReport(
            blockedMs <= budgetMs,
            `${BLOCKS_IN_VIEW} blocks of ${HIGHLIGHTED_BLOCK_LENGTH} characters kept a queued task waiting for ` +
            `${round(blockedMs)} ms at a stretch, where a single block takes ${round(singleBlockMs)} ms and at most ` +
            `${round(budgetMs)} ms of waiting is allowed`,
        )).toBe('within budget');
    }, 300000);

    test('should keep highlighting later blocks after one whose grammar cannot be loaded', async () => {
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

        await Promise.all(Array.from(
            {length: BLOCKS_IN_VIEW},
            (_, i) => highlight(LANGUAGE_WITHOUT_GRAMMAR, `line ${i}`),
        ));

        const result = await highlight(LANGUAGE, SHORT_SOURCE);

        expect(result).toContain('class="hljs-');
        consoleSpy.mockRestore();
    });
});

describe('utils/syntax_highlighting input bounds', () => {
    beforeAll(async () => {
        await highlight(LANGUAGE, SHORT_SOURCE);
    });

    // Lengths either side of the point where the cost of one unbroken run stops being
    // proportional to its length. Longer inputs are covered by the tests below.
    test.each([
        {length: 4999},
        {length: 5000},
        {length: 5001},
    ])('should complete an input of $length characters within a fixed time budget', async ({length}) => {
        const durationMs = await measureBest(LANGUAGE, singleRunSource(length));

        expect(budgetReport(
            durationMs < MAX_HIGHLIGHTED_BLOCK_MS,
            `${length} characters of one unbroken run took ${round(durationMs)} ms ` +
            `where at most ${MAX_HIGHLIGHTED_BLOCK_MS} ms is allowed`,
        )).toBe('within budget');
    }, 300000);

    test.each([
        {name: 'an empty input', code: ''},
        {name: 'a single space', code: ' '},
        {name: 'a single newline', code: '\n'},
        {name: 'tabs only', code: '\t\t\t\t'},
        {name: 'blank lines only', code: '   \n  \n\n   '},
    ])('should preserve the text of $name', async ({code}) => {
        const result = await highlight(LANGUAGE, code);

        expect(result).toBe(code);
    });

    // The guard on how much work is done cannot depend on which grammar is in use, so the
    // same ceiling has to hold for every language the code block offers.
    test.each([
        {lang: 'cpp'},
        {lang: 'csharp'},
        {lang: 'typescript'},
        {lang: 'xml'},
        {lang: 'latex'},
        {lang: 'markdown'},
        {lang: 'python'},
        {lang: 'json'},
        {lang: 'plaintext'},
    ])('should complete a maximum post sized block of $lang within a fixed time budget', async ({lang}) => {
        await highlight(lang, SHORT_SOURCE);

        const durationMs = await measureBest(lang, singleRunSource(MAX_POST_SIZED_LENGTH));

        expect(budgetReport(
            durationMs < MAX_SINGLE_BLOCK_MS,
            `${MAX_POST_SIZED_LENGTH} characters of ${lang} took ${round(durationMs)} ms ` +
            `where at most ${MAX_SINGLE_BLOCK_MS} ms is allowed`,
        )).toBe('within budget');
    }, 300000);

    test('should complete the largest input the file preview accepts within a fixed time budget', async () => {
        const durationMs = await measure(LANGUAGE, singleRunSource(PREVIEW_CEILING_LENGTH));

        expect(budgetReport(
            durationMs < MAX_ATTACHMENT_MS,
            `${PREVIEW_CEILING_LENGTH} characters of one unbroken run took ${round(durationMs)} ms ` +
            `where at most ${MAX_ATTACHMENT_MS} ms is allowed`,
        )).toBe('within budget');
    }, 600000);

    // The code block reaches the highlighter through a lowercased name that it first rewrites
    // for a few languages, so every spelling has to arrive at the same ceiling.
    test.each([
        {lang: 'CPP'},
        {lang: 'c++'},
        {lang: 'C'},
        {lang: 'xml'},
        {lang: 'latex'},
    ])('should complete a maximum post sized block within a fixed time budget for the name $lang', async ({lang}) => {
        await highlight(lang, SHORT_SOURCE);

        const durationMs = await measureBest(lang, singleRunSource(MAX_POST_SIZED_LENGTH));

        expect(budgetReport(
            durationMs < MAX_SINGLE_BLOCK_MS,
            `${MAX_POST_SIZED_LENGTH} characters named as ${lang} took ${round(durationMs)} ms ` +
            `where at most ${MAX_SINGLE_BLOCK_MS} ms is allowed`,
        )).toBe('within budget');
    }, 300000);

    // The point at which highlighting stops being applied has to be a single sharp step, so
    // that no length in between is left without a defined outcome, and it has to sit above
    // the size that is always highlighted.
    test('should apply highlighting up to a single sharp length boundary', async () => {
        const isHighlighted = async (length: number) => (await highlight(LANGUAGE, realisticSource(length))).includes('class="hljs-');

        let highlightedLength = HIGHLIGHTED_BLOCK_LENGTH;
        let plainLength = MAX_POST_SIZED_LENGTH;

        expect(await isHighlighted(highlightedLength)).toBe(true);
        expect(await isHighlighted(plainLength)).toBe(false);

        while (plainLength - highlightedLength > 1) {
            const midpoint = Math.floor((highlightedLength + plainLength) / 2);

            // eslint-disable-next-line no-await-in-loop
            if (await isHighlighted(midpoint)) {
                highlightedLength = midpoint;
            } else {
                plainLength = midpoint;
            }
        }

        expect(await isHighlighted(highlightedLength)).toBe(true);
        expect(await isHighlighted(highlightedLength + 1)).toBe(false);
    }, 300000);

    // Each of these inputs leads with characters whose count in code units differs from what
    // a reader would call a character, and is ordinary source for the rest of its length.
    test.each([
        {name: 'characters outside the basic plane', unit: '\u{1F600}'},
        {name: 'combining marks', unit: 'a\u0301'},
        {name: 'non-breaking spaces', unit: '\u00a0'},
        {name: 'zero width spaces', unit: '\u200b'},
        {name: 'unpaired surrogates', unit: '\ud800'},
        {name: 'carriage returns', unit: '\r'},
    ])('should complete a maximum post sized block of $name within a fixed time budget', async ({unit}) => {
        const prefix = unit.repeat(Math.floor((MAX_POST_SIZED_LENGTH / 8) / unit.length));
        const code = prefix + singleRunSource(MAX_POST_SIZED_LENGTH - prefix.length);

        const durationMs = await measureBest(LANGUAGE, code);

        expect(budgetReport(
            durationMs < MAX_SINGLE_BLOCK_MS,
            `${code.length} characters took ${round(durationMs)} ms ` +
            `where at most ${MAX_SINGLE_BLOCK_MS} ms is allowed`,
        )).toBe('within budget');
    }, 300000);

    test('should complete a maximum post sized block after a smaller block of the same language', async () => {
        await highlight(LANGUAGE, highlightedBlock(0));

        const code = singleRunSource(ATTACHMENT_SIZED_LENGTH);
        const durationMs = await measure(LANGUAGE, code);
        const result = await highlight(LANGUAGE, code);

        expect(result).not.toContain('class="hljs-');
        expect(budgetReport(
            durationMs < MAX_SINGLE_BLOCK_MS,
            `${ATTACHMENT_SIZED_LENGTH} characters took ${round(durationMs)} ms after a smaller block of the same ` +
            `language, where at most ${MAX_SINGLE_BLOCK_MS} ms is allowed`,
        )).toBe('within budget');
    }, 600000);
});

describe('utils/syntax_highlighting line numbers', () => {
    test.each([
        {name: 'a maximum post sized block of blank lines', code: '\n'.repeat(MAX_POST_SIZED_LENGTH), lines: MAX_POST_SIZED_LENGTH + 1},
        {name: 'the largest input the file preview accepts', code: '\n'.repeat(PREVIEW_CEILING_LENGTH), lines: PREVIEW_CEILING_LENGTH + 1},
    ])('should number the lines of $name within a fixed time budget', ({code, lines}) => {
        let bestMs = Number.POSITIVE_INFINITY;
        let result = '';

        for (let i = 0; i < MEASUREMENT_RUNS; i++) {
            const start = performance.now();
            result = renderLineNumbers(code);
            bestMs = Math.min(bestMs, performance.now() - start);
        }

        expect(result.split('\n')).toHaveLength(lines);
        expect(budgetReport(
            bestMs < MAX_LINE_NUMBERS_MS,
            `${lines} line numbers took ${round(bestMs)} ms where at most ${MAX_LINE_NUMBERS_MS} ms is allowed`,
        )).toBe('within budget');
    }, 300000);
});
