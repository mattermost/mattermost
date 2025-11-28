// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext} from 'tests/vitest_react_testing_utils';

import PluginTextbox from '.';

describe('PluginTextbox', () => {
    const baseProps = {
        id: 'id',
        channelId: 'channelId',
        rootId: 'rootId',
        tabIndex: -1,
        value: '',
        onChange: vi.fn(),
        onKeyPress: vi.fn(),
        createMessage: 'This is a placeholder',
        supportsCommands: true,
        characterLimit: 10000,
        currentUserId: 'currentUserId',
        currentTeamId: 'currentTeamId',
        profilesInChannel: [],
        autocompleteGroups: null,
        actions: {
            autocompleteUsersInChannel: vi.fn(),
            autocompleteChannels: vi.fn(),
            searchAssociatedGroupsForReference: vi.fn(),
        },
        useChannelMentions: true,
    };

    test('should render with suggestionListStyle prop', () => {
        const props: React.ComponentProps<typeof PluginTextbox> = {
            ...baseProps,
            suggestionListStyle: 'bottom',
        };
        const {container} = renderWithContext(<PluginTextbox {...props}/>);

        // Verify component renders - the suggestionListStyle prop is renamed internally to suggestionListPosition
        expect(container.querySelector('textarea')).toBeInTheDocument();
    });
});
