// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {SearchFilterType} from 'components/search/types';
import MessagesOrFilesSelector from 'components/search_results/messages_or_files_selector';

import {renderWithContext} from 'tests/react_testing_utils';

describe('components/search_results/MessagesOrFilesSelector', () => {
    const baseProps = {
        selected: 'messages' as 'messages' | 'files',
        selectedFilter: 'code' as SearchFilterType,
        messagesCounter: '5',
        filesCounter: '10',
        isFileAttachmentsEnabled: true,
        onChange: jest.fn(),
        onFilter: jest.fn(),
        onTeamChange: jest.fn(),
        crossTeamSearchEnabled: false,
    };

    const initialState = {
        entities: {
            teams: {
                currentTeamId: 'team1',
                teams: {
                    team1: {id: 'team1', name: 'team1', display_name: 'Team 1'},
                },
                myMembers: {
                    team1: {team_id: 'team1', user_id: 'user1'},
                },
            },
            users: {
                currentUserId: 'user1',
            },
            general: {
                config: {},
            },
        },
    };

    test('should match snapshot, on messages selected', () => {
        const {container} = renderWithContext(
            <MessagesOrFilesSelector {...baseProps}/>,
            initialState,
        );

        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, on files selected', () => {
        const props = {
            ...baseProps,
            selected: 'files' as 'messages' | 'files',
        };

        const {container} = renderWithContext(
            <MessagesOrFilesSelector {...props}/>,
            initialState,
        );

        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, without files tab', () => {
        const props = {
            ...baseProps,
            selected: 'files' as 'messages' | 'files',
            isFileAttachmentsEnabled: false,
        };

        const {container} = renderWithContext(
            <MessagesOrFilesSelector {...props}/>,
            initialState,
        );

        expect(container).toMatchSnapshot();
    });
});
