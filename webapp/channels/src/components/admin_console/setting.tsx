// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {PureComponent} from 'react';

import SetByEnv from './set_by_env';

export type SettingsProps = {
    inputId?: string;
    label: React.ReactNode;
    children: React.ReactNode;
    helpText?: React.ReactNode;
    setByEnv?: boolean;
}

export default class Settings extends PureComponent<SettingsProps> {
    public render() {
        const {
            children,
            setByEnv,
            helpText,
            inputId,
            label,
        } = this.props;

        return (
            <div
                data-testid={inputId}
                className='form-group'
            >
                <label
                    className='control-label col-sm-4'
                    htmlFor={inputId}
                >
                    {label}
                </label>
                <div className='col-sm-8'>
                    {children}
                    <div
                        data-testid={inputId + 'help-text'}
                        className='help-text'
                    >
                        {helpText}
                    </div>
                    {setByEnv ? <SetByEnv/> : null}
                </div>
            </div>
        );
    }
}
