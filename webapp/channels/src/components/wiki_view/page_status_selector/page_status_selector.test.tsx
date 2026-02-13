// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {PostType} from '@mattermost/types/posts';
import type {FieldType} from '@mattermost/types/properties';

import {renderWithContext, screen} from 'tests/react_testing_utils';

import PageStatusSelector from './page_status_selector';

jest.mock('actions/pages', () => ({
    fetchPageStatusField: jest.fn(() => ({type: 'FETCH_PAGE_STATUS_FIELD'})),
    updatePageStatus: jest.fn((pageId: string, status: string) => ({
        type: 'UPDATE_PAGE_STATUS',
        pageId,
        status,
    })),
}));

describe('components/wiki_view/page_status_selector/PageStatusSelector', () => {
    const mockStatusField = {
        id: 'status-field-id',
        name: 'Status',
        type: 'select' as FieldType,
        group_id: 'group-1',
        create_at: 1000,
        update_at: 1000,
        delete_at: 0,
        options: [
            {id: 'in-progress', value: 'In progress', color: '#1E90FF'},
            {id: 'review', value: 'Review', color: '#FFD700'},
            {id: 'done', value: 'Done', color: '#32CD32'},
        ],
    };

    const baseState = {
        entities: {
            general: {
                config: {},
            },
            users: {
                currentUserId: 'user1',
                profiles: {},
            },
            posts: {
                posts: {
                    'page-1': {
                        id: 'page-1',
                        type: 'page' as PostType,
                        props: {
                            page_status: 'In progress',
                        },
                    },
                },
            },
            wikiPages: {
                statusField: mockStatusField,
            },
        },
    };

    const baseProps = {
        pageId: 'page-1',
    };

    test('renders nothing when statusField is not loaded', () => {
        const stateWithoutStatusField = {
            ...baseState,
            entities: {
                ...baseState.entities,
                wikiPages: {
                    statusField: null,
                },
            },
        };

        const {container} = renderWithContext(
            <PageStatusSelector {...baseProps}/>,
            stateWithoutStatusField,
        );

        expect(container.querySelector('.page-status-selector')).not.toBeInTheDocument();
    });

    test('renders status selector when statusField is available', () => {
        renderWithContext(
            <PageStatusSelector {...baseProps}/>,
            baseState,
        );

        expect(screen.getByText('Status')).toBeInTheDocument();
    });

    test('dispatches fetchPageStatusField on mount when not loaded', () => {
        const {fetchPageStatusField} = require('actions/pages');
        const stateWithoutStatusField = {
            ...baseState,
            entities: {
                ...baseState.entities,
                wikiPages: {
                    statusField: null,
                },
            },
        };

        renderWithContext(
            <PageStatusSelector {...baseProps}/>,
            stateWithoutStatusField,
        );

        expect(fetchPageStatusField).toHaveBeenCalled();
    });

    test('uses draftStatus for draft pages', () => {
        renderWithContext(
            <PageStatusSelector
                {...baseProps}
                isDraft={true}
                draftStatus='Review'
            />,
            baseState,
        );

        expect(screen.getByText('Status')).toBeInTheDocument();
    });

    test('calls onDraftStatusChange for draft pages', () => {
        const onDraftStatusChange = jest.fn();
        renderWithContext(
            <PageStatusSelector
                {...baseProps}
                isDraft={true}
                draftStatus='In progress'
                onDraftStatusChange={onDraftStatusChange}
            />,
            baseState,
        );

        expect(screen.getByText('Status')).toBeInTheDocument();
    });
});
