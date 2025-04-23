// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {OverlayTrigger, Tooltip} from 'react-bootstrap';

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
    const button = (
        <button
            disabled={props.isDisabled}
            className='btn btn-primary'
            onClick={props.onClick}
        >
            {props.buttonText}
        </button>
    );

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
                props.buttonText && props.onClick && (
                    props.tooltipText && props.isDisabled ? (
                        <OverlayTrigger
                            placement='bottom'
                            overlay={
                                <Tooltip id='tooltip-disabled-reason'>
                                    {props.tooltipText}
                                </Tooltip>
                            }
                        >
                            <span>{button}</span>
                        </OverlayTrigger>
                    ) : button
                )
            }
        </>
    );
};

export default TitleAndButtonCardHeader;
