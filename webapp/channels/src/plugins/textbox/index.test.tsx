// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext} from 'tests/react_testing_utils';

import PluginTextbox from '.';

const mockTextboxProps = jest.fn();
jest.mock('components/textbox', () => {
    // Use require inside the factory: jest hoists mocks before imports run, and babel-plugin-jest-hoist
    // forbids non-mock-prefixed outer variables (e.g. React). Cast so forwardRef is typed.
    const react = require('react') as typeof import('react'); // eslint-disable-line @typescript-eslint/no-var-requires, global-require
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- forwardRef arity; ref unused in mock
    const MockTextbox = react.forwardRef((props: unknown, _ref: unknown) => {
        mockTextboxProps(props);
        return null;
    });
    MockTextbox.displayName = 'Textbox';
    return {__esModule: true, default: MockTextbox};
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

    test('should rename suggestionListStyle to suggestionListPosition', () => {
        const props = {
            ...baseProps,
            suggestionListStyle: 'bottom' as const,
        };

        renderWithContext(<PluginTextbox {...props}/>);

        expect(mockTextboxProps).toHaveBeenCalledWith(
            expect.objectContaining({suggestionListPosition: 'bottom'}),
        );
        expect(mockTextboxProps).toHaveBeenCalledWith(
            expect.not.objectContaining({suggestionListStyle: expect.anything()}),
        );
    });
});
