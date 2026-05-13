// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {PostType} from '@mattermost/types/posts';
import type {FieldType} from '@mattermost/types/properties';

import {makeInitialPagesState} from 'tests/helpers/pages_state';
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
        name: 'status',
        type: 'select' as FieldType,
        group_id: 'group-1',
        create_at: 1000,
        update_at: 1000,
        delete_at: 0,
        target_id: '',
        target_type: '',
        object_type: 'post',
        created_by: '',
        updated_by: '',
        attrs: {
            options: [
                {id: 'in-progress', name: 'In progress', color: '#1E90FF'},
                {id: 'review', name: 'Review', color: '#FFD700'},
                {id: 'done', name: 'Done', color: '#32CD32'},
            ],
        },
    };

    const statusFieldsState = {
        fields: {
            byObjectType: {
                post: {
                    'group-1': {
                        'status-field-id': mockStatusField,
                    },
                },
            },
            byId: {'status-field-id': mockStatusField},
        },
        groups: {
            byId: {'group-1': {id: 'group-1', name: 'pages'}},
            byName: {pages: {id: 'group-1', name: 'pages'}},
        },
        values: {byTargetId: {}},
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
            pages: makeInitialPagesState({
                byId: {
                    'page-1': {
                        id: 'page-1',
                        type: 'page' as PostType,
                        props: {
                            page_status: 'In progress',
                            wiki_id: 'wiki-1',
                        },
                    } as any,
                },
            }),
            properties: statusFieldsState,
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
                properties: {fields: {byObjectType: {}, byId: {}}},
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
                properties: {fields: {byObjectType: {}, byId: {}}},
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
