// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {useDispatch, useSelector} from 'react-redux';

import {getCurrentChannelId, getCurrentUserId} from 'mattermost-redux/selectors/entities/common';
import {getCurrentRelativeTeamUrl, getCurrentTeamId} from 'mattermost-redux/selectors/entities/teams';
import {getCurrentTimezone} from 'mattermost-redux/selectors/entities/timezone';
import {getStatusForUserId, getUser} from 'mattermost-redux/selectors/entities/users';

import {openDirectChannelToUserId} from 'actions/channel_actions';
import * as GlobalActions from 'actions/global_actions';
import {closeModal} from 'actions/views/modals';
import {getMembershipForEntities} from 'actions/views/profile_popover';
import {getSelectedPost} from 'selectors/rhs';
import {getIsMobileView} from 'selectors/views/browser';

import Pluggable from 'plugins/pluggable';
import {getHistory} from 'utils/browser_history';
import {A11yCustomEventTypes, UserStatuses} from 'utils/constants';
import type {A11yFocusEventDetail} from 'utils/constants';
import * as Utils from 'utils/utils';

import type {GlobalState} from 'types/store';

import ProfilePopoverAvatar from './profile_popover_avatar';
import ProfilePopoverCustomStatus from './profile_popover_custom_status';
import ProfilePopoverEmail from './profile_popover_email';
import ProfilePopoverLastActive from './profile_popover_last_active';
import ProfilePopoverName from './profile_popover_name';
import ProfilePopoverOtherUserRow from './profile_popover_other_user_row';
import ProfilePopoverOverrideDisclaimer from './profile_popover_override_disclaimer';
import ProfilePopoverSelfUserRow from './profile_popover_self_user_row';
import ProfilePopoverTimezone from './profile_popover_timezone';
import ProfilePopoverTitle from './profile_popover_title';

import './profile_popover.scss';

const PLUGGABLE_COMPONENT_NAME_PROFILE_POPOVER = 'PopoverUserAttributes';
export interface Props {
    userId: string;
    src: string;
    channelId?: string;
    hideStatus?: boolean;
    fromWebhook?: boolean;
    hide?: () => void;
    returnFocus?: () => void;
    overwriteIcon?: string;
    overwriteName?: string;
}

/**
 * The profile popover, or hover card, that appears with user information when clicking
 * on the username, profile picture of a user, or others.
 * However this component should not be used directly, instead use the `ProfilePopoverController` which is
 * what is default exported from 'components/profile_popover'.
 */
const ProfilePopover = ({
    userId,
    src,
    channelId: channelIdProp,
    hideStatus,
    fromWebhook,
    hide,
    returnFocus,
    overwriteIcon,
    overwriteName,
}: Props) => {
    const dispatch = useDispatch();
    const user = useSelector((state: GlobalState) => getUser(state, userId));
    const currentTeamId = useSelector((state: GlobalState) => getCurrentTeamId(state));
    const channelId = useSelector((state: GlobalState) => (channelIdProp || getDefaultChannelId(state)));
    const isMobileView = useSelector(getIsMobileView);
    const teamUrl = useSelector(getCurrentRelativeTeamUrl);
    const modals = useSelector((state: GlobalState) => state.views.modals);
    const status = useSelector((state: GlobalState) => getStatusForUserId(state, userId) || UserStatuses.OFFLINE);
    const currentUserTimezone = useSelector(getCurrentTimezone);
    const currentUserId = useSelector(getCurrentUserId);

    const [loadingDMChannel, setLoadingDMChannel] = useState<string>();

    const handleReturnFocus = useMemo(() => {
        if (returnFocus) {
            return returnFocus;
        }

        const previouslyFocused = document.activeElement;
        return () => {
            document.dispatchEvent(new CustomEvent<A11yFocusEventDetail>(
                A11yCustomEventTypes.FOCUS, {
                    detail: {
                        target: previouslyFocused as HTMLElement,
                        keyboardOnly: true,
                    },
                },
            ));
        };
    }, []);

    const handleCloseModals = useCallback(() => {
        for (const modal in modals?.modalState) {
            if (!Object.prototype.hasOwnProperty.call(modals, modal)) {
                continue;
            }
            if (modals?.modalState[modal].open) {
                dispatch(closeModal(modal));
            }
        }
    }, [modals]);

    const handleShowDirectChannel = useCallback(async (e: React.MouseEvent<HTMLButtonElement>) => {
        e.preventDefault();
        if (!user) {
            return;
        }

        if (loadingDMChannel !== undefined) {
            return;
        }
        setLoadingDMChannel(user.id);

        handleCloseModals();
        const result = await dispatch(openDirectChannelToUserId(user.id));
        if (!result.error) {
            if (isMobileView) {
                GlobalActions.emitCloseRightHandSide();
            }
            setLoadingDMChannel(undefined);
            hide?.();
            getHistory().push(`${teamUrl}/messages/@${user.username}`);
        }
    }, [user, loadingDMChannel, handleCloseModals, isMobileView, hide, teamUrl]);

    useEffect(() => {
        if (currentTeamId && userId) {
            dispatch(getMembershipForEntities(
                currentTeamId,
                userId,
                channelId,
            ));
        }
    }, []);

    if (!user) {
        return null;
    }

    const urlSrc = overwriteIcon || src;
    const haveOverrideProp = Boolean(overwriteIcon || overwriteName);
    const fullname = overwriteName || Utils.getFullName(user);

    return (
        <>
            <ProfilePopoverTitle
                channelId={channelId}
                isBot={user.is_bot}
                returnFocus={handleReturnFocus}
                roles={user.roles}
                userId={user.id}
                hide={hide}
            />
            <div className='user-profile-popover-content'>
                <ProfilePopoverAvatar
                    hideStatus={hideStatus}
                    urlSrc={urlSrc}
                    username={user.username}
                    status={status}
                />
                <ProfilePopoverLastActive userId={user.id}/>
                <ProfilePopoverName
                    user={user}
                    haveOverrideProp={haveOverrideProp}
                    fullname={fullname}
                />
                <hr/>
                <ProfilePopoverEmail
                    email={user.email}
                    haveOverrideProp={haveOverrideProp}
                    isBot={user.is_bot}
                />
                <div className='user-profile-popover-pluggables'>
                    <Pluggable
                        pluggableName={PLUGGABLE_COMPONENT_NAME_PROFILE_POPOVER}
                        user={user}
                        hide={hide}
                        status={hideStatus ? null : status}
                        fromWebhook={fromWebhook}
                    />
                </div>
                <ProfilePopoverTimezone
                    currentUserTimezone={currentUserTimezone}
                    profileUserTimezone={user.timezone}
                    haveOverrideProp={haveOverrideProp}
                />
                <ProfilePopoverCustomStatus
                    currentUserId={currentUserId}
                    currentUserTimezone={currentUserTimezone}
                    haveOverrideProp={haveOverrideProp}
                    hideStatus={hideStatus}
                    user={user}
                    returnFocus={handleReturnFocus}
                    hide={hide}
                />
                <hr className='user-popover__bottom-row-hr'/>
                <ProfilePopoverOverrideDisclaimer
                    haveOverrideProp={haveOverrideProp}
                    username={user.username}
                />
                <ProfilePopoverSelfUserRow
                    currentUserId={currentUserId}
                    handleCloseModals={handleCloseModals}
                    handleShowDirectChannel={handleShowDirectChannel}
                    haveOverrideProp={haveOverrideProp}
                    returnFocus={handleReturnFocus}
                    userId={user.id}
                    hide={hide}
                />
                <ProfilePopoverOtherUserRow
                    currentUserId={currentUserId}
                    fullname={fullname}
                    handleCloseModals={handleCloseModals}
                    handleShowDirectChannel={handleShowDirectChannel}
                    haveOverrideProp={haveOverrideProp}
                    returnFocus={handleReturnFocus}
                    user={user}
                    hide={hide}
                />
                <Pluggable
                    pluggableName='PopoverUserActions'
                    user={user}
                    hide={hide}
                    status={hideStatus ? null : status}
                />
            </div>
        </>
    );
};

function getDefaultChannelId(state: GlobalState) {
    const selectedPost = getSelectedPost(state);
    return selectedPost.exists ? selectedPost.channel_id : getCurrentChannelId(state);
}

export default React.memo(ProfilePopover);
