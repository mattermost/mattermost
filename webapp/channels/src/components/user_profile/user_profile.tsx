// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {PureComponent} from 'react';

import {isGuest} from 'mattermost-redux/utils/user_utils';

import OverlayTrigger from 'components/overlay_trigger';
import ProfilePopover from 'components/profile_popover';
import SharedUserIndicator from 'components/shared_user_indicator';
import BotTag from 'components/widgets/tag/bot_tag';
import GuestTag from 'components/widgets/tag/guest_tag';

import {imageURLForUser, isMobile} from 'utils/utils';

import {generateColor} from './utils';

import type {UserProfile as UserProfileType} from '@mattermost/types/users';
import type {BaseOverlayTrigger} from 'components/overlay_trigger';
import type {Theme} from 'mattermost-redux/selectors/entities/preferences';

export type UserProfileProps = {
    userId: string;
    displayName?: string;
    isBusy?: boolean;
    isShared?: boolean;
    overwriteName?: React.ReactNode;
    overwriteIcon?: string;
    user?: UserProfileType;
    disablePopover?: boolean;
    displayUsername?: boolean;
    colorize?: boolean;
    hasMention?: boolean;
    hideStatus?: boolean;
    isRHS?: boolean;
    channelId?: string;
    theme?: Theme;
}

export default class UserProfile extends PureComponent<UserProfileProps> {
    private overlay?: BaseOverlayTrigger;

    static defaultProps: Partial<UserProfileProps> = {
        disablePopover: false,
        displayUsername: false,
        hasMention: false,
        hideStatus: false,
        isRHS: false,
        overwriteName: '',
        colorize: false,
    };

    hideProfilePopover = (): void => {
        if (this.overlay) {
            this.overlay.hide();
        }
    };

    setOverlaynRef = (ref: BaseOverlayTrigger): void => {
        this.overlay = ref;
    };

    render(): React.ReactNode {
        const {
            disablePopover,
            displayName,
            displayUsername,
            isBusy,
            isRHS,
            isShared,
            hasMention,
            hideStatus,
            overwriteName,
            overwriteIcon,
            user,
            userId,
            channelId,
            colorize,
            theme,
        } = this.props;

        let name: React.ReactNode;
        if (user && displayUsername) {
            name = `@${(user.username)}`;
        } else {
            name = overwriteName || displayName || '...';
        }

        const ariaName: string = typeof name === 'string' ? name.toLowerCase() : '';

        let userColor = theme?.centerChannelColor;
        if (user && theme) {
            userColor = generateColor(user.username, theme.centerChannelBg);
        }

        let userStyle;
        if (colorize) {
            userStyle = {color: userColor};
        }

        if (disablePopover) {
            return (
                <div
                    className='user-popover'
                    style={userStyle}
                >{name}</div>
            );
        }

        let placement = 'right';
        if (isRHS && !isMobile()) {
            placement = 'left';
        }

        let profileImg = '';
        if (user) {
            profileImg = imageURLForUser(user.id, user.last_picture_update);
        }

        let sharedIcon;
        if (isShared) {
            sharedIcon = (
                <SharedUserIndicator
                    className='shared-user-icon'
                    withTooltip={true}
                />
            );
        }

        return (
            <>
                <OverlayTrigger
                    ref={this.setOverlaynRef}
                    trigger={['click']}
                    placement={placement}
                    rootClose={true}
                    overlay={
                        <ProfilePopover
                            className='user-profile-popover'
                            userId={userId}
                            channelId={channelId}
                            src={profileImg}
                            isBusy={isBusy}
                            hide={this.hideProfilePopover}
                            hideStatus={hideStatus}
                            isRHS={isRHS}
                            hasMention={hasMention}
                            overwriteName={overwriteName}
                            overwriteIcon={overwriteIcon}
                        />
                    }
                >
                    <button
                        aria-label={ariaName}
                        className='user-popover style--none'
                        style={userStyle}
                    >
                        {name}
                    </button>
                </OverlayTrigger>
                {sharedIcon}
                {(user && user.is_bot) && <BotTag/>}
                {(user && isGuest(user.roles)) && <GuestTag/>}
            </>
        );
    }
}
