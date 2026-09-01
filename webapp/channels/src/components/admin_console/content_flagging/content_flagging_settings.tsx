// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useEffect, useState} from 'react';
import type {MessageDescriptor} from 'react-intl';
import {FormattedMessage, defineMessages} from 'react-intl';
import {useSelector} from 'react-redux';

import type {
    ContentFlaggingAdditionalSettings,
    ContentFlaggingNotificationSettings,
    ContentFlaggingSettings as TypeContentFlaggingSettings,
    ContentFlaggingReviewerSetting} from '@mattermost/types/config';
import type {DeliveryTrackingConfig} from '@mattermost/types/delivery_tracking';
import type {ServerError} from '@mattermost/types/errors';

import {Client4} from 'mattermost-redux/client';
import {isPostDeliveryTrackingEnabled} from 'mattermost-redux/selectors/entities/general';

import BooleanSetting from 'components/admin_console/boolean_setting';
import ContentFlaggingAdditionalSettingsSection
    from 'components/admin_console/content_flagging/additional_settings/additional_settings';
import ContentFlaggingContentReviewers
    from 'components/admin_console/content_flagging/content_reviewers/content_reviewers';
import DeliveryTrackingSection
    from 'components/admin_console/content_flagging/delivery_tracking/delivery_tracking_section';
import ContentFlaggingNotificationSettingsSection
    from 'components/admin_console/content_flagging/notificatin_settings/notification_settings';
import SaveChangesPanel from 'components/admin_console/save_changes_panel';
import AdminHeader from 'components/widgets/admin_console/admin_header';

import './content_flagging_settings.scss';

const messages = defineMessages({
    title: {id: 'admin.dataSpillage.title', defaultMessage: 'Data Spillage Handling'},
    enableTitle: {id: 'admin.data_spillage.enableTitle', defaultMessage: 'Enable Data Spillage Handling'},
    legacyTitle: {id: 'admin.contentFlagging.title', defaultMessage: 'Content Flagging'},
});

export const searchableStrings: Array<string | MessageDescriptor> = [
    messages.title,
    messages.enableTitle,
    messages.legacyTitle,
];

export default function ContentFlaggingSettings() {
    const [saving, setSaving] = useState(false);
    const [serverError, setServerError] = useState('');
    const [contentFlaggingSettings, setContentFlaggingSettings] = useState<TypeContentFlaggingSettings>();

    // Content flagging and delivery tracking are persisted through separate endpoints, so
    // each half tracks its own dirty flag. A failure saving one must not cause the other to
    // be re-sent on retry.
    const [contentFlaggingDirty, setContentFlaggingDirty] = useState(false);
    const [deliveryTrackingDirty, setDeliveryTrackingDirty] = useState(false);

    const deliveryTrackingEnabled = useSelector(isPostDeliveryTrackingEnabled);
    const [deliveryTrackingConfig, setDeliveryTrackingConfig] = useState<DeliveryTrackingConfig>();

    const saveNeeded = contentFlaggingDirty || deliveryTrackingDirty;

    useEffect(() => {
        const fetchConfig = async () => {
            try {
                const config = await Client4.getAdminContentFlaggingConfig();
                if (config) {
                    setContentFlaggingSettings(config);
                }
            } catch (error) {
                console.error(error); // eslint-disable-line no-console
            }
        };

        if (!contentFlaggingSettings) {
            fetchConfig();
        }
    }, [contentFlaggingSettings]);

    // Loaded independently of the content flagging config so a failure in either doesn't
    // take out the other. When the feature flag is off no request is made at all, since the
    // endpoint is not available.
    useEffect(() => {
        if (!deliveryTrackingEnabled) {
            return undefined;
        }

        let cancelled = false;

        const fetchDeliveryTrackingConfig = async () => {
            try {
                const config = await Client4.getDeliveryTrackingConfig();
                if (!cancelled && config) {
                    setDeliveryTrackingConfig(config);
                }
            } catch (error) {
                console.error(error); // eslint-disable-line no-console
            }
        };

        fetchDeliveryTrackingConfig();

        return () => {
            cancelled = true;
        };
    }, [deliveryTrackingEnabled]);

    const handleSettingsChange = useCallback((id: string, value: unknown) => {
        const newValue = {...contentFlaggingSettings};

        switch (id) {
        case 'EnableContentFlagging':
            newValue.EnableContentFlagging = value as boolean;
            break;
        case 'ReviewerSettings':
            newValue.ReviewerSettings = value as ContentFlaggingReviewerSetting;
            break;
        case 'NotificationSettings':
            newValue.NotificationSettings = value as ContentFlaggingNotificationSettings;
            break;
        case 'AdditionalSettings':
            newValue.AdditionalSettings = value as ContentFlaggingAdditionalSettings;
            break;
        }

        setContentFlaggingSettings(newValue as TypeContentFlaggingSettings);
        setContentFlaggingDirty(true);
    }, [contentFlaggingSettings]);

    const handleDeliveryTrackingChange = useCallback((config: DeliveryTrackingConfig) => {
        setDeliveryTrackingConfig(config);
        setDeliveryTrackingDirty(true);
    }, []);

    // The server rejects this combination, and that rejection would land after the content
    // flagging half has already been persisted. Block the save client-side instead.
    const deliveryTrackingInvalid = Boolean(
        deliveryTrackingEnabled &&
        deliveryTrackingConfig?.Enable &&
        !deliveryTrackingConfig.EnableForAllChannels &&
        deliveryTrackingConfig.ChannelIds.length === 0,
    );

    const onSave = useCallback(async () => {
        if (!contentFlaggingSettings) {
            return;
        }

        setSaving(true);

        try {
            if (contentFlaggingDirty) {
                await Client4.saveContentFlaggingConfig(contentFlaggingSettings);
                setContentFlaggingDirty(false);
            }

            if (deliveryTrackingEnabled && deliveryTrackingDirty && deliveryTrackingConfig) {
                await Client4.saveDeliveryTrackingConfig(deliveryTrackingConfig);
                setDeliveryTrackingDirty(false);
            }

            setServerError('');
        } catch (error) {
            console.error(error); // eslint-disable-line no-console

            setServerError((error as ServerError)?.message ?? '');
        } finally {
            setSaving(false);
        }
    }, [contentFlaggingSettings, contentFlaggingDirty, deliveryTrackingEnabled, deliveryTrackingDirty, deliveryTrackingConfig]);

    if (!contentFlaggingSettings) {
        return null;
    }

    return (
        <div className='wrapper--fixed ContentFlaggingSettings'>
            <AdminHeader>
                <div>
                    <FormattedMessage
                        id='admin.dataSpillage.title'
                        defaultMessage='Data Spillage Handling'
                    />
                </div>
            </AdminHeader>

            <div className='admin-console__wrapper'>
                <div className='admin-console__content'>
                    <div className='admin-console__setting-group'>
                        <BooleanSetting
                            id='EnableContentFlagging'
                            label={
                                <FormattedMessage
                                    id='admin.data_spillage.enableTitle'
                                    defaultMessage='Enable Data Spillage Handling'
                                />
                            }
                            value={contentFlaggingSettings?.EnableContentFlagging || false}
                            setByEnv={false}
                            onChange={handleSettingsChange}
                            helpText=''
                        />
                    </div>
                    <ContentFlaggingContentReviewers
                        id='ReviewerSettings'
                        onChange={handleSettingsChange}
                        value={contentFlaggingSettings!.ReviewerSettings}
                        disabled={!contentFlaggingSettings.EnableContentFlagging}
                    />
                    <ContentFlaggingNotificationSettingsSection
                        id='NotificationSettings'
                        onChange={handleSettingsChange}
                        value={contentFlaggingSettings!.NotificationSettings}
                        disabled={!contentFlaggingSettings.EnableContentFlagging}
                    />
                    <ContentFlaggingAdditionalSettingsSection
                        id='AdditionalSettings'
                        onChange={handleSettingsChange}
                        value={contentFlaggingSettings!.AdditionalSettings}
                        disabled={!contentFlaggingSettings.EnableContentFlagging}
                    />
                    {deliveryTrackingEnabled && deliveryTrackingConfig && (
                        <DeliveryTrackingSection
                            value={deliveryTrackingConfig}
                            onChange={handleDeliveryTrackingChange}
                            hasError={deliveryTrackingInvalid}
                        />
                    )}
                </div>
            </div>

            <SaveChangesPanel
                saveNeeded={saveNeeded}
                saving={saving}
                onClick={onSave}
                cancelLink=''
                serverError={serverError}
                isDisabled={deliveryTrackingInvalid}
            />
        </div>
    );
}
