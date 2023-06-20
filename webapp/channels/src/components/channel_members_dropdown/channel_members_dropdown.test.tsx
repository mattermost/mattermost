// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {shallow} from 'enzyme';

import ChannelMembersDropdown from 'components/channel_members_dropdown/channel_members_dropdown';
import {Channel, ChannelMembership} from '@mattermost/types/channels';
import {UserProfile} from '@mattermost/types/users';
import {ActionResult} from 'mattermost-redux/types/actions';
import {mockDispatch} from 'packages/mattermost-redux/test/test_store';
import {ModalIdentifiers} from 'utils/constants';

jest.mock('react-redux', () => ({
    ...jest.requireActual('react-redux') as typeof import('react-redux'),
    useDispatch: () => mockDispatch,
}));

describe('components/channel_members_dropdown', () => {
    const user = {
        id: 'user-1',
    } as UserProfile;

    const channel = {
        create_at: 1508265709607,
        creator_id: 'zaktnt8bpbgu8mb6ez9k64r7sa',
        delete_at: 0,
        display_name: 'testing',
        header: 'test',
        id: 'owsyt8n43jfxjpzh9np93mx1wa',
        last_post_at: 1508265709635,
        name: 'testing',
        purpose: 'test',
        team_id: 'eatxocwc3bg9ffo9xyybnj4omr',
        type: 'O',
        update_at: 1508265709607,
    } as Channel;

    const channelMember = {
        roles: 'channel_admin',
        scheme_admin: true,
    } as ChannelMembership;

    const baseProps = {
        channel,
        user,
        channelMember,
        currentUserId: 'current-user-id',
        canChangeMemberRoles: false,
        canRemoveMember: true,
        index: 0,
        totalUsers: 10,
        actions: {
            removeChannelMember: jest.fn().mockImplementation(() => {
                const error = {
                    message: 'Failed',
                };

                return Promise.resolve({error});
            }),
            getChannelStats: jest.fn(),
            updateChannelMemberSchemeRoles: jest.fn(),
            getChannelMember: jest.fn(),
            openModal: jest.fn(),
        },
    };

    test('should match snapshot for dropdown with guest user', () => {
        const props = {
            ...baseProps,
            user: {
                ...baseProps.user,
                roles: 'system_guest',
            },
            channelMember: {
                ...baseProps.channelMember,
                roles: 'channel_guest',
            },
            canChangeMemberRoles: true,
        };
        const wrapper = shallow(
            <ChannelMembersDropdown {...props}/>,
        );
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot for dropdown with shared user', () => {
        const props = {
            ...baseProps,
            user: {
                ...baseProps.user,
                roles: 'system_user',
                remote_id: 'fakeid',
            },
        };
        const wrapper = shallow(
            <ChannelMembersDropdown {...props}/>,
        );
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot for not dropdown with guest user', () => {
        const props = {
            ...baseProps,
            user: {
                ...baseProps.user,
                roles: 'system_guest',
            },
            channelMember: {
                ...baseProps.channelMember,
                roles: 'channel_guest',
            },
            canChangeMemberRoles: false,
        };
        const wrapper = shallow(
            <ChannelMembersDropdown {...props}/>,
        );
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot for channel_members_dropdown', () => {
        const wrapper = shallow(
            <ChannelMembersDropdown {...baseProps}/>,
        );
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot opening dropdown upwards', () => {
        const wrapper = shallow(
            <ChannelMembersDropdown
                {...baseProps}
                index={4}
                totalUsers={5}
            />,
        );
        expect(wrapper).toMatchSnapshot();
    });

    test('If a removal is in progress do not execute another removal', () => {
        const removeMock = jest.fn().mockImplementation(() => {
            const myPromise = new Promise<ActionResult>((resolve) => {
                setTimeout(() => {
                    resolve({data: {}});
                }, 3000);
            });
            return myPromise;
        });

        const props = {
            ...baseProps,
            actions: {
                ...baseProps.actions,
                removeChannelMember: removeMock,
            },
        };

        const wrapper = shallow(
            <ChannelMembersDropdown {...props}/>,
        );

        wrapper.find('[data-testid="removeFromChannel"]').simulate('click');
        wrapper.find('[data-testid="removeFromChannel"]').simulate('click');
        expect(removeMock).toHaveBeenCalledTimes(1);
    });

    test('should fail to remove channel member', (done) => {
        const removeMock = jest.fn().mockImplementation(() => {
            return Promise.resolve({error: {message: 'Failed'}});
        });

        const props = {
            ...baseProps,
            actions: {
                ...baseProps.actions,
                removeChannelMember: removeMock,
            },
        };

        const wrapper = shallow(
            <ChannelMembersDropdown {...props}/>,
        );

        wrapper.find('[data-testid="removeFromChannel"]').simulate('click');
        process.nextTick(() => {
            expect(removeMock).toHaveBeenCalledTimes(1);
            expect(wrapper.find('.has-error.control-label').text()).toEqual('Failed');
            done();
        });
    });

    test('should remove the channel member', (done) => {
        const removeMock = jest.fn().mockImplementation(() => {
            return Promise.resolve({data: true});
        });

        const props = {
            ...baseProps,
            actions: {
                ...baseProps.actions,
                removeChannelMember: removeMock,
            },
        };

        const wrapper = shallow(
            <ChannelMembersDropdown {...props}/>,
        );

        wrapper.find('[data-testid="removeFromChannel"]').simulate('click');
        process.nextTick(() => {
            expect(removeMock).toHaveBeenCalledTimes(1);
            done();
        });
    });

    test('should match snapshot for group_constrained channel', () => {
        baseProps.channel.group_constrained = true;
        const wrapper = shallow(
            <ChannelMembersDropdown {...baseProps}/>,
        );
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot with role change possible', () => {
        const wrapper = shallow(
            <ChannelMembersDropdown
                {...baseProps}
                canChangeMemberRoles={true}
            />,
        );
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot when user is current user', () => {
        const props = {
            ...baseProps,
            currentUserId: 'user-1',
        };
        const wrapper = shallow(
            <ChannelMembersDropdown {...props}/>,
        );
        expect(wrapper).toMatchSnapshot();
    });

    test('should open a confirmation modal when current user tries to remove themselves from a channel', () => {
        const removeMock = jest.fn().mockImplementation(() => {
            const myPromise = new Promise<ActionResult>((resolve) => {
                setTimeout(() => {
                    resolve({data: {}});
                }, 3000);
            });
            return myPromise;
        });

        const props = {
            ...baseProps,
            currentUserId: 'user-1',
            channel: {
                ...baseProps.channel,
                group_constrained: false,
            },
            actions: {
                ...baseProps.actions,
                removeChannelMember: removeMock,
            },
        };
        const wrapper = shallow(
            <ChannelMembersDropdown {...props}/>,
        );

        expect(wrapper.find('[data-testid="leaveChannel"]').exists()).toBe(true);
        wrapper.find('[data-testid="leaveChannel"]').simulate('click');

        expect(removeMock).not.toHaveBeenCalled();
        expect(props.actions.openModal).toHaveBeenCalledWith(
            expect.objectContaining({
                modalId: ModalIdentifiers.LEAVE_PRIVATE_CHANNEL_MODAL,
                dialogProps: expect.objectContaining({
                    channel: expect.objectContaining({id: props.channel.id}),
                }),
            }));
    });
});
