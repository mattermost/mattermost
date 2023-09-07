// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import './multi_select_card.scss';
import OverlayTrigger from 'components/overlay_trigger';
import Tooltip from 'components/tooltip';

export type Props = {
    onClick: () => void;
    icon: JSX.Element;
    id: string;
    defaultMessage: string;
    checked: boolean;
    tooltip?: string;
    size?: 'regular' | 'small';
}
const MultiSelectCard = (props: Props) => {
    const buttonProps: {
        className: string;
        onClick: () => void;
    } = {
        className: 'MultiSelectCard',
        onClick: props.onClick,
    };
    if (props.checked) {
        buttonProps.className += ' MultiSelectCard--checked';
    }
    if (props.size === 'small') {
        buttonProps.className += ' MultiSelectCard--small';
    }

    let button = (
        <button
            {...buttonProps}
        >
            {props.icon}
            <span className='MultiSelectCard__label'>
                <FormattedMessage
                    id={props.id}
                    defaultMessage={props.defaultMessage}
                />
            </span>
            {props.checked && <i className='MultiSelectCard__checkmark icon icon-check-circle'/>}
        </button>
    );

    if (props.tooltip) {
        button = (
            <OverlayTrigger
                className='hidden-xs'
                delayShow={500}
                placement='top'
                overlay={
                    <Tooltip
                        id={props.tooltip}
                        className='hidden-xs'
                    >
                        {props.tooltip}
                    </Tooltip>
                }
            >
                {button}
            </OverlayTrigger>
        );
    }

    return button;
};

export default MultiSelectCard;
