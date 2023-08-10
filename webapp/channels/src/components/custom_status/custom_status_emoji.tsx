// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useMemo, memo} from 'react';
import {useSelector} from 'react-redux';

import {CustomStatusDuration} from '@mattermost/types/users';

import {getCurrentTimezone} from 'mattermost-redux/selectors/entities/timezone';

import {makeGetCustomStatus, isCustomStatusEnabled, isCustomStatusExpired} from 'selectors/views/custom_status';

import RenderEmoji from 'components/emoji/render_emoji';
import OverlayTrigger from 'components/overlay_trigger';
import Tooltip from 'components/tooltip';

import Constants from 'utils/constants';

import ExpiryTime from './expiry_time';

import type {GlobalState} from 'types/store';

interface Props {
    emojiSize?: number;
    showTooltip?: boolean;
    tooltipDirection?: 'top' | 'right' | 'bottom' | 'left';
    spanStyle?: React.CSSProperties;
    emojiStyle?: React.CSSProperties;
    userID?: string;
    onClick?: () => void;
}

function CustomStatusEmoji({
    emojiSize = 16,
    showTooltip = false,
    tooltipDirection = 'top',
    spanStyle = {},
    emojiStyle = {
        marginLeft: 4,
    },
    userID = '',
    onClick,
}: Props) {
    const getCustomStatus = useMemo(makeGetCustomStatus, []);
    const customStatus = useSelector((state: GlobalState) => getCustomStatus(state, userID));

    const timezone = useSelector(getCurrentTimezone);

    const customStatusExpired = useSelector((state: GlobalState) => isCustomStatusExpired(state, customStatus));
    const customStatusEnabled = useSelector(isCustomStatusEnabled);
    const isCustomStatusSet = Boolean(customStatusEnabled && customStatus?.emoji && !customStatusExpired);
    if (!isCustomStatusSet) {
        return null;
    }

    const statusEmoji = (
        <RenderEmoji
            emojiName={customStatus.emoji}
            size={emojiSize}
            emojiStyle={emojiStyle}
            onClick={onClick}
        />
    );

    if (!showTooltip) {
        return statusEmoji;
    }

    return (
        <OverlayTrigger
            delayShow={Constants.OVERLAY_TIME_DELAY}
            placement={tooltipDirection}
            overlay={
                <Tooltip id='custom-status-tooltip'>
                    <div className='custom-status'>
                        <RenderEmoji
                            emojiName={customStatus.emoji}
                            size={14}
                            emojiStyle={{
                                marginTop: 2,
                            }}
                        />
                        {customStatus.text &&
                            <span
                                className='custom-status-text'
                                style={{marginLeft: 5}}
                            >
                                {customStatus.text}
                            </span>
                        }
                    </div>
                    {customStatus.expires_at && customStatus.duration !== CustomStatusDuration.DONT_CLEAR &&
                        <div>
                            <ExpiryTime
                                time={customStatus.expires_at}
                                timezone={timezone}
                                className='custom-status-expiry'
                            />
                        </div>
                    }
                </Tooltip>
            }
        >
            <span style={spanStyle}>
                {statusEmoji}
            </span>
        </OverlayTrigger>
    );
}

function arePropsEqual(prevProps: Props, nextProps: Props) {
    return prevProps.userID === nextProps.userID;
}

export default memo(CustomStatusEmoji, arePropsEqual);
