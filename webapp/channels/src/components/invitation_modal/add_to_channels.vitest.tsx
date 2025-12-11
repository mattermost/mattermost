// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {Channel} from '@mattermost/types/channels';

import deepFreeze from 'mattermost-redux/utils/deep_freeze';

import {renderWithContext, screen, fireEvent} from 'tests/vitest_react_testing_utils';

import AddToChannels from './add_to_channels';
import type {Props} from './add_to_channels';

const baseProps: Props = deepFreeze({
    customMessage: {
        message: '',
        open: false,
    },
    toggleCustomMessage: vi.fn(),
    setCustomMessage: vi.fn(),
    inviteChannels: {
        channels: [],
        search: '',
    },
    onChannelsChange: vi.fn(),
    onChannelsInputChange: vi.fn(),
    channelsLoader: vi.fn(),
    currentChannel: {
        display_name: '',
    },
    townSquareDisplayName: 'Town Square',
});

describe('AddToChannels', () => {
    describe('placeholder selection', () => {
        it('should use townSquareDisplayName when not in a channel', () => {
            const props = {...baseProps, currentChannel: undefined};
            renderWithContext(<AddToChannels {...props}/>);
            expect(screen.getByText(props.townSquareDisplayName, {exact: false})).toBeInTheDocument();
        });

        it('should use townSqureDisplayName when not in a public or private channel', () => {
            const props = {...baseProps, currentChannel: {type: 'D', display_name: ''} as Channel};
            renderWithContext(<AddToChannels {...props}/>);
            expect(screen.getByText(props.townSquareDisplayName, {exact: false})).toBeInTheDocument();
        });

        it('should use the currentChannel display_name when in a channel', () => {
            const props = {...baseProps, currentChannel: {type: 'O', display_name: 'My Awesome Channel'} as Channel};
            renderWithContext(<AddToChannels {...props}/>);
            expect(screen.getByText('My Awesome Channel', {exact: false})).toBeInTheDocument();
        });
    });

    describe('custom message', () => {
        it('UI to toggle custom message opens it when closed', () => {
            const toggleCustomMessage = vi.fn();
            const props = {...baseProps, toggleCustomMessage};
            renderWithContext(<AddToChannels {...props}/>);

            expect(toggleCustomMessage).not.toHaveBeenCalled();
            const addCustomMessageLink = screen.getByText('Set a custom message', {exact: false});
            fireEvent.click(addCustomMessageLink);
            expect(toggleCustomMessage).toHaveBeenCalled();
        });

        it('UI to toggle custom message closes it when opened', () => {
            const toggleCustomMessage = vi.fn();
            const props = {
                ...baseProps,
                toggleCustomMessage,
                customMessage: {
                    ...baseProps.customMessage,
                    open: true,
                },
            };
            renderWithContext(<AddToChannels {...props}/>);

            expect(toggleCustomMessage).not.toHaveBeenCalled();

            // Click the close icon (it's an SVG wrapped in a span, click on the container)
            const closeIcon = document.querySelector('.AddToChannels__customMessageTitle svg') as Element;
            fireEvent.click(closeIcon);
            expect(toggleCustomMessage).toHaveBeenCalled();
        });

        it('UI to write custom message calls the on change handler with its input', () => {
            const setCustomMessage = vi.fn();
            const props = {
                ...baseProps,
                setCustomMessage,
                customMessage: {
                    ...baseProps.customMessage,
                    open: true,
                },
            };
            renderWithContext(<AddToChannels {...props}/>);

            expect(setCustomMessage).not.toHaveBeenCalled();
            const expectedMessage = 'welcome to the team!';
            const textarea = screen.getByRole('textbox');
            fireEvent.change(textarea, {target: {value: expectedMessage}});
            expect(setCustomMessage).toHaveBeenCalledWith(expectedMessage);
        });
    });
});
