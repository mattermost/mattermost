// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useState} from 'react';
import {FormattedMessage} from 'react-intl';

import type {ContentFlaggingNotificationSettings} from '@mattermost/types/config';
import type {ContentFlaggingEvent, NotificationTarget} from '@mattermost/types/content_flagging';

import CheckboxSetting from 'components/admin_console/checkbox_setting';
import type {SystemConsoleCustomSettingChangeHandler} from 'components/admin_console/schema_admin_settings';
import {
    AdminSection,
    SectionContent,
    SectionHeader,
} from 'components/admin_console/system_properties/controls';

import '../content_flagging_section_base.scss';

type Props = {
    id: string;
    onChange: SystemConsoleCustomSettingChangeHandler;
    value: ContentFlaggingNotificationSettings;
    disabled?: boolean;
}

export default function ContentFlaggingNotificationSettingsSection({id, value, onChange, disabled}: Props) {
    const [notificationSettings, setNotificationSettings] = useState<ContentFlaggingNotificationSettings>(value as ContentFlaggingNotificationSettings);

    const handleChange = useCallback((inputId: string, value: boolean) => {
        const [actionRaw, targetRaw] = inputId.split('_');
        const action = actionRaw as ContentFlaggingEvent;
        const target = targetRaw as NotificationTarget;
        if (!action || !target) {
            return;
        }

        const updatedSettings = {...notificationSettings};
        if (!updatedSettings.EventTargetMapping) {
            updatedSettings.EventTargetMapping = {
                flagged: [],
                assigned: [],
                removed: [],
                dismissed: [],
            };
        }

        if (!updatedSettings.EventTargetMapping[action]) {
            updatedSettings.EventTargetMapping[action] = [];
        }

        if (value) {
            // Add target to the action's list if not already present
            if (!updatedSettings.EventTargetMapping[action].includes(target)) {
                updatedSettings.EventTargetMapping = {
                    ...updatedSettings.EventTargetMapping,
                    [action]: [...updatedSettings.EventTargetMapping[action], target],
                };
            }
        } else {
            // Remove target from the action's list if present
            updatedSettings.EventTargetMapping = {
                ...updatedSettings.EventTargetMapping,
                [action]: updatedSettings.EventTargetMapping[action].filter((t: NotificationTarget) => t !== target),
            };
        }

        setNotificationSettings(updatedSettings);

        onChange(id, updatedSettings);
    }, [id, notificationSettings, onChange]);

    const getValue = useCallback((event: ContentFlaggingEvent, target: NotificationTarget): boolean => {
        if (!notificationSettings || !notificationSettings.EventTargetMapping) {
            return false;
        }

        return notificationSettings.EventTargetMapping[event]?.includes(target) || false;
    }, [notificationSettings]);

    return (
        <AdminSection>
            <SectionHeader>
                <hgroup>
                    <h1 className='content-flagging-section-title'>
                        <FormattedMessage
                            id='admin.contentFlagging.notificationSettings.title'
                            defaultMessage='Notification Settings'
                        />
                    </h1>
                    <h5 className='content-flagging-section-description'>
                        <FormattedMessage
                            id='admin.contentFlagging.notificationSettings.description'
                            defaultMessage='Choose who receives notifications from the System bot when content is flagged and reviewed'
                        />
                    </h5>
                </hgroup>
            </SectionHeader>
            <SectionContent>
                <div className='content-flagging-section-setting-wrapper'>

                    {/*Notify on flagging*/}
                    <div className='content-flagging-section-setting'>
                        <div className='setting-title'>
                            <FormattedMessage
                                id='admin.contentFlagging.notificationSettings.notifyOnFlag'
                                defaultMessage='Notify when content is flagged'
                            />
                        </div>

                        <div className='setting-content'>
                            <CheckboxSetting
                                id='flagged_reviewers'
                                label={
                                    <FormattedMessage
                                        id='admin.contentFlagging.notificationSettings.reviewers'
                                        defaultMessage='Reviewer(s)'
                                    />
                                }
                                defaultChecked={getValue('flagged', 'reviewers')}
                                onChange={handleChange}
                                setByEnv={false}
                                disabled={true}
                            />

                            <CheckboxSetting
                                id='flagged_author'
                                label={
                                    <FormattedMessage
                                        id='admin.contentFlagging.notificationSettings.author'
                                        defaultMessage='Author'
                                    />
                                }
                                defaultChecked={getValue('flagged', 'author')}
                                onChange={handleChange}
                                setByEnv={false}
                                disabled={disabled}
                            />
                        </div>
                    </div>

                    {/*Notify on reviewer assigned*/}
                    <div className='content-flagging-section-setting'>
                        <div className='setting-title'>
                            <FormattedMessage
                                id='admin.contentFlagging.notificationSettings.notifyOnReviewerAssigned'
                                defaultMessage='Notify when a reviewer is assigned'
                            />
                        </div>

                        <div className='setting-content'>
                            <CheckboxSetting
                                id='assigned_reviewers'
                                label={
                                    <FormattedMessage
                                        id='admin.contentFlagging.notificationSettings.reviewers'
                                        defaultMessage='Reviewer(s)'
                                    />
                                }
                                defaultChecked={getValue('assigned', 'reviewers')}
                                onChange={handleChange}
                                setByEnv={false}
                                disabled={disabled}
                            />
                        </div>
                    </div>

                    {/*Notify on removal*/}
                    <div className='content-flagging-section-setting'>
                        <div className='setting-title'>
                            <FormattedMessage
                                id='admin.contentFlagging.notificationSettings.notifyOnRemoval'
                                defaultMessage='Notify when content is removed'
                            />
                        </div>

                        <div className='setting-content'>
                            <CheckboxSetting
                                id='removed_reviewers'
                                label={
                                    <FormattedMessage
                                        id='admin.contentFlagging.notificationSettings.reviewers'
                                        defaultMessage='Reviewer(s)'
                                    />
                                }
                                defaultChecked={getValue('removed', 'reviewers')}
                                onChange={handleChange}
                                setByEnv={false}
                                disabled={disabled}
                            />

                            <CheckboxSetting
                                id='removed_author'
                                label={
                                    <FormattedMessage
                                        id='admin.contentFlagging.notificationSettings.author'
                                        defaultMessage='Author'
                                    />
                                }
                                defaultChecked={getValue('removed', 'author')}
                                onChange={handleChange}
                                setByEnv={false}
                                disabled={disabled}
                            />

                            <CheckboxSetting
                                id='removed_reporter'
                                label={
                                    <FormattedMessage
                                        id='admin.contentFlagging.notificationSettings.reporter'
                                        defaultMessage='Reporter'
                                    />
                                }
                                defaultChecked={getValue('removed', 'reporter')}
                                onChange={handleChange}
                                setByEnv={false}
                                disabled={disabled}
                            />
                        </div>
                    </div>

                    {/*Notify on dismiss*/}
                    <div className='content-flagging-section-setting'>
                        <div className='setting-title'>
                            <FormattedMessage
                                id='admin.contentFlagging.notificationSettings.notifyOnDismissal'
                                defaultMessage='Notify when flag is dismissed'
                            />
                        </div>

                        <div className='setting-content'>
                            <CheckboxSetting
                                id='dismissed_reviewers'
                                label={
                                    <FormattedMessage
                                        id='admin.contentFlagging.notificationSettings.reviewers'
                                        defaultMessage='Reviewer(s)'
                                    />
                                }
                                defaultChecked={getValue('dismissed', 'reviewers')}
                                onChange={handleChange}
                                setByEnv={false}
                                disabled={disabled}
                            />

                            <CheckboxSetting
                                id='dismissed_author'
                                label={
                                    <FormattedMessage
                                        id='admin.contentFlagging.notificationSettings.author'
                                        defaultMessage='Author'
                                    />
                                }
                                defaultChecked={getValue('dismissed', 'author')}
                                onChange={handleChange}
                                setByEnv={false}
                                disabled={disabled}
                            />

                            <CheckboxSetting
                                id='dismissed_reporter'
                                label={
                                    <FormattedMessage
                                        id='admin.contentFlagging.notificationSettings.reporter'
                                        defaultMessage='Reporter'
                                    />
                                }
                                defaultChecked={getValue('dismissed', 'reporter')}
                                onChange={handleChange}
                                setByEnv={false}
                                disabled={disabled}
                            />
                        </div>
                    </div>
                </div>
            </SectionContent>
        </AdminSection>
    );
}
