// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {useIntl} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';

import {getCurrentChannelId, getCurrentUserId} from 'mattermost-redux/selectors/entities/common';
import {getTeammateNameDisplaySetting} from 'mattermost-redux/selectors/entities/preferences';
import {getCurrentRelativeTeamUrl, getCurrentTeamId} from 'mattermost-redux/selectors/entities/teams';
import {getCurrentTimezone} from 'mattermost-redux/selectors/entities/timezone';
import {getStatusForUserId, getUser} from 'mattermost-redux/selectors/entities/users';
import {displayUsername} from 'mattermost-redux/utils/user_utils';

import {openDirectChannelToUserId} from 'actions/channel_actions';
import * as GlobalActions from 'actions/global_actions';
import {closeModal} from 'actions/views/modals';
import {getMembershipForEntities} from 'actions/views/profile_popover';
import {getSelectedPost} from 'selectors/rhs';
import {getIsMobileView} from 'selectors/views/browser';
import {isAnyModalOpen as getIsAnyModalOpen} from 'selectors/views/modals';

import useDidUpdate from 'components/common/hooks/useDidUpdate';
import Popover from 'components/widgets/popover';

import Pluggable from 'plugins/pluggable';
import {getHistory} from 'utils/browser_history';
import Constants, {A11yClassNames, A11yCustomEventTypes, UserStatuses} from 'utils/constants';
import type {A11yFocusEventDetail} from 'utils/constants';
import * as Keyboard from 'utils/keyboard';
import {shouldFocusMainTextbox} from 'utils/post_utils';
import * as Utils from 'utils/utils';

import type {GlobalState} from 'types/store';

import ProfilePopoverActions from './profile_popover_actions';
import ProfilePopoverAvatar from './profile_popover_avatar';
import ProfilePopoverCustomStatus from './profile_popover_custom_status';
import ProfilePopoverEdit from './profile_popover_edit';
import ProfilePopoverEmail from './profile_popover_email';
import ProfilePopoverLastActive from './profile_popover_last_active';
import ProfilePopoverName from './profile_popover_name';
import ProfilePopoverOverrideDisclaimer from './profile_popover_override_disclaimer';
import ProfilePopoverTitle from './profile_popover_title';
import ProfileTimezone from './profile_timezone';

import './profile_popover.scss';

export interface ProfilePopoverProps extends Omit<React.ComponentProps<typeof Popover>, 'id'> {

    /**
     * Source URL from the image to display in the popover
     */
    src: string;

    /**
     * Source URL from the image that should override default image
     */
    overwriteIcon?: string;

    /**
     * Set to true of the popover was opened from a webhook post
     */
    fromWebhook?: boolean;

    userId: string;
    channelId?: string;

    hideStatus?: boolean;

    /**
     * Function to call to hide the popover
     */
    hide?: () => void;

    /**
     * Function to call to return focus to the previously focused element when the popover closes.
     * If not provided, the popover will automatically determine the previously focused element
     * and focus that on close. However, if the previously focused element is not correctly detected
     * by the popover, or the previously focused element will disappear after the popover opens,
     * it is necessary to provide this function to focus the correct element.
     */
    returnFocus?: () => void;

    /**
     * The overwritten username that should be shown at the top of the popover
     */
    overwriteName?: string;
}

function getDefaultChannelId(state: GlobalState) {
    const selectedPost = getSelectedPost(state);
    return selectedPost.exists ? selectedPost.channel_id : getCurrentChannelId(state);
}

/**
 * The profile popover, or hovercard, that appears with user information when clicking
 * on the username or profile picture of a user.
 */
const ProfilePopover = ({
    returnFocus: returnFocusProp,
    userId,
    channelId: channelIdProp,
    hide,
    overwriteIcon,
    overwriteName,
    src,
    hideStatus,
    fromWebhook,
    ...restProps
}: ProfilePopoverProps) => {
    const {formatMessage} = useIntl();

    const dispatch = useDispatch();
    const user = useSelector((state: GlobalState) => getUser(state, userId));
    const currentTeamId = useSelector((state: GlobalState) => getCurrentTeamId(state));
    const channelId = useSelector((state: GlobalState) => (channelIdProp || getDefaultChannelId(state)));
    const isAnyModalOpen = useSelector(getIsAnyModalOpen);
    const isMobileView = useSelector(getIsMobileView);
    const teamUrl = useSelector(getCurrentRelativeTeamUrl);
    const modals = useSelector((state: GlobalState) => state.views.modals);
    const teammateNameDisplay = useSelector(getTeammateNameDisplaySetting);
    const status = useSelector((state: GlobalState) => getStatusForUserId(state, userId) || UserStatuses.OFFLINE);
    const currentUserTimezone = useSelector(getCurrentTimezone);
    const currentUserId = useSelector(getCurrentUserId);

    const closeButtonRef = useRef<HTMLButtonElement>(null);
    const [loadingDMChannel, setLoadingDMChannel] = useState<string>();
    const returnFocus = useMemo(() => {
        if (returnFocusProp) {
            return returnFocusProp;
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

    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (shouldFocusMainTextbox(e, document.activeElement)) {
            hide?.();
        } else if (Keyboard.isKeyPressed(e, Constants.KeyCodes.ESCAPE)) {
            returnFocus();
        }
    }, [hide, returnFocus]);

    useEffect(() => {
        if (currentTeamId && userId) {
            dispatch(getMembershipForEntities(
                currentTeamId,
                userId,
                channelId,
            ));
        }

        // Focus the close button when the popover first opens, to bring the focus into the popover.
        document.dispatchEvent(new CustomEvent<A11yFocusEventDetail>(
            A11yCustomEventTypes.FOCUS, {
                detail: {
                    target: closeButtonRef.current,
                    keyboardOnly: true,
                },
            },
        ));
    }, []);

    useDidUpdate(() => {
        hide?.();
    }, [isAnyModalOpen]);

    if (!user) {
        return null;
    }

    const urlSrc = overwriteIcon || src;
    const haveOverrideProp = Boolean(overwriteIcon || overwriteName);
    const fullname = overwriteName || Utils.getFullName(user);

    const displayName = displayUsername(user, teammateNameDisplay);

    const tabCatcher = (
        <span
            tabIndex={0}
            onFocus={(e) => (e.relatedTarget as HTMLElement).focus()}
        />
    );

    return (
        <Popover
            {...restProps}
            id='user-profile-popover'
        >
            {tabCatcher}
            <div
                role='dialog'
                aria-label={formatMessage(
                    {
                        id: 'profile_popover.profileLabel',
                        defaultMessage: 'Profile for {name}',
                    },
                    {name: displayName},
                )}
                onKeyDown={handleKeyDown}
                className={A11yClassNames.POPUP}
                aria-modal={true}
            >
                <ProfilePopoverTitle
                    channelId={channelId}
                    closeButtonRef={closeButtonRef}
                    isBot={user.is_bot}
                    returnFocus={returnFocus}
                    roles={user.roles}
                    userId={user.id}
                    username={user.username}
                    hide={hide}
                />
                <div className='user-profile-popover__content'>
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
                    <hr className='divider divider--expanded'/>
                    <ProfilePopoverEmail
                        email={user.email}
                        haveOverrideProp={haveOverrideProp}
                        isBot={user.is_bot}
                    />
                    <Pluggable
                        pluggableName='PopoverUserAttributes'
                        user={user}
                        hide={hide}
                        status={hideStatus ? null : status}
                        fromWebhook={fromWebhook}
                    />
                    <ProfileTimezone
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
                        returnFocus={returnFocus}
                        hide={hide}
                    />
                    <ProfilePopoverEdit
                        currentUserId={currentUserId}
                        handleCloseModals={handleCloseModals}
                        handleShowDirectChannel={handleShowDirectChannel}
                        haveOverrideProp={haveOverrideProp}
                        returnFocus={returnFocus}
                        userId={user.id}
                        hide={hide}
                    />
                    <ProfilePopoverOverrideDisclaimer
                        haveOverrideProp={haveOverrideProp}
                        username={user.username}
                    />
                    <ProfilePopoverActions
                        channelId={channelId}
                        currentUserId={currentUserId}
                        fullname={fullname}
                        handleCloseModals={handleCloseModals}
                        handleShowDirectChannel={handleShowDirectChannel}
                        haveOverrideProp={haveOverrideProp}
                        returnFocus={returnFocus}
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
            </div>
            {tabCatcher}
        </Popover>
    );
};

export default React.memo(ProfilePopover);
