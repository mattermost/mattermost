// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import React from 'react';

import Textbox from 'components/textbox';

import PluginTextbox from '.';

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
        const props: React.ComponentProps<typeof PluginTextbox> = {
            ...baseProps,
            suggestionListStyle: 'bottom',
        };
        const wrapper = shallow(<PluginTextbox {...props}/>);

        expect(wrapper.find(Textbox).prop('suggestionListPosition')).toEqual('bottom');
        expect(wrapper.find(Textbox).prop('suggestionListStyle')).toBeUndefined();
    });
});
