// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState} from 'react';
import {useSelector} from 'react-redux';

import {isCustomStatusEnabled} from 'selectors/views/custom_status';

import WithTooltip from 'components/with_tooltip';

import type {GlobalState} from 'types/store';

interface ComponentProps {
    text: string;
    className?: string;
}

const CustomStatusText = (props: ComponentProps) => {
    const {text, className} = props;
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
        <WithTooltip
            title={text}
        >
            {customStatusTextComponent}
        </WithTooltip>
    );
};

CustomStatusText.defaultProps = {
    text: '',
    className: '',
};

export default CustomStatusText;
