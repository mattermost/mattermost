// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {closeRightHandSide, showMentions} from 'actions/views/rhs';

import {renderWithContext, userEvent} from 'tests/react_testing_utils';
import {RHSStates} from 'utils/constants';
import {defaultMentionFilters} from 'utils/mention_search';

import type {MentionFilters} from 'types/store/rhs';

import GlobalSearchNav from './global_search_nav';

jest.mock('actions/views/rhs', () => ({
    ...jest.requireActual('actions/views/rhs'),
    closeRightHandSide: jest.fn(() => ({type: 'MOCK_CLOSE_RHS'})),
    showMentions: jest.fn(() => ({type: 'MOCK_SHOW_MENTIONS'})),
}));

describe('components/GlobalSearchNav', () => {
    test('should match snapshot with active flagged posts', () => {
        const {container} = renderWithContext(
            <GlobalSearchNav/>,
            {
                entities: {
                    general: {
                        config: {},
                    },
                },
                views: {
                    rhs: {
                        rhsState: 'flag',
                        isSidebarOpen: true,
                    },
                },
            },
        );
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot with active mentions posts', () => {
        const {container} = renderWithContext(
            <GlobalSearchNav/>,
            {
                entities: {
                    general: {
                        config: {},
                    },
                },
                views: {
                    rhs: {
                        rhsState: 'mentions',
                        isSidebarOpen: true,
                    },
                },
            },
        );
        expect(container).toMatchSnapshot();
    });

    describe('the mentions shortcut', () => {
        function renderWithMentions(mentionFilters: MentionFilters, searchTeam: string | null) {
            renderWithContext(
                <GlobalSearchNav/>,
                {
                    entities: {general: {config: {}}},
                    views: {
                        rhs: {
                            rhsState: RHSStates.MENTION,
                            isSidebarOpen: true,
                            searchTeam,
                            mentionFilters,
                        },
                    },
                },
            );
        }

        beforeEach(() => {
            jest.clearAllMocks();
        });

        test('closes the panel when the unfiltered mentions view is showing', async () => {
            renderWithMentions(defaultMentionFilters, null);

            await userEvent.keyboard('{Control>}{Shift>}m{/Shift}{/Control}');

            expect(closeRightHandSide).toHaveBeenCalledTimes(1);
            expect(showMentions).not.toHaveBeenCalled();
        });

        test('widens back out to all mentions when the view is filtered', async () => {
            renderWithMentions({...defaultMentionFilters, channelIds: ['channel_id']}, null);

            await userEvent.keyboard('{Control>}{Shift>}m{/Shift}{/Control}');

            expect(showMentions).toHaveBeenCalledTimes(1);
            expect(closeRightHandSide).not.toHaveBeenCalled();
        });

        test('widens back out to all mentions when the view is scoped to a team', async () => {
            renderWithMentions(defaultMentionFilters, 'team_id');

            await userEvent.keyboard('{Control>}{Shift>}m{/Shift}{/Control}');

            expect(showMentions).toHaveBeenCalledTimes(1);
            expect(closeRightHandSide).not.toHaveBeenCalled();
        });
    });
});
