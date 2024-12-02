// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import SetByEnv from './set_by_env';
import type {Props as SettingProps} from './setting';

export type Props = Omit<SettingProps, 'nested'>;

export default function SettingSet({
    children,
    helpText,
    inputId,
    label,
    setByEnv,
}: Props) {
    return (
        <fieldset
            data-testid={inputId}
            id={inputId}
            className='form-group'
        >
            <legend className='control-label form-legend col-sm-4'>
                {label}
            </legend>
            <div className='col-sm-8'>
                {children}
                <div
                    data-textid={inputId + 'help-text'}
                    className='help-text'
                >
                    {helpText}
                </div>
                {setByEnv ? <SetByEnv/> : null}
            </div>
        </fieldset>
    );
}
