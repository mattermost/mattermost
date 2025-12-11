// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {IntlProvider} from 'react-intl';

import QuickSwitchModal from 'components/quick_switch_modal/quick_switch_modal';
import ChannelNavigator from 'components/sidebar/channel_navigator/channel_navigator';

import {renderWithContext, screen, userEvent, waitFor} from 'tests/vitest_react_testing_utils';
import Constants from 'utils/constants';

// Mock SuggestionBox to capture onItemSelected callback
let capturedOnItemSelected: ((selected: any) => void) | null = null;

vi.mock('components/suggestion/suggestion_box', () => ({
    default: React.forwardRef(({onItemSelected}: any, ref: any) => {
        capturedOnItemSelected = onItemSelected;

        // Create a mock input element
        const inputRef = React.useRef<HTMLInputElement>(null);

        // Expose getTextbox method that the component expects
        React.useImperativeHandle(ref, () => ({
            getTextbox: () => inputRef.current,
        }));

        return (
            <input
                ref={inputRef}
                data-testid='suggestion-box'
            />
        );
    }),
}));

describe('components/QuickSwitchModal', () => {
    const baseProps = {
        focusOriginElement: 'anyId',
        onExited: vi.fn(),
        showTeamSwitcher: false,
        isMobileView: false,
        actions: {
            joinChannelById: vi.fn().mockResolvedValue({data: true}),
            switchToChannel: vi.fn().mockImplementation(() => {
                const error = {
                    message: 'Failed',
                };
                return Promise.resolve({error});
            }),
            closeRightHandSide: vi.fn(),
        },
    };

    beforeEach(() => {
        vi.clearAllMocks();
        capturedOnItemSelected = null;
    });

    it('should match snapshot', () => {
        const {container} = renderWithContext(<QuickSwitchModal {...baseProps}/>);
        expect(container).toMatchSnapshot();
    });

    describe('handleSubmit', () => {
        it('should do nothing if nothing selected', async () => {
            const props = {...baseProps};
            renderWithContext(<QuickSwitchModal {...props}/>);

            // Wait for component to render and capture callback
            await waitFor(() => {
                expect(capturedOnItemSelected).not.toBeNull();
            });

            // Call handleSubmit with nothing selected (undefined)
            capturedOnItemSelected!(undefined);

            expect(props.onExited).not.toHaveBeenCalled();
            expect(props.actions.switchToChannel).not.toHaveBeenCalled();
        });

        it('should fail to switch to a channel', async () => {
            const props = {...baseProps};
            renderWithContext(<QuickSwitchModal {...props}/>);

            await waitFor(() => {
                expect(capturedOnItemSelected).not.toBeNull();
            });

            const channel = {id: 'channel_id', userId: 'user_id', type: Constants.DM_CHANNEL};

            // Call handleSubmit with channel - switchToChannel returns error by default
            capturedOnItemSelected!({channel});

            expect(props.actions.switchToChannel).toHaveBeenCalledWith(channel);

            // Wait for promise to resolve
            await waitFor(() => {
                // onExited should NOT be called because switchToChannel returned error
                expect(props.onExited).not.toHaveBeenCalled();
            });
        });

        it('should switch to a channel', async () => {
            const props = {
                ...baseProps,
                actions: {
                    ...baseProps.actions,
                    switchToChannel: vi.fn().mockImplementation(() => {
                        const data = true;
                        return Promise.resolve({data});
                    }),
                },
            };

            renderWithContext(<QuickSwitchModal {...props}/>);

            await waitFor(() => {
                expect(capturedOnItemSelected).not.toBeNull();
            });

            const channel = {id: 'channel_id', userId: 'user_id', type: Constants.DM_CHANNEL};

            capturedOnItemSelected!({channel});

            expect(props.actions.switchToChannel).toHaveBeenCalledWith(channel);

            // Wait for promise to resolve
            await waitFor(() => {
                // onExited SHOULD be called because switchToChannel returned data (success)
                expect(props.onExited).toHaveBeenCalled();
            });
        });

        it('should join the channel before switching', async () => {
            const props = {
                ...baseProps,
                actions: {
                    ...baseProps.actions,
                    switchToChannel: vi.fn().mockImplementation(() => {
                        const data = true;
                        return Promise.resolve({data});
                    }),
                },
            };

            renderWithContext(<QuickSwitchModal {...props}/>);

            await waitFor(() => {
                expect(capturedOnItemSelected).not.toBeNull();
            });

            const channel = {id: 'channel_id', name: 'test', type: Constants.OPEN_CHANNEL};
            const selected = {
                type: Constants.MENTION_MORE_CHANNELS,
                channel,
            };

            capturedOnItemSelected!(selected);

            // joinChannelById should be called first for MENTION_MORE_CHANNELS + OPEN_CHANNEL
            expect(props.actions.joinChannelById).toHaveBeenCalledWith(channel.id);

            await waitFor(() => {
                expect(props.actions.switchToChannel).toHaveBeenCalledWith(channel);
            });
        });

        it('should not join the channel before switching if channel is DM', async () => {
            const props = {
                ...baseProps,
                actions: {
                    ...baseProps.actions,
                    switchToChannel: vi.fn().mockImplementation(() => {
                        const data = true;
                        return Promise.resolve({data});
                    }),
                },
            };

            renderWithContext(<QuickSwitchModal {...props}/>);

            await waitFor(() => {
                expect(capturedOnItemSelected).not.toBeNull();
            });

            const channel = {id: 'channel_id', name: 'test', type: Constants.DM_CHANNEL};
            const selected = {
                type: Constants.MENTION_MORE_CHANNELS,
                channel,
            };

            capturedOnItemSelected!(selected);

            // joinChannelById should NOT be called for DM channels
            expect(props.actions.joinChannelById).not.toHaveBeenCalled();
            expect(props.actions.switchToChannel).toHaveBeenCalledWith(channel);

            await waitFor(() => {
                expect(props.onExited).toHaveBeenCalled();
            });
        });
    });

    describe('accessibility', () => {
        it('should restore focus to button', async () => {
            const channelNavigatorProps = {
                showUnreadsCategory: false,
                isQuickSwitcherOpen: false,
                actions: {
                    openModal: vi.fn(),
                    closeModal: vi.fn(),
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

            await userEvent.click(await screen.findByTestId('SidebarChannelNavigatorButton'));
            await userEvent.keyboard('{escape}');

            expect(screen.getByTestId('SidebarChannelNavigatorButton')).toHaveFocus();
        });
    });
});
