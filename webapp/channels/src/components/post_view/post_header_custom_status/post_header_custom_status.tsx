// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useMemo} from 'react';
import {FormattedMessage} from 'react-intl';
import {useSelector} from 'react-redux';

import {makeGetCustomStatus, showPostHeaderUpdateStatusButton, isCustomStatusEnabled} from 'selectors/views/custom_status';

import CustomStatusEmoji from 'components/custom_status/custom_status_emoji';
import {openMenu} from 'components/menu';
import {ELEMENT_ID_FOR_USER_ACCOUNT_MENU_BUTTON} from 'components/user_account_menu/user_account_menu';
import EmojiIcon from 'components/widgets/icons/emoji_icon';

import type {GlobalState} from 'types/store';

interface ComponentProps {
    userId: string;
    isSystemMessage: boolean;
    isBot: boolean;
}

const PostHeaderCustomStatus = (props: ComponentProps) => {
    const getCustomStatus = useMemo(makeGetCustomStatus, []);
    const {userId, isSystemMessage, isBot} = props;
    const userCustomStatus = useSelector((state: GlobalState) => getCustomStatus(state, userId));
    const showUpdateStatusButton = useSelector(showPostHeaderUpdateStatusButton);
    const customStatusEnabled = useSelector(isCustomStatusEnabled);

    const isCustomStatusSet = userCustomStatus && userCustomStatus.emoji;
    if (!customStatusEnabled || isSystemMessage || isBot) {
        return null;
    }

    if (isCustomStatusSet) {
        return (
            <CustomStatusEmoji
                userID={userId}
                showTooltip={true}
                emojiStyle={{
                    marginTop: 2,
                }}
            />
        );
    }

    // This must be checked after checking that custom status is not null
    if (!showUpdateStatusButton) {
        return null;
    }

    const updateStatus = (event: React.MouseEvent) => {
        event.preventDefault();
        openMenu(ELEMENT_ID_FOR_USER_ACCOUNT_MENU_BUTTON);
    };

    return (
        <button
            onClick={updateStatus}
            className='post__header-set-custom-status cursor--pointer style--none'
        >
            <EmojiIcon className='post__header-set-custom-status-icon'/>
            <span className='post__header-set-custom-status-text'>
                <FormattedMessage
                    id='post_header.update_status'
                    defaultMessage='Update your status'
                />
            </span>
        </button>
    );
};

export default PostHeaderCustomStatus;
