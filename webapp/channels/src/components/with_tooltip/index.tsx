// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useMemo} from 'react';
import type {ComponentProps} from 'react';

import OverlayTrigger from 'components/overlay_trigger';

import Constants from 'utils/constants';

import type {CommonTooltipProps} from './create_tooltip';
import {createTooltip} from './create_tooltip';

type OverlayTriggerProps = ComponentProps<typeof OverlayTrigger>;

type WithTooltipProps = {
    children: OverlayTriggerProps['children'];
    placement: OverlayTriggerProps['placement'];
    onShow?: () => void;
    delayHide?: number;
    hide?: boolean;
} & CommonTooltipProps;
const WithTooltip = ({
    id,
    title,
    emoji,
    emojiStyle,
    hint,
    shortcut,
    placement,
    onShow,
    delayHide,
    hide,
    children,
}: WithTooltipProps) => {
    const ThisTooltip = useMemo(() => createTooltip({
        id,
        title,
        emoji,
        emojiStyle,
        hint,
        shortcut,
    }), [id, title, emoji, emojiStyle, hint, shortcut]);

    return (
        <OverlayTrigger
            delay={Constants.OVERLAY_TIME_DELAY}
            overlay={hide ? <></> : <ThisTooltip/>}
            placement={placement}
            onEnter={onShow}
            delayHide={delayHide}
        >
            {children}
        </OverlayTrigger>
    );
};

export default WithTooltip;
