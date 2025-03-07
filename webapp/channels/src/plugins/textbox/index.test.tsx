// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {render} from '@testing-library/react';

import PluginTextbox from '.';

// Mock the Textbox component to verify props
jest.mock('components/textbox', () => {
    const mockTextbox = jest.fn().mockImplementation((props) => {
        mockTextbox.lastProps = props;
        return <div data-testid="mock-textbox" />;
    });
    return mockTextbox;
});

describe('PluginTextbox', () => {
    const baseProps = {
        id: 'id',
        channelId: 'channelId',
        rootId: 'rootId',
        tabIndex: -1,
        value: '',
        onChange: jest.fn(),
        onKeyPress: jest.fn(),
        createMessage: 'This is a placeholder',
        supportsCommands: true,
        characterLimit: 10000,
        currentUserId: 'currentUserId',
        currentTeamId: 'currentTeamId',
        profilesInChannel: [],
        autocompleteGroups: null,
        actions: {
            autocompleteUsersInChannel: jest.fn(),
            autocompleteChannels: jest.fn(),
            searchAssociatedGroupsForReference: jest.fn(),
        },
        useChannelMentions: true,
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('should rename suggestionListStyle to suggestionListPosition', () => {
        const props: React.ComponentProps<typeof PluginTextbox> = {
            ...baseProps,
            suggestionListStyle: 'bottom',
        };
        
        render(<PluginTextbox {...props}/>);

        // Get the mock Textbox component
        const Textbox = require('components/textbox');
        
        // Check the props passed to Textbox
        expect(Textbox.lastProps.suggestionListPosition).toEqual('bottom');
        expect(Textbox.lastProps.suggestionListStyle).toBeUndefined();
    });
});
