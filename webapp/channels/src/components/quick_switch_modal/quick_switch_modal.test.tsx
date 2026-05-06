// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {IntlProvider, injectIntl} from 'react-intl';

import QuickSwitchModal, {QuickSwitchModal as QuickSwitchModalClass} from 'components/quick_switch_modal/quick_switch_modal';
import ChannelNavigator from 'components/sidebar/channel_navigator/channel_navigator';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';
import Constants from 'utils/constants';

// Wrap the class component with injectIntl + forwardRef so refs work
const QuickSwitchModalWithRef = injectIntl(QuickSwitchModalClass, {forwardRef: true});

describe('components/QuickSwitchModal', () => {
    const baseProps = {
        focusOriginElement: 'anyId',
        onExited: jest.fn(),
        showTeamSwitcher: false,
        isMobileView: false,

        // ABAC defaults to off so the recommendation fetch doesn't fire in
        // unrelated tests; the dedicated mount-fetch test below flips it
        // and asserts the action is called.
        accessControlEnabled: false,
        currentTeamId: 'team_1',
        actions: {
            joinChannelById: jest.fn().mockResolvedValue({data: true}),
            switchToChannel: jest.fn().mockImplementation(() => {
                const error = {
                    message: 'Failed',
                };
                return Promise.resolve({error});
            }),
            closeRightHandSide: jest.fn(),
            getRecommendedChannelsForUser: jest.fn().mockResolvedValue({data: []}),
        },
    };

    it('should match snapshot', () => {
        const {container} = renderWithContext(<QuickSwitchModal {...baseProps}/>);
        expect(container).toMatchSnapshot();
    });

    it('does not fetch recommended channels on mount when access control is disabled', () => {
        // Cheap server-side short-circuit: even when ABAC is off the
        // endpoint returns empty, but we still want to skip the
        // round-trip on the client to keep the open-time fast on
        // non-Enterprise installations.
        renderWithContext(<QuickSwitchModal {...baseProps}/>);
        expect(baseProps.actions.getRecommendedChannelsForUser).not.toHaveBeenCalled();
    });

    it('fetches recommended channels for the current team on mount when access control is enabled', () => {
        const fetchMock = jest.fn().mockResolvedValue({data: []});
        const props = {
            ...baseProps,
            accessControlEnabled: true,
            actions: {
                ...baseProps.actions,
                getRecommendedChannelsForUser: fetchMock,
            },
        };
        renderWithContext(<QuickSwitchModal {...props}/>);
        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(fetchMock).toHaveBeenCalledWith('team_1');
    });

    it('does not fetch recommended channels when current team is empty', () => {
        // Defensive guard: the action requires a team id and would 404
        // server-side without one. Empty currentTeamId can happen during
        // team-switch transitions; the switcher must still mount cleanly.
        const fetchMock = jest.fn();
        const props = {
            ...baseProps,
            accessControlEnabled: true,
            currentTeamId: '',
            actions: {
                ...baseProps.actions,
                getRecommendedChannelsForUser: fetchMock,
            },
        };
        renderWithContext(<QuickSwitchModal {...props}/>);
        expect(fetchMock).not.toHaveBeenCalled();
    });

    describe('handleSubmit', () => {
        it('should do nothing if nothing selected', () => {
            const props = {...baseProps};
            const ref = React.createRef<QuickSwitchModalClass>();
            renderWithContext(
                <QuickSwitchModalWithRef
                    {...props}
                    ref={ref}
                />,
            );
            const instance = ref.current!;

            instance.handleSubmit();
            expect(props.onExited).not.toHaveBeenCalled();
            expect(props.actions.switchToChannel).not.toHaveBeenCalled();
        });

        it('should fail to switch to a channel', (done) => {
            const props = {...baseProps};
            const ref = React.createRef<QuickSwitchModalClass>();
            renderWithContext(
                <QuickSwitchModalWithRef
                    {...props}
                    ref={ref}
                />,
            );
            const instance = ref.current!;

            const channel = {id: 'channel_id', userId: 'user_id', type: Constants.DM_CHANNEL};
            instance.handleSubmit({channel});
            expect(props.actions.switchToChannel).toHaveBeenCalledWith(channel);

            process.nextTick(() => {
                expect(props.onExited).not.toHaveBeenCalled();
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

            const ref = React.createRef<QuickSwitchModalClass>();
            renderWithContext(
                <QuickSwitchModalWithRef
                    {...props}
                    ref={ref}
                />,
            );
            const instance = ref.current!;

            const channel = {id: 'channel_id', userId: 'user_id', type: Constants.DM_CHANNEL};
            instance.handleSubmit({channel});
            expect(props.actions.switchToChannel).toHaveBeenCalledWith(channel);

            process.nextTick(() => {
                expect(props.onExited).toHaveBeenCalled();
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

            const ref = React.createRef<QuickSwitchModalClass>();
            renderWithContext(
                <QuickSwitchModalWithRef
                    {...props}
                    ref={ref}
                />,
            );
            const instance = ref.current!;

            const channel = {id: 'channel_id', name: 'test', type: Constants.OPEN_CHANNEL};
            const selected = {
                type: Constants.MENTION_MORE_CHANNELS,
                channel,
            };

            instance.handleSubmit(selected);
            expect(props.actions.joinChannelById).toHaveBeenCalledWith(channel.id);

            process.nextTick(() => {
                expect(props.actions.switchToChannel).toHaveBeenCalledWith(channel);
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

            const ref = React.createRef<QuickSwitchModalClass>();
            renderWithContext(
                <QuickSwitchModalWithRef
                    {...props}
                    ref={ref}
                />,
            );
            const instance = ref.current!;

            const channel = {id: 'channel_id', name: 'test', type: Constants.DM_CHANNEL};
            const selected = {
                type: Constants.MENTION_MORE_CHANNELS,
                channel,
            };

            instance.handleSubmit(selected);
            expect(props.actions.joinChannelById).not.toHaveBeenCalled();
            expect(props.actions.switchToChannel).toHaveBeenCalledWith(channel);

            process.nextTick(() => {
                expect(props.onExited).toHaveBeenCalled();
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

            await userEvent.click(await screen.getByTestId('SidebarChannelNavigatorButton'));
            await userEvent.keyboard('{escape}');

            expect(screen.getByTestId('SidebarChannelNavigatorButton')).toHaveFocus();
        });
    });
});
