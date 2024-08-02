// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import React from 'react';

import Textbox, {type Props} from 'components/textbox/textbox';

import {TestHelper} from 'utils/test_helper';

describe('components/TextBox', () => {
    const baseProps: Props = {
        channelId: 'channelId',
        rootId: 'rootId',
        currentUserId: 'currentUserId',
        currentTeamId: 'currentTeamId',
        delayChannelAutocomplete: false,
        autocompleteGroups: [
            TestHelper.getGroupMock({id: 'gid1'}),
            TestHelper.getGroupMock({id: 'gid2'}),
        ],
        actions: {
            autocompleteUsersInChannel: jest.fn(),
            autocompleteChannels: jest.fn(),
            searchAssociatedGroupsForReference: jest.fn(),
        },
        useChannelMentions: true,
        tabIndex: 0,
        id: '',
        value: '',
        onChange: jest.fn(),
        onKeyPress: jest.fn(),
        createMessage: '',
        characterLimit: 0,
    };

    test('should match snapshot with required props', () => {
        const emptyFunction = jest.fn();
        const props = {
            ...baseProps,
            id: 'someid',
            value: 'some test text',
            onChange: emptyFunction,
            onKeyPress: emptyFunction,
            characterLimit: 400,
            createMessage: 'placeholder text',
            supportsCommands: false,
        };

        const wrapper = shallow(
            <Textbox {...props}/>,
        );
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot with additional, optional props', () => {
        const emptyFunction = jest.fn();
        const props = {
            ...baseProps,
            id: 'someid',
            value: 'some test text',
            onChange: emptyFunction,
            onKeyPress: emptyFunction,
            characterLimit: 4000,
            createMessage: 'placeholder text',
            supportsCommands: false,
            rootId: 'root_id',
            onComposition: jest.fn().mockReturnValue({}),
            onHeightChange: jest.fn().mockReturnValue({}),
            onKeyDown: jest.fn().mockReturnValue({}),
            onMouseUp: jest.fn().mockReturnValue({}),
            onKeyUp: jest.fn().mockReturnValue({}),
            onBlur: jest.fn().mockReturnValue({}),
            handlePostError: jest.fn().mockReturnValue({}),
            suggestionListPosition: 'top' as const,
            emojiEnabled: true,
            disabled: true,
            badConnection: true,
            preview: true,
            openWhenEmpty: true,
        };

        const wrapper = shallow(
            <Textbox {...props}/>,
        );
        expect(wrapper).toMatchSnapshot();
    });

    test('should throw error when value is too long', () => {
        const emptyFunction = jest.fn();

        // this mock function should be called when the textbox value is too long
        let gotError = false;
        const handlePostError = jest.fn((msg: React.ReactNode) => {
            gotError = msg !== null;
        });

        const props = {
            ...baseProps,
            id: 'someid',
            value: 'some test text that exceeds char limit',
            onChange: emptyFunction,
            onKeyPress: emptyFunction,
            characterLimit: 14,
            createMessage: 'placeholder text',
            supportsCommands: false,
            handlePostError,
        };

        const wrapper = shallow(
            <Textbox {...props}/>,
        );

        expect(gotError).toEqual(true);
        expect(wrapper).toMatchSnapshot();
    });

    test('should throw error when new property is too long', () => {
        const emptyFunction = jest.fn();

        // this mock function should be called when the textbox value is too long
        let gotError = false;
        const handlePostError = jest.fn((msg: React.ReactNode) => {
            gotError = msg !== null;
        });

        const props = {
            ...baseProps,
            id: 'someid',
            value: 'some test text',
            onChange: emptyFunction,
            onKeyPress: emptyFunction,
            characterLimit: 14,
            createMessage: 'placeholder text',
            supportsCommands: false,
            handlePostError,
        };

        const wrapper = shallow(
            <Textbox {...props}/>,
        );

        wrapper.setProps({value: 'some test text that exceeds char limit'});
        wrapper.update();
        expect(gotError).toEqual(true);

        expect(wrapper).toMatchSnapshot();
    });
});
