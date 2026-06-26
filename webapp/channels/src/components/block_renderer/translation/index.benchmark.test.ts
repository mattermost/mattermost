// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {IntlShape} from 'react-intl';

import {
    ADAPTIVE_CARDS_COMPLEX,
    ATTACHMENTS_COMPLEX,
    BLOCK_KIT_COMPLEX,
    MM_BLOCKS_COMPLEX,
} from './test_fixtures';

import {translatePostProps} from './index';

const mockIntl = {
    formatMessage: jest.fn((descriptor) => descriptor.defaultMessage),
} as unknown as IntlShape;

/** Typical max posts visible in a channel list at once. */
const POST_COUNT = 600;

const WARMUP_ITERATIONS = 50;

/** Jest setup mocks `performance.now` to `Date.now` (1ms resolution). */
function highResNowMs(): number {
    return Number(process.hrtime.bigint()) / 1e6;
}

type BenchmarkFormat = {
    label: string;
    props: Record<string, unknown>;
};

const BENCHMARK_FORMATS: BenchmarkFormat[] = [
    {label: 'mm_blocks', props: {mm_blocks: [...MM_BLOCKS_COMPLEX]}},
    {label: 'block_kit', props: {blocks: [...BLOCK_KIT_COMPLEX]}},
    {label: 'adaptive_cards', props: {cards: [...ADAPTIVE_CARDS_COMPLEX]}},
    {label: 'attachments', props: {attachments: [...ATTACHMENTS_COMPLEX]}},
];

function runTranslationBenchmark({label, props}: BenchmarkFormat) {
    for (let i = 0; i < WARMUP_ITERATIONS; i++) {
        translatePostProps(props, mockIntl);
    }

    const start = highResNowMs();
    let totalBlocks = 0;

    for (let i = 0; i < POST_COUNT; i++) {
        const result = translatePostProps(props, mockIntl);
        totalBlocks += result?.length ?? 0;
    }

    const elapsedMs = highResNowMs() - start;
    const perPostMs = elapsedMs / POST_COUNT;

    console.log(
        `[translatePostProps benchmark] ${label}: ` +
        `${elapsedMs.toFixed(2)}ms total, ` +
        `${perPostMs.toFixed(3)}ms per post, ` +
        `${POST_COUNT} posts`,
    );

    return {elapsedMs, perPostMs, totalBlocks};
}

describe('translatePostProps benchmark', () => {
    it.each(BENCHMARK_FORMATS)('should translate $label complex payloads 600 times', ({label, props}) => {
        const {elapsedMs, totalBlocks} = runTranslationBenchmark({label, props});

        expect(elapsedMs).toBeGreaterThanOrEqual(0);
        expect(totalBlocks).toBeGreaterThan(0);
    });
});

// Results from running this benchmark:
// [translatePostProps benchmark] mm_blocks: 15.34ms total, 0.026ms per post, 600 posts
// [translatePostProps benchmark] block_kit: 3.31ms total, 0.006ms per post, 600 posts
// [translatePostProps benchmark] adaptive_cards: 9.21ms total, 0.015ms per post, 600 posts
// [translatePostProps benchmark] attachments: 4.40ms total, 0.007ms per post, 600 posts
