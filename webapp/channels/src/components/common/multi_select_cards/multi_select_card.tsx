// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import WithTooltip from 'components/with_tooltip';

import './multi_select_card.scss';

export type Props = {
    onClick: () => void;
    icon: JSX.Element;
    id: string;
    buttonText: string;
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
                {props.buttonText}
            </span>
            {props.checked && <i className='MultiSelectCard__checkmark icon icon-check-circle'/>}
        </button>
    );

    if (props.tooltip) {
        button = (
            <WithTooltip
                id={props.id}
                placement='top'
                title={props.tooltip}
            >
                {button}
            </WithTooltip>
        );
    }

    return button;
};

export default MultiSelectCard;
