// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';

import {UserSelector} from 'components/admin_console/content_flagging/user_multiselector/user_multiselector';
import RadioSetting from 'components/admin_console/radio_setting';
import Setting from 'components/admin_console/setting';

import './plugin_access_control_settings.scss';

export type PluginAccessControlUI = {
    Enable: boolean;
    AllowedUserIds: string[];
};

export const emptyAccessControl = (): PluginAccessControlUI => ({
    Enable: false,
    AllowedUserIds: [],
});

type Props = {
    pluginId: string;
    userFiltering?: boolean;
    accessControl: PluginAccessControlUI;
    isDisabled?: boolean;
    onAccessControlChange: (accessControl: PluginAccessControlUI) => void;
};

const PluginAccessControlSettings = ({
    pluginId,
    userFiltering,
    accessControl,
    isDisabled,
    onAccessControlChange,
}: Props) => {
    const {formatMessage} = useIntl();

    const handleModeChange = useCallback((_id: string, value: string) => {
        const selected = value === 'selected';
        onAccessControlChange({
            Enable: selected,

            // Everyone means no allow-list; clear selected users so save wipes the DB rows.
            AllowedUserIds: selected ? accessControl.AllowedUserIds : [],
        });
    }, [accessControl, onAccessControlChange]);

    const handleUsersChange = useCallback((selectedUserIds: string[]) => {
        onAccessControlChange({
            ...accessControl,
            AllowedUserIds: selectedUserIds,
        });
    }, [accessControl, onAccessControlChange]);

    if (userFiltering === false) {
        return (
            <div className='PluginAccessControlSettings'>
                <Setting
                    label={
                        <FormattedMessage
                            id='admin.plugin.accessControl.title'
                            defaultMessage='UI access'
                        />
                    }
                    inputId={`plugin_access_control_mode_${pluginId}`}
                    helpText={
                        <FormattedMessage
                            id='admin.plugin.accessControl.optedOut'
                            defaultMessage='This plugin does not support user filtering.'
                        />
                    }
                >
                    <span/>
                </Setting>
            </div>
        );
    }

    const mode = accessControl.Enable ? 'selected' : 'everyone';
    const usersDisabled = Boolean(isDisabled) || !accessControl.Enable;

    return (
        <div className='PluginAccessControlSettings'>
            <RadioSetting
                id={`plugin_access_control_mode_${pluginId}`}
                label={
                    <FormattedMessage
                        id='admin.plugin.accessControl.title'
                        defaultMessage='UI access'
                    />
                }
                helpText={
                    <FormattedMessage
                        id='admin.plugin.accessControl.help'
                        defaultMessage='Control which users can see this plugin. System Administrators always have access.'
                    />
                }
                values={[
                    {
                        text: formatMessage({id: 'admin.plugin.accessControl.everyone', defaultMessage: 'Everyone'}),
                        value: 'everyone',
                    },
                    {
                        text: formatMessage({id: 'admin.plugin.accessControl.selectedUsers', defaultMessage: 'Only selected users'}),
                        value: 'selected',
                    },
                ]}
                value={mode}
                setByEnv={false}
                disabled={isDisabled}
                onChange={handleModeChange}
            />
            <Setting
                label={
                    <FormattedMessage
                        id='admin.plugin.accessControl.allowedUsers'
                        defaultMessage='Allowed users'
                    />
                }
                inputId={`plugin_access_control_users_${pluginId}`}
            >
                <div className='PluginAccessControlSettings__usersResizer'>
                    <UserSelector
                        key={`plugin_access_control_users_${pluginId}_${mode}`}
                        isMulti={true}
                        id={`plugin_access_control_users_${pluginId}`}
                        multiSelectInitialValue={accessControl.AllowedUserIds || []}
                        multiSelectOnChange={handleUsersChange}
                        disabled={usersDisabled}
                    />
                </div>
            </Setting>
        </div>
    );
};

export default PluginAccessControlSettings;
