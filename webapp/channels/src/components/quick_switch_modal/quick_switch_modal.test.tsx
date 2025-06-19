// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {IntlProvider} from 'react-intl';

import type {QuickSwitchModal as QuickSwitchModalClass} from 'components/quick_switch_modal/quick_switch_modal';
import QuickSwitchModal from 'components/quick_switch_modal/quick_switch_modal';
import ChannelNavigator from 'components/sidebar/channel_navigator/channel_navigator';

import {shallowWithIntl} from 'tests/helpers/intl-test-helper';
import {act, renderWithContext, screen, userEvent} from 'tests/react_testing_utils';
import Constants from 'utils/constants';

describe('components/QuickSwitchModal', () => {
    const baseProps = {
        focusOriginElement: 'anyId',
        onExited: jest.fn(),
        showTeamSwitcher: false,
        isMobileView: false,
        actions: {
            joinChannelById: jest.fn().mockResolvedValue({data: true}),
            switchToChannel: jest.fn().mockImplementation(() => {
                const error = {
                    message: 'Failed',
                };
                return Promise.resolve({error});
            }),
            closeRightHandSide: jest.fn(),
        },
    };

    it('should match snapshot', () => {
        const wrapper = shallowWithIntl(<QuickSwitchModal {...baseProps}/>);
        expect(wrapper).toMatchSnapshot();
    });

    describe('handleSubmit', () => {
        it('should do nothing if nothing selected', () => {
            const props = {...baseProps};
            const wrapper = shallowWithIntl(<QuickSwitchModal {...props}/>);
            const instance = wrapper.instance() as QuickSwitchModalClass;

            instance.handleSubmit();
            expect(props.onExited).not.toBeCalled();
            expect(props.actions.switchToChannel).not.toBeCalled();
        });

        it('should fail to switch to a channel', (done) => {
            const props = {...baseProps};
            const wrapper = shallowWithIntl(<QuickSwitchModal {...props}/>);
            const instance = wrapper.instance() as QuickSwitchModalClass;

            const channel = {id: 'channel_id', userId: 'user_id', type: Constants.DM_CHANNEL};
            instance.handleSubmit({channel});
            expect(props.actions.switchToChannel).toBeCalledWith(channel);

            process.nextTick(() => {
                expect(props.onExited).not.toBeCalled();
                done();
            });
        });

        it('should switch to a channel', (done) => {
            const props = {
                ...baseProps,
                actions: {
                    ...baseProps.actions,
                    switchToChannel: jest.fn().mockImplementation(() => {
                        const data = true;
                        return Promise.resolve({data});
                    }),
                },
            };

            const wrapper = shallowWithIntl(<QuickSwitchModal {...props}/>);
            const instance = wrapper.instance() as QuickSwitchModalClass;

            const channel = {id: 'channel_id', userId: 'user_id', type: Constants.DM_CHANNEL};
            instance.handleSubmit({channel});
            expect(props.actions.switchToChannel).toBeCalledWith(channel);

            process.nextTick(() => {
                expect(props.onExited).toBeCalled();
                done();
            });
        });

        it('should join the channel before switching', (done) => {
            const props = {
                ...baseProps,
                actions: {
                    ...baseProps.actions,
                    switchToChannel: jest.fn().mockImplementation(() => {
                        const data = true;
                        return Promise.resolve({data});
                    }),
                },
            };

            const wrapper = shallowWithIntl(<QuickSwitchModal {...props}/>);
            const instance = wrapper.instance() as QuickSwitchModalClass;

            const channel = {id: 'channel_id', name: 'test', type: Constants.OPEN_CHANNEL};
            const selected = {
                type: Constants.MENTION_MORE_CHANNELS,
                channel,
            };

            instance.handleSubmit(selected);
            expect(props.actions.joinChannelById).toBeCalledWith(channel.id);

            process.nextTick(() => {
                expect(props.actions.switchToChannel).toBeCalledWith(channel);
                done();
            });
        });

        it('should not join the channel before switching if channel is DM', (done) => {
            const props = {
                ...baseProps,
                actions: {
                    ...baseProps.actions,
                    switchToChannel: jest.fn().mockImplementation(() => {
                        const data = true;
                        return Promise.resolve({data});
                    }),
                },
            };

            const wrapper = shallowWithIntl(<QuickSwitchModal {...props}/>);
            const instance = wrapper.instance() as QuickSwitchModalClass;

            const channel = {id: 'channel_id', name: 'test', type: Constants.DM_CHANNEL};
            const selected = {
                type: Constants.MENTION_MORE_CHANNELS,
                channel,
            };

            instance.handleSubmit(selected);
            expect(props.actions.joinChannelById).not.toHaveBeenCalled();
            expect(props.actions.switchToChannel).toBeCalledWith(channel);

            process.nextTick(() => {
                expect(props.onExited).toBeCalled();
                done();
            });
        });
    });

    describe('accessibility', () => {
        it('should restore focus to button', async () => {
            const channelNavigatorProps = {
                showUnreadsCategory: false,
                isQuickSwitcherOpen: false,
                actions: {
                    openModal: jest.fn(),
                    closeModal: jest.fn(),
                },
            };

            renderWithContext(
                <IntlProvider locale='en'>
                    <>
                        <ChannelNavigator {...channelNavigatorProps}/>
                        <QuickSwitchModal {...baseProps}/>
                    </>
                </IntlProvider>,
            );

            await act(async () => {
                userEvent.click(await screen.getByTestId('SidebarChannelNavigatorButton'));
                userEvent.keyboard('{escape}');
            });
            expect(screen.getByTestId('SidebarChannelNavigatorButton')).toHaveFocus();
        });
    });
});
