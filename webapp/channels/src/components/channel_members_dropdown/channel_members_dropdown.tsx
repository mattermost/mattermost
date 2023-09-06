// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState} from 'react';
import {FormattedMessage} from 'react-intl';
import {useDispatch} from 'react-redux';

import type {Channel, ChannelMembership} from '@mattermost/types/channels';
import type {UserProfile} from '@mattermost/types/users';

import type {ActionResult} from 'mattermost-redux/types/actions';
import * as UserUtils from 'mattermost-redux/utils/user_utils';

import LeaveChannelModal from 'components/leave_channel_modal';
import OverlayTrigger from 'components/overlay_trigger';
import Tooltip from 'components/tooltip';
import DropdownIcon from 'components/widgets/icons/fa_dropdown_icon';
import Menu from 'components/widgets/menu/menu';
import MenuWrapper from 'components/widgets/menu/menu_wrapper';

import {Constants, ModalIdentifiers} from 'utils/constants';
import * as Utils from 'utils/utils';

import type {ModalData} from 'types/actions';

const ROWS_FROM_BOTTOM_TO_OPEN_UP = 2;

interface Props {
    channel: Channel;
    user: UserProfile;
    currentUserId: string;
    channelMember: ChannelMembership;
    canChangeMemberRoles: boolean;
    canRemoveMember: boolean;
    index: number;
    totalUsers: number;
    channelAdminLabel?: JSX.Element;
    channelMemberLabel?: JSX.Element;
    guestLabel?: JSX.Element;
    actions: {
        getChannelStats: (channelId: string) => void;
        updateChannelMemberSchemeRoles: (channelId: string, userId: string, isSchemeUser: boolean, isSchemeAdmin: boolean) => Promise<ActionResult>;
        removeChannelMember: (channelId: string, userId: string) => Promise<ActionResult>;
        getChannelMember: (channelId: string, userId: string) => void;
        openModal: <P>(modalData: ModalData<P>) => void;
    };
}

export default function ChannelMembersDropdown({
    channel,
    user,
    currentUserId,
    channelMember,
    canChangeMemberRoles,
    canRemoveMember,
    index,
    totalUsers,
    channelAdminLabel,
    channelMemberLabel,
    guestLabel,
    actions,
}: Props) {
    const [removing, setRemoving] = useState(false);
    const [serverError, setServerError] = useState<string | null>(null);
    const dispatch = useDispatch();

    const handleRemoveFromChannel = async () => {
        if (removing) {
            return;
        }

        if (user.id === currentUserId) {
            setRemoving(true);
            dispatch(actions.openModal({
                modalId: ModalIdentifiers.LEAVE_PRIVATE_CHANNEL_MODAL,
                dialogType: LeaveChannelModal,
                dialogProps: {
                    channel,
                    callback: () => {
                        actions.getChannelStats(channel.id);
                        setRemoving(false);
                    },
                },
            }));
        } else {
            setRemoving(true);
            const {error} = await actions.removeChannelMember(channel.id, user.id);
            setRemoving(false);
            if (error) {
                setServerError(error.message);
                return;
            }

            actions.getChannelStats(channel.id);
        }
    };

    const handleMakeChannelAdmin = () => {
        updateChannelMemberSchemeRole(true);
    };

    const handleMakeChannelMember = () => {
        updateChannelMemberSchemeRole(false);
    };

    const updateChannelMemberSchemeRole = async (schemeAdmin: boolean) => {
        const {error} = await actions.updateChannelMemberSchemeRoles(channel.id, user.id, true, schemeAdmin);
        if (error) {
            setServerError(error.message);
            return;
        }

        actions.getChannelStats(channel.id);
        actions.getChannelMember(channel.id, user.id);
    };

    const renderRole = (isChannelAdmin: boolean, isGuest: boolean) => {
        if (isChannelAdmin) {
            if (channelAdminLabel) {
                return channelAdminLabel;
            }
            return (
                <FormattedMessage
                    id='channel_members_dropdown.channel_admin'
                    defaultMessage='Channel Admin'
                />
            );
        } else if (isGuest) {
            if (guestLabel) {
                return guestLabel;
            }
            return (
                <FormattedMessage
                    id='channel_members_dropdown.channel_guest'
                    defaultMessage='Channel Guest'
                />
            );
        }

        if (channelMemberLabel) {
            return channelMemberLabel;
        }
        return (
            <FormattedMessage
                id='channel_members_dropdown.channel_member'
                defaultMessage='Channel Member'
            />
        );
    };

    const isChannelAdmin = UserUtils.isChannelAdmin(channelMember.roles) || channelMember.scheme_admin;
    const isGuest = UserUtils.isGuest(user.roles);
    const isMember = !isChannelAdmin && !isGuest;
    const isDefaultChannel = channel.name === Constants.DEFAULT_CHANNEL;
    const currentRole = renderRole(isChannelAdmin, isGuest);

    if (user.remote_id) {
        const sharedTooltip = (
            <Tooltip id='sharedTooltip'>
                <FormattedMessage
                    id='shared_user_indicator.tooltip'
                    defaultMessage='From trusted organizations'
                />
            </Tooltip>
        );

        return (
            <div className='more-modal__shared-actions'>
                <OverlayTrigger
                    delayShow={Constants.OVERLAY_TIME_DELAY}
                    placement='bottom'
                    overlay={sharedTooltip}
                >
                    <span>
                        <FormattedMessage
                            id='channel_members_dropdown.shared_member'
                            defaultMessage='Shared Member'
                        />
                        <i className='shared-user-icon icon-circle-multiple-outline'/>
                    </span>
                </OverlayTrigger>
            </div>
        );
    }

    const canMakeUserChannelMember = canChangeMemberRoles && isChannelAdmin;
    const canMakeUserChannelAdmin = canChangeMemberRoles && isMember;
    const canRemoveUserFromChannel = canRemoveMember && (!channel.group_constrained || user.is_bot) && (!isDefaultChannel || isGuest);
    const removeFromChannelText = user.id === currentUserId ? Utils.localizeMessage('channel_header.leave', 'Leave Channel') : Utils.localizeMessage('channel_members_dropdown.remove_from_channel', 'Remove from Channel');
    const removeFromChannelTestId = user.id === currentUserId ? 'leaveChannel' : 'removeFromChannel';

    if (canMakeUserChannelMember || canMakeUserChannelAdmin || canRemoveUserFromChannel) {
        const removeMenu = (
            <Menu.ItemAction
                data-testid={removeFromChannelTestId}
                show={canRemoveUserFromChannel}
                onClick={handleRemoveFromChannel}
                text={removeFromChannelText}
                isDangerous={true}
            />
        );
        const makeAdminMenu = (
            <Menu.ItemAction
                id={`${user.username}-make-channel-admin`}
                show={canMakeUserChannelAdmin}
                onClick={handleMakeChannelAdmin}
                text={Utils.localizeMessage('channel_members_dropdown.make_channel_admin', 'Make Channel Admin')}
            />
        );
        const makeMemberMenu = (
            <Menu.ItemAction
                id={`${user.username}-make-channel-member`}
                show={canMakeUserChannelMember}
                onClick={handleMakeChannelMember}
                text={Utils.localizeMessage('channel_members_dropdown.make_channel_member', 'Make Channel Member')}
            />
        );
        return (
            <MenuWrapper>
                <button
                    className='dropdown-toggle theme color--link style--none'
                    type='button'
                >
                    <span className='sr-only'>{user.username}</span>
                    <span>{currentRole} </span>
                    <DropdownIcon/>
                </button>
                <Menu
                    openLeft={true}
                    openUp={totalUsers > ROWS_FROM_BOTTOM_TO_OPEN_UP && totalUsers - index <= ROWS_FROM_BOTTOM_TO_OPEN_UP}
                    ariaLabel={Utils.localizeMessage('channel_members_dropdown.menuAriaLabel', 'Change the role of channel member')}
                >
                    {canMakeUserChannelMember ? makeMemberMenu : null}
                    {canMakeUserChannelAdmin ? makeAdminMenu : null}
                    {canRemoveUserFromChannel ? removeMenu : null}
                    {serverError && (
                        <div className='has-error'>
                            <label className='has-error control-label'>{serverError}</label>
                        </div>
                    )}
                </Menu>
            </MenuWrapper>
        );
    }

    if (isDefaultChannel) {
        return (
            <div/>
        );
    }

    return (
        <div>
            {currentRole}
        </div>
    );
}
