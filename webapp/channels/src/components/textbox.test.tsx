// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {shallow} from 'enzyme';

import Textbox from 'components/textbox/textbox';

describe('components/TextBox', () => {
    const baseProps = {
        channelId: 'channelId',
        rootId: 'rootId',
        currentUserId: 'currentUserId',
        currentTeamId: 'currentTeamId',
        profilesInChannel: [
            {id: 'id1'},
            {id: 'id2'},
        ],
        delayChannelAutocomplete: false,
        autocompleteGroups: [
            {id: 'gid1'},
            {id: 'gid2'},
        ],
        actions: {
            autocompleteUsersInChannel: jest.fn(),
            autocompleteChannels: jest.fn(),
            searchAssociatedGroupsForReference: jest.fn(),
        },
        useChannelMentions: true,
        tabIndex: 0,
    };

    test('should match snapshot with required props', () => {
        function emptyFunction() {} //eslint-disable-line no-empty-function

        const wrapper = shallow(
            <Textbox
                id='someid'
                value='some test text'
                onChange={emptyFunction}
                onKeyPress={emptyFunction}
                characterLimit={4000}
                createMessage='placeholder text'
                supportsCommands={false}
                {...baseProps}
            />,
        );
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot with additional, optional props', () => {
        function emptyFunction() {} //eslint-disable-line no-empty-function

        const wrapper = shallow(
            <Textbox
                id='someid'
                value='some test text'
                onChange={emptyFunction}
                onKeyPress={emptyFunction}
                characterLimit={4000}
                createMessage='placeholder text'
                supportsCommands={false}
                {...baseProps}
                rootId='root_id'
                onComposition={() => {}}
                onHeightChange={() => {}}
                onKeyDown={() => {}}
                onMouseUp={() => {}}
                onKeyUp={() => {}}
                onBlur={() => {}}
                handlePostError={() => {}}
                suggestionListPosition='top'
                emojiEnabled={true}
                disabled={true}
                badConnection={true}
                preview={true}
                openWhenEmpty={true}
            />,
        );
        expect(wrapper).toMatchSnapshot();
    });

    test('should throw error when value is too long', () => {
        function emptyFunction() {} //eslint-disable-line no-empty-function

        // this mock function should be called when the textbox value is too long
        let gotError = false;
        function handlePostError(msg: React.ReactNode) {
            gotError = msg !== null;
        }

        const wrapper = shallow(
            <Textbox
                id='someid'
                value='some test text that exceeds char limit'
                onChange={emptyFunction}
                onKeyPress={emptyFunction}
                characterLimit={14}
                createMessage='placeholder text'
                supportsCommands={false}
                handlePostError={handlePostError}
                {...baseProps}
            />,
        );

        expect(gotError).toEqual(true);
        expect(wrapper).toMatchSnapshot();
    });

    test('should throw error when new property is too long', () => {
        function emptyFunction() {} //eslint-disable-line no-empty-function

        // this mock function should be called when the textbox value is too long
        let gotError = false;
        function handlePostError(msg: React.ReactNode) {
            gotError = msg !== null;
        }

        const wrapper = shallow(
            <Textbox
                id='someid'
                value='some test text'
                onChange={emptyFunction}
                onKeyPress={emptyFunction}
                characterLimit={14}
                createMessage='placeholder text'
                supportsCommands={false}
                handlePostError={handlePostError}
                {...baseProps}
            />,
        );

        wrapper.setProps({value: 'some test text that exceeds char limit'});
        wrapper.update();
        expect(gotError).toEqual(true);

        expect(wrapper).toMatchSnapshot();
    });
});
