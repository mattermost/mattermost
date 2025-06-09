// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback} from 'react';
import {FormattedMessage} from 'react-intl';

import {Label} from 'components/admin_console/boolean_setting';
import CheckboxSetting from 'components/admin_console/checkbox_setting';
import {UserMultiSelector} from 'components/admin_console/content_flagging/user_multiselector/user_multiselector';
import {
    AdminSection,
    SectionContent,
    SectionHeader,
} from 'components/admin_console/system_properties/controls';

import './content_reviewers.scss';

const noOp = () => null;

export default function ContentFlaggingContentReviewers() {
    const [sameReviewersForAllTeams, setSameReviewersForAllTeams] = React.useState(false);

    const handleSameReviewersForAllTeamsChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
        setSameReviewersForAllTeams(event.target.value === 'true');
    }, []);

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
                                    checked={sameReviewersForAllTeams}
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
                                    checked={!sameReviewersForAllTeams}
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
                        sameReviewersForAllTeams &&
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
                                />
                            </div>
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
                                    defaultChecked={false}
                                    onChange={noOp}
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
                                    defaultChecked={false}
                                    onChange={noOp}
                                    setByEnv={false}
                                />
                            </div>

                            <div className='content-flagging-section-description additionalReviewerHelpText'>
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
