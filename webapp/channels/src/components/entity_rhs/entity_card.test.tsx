// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {EntityCard} from '@mattermost/types/posts';

import {renderWithContext} from 'tests/react_testing_utils';

import EntityCardView from './entity_card';

jest.mock('components/block_renderer', () => ({
    BlockRenderer: () => <div data-testid='block-renderer'/>,
}));
jest.mock('components/block_renderer/translation/mm_block', () => ({
    translateMMBlocks: (blocks: unknown[]) => blocks,
}));
jest.mock('components/external_link', () => ({
    __esModule: true,
    default: ({children, href, ...rest}: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
        <a
            href={href}
            {...rest}
        >{children}</a>
    ),
}));

describe('EntityCardView', () => {
    const baseCard: EntityCard = {
        type_id: 'mm.time',
        value: '2024-06-01T15:04:05Z',
        title: 'Timestamp',
        instant: Date.parse('2024-06-01T15:04:05Z'),
        blocks: [{type: 'text', text: '**UTC:** 15:04 UTC'}],
        url: 'https://example.com/time',
        rows: [{label: 'URL', value: 'https://example.com/time'}],
    };

    it('renders the blocks body and still shows the card url', () => {
        const {getByTestId} = renderWithContext(
            <EntityCardView card={baseCard}/>,
        );

        expect(getByTestId('entity-card')).toBeInTheDocument();
        expect(getByTestId('entity-card-blocks')).toBeInTheDocument();
        expect(getByTestId('entity-card-link')).toHaveAttribute('href', 'https://example.com/time');
    });
});
