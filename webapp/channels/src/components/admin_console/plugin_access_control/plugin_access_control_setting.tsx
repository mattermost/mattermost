// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useEffect, useRef, useState} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {useSelector} from 'react-redux';
import {useParams} from 'react-router-dom';

import {Client4} from 'mattermost-redux/client';

import type {SystemConsoleCustomSettingsComponentProps} from 'components/admin_console/schema_admin_settings';
import FormError from 'components/form_error';

import type {GlobalState} from 'types/store';

import PluginAccessControlSettings, {
    emptyAccessControl,
    type PluginAccessControlUI,
} from './plugin_access_control_settings';

const PluginAccessControlSetting = ({
    disabled,
    setSaveNeeded,
    registerSaveAction,
    unRegisterSaveAction,
}: SystemConsoleCustomSettingsComponentProps) => {
    const {formatMessage} = useIntl();
    const {plugin_id: pluginId = ''} = useParams<{plugin_id: string}>();
    const userFiltering = useSelector((state: GlobalState) => state.entities.admin.plugins?.[pluginId]?.user_filtering);

    const [accessControl, setAccessControl] = useState<PluginAccessControlUI>(emptyAccessControl());
    const [loaded, setLoaded] = useState(userFiltering === false);
    const [loadError, setLoadError] = useState(false);
    const [saveError, setSaveError] = useState('');

    // Keep latest ACL in a ref so the registered save action always persists current edits.
    const accessControlRef = useRef(accessControl);
    accessControlRef.current = accessControl;
    const dirtyRef = useRef(false);

    useEffect(() => {
        if (!pluginId || userFiltering === false) {
            setLoaded(userFiltering === false);
            return undefined;
        }

        let cancelled = false;
        setLoaded(false);
        (async () => {
            try {
                const settings = await Client4.getPluginAccessControl(pluginId);
                if (cancelled) {
                    return;
                }
                setAccessControl({
                    Enable: settings.enable,
                    AllowedUserIds: settings.allowed_user_ids || [],
                });
                dirtyRef.current = false;
                setLoaded(true);
                setLoadError(false);
            } catch {
                if (!cancelled) {
                    setLoadError(true);
                    setLoaded(false);
                }
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [pluginId, userFiltering]);

    const handleSave = useCallback(async () => {
        if (!pluginId || userFiltering === false || !loaded || !dirtyRef.current) {
            return {error: undefined};
        }

        setSaveError('');
        const acl = accessControlRef.current;
        try {
            await Client4.setPluginAccessControl(pluginId, {
                enable: Boolean(acl.Enable),
                allowed_user_ids: acl.AllowedUserIds || [],
            });
            dirtyRef.current = false;
            return {error: undefined};
        } catch (err) {
            const message = err instanceof Error ? err.message : '';
            const fallback = formatMessage({
                id: 'admin.plugin.accessControl.saveUsersError',
                defaultMessage: 'Failed to save allowed users for this plugin.',
            });
            setSaveError(message || fallback);
            return {
                error: {
                    message: message || fallback,
                },
            };
        }
    }, [formatMessage, loaded, pluginId, userFiltering]);

    useEffect(() => {
        registerSaveAction(handleSave);
        return () => {
            unRegisterSaveAction(handleSave);
        };
    }, [handleSave, registerSaveAction, unRegisterSaveAction]);

    const handleChange = useCallback((next: PluginAccessControlUI) => {
        dirtyRef.current = true;
        setAccessControl(next);
        setSaveNeeded();
    }, [setSaveNeeded]);

    if (!pluginId) {
        return null;
    }

    if (loadError) {
        return (
            <div className='pt-3'>
                <FormError
                    error={
                        <FormattedMessage
                            id='admin.plugin.accessControl.loadUsersError'
                            defaultMessage='Failed to load allowed users for this plugin. Saving access control is disabled until the page is reloaded.'
                        />
                    }
                />
            </div>
        );
    }

    if (!loaded && userFiltering !== false) {
        return null;
    }

    return (
        <>
            <PluginAccessControlSettings
                pluginId={pluginId}
                userFiltering={userFiltering}
                accessControl={accessControl}
                isDisabled={disabled || !loaded}
                onAccessControlChange={handleChange}
            />
            {saveError && (
                <FormError error={saveError}/>
            )}
        </>
    );
};

export default PluginAccessControlSetting;
