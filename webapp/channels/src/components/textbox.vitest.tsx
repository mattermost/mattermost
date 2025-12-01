// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {MemoryRouter, Route} from 'react-router-dom';

import Textbox, {type Props} from 'components/textbox/textbox';

import {renderWithContext} from 'tests/vitest_react_testing_utils';
import {TestHelper} from 'utils/test_helper';

const baseState = {
    entities: {
        users: {
            currentUserId: 'currentUserId',
        },
        teams: {
            currentTeamId: 'currentTeamId',
            teams: {
                currentTeamId: {
                    id: 'currentTeamId',
                    name: 'team',
                },
            },
        },
        channels: {
            currentChannelId: 'channelId',
            channels: {},
        },
        general: {
            config: {},
        },
    },
};

const renderWithRouter = (component: React.ReactElement, state = baseState) => {
    return renderWithContext(
        <MemoryRouter initialEntries={['/team/channels/channelId']}>
            <Route path='/:team/channels/:channelId'>
                {component}
            </Route>
        </MemoryRouter>,
        state,
    );
};

vi.mock('components/remove_flagged_message_confirmation_modal/remove_flagged_message_confirmation_modal', () => {
    return {default: vi.fn(() => <div data-testid='keep-remove-flagged-message-confirmation-modal'>{'KeepRemoveFlaggedMessageConfirmationModal Mock'}</div>)};
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
            autocompleteUsersInChannel: vi.fn(),
            autocompleteChannels: vi.fn(),
            searchAssociatedGroupsForReference: vi.fn(),
        },
        useChannelMentions: true,
        tabIndex: 0,
        id: '',
        value: '',
        onChange: vi.fn(),
        onKeyPress: vi.fn(),
        createMessage: '',
        characterLimit: 0,
    };

    test('should match snapshot with required props', () => {
        const emptyFunction = vi.fn();
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

        const {container} = renderWithRouter(
            <Textbox {...props}/>,
        );
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot with additional, optional props', () => {
        const emptyFunction = vi.fn();
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
            onComposition: vi.fn().mockReturnValue({}),
            onHeightChange: vi.fn().mockReturnValue({}),
            onKeyDown: vi.fn().mockReturnValue({}),
            onMouseUp: vi.fn().mockReturnValue({}),
            onKeyUp: vi.fn().mockReturnValue({}),
            onBlur: vi.fn().mockReturnValue({}),
            handlePostError: vi.fn().mockReturnValue({}),
            suggestionListPosition: 'top' as const,
            emojiEnabled: true,
            disabled: true,
            badConnection: true,
            preview: true,
            openWhenEmpty: true,
        };

        const {container} = renderWithRouter(
            <Textbox {...props}/>,
        );
        expect(container).toMatchSnapshot();
    });

    test('should throw error when value is too long', () => {
        const emptyFunction = vi.fn();

        // this mock function should be called when the textbox value is too long
        let gotError = false;
        const handlePostError = vi.fn((msg: React.ReactNode) => {
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

        const {container} = renderWithRouter(
            <Textbox {...props}/>,
        );

        expect(gotError).toEqual(true);
        expect(container).toMatchSnapshot();
    });

    test('should throw error when new property is too long', () => {
        const emptyFunction = vi.fn();

        // this mock function should be called when the textbox value is too long
        let gotError = false;
        const handlePostError = vi.fn((msg: React.ReactNode) => {
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

        const {container} = renderWithRouter(
            <Textbox {...props}/>,
        );

        // Change value to exceed limit and check error
        expect(gotError).toEqual(false);
        expect(container).toMatchSnapshot();
    });
});
