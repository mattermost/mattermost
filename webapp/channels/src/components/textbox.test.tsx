// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import Textbox, {type Props} from 'components/textbox/textbox';

import {renderWithContext} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

jest.mock('components/suggestion/suggestion_box', () => {
    // Use require inside the factory: jest hoists mocks before imports run, and babel-plugin-jest-hoist
    // forbids non-mock-prefixed outer variables (e.g. React). Cast so forwardRef accepts generics (TS2347).
    const react = require('react') as typeof import('react'); // eslint-disable-line @typescript-eslint/no-var-requires, global-require
    const MockSuggestionBox = react.forwardRef<HTMLTextAreaElement, any>((props: any, ref: any) => (
        <textarea
            ref={ref}
            id={props.id}
            className={props.className}
            placeholder={props.placeholder}
            value={props.value}
            disabled={props.disabled}
            data-testid='suggestion-box'
            readOnly={true}
            style={props.style}
        />
    ));
    MockSuggestionBox.displayName = 'SuggestionBox';
    return {__esModule: true, default: MockSuggestionBox};
});

jest.mock('components/post_markdown', () => {
    return {
        __esModule: true,
        default: (props: any) => <div data-testid='post-markdown'>{props.message}</div>,
    };
});

jest.mock('components/suggestion/suggestion_list', () => {
    return {
        __esModule: true,
        default: () => null,
    };
});

jest.mock('components/suggestion/at_mention_provider', () => {
    return jest.fn().mockImplementation(() => ({setProps: jest.fn()}));
});
jest.mock('components/suggestion/channel_mention_provider', () => {
    return jest.fn().mockImplementation(() => ({setProps: jest.fn()}));
});
jest.mock('components/suggestion/command_provider/command_provider', () => {
    return jest.fn().mockImplementation(() => ({setProps: jest.fn()}));
});
jest.mock('components/suggestion/command_provider/app_provider', () => {
    return jest.fn().mockImplementation(() => ({setProps: jest.fn()}));
});
jest.mock('components/suggestion/emoticon_provider', () => {
    return jest.fn().mockImplementation(() => ({}));
});

jest.mock('components/remove_flagged_message_confirmation_modal/remove_flagged_message_confirmation_modal', () => {
    return jest.fn(() => <div data-testid='keep-remove-flagged-message-confirmation-modal'>{'KeepRemoveFlaggedMessageConfirmationModal Mock'}</div>);
});

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
            fetchAgents: jest.fn(),
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

        const {container} = renderWithContext(
            <Textbox {...props}/>,
        );
        expect(container).toMatchSnapshot();
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
            onCompositionUpdate: jest.fn().mockReturnValue({}),
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

        const {container} = renderWithContext(
            <Textbox {...props}/>,
        );
        expect(container).toMatchSnapshot();
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

        const {container} = renderWithContext(
            <Textbox {...props}/>,
        );

        expect(gotError).toEqual(true);
        expect(container).toMatchSnapshot();
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

        const {container, rerender} = renderWithContext(
            <Textbox {...props}/>,
        );

        const newProps = {
            ...props,
            value: 'some test text that exceeds char limit',
        };

        rerender(
            <Textbox {...newProps}/>,
        );

        expect(gotError).toEqual(true);
        expect(container).toMatchSnapshot();
    });
});
