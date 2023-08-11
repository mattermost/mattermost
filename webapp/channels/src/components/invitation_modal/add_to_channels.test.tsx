// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {Channel} from '@mattermost/types/channels';

import deepFreeze from 'mattermost-redux/utils/deep_freeze';

import CloseCircleIcon from 'components/widgets/icons/close_circle_icon';

import {mountWithIntl} from 'tests/helpers/intl-test-helper';
import {renderWithIntl, screen} from 'tests/react_testing_utils';

import AddToChannels from './add_to_channels';
import type {Props} from './add_to_channels';

const defaultProps: Props = deepFreeze({
    customMessage: {
        message: '',
        open: false,
    },
    toggleCustomMessage: jest.fn(),
    setCustomMessage: jest.fn(),
    inviteChannels: {
        channels: [],
        search: '',
    },
    onChannelsChange: jest.fn(),
    onChannelsInputChange: jest.fn(),
    channelsLoader: jest.fn(),
    currentChannel: {
        display_name: '',
    },
    townSquareDisplayName: 'Town Square',
});

let props = defaultProps;

describe('AddToChannels', () => {
    beforeEach(() => {
        props = defaultProps;
    });

    describe('placeholder selection', () => {
        it('should use townSquareDisplayName when not in a channel', () => {
            props = {...props, currentChannel: undefined};
            renderWithIntl(<AddToChannels {...props}/>);
            expect(screen.getByText(props.townSquareDisplayName, {exact: false})).toBeInTheDocument();
        });

        it('should use townSqureDisplayName when not in a public or private channel', () => {
            props = {...props, currentChannel: {type: 'D', display_name: ''} as Channel};
            renderWithIntl(<AddToChannels {...props}/>);
            expect(screen.getByText(props.townSquareDisplayName, {exact: false})).toBeInTheDocument();
        });

        it('should use the currentChannel display_name when in a channel', () => {
            props = {...props, currentChannel: {type: 'O', display_name: 'My Awesome Channel'} as Channel};
            renderWithIntl(<AddToChannels {...props}/>);
            expect(screen.getByText('My Awesome Channel', {exact: false})).toBeInTheDocument();
        });
    });

    describe('custom message', () => {
        it('UI to toggle custom message opens it when closed', () => {
            const wrapper = mountWithIntl(<AddToChannels {...props}/>);
            expect(props.toggleCustomMessage).not.toHaveBeenCalled();
            wrapper.find('a').at(0).simulate('click');
            expect(props.toggleCustomMessage).toHaveBeenCalled();
        });

        it('UI to toggle custom message closes it when opened', () => {
            props = {
                ...props,
                customMessage: {
                    ...props.customMessage,
                    open: true,
                },
            };
            const wrapper = mountWithIntl(<AddToChannels {...props}/>);
            expect(props.toggleCustomMessage).not.toHaveBeenCalled();
            wrapper.find(CloseCircleIcon).at(0).simulate('click');
            expect(props.toggleCustomMessage).toHaveBeenCalled();
        });

        it('UI to write custom message calls the on change handler with its input', () => {
            props = {
                ...props,
                customMessage: {
                    ...props.customMessage,
                    open: true,
                },
            };
            const wrapper = mountWithIntl(<AddToChannels {...props}/>);
            expect(props.setCustomMessage).not.toHaveBeenCalled();
            const expectedMessage = 'welcome to the team!';
            wrapper.find('textarea').at(0).simulate('change', {
                target: {
                    value: expectedMessage,
                },
            });
            expect(props.setCustomMessage).toHaveBeenCalledWith(expectedMessage);
        });
    });
});
