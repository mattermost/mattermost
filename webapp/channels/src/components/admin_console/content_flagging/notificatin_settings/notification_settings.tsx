// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, { useCallback, useState } from "react";
import {FormattedMessage} from 'react-intl';

import CheckboxSetting from 'components/admin_console/checkbox_setting';
import {
    AdminSection,
    SectionContent,
    SectionHeader,
} from 'components/admin_console/system_properties/controls';

import '../content_flagging_section_base.scss';
import { SystemConsoleCustomSettingsComponentProps } from "components/admin_console/schema_admin_settings";
import { ContentFlaggingNotificationSettings } from "@mattermost/types/lib/config";

const noOp = () => null;

export default function ContentFlaggingNotificationSettingsSection(props: SystemConsoleCustomSettingsComponentProps) {
    const [notificationSettings, setNotificationSettings] = useState<ContentFlaggingNotificationSettings>(props.value);

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
                                id='notifyOnFlag_reviewers'
                                label={
                                    <FormattedMessage
                                        id='admin.contentFlagging.notificationSettings.reviewers'
                                        defaultMessage='Reviewer(s)'
                                    />
                                }
                                defaultChecked={notificationSettings.EventTargetMapping.flagged.includes('reviewers')}
                                onChange={noOp}
                                setByEnv={false}
                                disabled={true}
                            />

                            <CheckboxSetting
                                id='notifyOnFlag_authors'
                                label={
                                    <FormattedMessage
                                        id='admin.contentFlagging.notificationSettings.author'
                                        defaultMessage='Author'
                                    />
                                }
                                defaultChecked={notificationSettings.EventTargetMapping.flagged.includes('author')}
                                onChange={noOp}
                                setByEnv={false}
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
                                id='notifyOnReviewerAssigned_reviewers'
                                label={
                                    <FormattedMessage
                                        id='admin.contentFlagging.notificationSettings.reviewers'
                                        defaultMessage='Reviewer(s)'
                                    />
                                }
                                defaultChecked={notificationSettings.EventTargetMapping.assigned.includes('reviewers')}
                                onChange={noOp}
                                setByEnv={false}
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
                                id='notifyOnRemoval_reviewers'
                                label={
                                    <FormattedMessage
                                        id='admin.contentFlagging.notificationSettings.reviewers'
                                        defaultMessage='Reviewer(s)'
                                    />
                                }
                                defaultChecked={notificationSettings.EventTargetMapping.removed.includes('reviewers')}
                                onChange={noOp}
                                setByEnv={false}
                            />

                            <CheckboxSetting
                                id='notifyOnRemoval_author'
                                label={
                                    <FormattedMessage
                                        id='admin.contentFlagging.notificationSettings.author'
                                        defaultMessage='Author'
                                    />
                                }
                                defaultChecked={notificationSettings.EventTargetMapping.removed.includes('author')}
                                onChange={noOp}
                                setByEnv={false}
                            />

                            <CheckboxSetting
                                id='notifyOnRemoval_reporter'
                                label={
                                    <FormattedMessage
                                        id='admin.contentFlagging.notificationSettings.reporter'
                                        defaultMessage='Reporter'
                                    />
                                }
                                defaultChecked={notificationSettings.EventTargetMapping.removed.includes('reporter')}
                                onChange={noOp}
                                setByEnv={false}
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
                                id='notifyOnDismissal_reviewers'
                                label={
                                    <FormattedMessage
                                        id='admin.contentFlagging.notificationSettings.reviewers'
                                        defaultMessage='Reviewer(s)'
                                    />
                                }
                                defaultChecked={notificationSettings.EventTargetMapping.dismissed.includes('reviewers')}
                                onChange={noOp}
                                setByEnv={false}
                            />

                            <CheckboxSetting
                                id='notifyOnDismissal_author'
                                label={
                                    <FormattedMessage
                                        id='admin.contentFlagging.notificationSettings.author'
                                        defaultMessage='Author'
                                    />
                                }
                                defaultChecked={notificationSettings.EventTargetMapping.dismissed.includes('author')}
                                onChange={noOp}
                                setByEnv={false}
                            />

                            <CheckboxSetting
                                id='notifyOnDismissal_reporter'
                                label={
                                    <FormattedMessage
                                        id='admin.contentFlagging.notificationSettings.reporter'
                                        defaultMessage='Reporter'
                                    />
                                }
                                defaultChecked={notificationSettings.EventTargetMapping.dismissed.includes('reporter')}
                                onChange={noOp}
                                setByEnv={false}
                            />
                        </div>
                    </div>
                </div>
            </SectionContent>
        </AdminSection>
    );
}
