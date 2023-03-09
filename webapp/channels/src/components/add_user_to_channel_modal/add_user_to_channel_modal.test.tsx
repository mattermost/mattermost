// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {shallow} from 'enzyme';

import AddUserToChannelModal from 'components/add_user_to_channel_modal/add_user_to_channel_modal';
import {TestHelper} from 'utils/test_helper';

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

    it('should match snapshot', () => {
        const wrapper = shallow(
            <AddUserToChannelModal {...baseProps}/>,
        );

        expect(wrapper.find('#add-user-to-channel-modal__add-button').props().disabled).toBe(true);
        expect(wrapper.find('#add-user-to-channel-modal__user-is-member').exists()).toBe(false);
        expect(wrapper.find('#add-user-to-channel-modal__invite-error').exists()).toBe(false);
        expect(wrapper).toMatchSnapshot();
    });

    it('should enable the add button when a channel is selected', () => {
        const wrapper = shallow(
            <AddUserToChannelModal {...baseProps}/>,
        );

        wrapper.setState({selectedChannelId: 'someChannelId'});
        expect(wrapper.find('#add-user-to-channel-modal__add-button').props().disabled).toBe(false);
        expect(wrapper.find('#add-user-to-channel-modal__invite-error').exists()).toBe(false);
    });

    it('should show invite error when an error message is captured', () => {
        const wrapper = shallow(
            <AddUserToChannelModal {...baseProps}/>,
        );

        wrapper.setState({submitError: 'some error'});
        expect(wrapper.find('#add-user-to-channel-modal__add-button').props().disabled).toBe(true);
        expect(wrapper.find('#add-user-to-channel-modal__invite-error').exists()).toBe(true);
    });

    it('should disable add button when membership is being checked', () => {
        const wrapper = shallow(
            <AddUserToChannelModal {...baseProps}/>,
        );

        wrapper.setState({
            selectedChannelId: 'someChannelId',
            checkingForMembership: true,
        });

        expect(wrapper.find('#add-user-to-channel-modal__add-button').props().disabled).toBe(true);
    });

    it('should display error message if user is a member of the selected channel', () => {
        const props = {...baseProps,
            channelMembers: {
                someChannelId: {
                    someUserId: TestHelper.getChannelMembershipMock({}),
                },
            },
        };

        const wrapper = shallow(
            <AddUserToChannelModal {...props}/>,
        );

        wrapper.setState({selectedChannelId: 'someChannelId'});
        expect(wrapper.find('#add-user-to-channel-modal__add-button').props().disabled).toBe(true);
        expect(wrapper.find('#add-user-to-channel-modal__user-is-member').exists()).toBe(true);
    });

    it('should disable the add button when saving', () => {
        const wrapper = shallow(
            <AddUserToChannelModal {...baseProps}/>,
        );

        wrapper.setState({
            selectedChannelId: 'someChannelId',
            saving: true,
        });
        expect(wrapper.find('#add-user-to-channel-modal__add-button').props().disabled).toBe(true);
    });

    describe('didSelectChannel', () => {
        it('should fetch the selected user\'s membership for the selected channel', () => {
            const props = {...baseProps};

            const wrapper = shallow<AddUserToChannelModal>(
                <AddUserToChannelModal {...props}/>,
            );

            const selection = {channel: TestHelper.getChannelMock({id: 'someChannelId', display_name: 'channelName'})};
            wrapper.instance().didSelectChannel(selection);
            expect(props.actions.getChannelMember).toBeCalledWith('someChannelId', 'someUserId');
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

            const wrapper = shallow<AddUserToChannelModal>(
                <AddUserToChannelModal {...props}/>,
            );

            expect(wrapper.state().text).toEqual('');
            expect(wrapper.state().checkingForMembership).toEqual(false);
            expect(wrapper.state().selectedChannelId).toEqual(null);
            expect(wrapper.state().submitError).toEqual('');

            const selection = {channel: TestHelper.getChannelMock({id: 'someChannelId', display_name: 'channelName'})};
            wrapper.setState({submitError: 'some pre-existing error'});

            wrapper.instance().didSelectChannel(selection);
            expect(wrapper.state().text).toEqual('channelName');
            expect(wrapper.state().checkingForMembership).toEqual(true);
            expect(wrapper.state().selectedChannelId).toEqual('someChannelId');
            expect(wrapper.state().submitError).toEqual('');

            await promise;
            expect(wrapper.state().checkingForMembership).toEqual(false);
        });
    });

    describe('handleSubmit', () => {
        it('should do nothing if no channel is selected', () => {
            const props = {...baseProps};

            const wrapper = shallow<AddUserToChannelModal>(
                <AddUserToChannelModal {...props}/>,
            );

            const event: any = {stopPropagation: jest.fn(), preventDefault: jest.fn()};
            wrapper.instance().handleSubmit(event);
            expect(wrapper.state().saving).toBe(false);
            expect(props.actions.addChannelMember).not.toBeCalled();
        });

        it('should do nothing if user is a member of the selected channel', () => {
            const props = {...baseProps,
                channelMembers: {
                    someChannelId: {
                        someUserId: TestHelper.getChannelMembershipMock({}),
                    },
                },
            };

            const wrapper = shallow<AddUserToChannelModal>(
                <AddUserToChannelModal {...props}/>,
            );

            wrapper.setState({selectedChannelId: 'someChannelId'});
            const event: any = {stopPropagation: jest.fn(), preventDefault: jest.fn()};
            wrapper.instance().handleSubmit(event);
            expect(wrapper.state().saving).toBe(false);
            expect(props.actions.addChannelMember).not.toBeCalled();
        });

        it('should submit if user is not a member of the selected channel', () => {
            const props = {...baseProps,
                channelMembers: {
                    someChannelId: {},
                },
            };

            const wrapper = shallow<AddUserToChannelModal>(
                <AddUserToChannelModal {...props}/>,
            );

            wrapper.setState({selectedChannelId: 'someChannelId'});
            const event: any = {stopPropagation: jest.fn(), preventDefault: jest.fn()};
            wrapper.instance().handleSubmit(event);
            expect(wrapper.state().saving).toBe(true);
            expect(props.actions.addChannelMember).toBeCalled();
        });

        test('should match state when save is successful', async () => {
            const promise = Promise.resolve({});
            const props = {
                ...baseProps,
                actions: {
                    ...baseProps.actions,
                    addChannelMember: () => promise,
                },
            };

            const wrapper = shallow<AddUserToChannelModal>(
                <AddUserToChannelModal {...props}/>,
            );

            expect(wrapper.state().show).toBe(true);
            expect(wrapper.state().saving).toBe(false);
            wrapper.setState({selectedChannelId: 'someChannelId'});

            const event: any = {stopPropagation: jest.fn(), preventDefault: jest.fn()};
            wrapper.instance().handleSubmit(event);
            expect(wrapper.state().show).toBe(true);
            expect(wrapper.state().saving).toBe(true);

            await promise;
            expect(wrapper.state().submitError).toEqual('');
            expect(wrapper.state().show).toBe(false);
        });

        test('should match state when save fails', async () => {
            const promise = Promise.resolve({error: new Error('some error')});
            const props = {
                ...baseProps,
                actions: {
                    ...baseProps.actions,
                    addChannelMember: () => promise,
                },
            };

            const wrapper = shallow<AddUserToChannelModal>(
                <AddUserToChannelModal {...props}/>,
            );

            expect(wrapper.state().show).toBe(true);
            wrapper.setState({selectedChannelId: 'someChannelId'});

            const event: any = {stopPropagation: jest.fn(), preventDefault: jest.fn()};
            wrapper.instance().handleSubmit(event);

            await promise;
            expect(wrapper.state().submitError).toEqual('some error');
            expect(wrapper.state().show).toBe(true);
        });
    });
});
