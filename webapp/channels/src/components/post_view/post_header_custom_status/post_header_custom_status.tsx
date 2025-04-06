// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useMemo} from 'react';
import {useSelector} from 'react-redux';

import {makeGetCustomStatus, isCustomStatusEnabled} from 'selectors/views/custom_status';

import CustomStatusEmoji from 'components/custom_status/custom_status_emoji';

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

    return null;
};

export default PostHeaderCustomStatus;
