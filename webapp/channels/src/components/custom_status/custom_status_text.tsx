// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState} from 'react';
import {useSelector} from 'react-redux';

import OverlayTrigger from 'components/overlay_trigger';
import Tooltip from 'components/tooltip';
import {isCustomStatusEnabled} from 'selectors/views/custom_status';
import {GlobalState} from 'types/store';
import Constants from 'utils/constants';

interface ComponentProps {
    tooltipDirection?: 'top' | 'right' | 'bottom' | 'left';
    text: string;
    className?: string;
}

const CustomStatusText = (props: ComponentProps) => {
    const {tooltipDirection, text, className} = props;
    const customStatusEnabled = useSelector((state: GlobalState) => {
        return isCustomStatusEnabled(state);
    });
    const [show, setShow] = useState<boolean>(false);
    let spanElement: HTMLSpanElement | null = null;
    if (!customStatusEnabled) {
        return null;
    }

    const showTooltip = () => {
        setShow(Boolean(spanElement && spanElement.offsetWidth < spanElement.scrollWidth));
    };

    const customStatusTextComponent = (
        <span
            className={`overflow--ellipsis text-nowrap ${className}`}
            ref={(element) => {
                spanElement = element;
                showTooltip();
            }}
        >
            {text}
        </span>
    );

    if (!show) {
        return customStatusTextComponent;
    }

    return (
        <OverlayTrigger
            delayShow={Constants.OVERLAY_TIME_DELAY}
            placement={tooltipDirection}
            overlay={
                <Tooltip id='custom-status-tooltip'>
                    {text}
                </Tooltip>
            }
        >
            {customStatusTextComponent}
        </OverlayTrigger>
    );
};

CustomStatusText.defaultProps = {
    tooltipDirection: 'bottom',
    text: '',
    className: '',
};

export default CustomStatusText;
