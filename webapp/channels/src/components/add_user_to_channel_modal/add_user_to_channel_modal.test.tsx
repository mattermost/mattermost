// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import AddUserToChannelModal from 'components/add_user_to_channel_modal/add_user_to_channel_modal';

import {act, renderWithContext, userEvent, waitFor} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

let mockOnItemSelected: ((selection: any) => void) | undefined;

jest.mock('components/suggestion/suggestion_box', () => {
    const react = require('react');
    return {
        __esModule: true,
        // eslint-disable-next-line @typescript-eslint/no-unused-vars -- forwardRef arity; ref unused in mock
        default: react.forwardRef((props: any, _ref: React.Ref<unknown>) => {
            mockOnItemSelected = props.onItemSelected;
            return null;
        }),
    };
});

jest.mock('components/suggestion/search_channel_with_permissions_provider', () =>
    jest.fn().mockImplementation(() => ({disableDispatches: false})),
);

function getAddButton() {
    return document.querySelector('#add-user-to-channel-modal__add-button') as HTMLButtonElement;
}

describe('components/AddUserToChannelModal', () => {
    const baseProps = {
        channelMembers: {},
        user: TestHelper.getUserMock({
            id: 'someUserId',
            first_name: 'Fake',
            last_name: 'Person',
        }),
        onExited: jest.fn(),
        actions: {
            addChannelMember: jest.fn().mockResolvedValue({}),
            getChannelMember: jest.fn().mockResolvedValue({}),
            autocompleteChannelsForSearch: jest.fn().mockResolvedValue({}),
        },
    };

    beforeEach(() => {
        mockOnItemSelected = undefined;
    });

    async function selectChannel(channelId = 'someChannelId', displayName = 'channelName') {
        await act(async () => {
            mockOnItemSelected!({channel: TestHelper.getChannelMock({id: channelId, display_name: displayName})});
        });
    }

    it('should match snapshot', () => {
        const {baseElement} = renderWithContext(
            <AddUserToChannelModal {...baseProps}/>,
        );

        expect(getAddButton().disabled).toBe(true);
        expect(document.querySelector('#add-user-to-channel-modal__user-is-member')).toBeNull();
        expect(document.querySelector('#add-user-to-channel-modal__invite-error')).toBeNull();
        expect(baseElement).toMatchSnapshot();
    });

    it('should enable the add button when a channel is selected', async () => {
        renderWithContext(
            <AddUserToChannelModal {...baseProps}/>,
        );

        await selectChannel();

        await waitFor(() => {
            expect(getAddButton().disabled).toBe(false);
        });
        expect(document.querySelector('#add-user-to-channel-modal__invite-error')).toBeNull();
    });

    it('should show invite error when an error message is captured', async () => {
        const props = {
            ...baseProps,
            actions: {
                ...baseProps.actions,
                addChannelMember: jest.fn().mockResolvedValue({error: {message: 'some error'}}),
            },
        };

        renderWithContext(
            <AddUserToChannelModal {...props}/>,
        );

        await selectChannel();

        await waitFor(() => {
            expect(getAddButton().disabled).toBe(false);
        });

        await userEvent.click(getAddButton());

        await waitFor(() => {
            expect(document.querySelector('#add-user-to-channel-modal__invite-error')).not.toBeNull();
        });
    });

    it('should disable add button when membership is being checked', async () => {
        let resolveGetChannelMember: (value: any) => void;
        const getChannelMemberPromise = new Promise<Record<string, never>>((resolve) => {
            resolveGetChannelMember = resolve;
        });

        const props = {
            ...baseProps,
            actions: {
                ...baseProps.actions,
                getChannelMember: jest.fn(() => getChannelMemberPromise),
            },
        };

        renderWithContext(
            <AddUserToChannelModal {...props}/>,
        );

        // Select a channel - membership check starts
        act(() => {
            mockOnItemSelected!({channel: TestHelper.getChannelMock({id: 'someChannelId', display_name: 'channelName'})});
        });

        // While checking membership, button should be disabled
        expect(getAddButton().disabled).toBe(true);

        // Resolve the membership check
        await act(async () => {
            resolveGetChannelMember!({} as Record<string, never>);
        });
    });

    it('should display error message if user is a member of the selected channel', async () => {
        const props = {
            ...baseProps,
            channelMembers: {
                someChannelId: {
                    someUserId: TestHelper.getChannelMembershipMock({}),
                },
            },
        };

        renderWithContext(
            <AddUserToChannelModal {...props}/>,
        );

        await selectChannel();

        await waitFor(() => {
            expect(getAddButton().disabled).toBe(true);
            expect(document.querySelector('#add-user-to-channel-modal__user-is-member')).not.toBeNull();
        });
    });

    it('should disable the add button when saving', async () => {
        let resolveAddChannelMember: (value: any) => void;
        const addChannelMemberPromise = new Promise<Record<string, never>>((resolve) => {
            resolveAddChannelMember = resolve;
        });

        const props = {
            ...baseProps,
            actions: {
                ...baseProps.actions,
                addChannelMember: jest.fn(() => addChannelMemberPromise),
            },
        };

        renderWithContext(
            <AddUserToChannelModal {...props}/>,
        );

        await selectChannel();

        await waitFor(() => {
            expect(getAddButton().disabled).toBe(false);
        });

        await userEvent.click(getAddButton());

        // While saving, button should be disabled
        expect(getAddButton().disabled).toBe(true);

        // Clean up
        await act(async () => {
            resolveAddChannelMember!({} as Record<string, never>);
        });
    });

    describe('didSelectChannel', () => {
        it('should fetch the selected user\'s membership for the selected channel', async () => {
            const props = {...baseProps};

            renderWithContext(
                <AddUserToChannelModal {...props}/>,
            );

            await selectChannel();

            expect(props.actions.getChannelMember).toHaveBeenCalledWith('someChannelId', 'someUserId');
        });

        it('should match state on selection', async () => {
            const promise = Promise.resolve({});
            const props = {
                ...baseProps,
                actions: {
                    ...baseProps.actions,
                    getChannelMember: jest.fn(() => {
                        return promise;
                    }),
                },
            };

            renderWithContext(
                <AddUserToChannelModal {...props}/>,
            );

            // Initially, add button should be disabled (no channel selected)
            expect(getAddButton().disabled).toBe(true);

            // Select a channel
            act(() => {
                mockOnItemSelected!({channel: TestHelper.getChannelMock({id: 'someChannelId', display_name: 'channelName'})});
            });

            // During membership check, button should be disabled
            expect(getAddButton().disabled).toBe(true);

            // Wait for membership check
            await act(async () => {
                await promise;
            });

            // After membership check, button should be enabled
            await waitFor(() => {
                expect(getAddButton().disabled).toBe(false);
            });
        });
    });

    describe('handleSubmit', () => {
        it('should do nothing if no channel is selected', async () => {
            const props = {...baseProps};

            renderWithContext(
                <AddUserToChannelModal {...props}/>,
            );

            await userEvent.click(getAddButton());
            expect(props.actions.addChannelMember).not.toHaveBeenCalled();
        });

        it('should do nothing if user is a member of the selected channel', async () => {
            const props = {
                ...baseProps,
                channelMembers: {
                    someChannelId: {
                        someUserId: TestHelper.getChannelMembershipMock({}),
                    },
                },
            };

            renderWithContext(
                <AddUserToChannelModal {...props}/>,
            );

            await selectChannel();

            await userEvent.click(getAddButton());
            expect(props.actions.addChannelMember).not.toHaveBeenCalled();
        });

        it('should submit if user is not a member of the selected channel', async () => {
            const props = {
                ...baseProps,
                channelMembers: {
                    someChannelId: {},
                },
            };

            renderWithContext(
                <AddUserToChannelModal {...props}/>,
            );

            await selectChannel();

            await waitFor(() => {
                expect(getAddButton().disabled).toBe(false);
            });

            await userEvent.click(getAddButton());
            expect(props.actions.addChannelMember).toHaveBeenCalled();
        });

        test('should match state when save is successful', async () => {
            const promise = Promise.resolve({});
            const props = {
                ...baseProps,
                actions: {
                    ...baseProps.actions,
                    addChannelMember: jest.fn(() => promise),
                },
            };

            renderWithContext(
                <AddUserToChannelModal {...props}/>,
            );

            await selectChannel();

            await waitFor(() => {
                expect(getAddButton().disabled).toBe(false);
            });

            await userEvent.click(getAddButton());

            // After successful save, modal should close (no error)
            await waitFor(() => {
                expect(document.querySelector('#add-user-to-channel-modal__invite-error')).toBeNull();
            });
        });

        test('should match state when save fails', async () => {
            const errorMessage = 'some error';
            const promise = Promise.resolve({error: new Error(errorMessage)});
            const props = {
                ...baseProps,
                actions: {
                    ...baseProps.actions,
                    addChannelMember: jest.fn(() => promise),
                },
            };

            renderWithContext(
                <AddUserToChannelModal {...props}/>,
            );

            await selectChannel();

            await waitFor(() => {
                expect(getAddButton().disabled).toBe(false);
            });

            await userEvent.click(getAddButton());

            // After failed save, error should be shown
            await waitFor(() => {
                const inviteError = document.querySelector('#add-user-to-channel-modal__invite-error');
                expect(inviteError).not.toBeNull();
                expect(inviteError).toHaveTextContent(errorMessage);
            });
        });
    });
});
