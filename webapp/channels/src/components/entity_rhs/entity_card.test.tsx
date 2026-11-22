// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import userEvent from '@testing-library/user-event';
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
        type_id: 'mm:time',
        value: '2024-06-01T15:04:05Z',
        title: 'Timestamp',
        instant: Date.parse('2024-06-01T15:04:05Z'),
        blocks: [{type: 'text', text: '**UTC:** 15:04 UTC'}],
        url: 'https://example.com/time',
        rows: [{label: 'URL', value: 'https://example.com/time'}],
    };

    it('renders the blocks body and still shows the card url', () => {
        const {getByTestId} = renderWithContext(
            <EntityCardView
                card={baseCard}
                testIdScope='rhs.entity.card'
            />,
        );

        expect(getByTestId('rhs.entity.card--region')).toBeInTheDocument();
        expect(getByTestId('rhs.entity.card.blocks--region')).toBeInTheDocument();
        expect(getByTestId('rhs.entity.card.link--link')).toHaveAttribute('href', 'https://example.com/time');
    });

    it('renders a related term as its link and opens a typed value that has none', async () => {
        const onOpen = jest.fn();
        const card: EntityCard = {
            ...baseCard,
            related: [
                {label: 'Glossary', text: 'MLT', type_id: 'com.example:acronym', url: '/conflux/team/pages/abcdefghijklmnopqrstuvwxyz'},
                {label: 'When', text: '16:30 CET', type_id: 'mm:time'},
            ],
        };
        const {getByRole} = renderWithContext(
            <EntityCardView
                card={card}
                onOpen={onOpen}
            />,
        );

        const term = getByRole('link', {name: 'MLT'});
        expect(term).toHaveAttribute('href', '/conflux/team/pages/abcdefghijklmnopqrstuvwxyz');
        await userEvent.click(term);
        expect(onOpen).not.toHaveBeenCalled();

        await userEvent.click(getByRole('button', {name: '16:30 CET'}));
        expect(onOpen).toHaveBeenCalledWith({typeId: 'mm:time', value: '16:30 CET', label: 'When'});
    });
});
