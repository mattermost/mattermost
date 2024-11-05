// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useRef} from 'react';
import {useIntl} from 'react-intl';
import {useSelector} from 'react-redux';

import {getChannelMember} from 'mattermost-redux/selectors/entities/channels';
import {getCurrentTeam, getTeamMember} from 'mattermost-redux/selectors/entities/teams';
import {isGuest, isSystemAdmin} from 'mattermost-redux/utils/user_utils';

import {getRhsState} from 'selectors/rhs';

import BotTag from 'components/widgets/tag/bot_tag';
import GuestTag from 'components/widgets/tag/guest_tag';
import Tag from 'components/widgets/tag/tag';

import type {A11yFocusEventDetail} from 'utils/constants';
import {A11yCustomEventTypes} from 'utils/constants';

import type {GlobalState} from 'types/store';

type Props = {
    isBot?: boolean;
    roles: string;
    returnFocus: () => void;
    hide?: () => void;
    userId: string;
    channelId?: string;
}

function getIsTeamAdmin(state: GlobalState, userId: string) {
    const team = getCurrentTeam(state);
    const teamMember = team ? getTeamMember(state, team.id, userId) : undefined;

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
    returnFocus,
    hide,
    userId,
    channelId,
}: Props) => {
    const {formatMessage} = useIntl();

    const closeRef = useRef<HTMLButtonElement>(null);

    const isTeamAdmin = useSelector((state: GlobalState) => getIsTeamAdmin(state, userId));
    const isChannelAdmin = useSelector((state: GlobalState) => getIsChannelAdmin(state, userId, channelId));

    useEffect(() => {
        // Focus the close button when the popover first opens
        document.dispatchEvent(new CustomEvent<A11yFocusEventDetail>(
            A11yCustomEventTypes.FOCUS, {
                detail: {
                    target: closeRef.current,
                    keyboardOnly: true,
                },
            },
        ));
    }, []);

    function handleClose() {
        hide?.();
        returnFocus();
    }

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
                    id: 'user_profile.roleTitle.system_admin',
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
                    id: 'user_profile.roleTitle.team_admin',
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
                    id: 'user_profile.roleTitle.channel_admin',
                    defaultMessage: 'Channel Admin',
                })}
            />
        );
    }

    return (
        <div className='user-profile-popover-title'>
            {roleTitle}
            <button
                ref={closeRef}
                className='btn btn-icon btn-sm closeButtonRelativePosition'
                onClick={handleClose}
                aria-label={formatMessage({id: 'user_profile.close', defaultMessage: 'Close user profile popover'})}
            >
                <i className='icon icon-close'/>
            </button>
        </div>
    );
};

export default ProfilePopoverTitle;
