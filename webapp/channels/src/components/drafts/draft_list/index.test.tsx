// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import type {Props as AutoSizerProps} from 'react-virtualized-auto-sizer';

import type {Draft} from 'selectors/drafts';

import {renderWithContext, screen} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import type {PostDraft} from 'types/store/draft';

import DraftList from './index';

jest.mock('react-virtualized-auto-sizer', () => (props: AutoSizerProps) => props.children({height: 100, width: 100, scaledHeight: 100, scaledWidth: 100}));

jest.mock('components/drafts/draft_row', () => {
    return function MockDraftRow(props: {item: PostDraft}) {
        return (
            <div
                data-testid='draft-row'
                className='draft-row-mock'
            >
                {props.item.message}
            </div>
        );
    };
});

describe('components/drafts/draft_list', () => {
    const currentUser = TestHelper.getUserMock({id: 'user1'});

    const mockDrafts: Draft[] = [
        {
            id: 'channel1',
            type: 'channel',
            key: 'draft_channel1',
            value: TestHelper.getPostDraftMock({
                message: 'What you seek is seeking you',
            }),
            timestamp: new Date(),
        },
        {
            id: 'channel2',
            type: 'channel',
            key: 'draft_channel2',
            value: TestHelper.getPostDraftMock({
                message: 'Where there is ruin, there is hope for a treasure.',
            }),
            timestamp: new Date(),
        },
    ];

    const initialState = {
        views: {
            drafts: {
                remotes: {
                    draft_channel1: false,
                },
            },
        },
    };

    test('should render empty draft list when no drafts are provided', () => {
        renderWithContext(
            <DraftList
                drafts={[]}
                currentUser={currentUser}
                userDisplayName='User One'
                userStatus='online'
            />,
            initialState,
        );

        expect(screen.getByText('No drafts at the moment')).toBeInTheDocument();
    });

    test('should handle undefined drafts', () => {
        renderWithContext(
            <DraftList
                drafts={[]}
                currentUser={currentUser}
                userDisplayName='User One'
                userStatus='online'
            />,
            initialState,
        );

        expect(screen.getByText('No drafts at the moment')).toBeInTheDocument();
    });

    test('should render virtualized draft list when drafts are provided', () => {
        renderWithContext(
            <DraftList
                drafts={mockDrafts}
                currentUser={currentUser}
                userDisplayName='User One'
                userStatus='online'
            />,
            initialState,
        );

        expect(screen.getByText('What you seek is seeking you')).toBeInTheDocument();
        expect(screen.getByText('Where there is ruin, there is hope for a treasure.')).toBeInTheDocument();
    });
});
