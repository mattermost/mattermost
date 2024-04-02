// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {PureComponent} from 'react';

import type {UserProfile as UserProfileType} from '@mattermost/types/users';

import type {Theme} from 'mattermost-redux/selectors/entities/preferences';
import {isGuest} from 'mattermost-redux/utils/user_utils';

import OverlayTrigger from 'components/overlay_trigger';
import type {BaseOverlayTrigger} from 'components/overlay_trigger';
import ProfilePopover from 'components/profile_popover';
import SharedUserIndicator from 'components/shared_user_indicator';
import BotTag from 'components/widgets/tag/bot_tag';
import GuestTag from 'components/widgets/tag/guest_tag';

import {imageURLForUser} from 'utils/utils';

import {generateColor} from './utils';

export type Props = {
    user?: UserProfileType;
    userId: string;
    displayName?: string;
    isShared?: boolean;
    overwriteName?: string;
    overwriteIcon?: string;
    disablePopover?: boolean;
    displayUsername?: boolean;
    colorize?: boolean;
    hideStatus?: boolean;
    isMobileView: boolean;
    isRHS?: boolean;
    channelId?: string;
    theme?: Theme;
}

export default class UserProfile extends PureComponent<Props> {
    private overlay?: BaseOverlayTrigger;

    static defaultProps: Partial<Props> = {
        disablePopover: false,
        displayUsername: false,
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
            isMobileView,
            isRHS,
            isShared,
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
        if (isRHS && !isMobileView) {
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
                    id={`sharedUserIndicator-${userId}`}
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
                            hide={this.hideProfilePopover}
                            hideStatus={hideStatus}
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
