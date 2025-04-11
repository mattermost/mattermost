// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {render} from '@testing-library/react';
import React from 'react';

import PluginTextbox from '.';

// Define the type for our mock
interface ExtendedMock extends jest.Mock {
    lastProps: any;
}

// Mock the Textbox component to verify props
jest.mock('components/textbox', () => {
    const mockTextbox = jest.fn().mockImplementation((props: any) => {
        (mockTextbox as ExtendedMock).lastProps = props;
        return <div data-testid='mock-textbox'/>;
    }) as ExtendedMock;

    // Initialize lastProps
    mockTextbox.lastProps = {};

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
        const Textbox = require('components/textbox') as ExtendedMock;

        // Check the props passed to Textbox
        expect(Textbox.lastProps.suggestionListPosition).toEqual('bottom');
        expect(Textbox.lastProps.suggestionListStyle).toBeUndefined();
    });
});
