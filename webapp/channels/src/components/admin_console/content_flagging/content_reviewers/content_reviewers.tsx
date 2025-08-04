// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useState} from 'react';
import {FormattedMessage} from 'react-intl';

import type {ContentFlaggingReviewerSetting, TeamReviewerSetting} from '@mattermost/types/config';

import {Label} from 'components/admin_console/boolean_setting';
import CheckboxSetting from 'components/admin_console/checkbox_setting';
import TeamReviewers
    from 'components/admin_console/content_flagging/content_reviewers/team_reviewers_section/team_reviewers_section';
import {
    AdminSection,
    SectionContent,
    SectionHeader,
} from 'components/admin_console/system_properties/controls';

import {UserMultiSelector} from '../../content_flagging/user_multiselector/user_multiselector';
import type {SystemConsoleCustomSettingsComponentProps} from '../../schema_admin_settings';

import './content_reviewers.scss';

export default function ContentFlaggingContentReviewers(props: SystemConsoleCustomSettingsComponentProps) {
    const [reviewerSetting, setReviewerSetting] = useState<ContentFlaggingReviewerSetting>(props.value as ContentFlaggingReviewerSetting);

    const handleSameReviewersForAllTeamsChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
        const updatedSetting: ContentFlaggingReviewerSetting = {
            ...reviewerSetting,
            CommonReviewers: event.target.value === 'true',
        };

        setReviewerSetting(updatedSetting);
        props.onChange(props.id, updatedSetting);
    }, [props, reviewerSetting]);

    const handleSystemAdminReviewerChange = useCallback((_: string, value: boolean) => {
        const updatedSetting: ContentFlaggingReviewerSetting = {
            ...reviewerSetting,
            SystemAdminsAsReviewers: value,
        };

        setReviewerSetting(updatedSetting);
        props.onChange(props.id, updatedSetting);
    }, [props, reviewerSetting]);

    const handleTeamAdminReviewerChange = useCallback((_: string, value: boolean) => {
        const updatedSetting: ContentFlaggingReviewerSetting = {
            ...reviewerSetting,
            TeamAdminsAsReviewers: value,
        };

        setReviewerSetting(updatedSetting);
        props.onChange(props.id, updatedSetting);
    }, [props, reviewerSetting]);

    const handleCommonReviewersChange = useCallback((selectedUserIds: string[]) => {
        const updatedSetting: ContentFlaggingReviewerSetting = {
            ...reviewerSetting,
            CommonReviewerIds: selectedUserIds,
        };

        setReviewerSetting(updatedSetting);
        props.onChange(props.id, updatedSetting);
    }, [props, reviewerSetting]);

    const handleTeamReviewerSettingsChange = useCallback((updatedTeamSettings: Record<string, TeamReviewerSetting>) => {
        const updatedSetting: ContentFlaggingReviewerSetting = {
            ...reviewerSetting,
            TeamReviewersSetting: updatedTeamSettings,
        };

        setReviewerSetting(updatedSetting);
        props.onChange(props.id, updatedSetting);
    }, [props, reviewerSetting]);

    return (
        <AdminSection>
            <SectionHeader>
                <hgroup>
                    <h1 className='content-flagging-section-title'>
                        <FormattedMessage
                            id='admin.contentFlagging.reviewerSettings.title'
                            defaultMessage='Content Reviewers'
                        />
                    </h1>
                    <h5 className='content-flagging-section-description'>
                        <FormattedMessage
                            id='admin.contentFlagging.reviewerSettings.description'
                            defaultMessage='Define who should review content in your environment'
                        />
                    </h5>
                </hgroup>
            </SectionHeader>

            <SectionContent>
                <div className='content-flagging-section-setting-wrapper'>
                    {/* Same reviewers for all teams */}
                    <div className='content-flagging-section-setting'>
                        <div className='setting-title'>
                            <FormattedMessage
                                id='admin.contentFlagging.reviewerSettings.sameReviewersForAllTeams'
                                defaultMessage='Same reviewers for all teams:'
                            />
                        </div>

                        <div className='setting-content'>
                            <Label isDisabled={false}>
                                <input
                                    data-testid='sameReviewersForAllTeams_true'
                                    id='sameReviewersForAllTeams_true'
                                    type='radio'
                                    value='true'
                                    checked={reviewerSetting.CommonReviewers}
                                    onChange={handleSameReviewersForAllTeamsChange}
                                />
                                <FormattedMessage
                                    id='admin.true'
                                    defaultMessage='True'
                                />
                            </Label>

                            <Label isDisabled={false}>
                                <input
                                    data-testid='sameReviewersForAllTeams_false'
                                    id='sameReviewersForAllTeams_false'
                                    type='radio'
                                    value='false'
                                    checked={!reviewerSetting.CommonReviewers}
                                    onChange={handleSameReviewersForAllTeamsChange}
                                />
                                <FormattedMessage
                                    id='admin.false'
                                    defaultMessage='False'
                                />
                            </Label>
                        </div>
                    </div>

                    {
                        reviewerSetting.CommonReviewers &&
                        <div className='content-flagging-section-setting'>
                            <div className='setting-title'>
                                <FormattedMessage
                                    id='admin.contentFlagging.reviewerSettings.commonReviewers'
                                    defaultMessage='Reviewers:'
                                />
                            </div>

                            <div className='setting-content'>
                                <UserMultiSelector
                                    id='content_reviewers_common_reviewers'
                                    initialValue={reviewerSetting.CommonReviewerIds}
                                    onChange={handleCommonReviewersChange}
                                />
                            </div>
                        </div>
                    }

                    {
                        !reviewerSetting.CommonReviewers &&
                        <div className='content-flagging-section-setting teamSpecificReviewerSection'>
                            <div className='setting-title'>
                                <FormattedMessage
                                    id='admin.contentFlagging.reviewerSettings.perTeamReviewers.title'
                                    defaultMessage='Configure content flagging per team'
                                />
                            </div>

                            <TeamReviewers
                                teamReviewersSetting={reviewerSetting.TeamReviewersSetting}
                                onChange={handleTeamReviewerSettingsChange}
                            />

                        </div>
                    }

                    <div className='content-flagging-section-setting'>
                        <div className='setting-title'>
                            <FormattedMessage
                                id='admin.contentFlagging.reviewerSettings.additionalReviewers'
                                defaultMessage='Additional reviewers'
                            />
                        </div>

                        <div className='setting-content-wrapper'>
                            <div className='setting-content'>
                                <CheckboxSetting
                                    id='notifyOnDismissal_reviewers'
                                    label={
                                        <FormattedMessage
                                            id='admin.contentFlagging.reviewerSettings.additionalReviewers.systemAdmins'
                                            defaultMessage='System Administrators'
                                        />
                                    }
                                    defaultChecked={reviewerSetting.SystemAdminsAsReviewers}
                                    onChange={handleSystemAdminReviewerChange}
                                    setByEnv={false}
                                />

                                <CheckboxSetting
                                    id='notifyOnDismissal_author'
                                    label={
                                        <FormattedMessage
                                            id='admin.contentFlagging.reviewerSettings.additionalReviewers.teamAdmins'
                                            defaultMessage='Team Administrators'
                                        />
                                    }
                                    defaultChecked={reviewerSetting.TeamAdminsAsReviewers}
                                    onChange={handleTeamAdminReviewerChange}
                                    setByEnv={false}
                                />
                            </div>

                            <div className='helpText'>
                                <FormattedMessage
                                    id='admin.contentFlagging.reviewerSettings.additionalReviewers.helpText'
                                    defaultMessage='If enabled, system administrators will be sent flagged posts for review from every team that they are a part of. Team administrators will only be sent flagged posts for review from their respective teams.'
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </SectionContent>
        </AdminSection>
    );
}
