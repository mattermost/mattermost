// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {useCallback} from 'react';
import {useIntl} from 'react-intl';
import {useSelector} from 'react-redux';

import {CloseIcon} from '@mattermost/compass-icons/components';

import {getChannelMember} from 'mattermost-redux/selectors/entities/channels';
import {getCurrentTeam, getTeamMember} from 'mattermost-redux/selectors/entities/teams';
import {isGuest, isSystemAdmin} from 'mattermost-redux/utils/user_utils';

import {getRhsState} from 'selectors/rhs';

import BotTag from 'components/widgets/tag/bot_tag';
import GuestTag from 'components/widgets/tag/guest_tag';
import Tag from 'components/widgets/tag/tag';

import type {GlobalState} from 'types/store';

type Props = {
    isBot: boolean;
    roles: string;
    username: string;
    returnFocus: () => void;
    hide?: () => void;
    userId: string;
    channelId?: string;
    closeButtonRef: React.RefObject<HTMLButtonElement>;
}

function getIsTeamAdmin(state: GlobalState, userId: string) {
    const team = getCurrentTeam(state);
    const teamMember = getTeamMember(state, team.id, userId);

    return Boolean(teamMember && teamMember.scheme_admin);
}

function getIsChannelAdmin(state: GlobalState, userId: string, channelId?: string) {
    if (!channelId) {
        return false;
    }

    const channelMember = getChannelMember(state, channelId, userId);

    if (getRhsState(state) !== 'search' && channelMember != null && channelMember.scheme_admin) {
        return true;
    }

    return false;
}

const ProfilePopoverTitle = ({
    isBot,
    roles,
    username,
    returnFocus,
    hide,
    userId,
    channelId,
    closeButtonRef,
}: Props) => {
    const {formatMessage} = useIntl();

    const isTeamAdmin = useSelector((state: GlobalState) => getIsTeamAdmin(state, userId));
    const isChannelAdmin = useSelector((state: GlobalState) => getIsChannelAdmin(state, userId, channelId));

    const handleClose = useCallback(() => {
        hide?.();
        returnFocus();
    }, [hide, returnFocus]);

    let roleTitle;
    if (isBot) {
        roleTitle = (
            <BotTag
                className='user-popover__role'
                size={'sm'}
            />
        );
    } else if (isGuest(roles)) {
        roleTitle = (
            <GuestTag
                className='user-popover__role'
                size={'sm'}
            />
        );
    } else if (isSystemAdmin(roles)) {
        roleTitle = (
            <Tag
                className='user-popover__role'
                size={'sm'}
                text={formatMessage({
                    id: 'admin.permissions.roles.system_admin.name',
                    defaultMessage: 'System Admin',
                })}
            />
        );
    } else if (isTeamAdmin) {
        roleTitle = (
            <Tag
                className='user-popover__role'
                size={'sm'}
                text={formatMessage({
                    id: 'admin.permissions.roles.team_admin.name',
                    defaultMessage: 'Team Admin',
                })}
            />
        );
    } else if (isChannelAdmin) {
        roleTitle = (
            <Tag
                className='user-popover__role'
                size={'sm'}
                text={formatMessage({
                    id: 'admin.permissions.roles.channel_admin.name',
                    defaultMessage: 'Channel Admin',
                })}
            />
        );
    }
    const titleClassName = classNames('popover-title', {'popover-title_height': !roleTitle});

    return (
        <div className={titleClassName}>
            <span data-testid={`profilePopoverTitle_${username}`}>
                {roleTitle}
                <button
                    ref={closeButtonRef}
                    className='user-popover__close'
                    onClick={handleClose}
                >
                    <CloseIcon
                        size={18}
                    />
                </button>
            </span>
        </div>
    );
};

export default ProfilePopoverTitle;
