// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useEffect, useState} from 'react';
import {FormattedMessage} from 'react-intl';

import type {
    ContentFlaggingAdditionalSettings,
    ContentFlaggingNotificationSettings,
    ContentFlaggingSettings as TypeContentFlaggingSettings,
    ContentFlaggingReviewerSetting} from '@mattermost/types/config';
import type {ServerError} from '@mattermost/types/errors';

import {Client4} from 'mattermost-redux/client';

import BooleanSetting from 'components/admin_console/boolean_setting';
import ContentFlaggingAdditionalSettingsSection
    from 'components/admin_console/content_flagging/additional_settings/additional_settings';
import ContentFlaggingContentReviewers
    from 'components/admin_console/content_flagging/content_reviewers/content_reviewers';
import ContentFlaggingNotificationSettingsSection
    from 'components/admin_console/content_flagging/notificatin_settings/notification_settings';
import SaveChangesPanel from 'components/admin_console/save_changes_panel';
import AdminHeader from 'components/widgets/admin_console/admin_header';

import './content_flagging_settings.scss';

export default function ContentFlaggingSettings() {
    const [saving, setSaving] = useState(false);
    const [saveNeeded, setSaveNeeded] = useState(false);
    const [serverError, setServerError] = useState('');
    const [contentFlaggingSettings, setContentFlaggingSettings] = useState<TypeContentFlaggingSettings>();

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
        setSaveNeeded(true);
    }, [contentFlaggingSettings]);

    const onSave = useCallback(async () => {
        if (!contentFlaggingSettings) {
            return;
        }

        setSaving(true);

        try {
            await Client4.saveContentFlaggingConfig(contentFlaggingSettings);
            setSaveNeeded(false);
            setServerError('');
        } catch (error) {
            console.error(error); // eslint-disable-line no-console

            if (error satisfies ServerError) {
                setServerError(error.message);
            }
        } finally {
            setSaving(false);
        }
    }, [contentFlaggingSettings]);

    if (!contentFlaggingSettings) {
        return null;
    }

    return (
        <div className='wrapper--fixed ContentFlaggingSettings'>
            <AdminHeader>
                <div>
                    <FormattedMessage
                        id='admin.contentFlagging.title'
                        defaultMessage='Content Flagging'
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
                                    id='admin.content_flagging.enableTitle'
                                    defaultMessage='Enable content flagging'
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
                </div>
            </div>

            <SaveChangesPanel
                saveNeeded={saveNeeded}
                saving={saving}
                onClick={onSave}
                cancelLink=''
                serverError={serverError}
            />
        </div>
    );
}
