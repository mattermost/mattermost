// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {memo, useMemo, useRef} from 'react';
import type {MouseEvent, KeyboardEvent} from 'react';
import {useSelector} from 'react-redux';

import RenderEmoji from '@mattermost/design-system/src/components/primitives/emoji/render_emoji';
import WithTooltip from '@mattermost/design-system/src/components/primitives/with_tooltip';
import {CustomStatusDuration} from '@mattermost/types/users';

import {getCurrentTimezone} from 'mattermost-redux/selectors/entities/timezone';

import {isCustomStatusEnabled, isCustomStatusExpired, makeGetCustomStatus} from 'selectors/views/custom_status';

import {useEmojiImageUrl} from 'utils/emoji_utils';

import type {GlobalState} from 'types/store';

import ExpiryTime from './expiry_time';

interface Props {
    emojiSize?: number;
    showTooltip?: boolean;
    spanStyle?: React.CSSProperties;
    emojiStyle?: React.CSSProperties;
    userID?: string;
    onClick?: (event: MouseEvent<HTMLSpanElement> | KeyboardEvent<HTMLSpanElement>) => void;
}

function CustomStatusEmoji({
    emojiSize = 16,
    showTooltip = false,
    spanStyle = {},
    emojiStyle = {
        marginLeft: 4,
        marginTop: -1,
    },
    userID = '',
    onClick,
}: Props) {
    const getCustomStatus = useMemo(makeGetCustomStatus, []);
    const customStatus = useSelector((state: GlobalState) => getCustomStatus(state, userID));

    const timezone = useSelector(getCurrentTimezone);

    const customStatusExpired = useSelector((state: GlobalState) => isCustomStatusExpired(state, customStatus));
    const customStatusEnabled = useSelector(isCustomStatusEnabled);

    const emojiImageURL = useEmojiImageUrl(customStatus?.emoji);

    const emojiRef = useRef<HTMLSpanElement>(null);

    if (!customStatusEnabled || !customStatus?.emoji || customStatusExpired) {
        return null;
    }

    const statusEmoji = (
        <RenderEmoji
            emojiName={customStatus.emoji}
            emojiImageUrl={emojiImageURL}
            size={emojiSize}
            emojiStyle={emojiStyle}
            onClick={onClick}
        />
    );

    if (!showTooltip) {
        return statusEmoji;
    }

    return (
        <WithTooltip
            title={
                <>
                    <div className='custom-status'>
                        {customStatus.text && (
                            <span
                                className='custom-status-text'
                                style={{marginLeft: 5}}
                            >
                                {customStatus.text}
                            </span>
                        )}
                    </div>
                    {customStatus.expires_at && customStatus.duration !== CustomStatusDuration.DONT_CLEAR && (
                        <div>
                            <ExpiryTime
                                time={customStatus.expires_at}
                                timezone={timezone}
                                className='custom-status-expiry'
                            />
                        </div>
                    )}
                </>
            }
            emoji={customStatus.emoji}
            emojiImageUrl={emojiImageURL}
            isEmojiLarge={true}
        >
            <span
                ref={emojiRef}
                style={spanStyle}
            >
                {statusEmoji}
            </span>
        </WithTooltip>
    );
}

function arePropsEqual(prevProps: Props, nextProps: Props) {
    return prevProps.userID === nextProps.userID;
}

export default memo(CustomStatusEmoji, arePropsEqual);
