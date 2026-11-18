// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import SetByEnv from './set_by_env';
import type {Props} from './setting';

export default function SettingSet({
    children,
    helpText,
    inputId,
    label,
    setByEnv,
}: Props) {
    return (
        <fieldset
            role='group'
            data-testid={inputId ? `admin.setting:${inputId}--group` : undefined}
            id={inputId}
            className='form-group'
        >
            <legend className='control-label form-legend col-sm-4'>
                {label}
            </legend>
            <div className='col-sm-8'>
                {children}
                {helpText ? (
                    <div
                        data-testid={inputId ? 'admin.setting.set_help--text' : undefined}
                        className='help-text'
                    >
                        {helpText}
                    </div>
                ) : null}
                {setByEnv ? <SetByEnv/> : null}
            </div>
        </fieldset>
    );
}
