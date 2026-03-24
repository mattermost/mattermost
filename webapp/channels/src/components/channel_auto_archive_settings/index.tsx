// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useState} from 'react';
import {useIntl} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';

import type {AdminConfig} from '@mattermost/types/config';

import {saveConfig} from 'mattermost-redux/actions/admin';
import {getConfig} from 'mattermost-redux/selectors/entities/admin';

import AdminSetting from 'components/admin_console/admin_settings';
import BooleanSetting from 'components/admin_console/boolean_setting';
import TextSetting from 'components/admin_console/text_setting';

import type {GlobalState} from 'types/store';

type Props = {
    disabled?: boolean;
}

/**
 * ChannelAutoArchiveSettings renders the System Console panel for configuring
 * the channel auto-archive feature. Gated behind the ChannelAutoArchiveUI
 * feature flag so it can be rolled out gradually.
 *
 * Location: System Console → Site Configuration → Channels
 */
const ChannelAutoArchiveSettings = ({disabled = false}: Props) => {
    const {formatMessage} = useIntl();
    const dispatch = useDispatch();
    const config = useSelector((state: GlobalState) => getConfig(state));

    const [saveNeeded, setSaveNeeded] = useState(false);

    const handleChange = useCallback(() => setSaveNeeded(true), []);

    const handleSave = useCallback(async (settings: Partial<AdminConfig>) => {
        await dispatch(saveConfig({
            ...config,
            ChannelSettings: {
                ...config.ChannelSettings,
                ...settings,
            },
        }));
        setSaveNeeded(false);
    }, [config, dispatch]);

    return (
        <AdminSetting
            title={formatMessage({
                id: 'admin.channel_settings.auto_archive.title',
                defaultMessage: 'Channel Auto-Archive',
            })}
            description={formatMessage({
                id: 'admin.channel_settings.auto_archive.description',
                defaultMessage: 'Automatically archive channels that have had no activity for a configurable number of days. Archived channels are hidden from the channel sidebar but their content is preserved and searchable.',
            })}
            saveNeeded={saveNeeded}
            onSave={handleSave}
            disabled={disabled}
        >
            <BooleanSetting
                id='EnableAutoArchive'
                label={formatMessage({
                    id: 'admin.channel_settings.auto_archive.enable_label',
                    defaultMessage: 'Enable Channel Auto-Archive:',
                })}
                helpText={formatMessage({
                    id: 'admin.channel_settings.auto_archive.enable_help',
                    defaultMessage: 'When enabled, a background job runs daily and archives channels that have had no posts for the configured number of days.',
                })}
                value={config.ChannelSettings?.EnableAutoArchive ?? false}
                onChange={handleChange}
                setByEnv={false}
                disabled={disabled}
            />
            <TextSetting
                id='InactiveDaysBeforeArchive'
                label={formatMessage({
                    id: 'admin.channel_settings.auto_archive.inactive_days_label',
                    defaultMessage: 'Days of Inactivity Before Archiving:',
                })}
                helpText={formatMessage({
                    id: 'admin.channel_settings.auto_archive.inactive_days_help',
                    defaultMessage: 'Number of days without any posts before a channel is eligible for auto-archiving. Minimum: 1. Maximum: 3650.',
                })}
                value={String(config.ChannelSettings?.InactiveDaysBeforeArchive ?? 90)}
                onChange={handleChange}
                setByEnv={false}
                disabled={disabled || !(config.ChannelSettings?.EnableAutoArchive)}
            />
            <BooleanSetting
                id='ExcludePublicChannels'
                label={formatMessage({
                    id: 'admin.channel_settings.auto_archive.exclude_public_label',
                    defaultMessage: 'Exclude Public Channels:',
                })}
                helpText={formatMessage({
                    id: 'admin.channel_settings.auto_archive.exclude_public_help',
                    defaultMessage: 'When enabled, public channels are never auto-archived regardless of inactivity.',
                })}
                value={config.ChannelSettings?.ExcludePublicChannels ?? false}
                onChange={handleChange}
                setByEnv={false}
                disabled={disabled || !(config.ChannelSettings?.EnableAutoArchive)}
            />
            <BooleanSetting
                id='ExcludePrivateChannels'
                label={formatMessage({
                    id: 'admin.channel_settings.auto_archive.exclude_private_label',
                    defaultMessage: 'Exclude Private Channels:',
                })}
                helpText={formatMessage({
                    id: 'admin.channel_settings.auto_archive.exclude_private_help',
                    defaultMessage: 'When enabled, private channels are never auto-archived regardless of inactivity.',
                })}
                value={config.ChannelSettings?.ExcludePrivateChannels ?? true}
                onChange={handleChange}
                setByEnv={false}
                disabled={disabled || !(config.ChannelSettings?.EnableAutoArchive)}
            />
        </AdminSetting>
    );
};

export default ChannelAutoArchiveSettings;
