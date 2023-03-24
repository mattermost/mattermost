// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import Toggle from 'components/toggle';

type Props = {
    id: string;
    title: JSX.Element;
    toggled: boolean;
    subTitle: JSX.Element;
    onToggle: () => void;
    last?: boolean;
    disabled?: boolean;
    singleLine?: boolean;
    children?: JSX.Element;
    offText?: JSX.Element;
    onText?: JSX.Element;
};

const LineSwitch = (props: Props): JSX.Element => {
    const {title, subTitle, singleLine, toggled, onToggle, children, offText, onText, disabled, last, id} = props;
    return (<div>
        <div className='line-switch d-flex flex-sm-column flex-md-row align-items-sm-start align-items-center'>
            <label className='line-switch__label'>{title}</label>
            <div
                data-testid={id}
                className='line-switch__toggle'
            >
                <Toggle
                    id={id}
                    disabled={disabled}
                    onToggle={onToggle}
                    toggled={toggled}
                    onText={onText}
                    offText={offText}
                />
            </div>
        </div>
        <div className='row'>
            <div className='col-sm-10'>
                <div className={`help-text-small help-text-no-padding ${singleLine ? 'help-text-single-line' : ''}`}>{subTitle}</div>
            </div>
        </div>
        {children}
        {!last && <div className='section-separator'><hr className='separator__hr'/></div>}
    </div>);
};

export default LineSwitch;
