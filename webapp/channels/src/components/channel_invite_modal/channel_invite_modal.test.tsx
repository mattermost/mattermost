// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {Modal} from 'react-bootstrap';

import type {Channel} from '@mattermost/types/channels';
import type {UserProfile} from '@mattermost/types/users';
import type {RelationOneToOne} from '@mattermost/types/utilities';

import {General} from 'mattermost-redux/constants';

import ChannelInviteModal from 'components/channel_invite_modal/channel_invite_modal';
import type {ChannelInviteModal as ChannelInviteModalClass} from 'components/channel_invite_modal/channel_invite_modal';
import type {Value} from 'components/multiselect/multiselect';

import {shallowWithIntl} from 'tests/helpers/intl-test-helper';

type UserProfileValue = Value & UserProfile;

jest.mock('utils/utils', () => {
    const original = jest.requireActual('utils/utils');
    return {
        ...original,
        localizeMessage: jest.fn(),
        sortUsersAndGroups: jest.fn(),
    };
});

describe('components/channel_invite_modal', () => {
    const users = [{
        id: 'user-1',
        label: 'user-1',
        value: 'user-1',
        delete_at: 0,
    } as UserProfileValue, {
        id: 'user-2',
        label: 'user-2',
        value: 'user-2',
        delete_at: 0,
    } as UserProfileValue];

    const userStatuses = {
        'user-1': 'online',
        'user-2': 'offline',
    } as RelationOneToOne<UserProfile, string>;

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

    const baseProps = {
        channel,
        profilesNotInCurrentChannel: [],
        profilesInCurrentChannel: [],
        profilesNotInCurrentTeam: [],
        profilesFromRecentDMs: [],
        membersInTeam: {},
        groups: [],
        userStatuses: {},
        teammateNameDisplaySetting: General.TEAMMATE_NAME_DISPLAY.SHOW_USERNAME,
        isGroupsEnabled: true,
        actions: {
            addUsersToChannel: jest.fn().mockImplementation(() => {
                const error = {
                    message: 'Failed',
                };

                return Promise.resolve({error});
            }),
            getProfilesNotInChannel: jest.fn().mockImplementation(() => Promise.resolve()),
            getProfilesInChannel: jest.fn().mockImplementation(() => Promise.resolve()),
            searchAssociatedGroupsForReference: jest.fn().mockImplementation(() => Promise.resolve()),
            getTeamStats: jest.fn(),
            getUserStatuses: jest.fn().mockImplementation(() => Promise.resolve()),
            loadStatusesForProfilesList: jest.fn(),
            searchProfiles: jest.fn(),
            closeModal: jest.fn(),
            getTeamMembersByIds: jest.fn(),
        },
        onExited: jest.fn(),
    };

    test('should match snapshot for channel_invite_modal with profiles', () => {
        const wrapper = shallowWithIntl(
            <ChannelInviteModal
                {...baseProps}
                profilesNotInCurrentChannel={users}
                profilesInCurrentChannel={[]}
                profilesNotInCurrentTeam={[]}
                profilesFromRecentDMs={[]}
            />,
        );
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot for channel_invite_modal with profiles from DMs', () => {
        const wrapper = shallowWithIntl(
            <ChannelInviteModal
                {...baseProps}
                profilesNotInCurrentChannel={[]}
                profilesInCurrentChannel={[]}
                profilesNotInCurrentTeam={[]}
                profilesFromRecentDMs={users}
            />,
        );
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot with exclude and include users', () => {
        const wrapper = shallowWithIntl(
            <ChannelInviteModal
                {...baseProps}
                profilesNotInCurrentChannel={users}
                profilesInCurrentChannel={[]}
                profilesNotInCurrentTeam={[]}
                profilesFromRecentDMs={[]}
                includeUsers={
                    {
                        'user-3': {
                            id: 'user-3',
                            label: 'user-3',
                            value: 'user-3',
                            delete_at: 0,
                        } as UserProfileValue,
                    }
                }
                excludeUsers={
                    {
                        'user-1': {
                            id: 'user-1',
                            label: 'user-1',
                            value: 'user-1',
                            delete_at: 0,
                        } as UserProfileValue,
                    }
                }
            />,
        );
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot for channel_invite_modal with userStatuses', () => {
        const wrapper = shallowWithIntl(
            <ChannelInviteModal
                {...baseProps}
                profilesNotInCurrentChannel={users}
                profilesInCurrentChannel={[]}
                userStatuses={userStatuses}
                profilesFromRecentDMs={[]}
            />,
        );
        const instance = wrapper.instance() as ChannelInviteModalClass;
        expect(instance.renderOption(users[0], true, jest.fn(), jest.fn())).toMatchSnapshot();
    });

    test('should match state when onHide is called', () => {
        const wrapper = shallowWithIntl(
            <ChannelInviteModal {...baseProps}/>,
        );

        wrapper.setState({show: true});

        const instance = wrapper.instance() as ChannelInviteModalClass;
        instance.onHide();

        expect(wrapper.state('show')).toEqual(false);
    });

    test('should have called props.onHide when Modal.onExited is called', () => {
        const props = {...baseProps};
        const wrapper = shallowWithIntl(
            <ChannelInviteModal {...props}/>,
        );

        wrapper.find(Modal).props().onExited!(document.createElement('div'));
        expect(props.onExited).toHaveBeenCalledTimes(1);
    });

    test('should fail to add users on handleSubmit', (done) => {
        const wrapper = shallowWithIntl(
            <ChannelInviteModal
                {...baseProps}
            />,
        );

        wrapper.setState({selectedUsers: users, show: true});

        const instance = wrapper.instance() as ChannelInviteModalClass;
        instance.handleSubmit();

        expect(wrapper.state('saving')).toEqual(true);
        expect(instance.props.actions.addUsersToChannel).toHaveBeenCalledTimes(1);
        process.nextTick(() => {
            expect(wrapper.state('inviteError')).toEqual('Failed');
            expect(wrapper.state('saving')).toEqual(false);
            done();
        });
    });

    test('should add users on handleSubmit', (done) => {
        const props = {
            ...baseProps,
            actions: {
                ...baseProps.actions,
                addUsersToChannel: jest.fn().mockImplementation(() => {
                    const data = true;
                    return Promise.resolve({data});
                }),
            },
        };

        const wrapper = shallowWithIntl(
            <ChannelInviteModal
                {...props}
            />,
        );

        wrapper.setState({selectedUsers: users, show: true});

        const instance = wrapper.instance() as ChannelInviteModalClass;
        instance.handleSubmit();

        expect(wrapper.state('saving')).toEqual(true);
        expect(instance.props.actions.addUsersToChannel).toHaveBeenCalledTimes(1);
        process.nextTick(() => {
            expect(wrapper.state('inviteError')).toBeUndefined();
            expect(wrapper.state('saving')).toEqual(false);
            expect(wrapper.state('show')).toEqual(false);
            done();
        });
    });

    test('should call onAddCallback on handleSubmit with skipCommit', () => {
        const onAddCallback = jest.fn();
        const props = {
            ...baseProps,
            skipCommit: true,
            onAddCallback,
        };

        const wrapper = shallowWithIntl(
            <ChannelInviteModal
                {...props}
            />,
        );

        wrapper.setState({selectedUsers: users, show: true});
        const instance = wrapper.instance() as ChannelInviteModalClass;
        instance.handleSubmit();

        expect(onAddCallback).toHaveBeenCalled();
        expect(instance.props.actions.addUsersToChannel).toHaveBeenCalledTimes(0);
    });

    test('should trim the search term', () => {
        const wrapper = shallowWithIntl(
            <ChannelInviteModal {...baseProps}/>,
        );

        const instance = wrapper.instance() as ChannelInviteModalClass;

        instance.search(' something ');
        expect(wrapper.state('term')).toEqual('something');
    });

    test('should send the invite as guest param through the link', () => {
        const props = {
            ...baseProps,
            canInviteGuests: true,
            emailInvitationsEnabled: true,
        };
        const wrapper = shallowWithIntl(
            <ChannelInviteModal {...props}/>,
        );

        const invitationLink = wrapper.find('InviteModalLink');

        expect(invitationLink).toHaveLength(1);

        expect(invitationLink.prop('inviteAsGuest')).toBeTruthy();
    });

    test('should hide the invite as guest param when can not invite guests', () => {
        const props = {
            ...baseProps,
            canInviteGuests: false,
            emailInvitationsEnabled: false,
        };
        const wrapper = shallowWithIntl(
            <ChannelInviteModal {...props}/>,
        );

        const invitationLink = wrapper.find('InviteModalLink');

        expect(invitationLink).toHaveLength(0);
    });
});
