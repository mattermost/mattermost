// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import WithTooltip from 'components/with_tooltip';

type Props = {
    title: React.ReactNode;
    subtitle?: React.ReactNode;
    buttonText?: React.ReactNode;
    isDisabled?: boolean;
    onClick?: () => void;
    tooltipText?: string;
};

// This component can be used in the card header
const TitleAndButtonCardHeader: React.FC<Props> = (props: Props) => {
    let button = (
        <button
            disabled={props.isDisabled}
            className='btn btn-primary'
            onClick={props.onClick}
        >
            {props.buttonText}
        </button>
    );

    if (props.isDisabled && props.tooltipText) {
        button = (
            <WithTooltip
                title={props.tooltipText}
            >
                {button}
            </WithTooltip>
        );
    }

    return (
        <>
            <div>
                <div className='text-top'>
                    {props.title}
                </div>
                {
                    props.subtitle &&
                    <div className='text-bottom'>
                        {props.subtitle}
                    </div>
                }
            </div>
            {
                props.buttonText && props.onClick && button
            }
        </>
    );
};

export default TitleAndButtonCardHeader;
