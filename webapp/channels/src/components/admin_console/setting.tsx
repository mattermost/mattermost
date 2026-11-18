// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import WidgetSetting from 'components/widgets/settings/setting';

import SetByEnv from './set_by_env';

export type Props = {
    inputId?: string;
    label: React.ReactNode;
    children?: React.ReactNode;
    helpText?: React.ReactNode;
    setByEnv?: boolean;
};

const Settings = ({children, setByEnv, helpText, inputId, label}: Props) => {
    if (!inputId) {
        return (
            <div className='form-group'>
                <label className='control-label col-sm-4'>
                    {label}
                </label>
                <div className='col-sm-8'>
                    {children}
                    <div className='help-text'>
                        {helpText}
                    </div>
                    {setByEnv ? <SetByEnv/> : null}
                </div>
            </div>
        );
    }

    return (
        <WidgetSetting
            label={label}
            labelClassName='col-sm-4'
            inputClassName='col-sm-8'
            helpText={helpText}
            inputId={inputId}
            testIdScope='admin.setting'
            testKey={inputId}
            footer={setByEnv ? <SetByEnv/> : undefined}
        >
            {children}
        </WidgetSetting>
    );
};

export default React.memo(Settings);
