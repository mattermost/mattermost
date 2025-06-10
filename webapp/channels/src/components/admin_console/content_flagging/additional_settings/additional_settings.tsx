// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useMemo} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import CreatableReactSelect from 'react-select/creatable';

import {
    AdminSection,
    SectionContent,
    SectionHeader,
} from '../../system_properties/controls';

import '../content_flagging_section_base.scss';
import './additional_settings.scss';

import {ReasonOption} from './reason_option';

import {CreatableReactSelectInput} from '../../../user_settings/notifications/user_settings_notifications';
import { Label } from "components/admin_console/boolean_setting";

export default function ContentFlaggingAdditionalSettingsSection() {
    const {formatMessage} = useIntl();

    const [requireReporterComment, setRequireReporterComment] = React.useState(true);
    const [requireReviewerComment, setRequireReviewerComment] = React.useState(true);
    const [hideFlaggedPosts, setHideFlaggedPosts] = React.useState(true);

    const defaultFlaggingReasons = useMemo(() => {
        return [
            {
                value: 'spam',
                label: formatMessage({id: 'admin.contentFlagging.additionalSettings.reasonInappropriateContent', defaultMessage: 'Inappropriate Content'}),
            },
            {
                value: 'abuse',
                label: formatMessage({id: 'admin.contentFlagging.additionalSettings.reasonSensitiveData', defaultMessage: 'Sensitive data'}),
            },
            {
                value: 'inappropriate',
                label: formatMessage({id: 'admin.contentFlagging.additionalSettings.reasonSecurityConcern', defaultMessage: 'Security concern'}),
            },
            {
                value: 'inappropriate',
                label: formatMessage({id: 'admin.contentFlagging.additionalSettings.reasonHarassment', defaultMessage: 'Harassment or abuse'}),
            },
            {
                value: 'inappropriate',
                label: formatMessage({id: 'admin.contentFlagging.additionalSettings.reasonSpamPhishing', defaultMessage: 'Spam or phishing'}),
            },
        ];
    }, [formatMessage]);

    const [reasons, setReasons] = React.useState(defaultFlaggingReasons);

    const handleReasonsChange = useCallback((newValues) => {
        setReasons(newValues);
    }, []);

    return (
        <AdminSection>
            <SectionHeader>
                <hgroup>
                    <h1 className='content-flagging-section-title'>
                        <FormattedMessage
                            id='admin.contentFlagging.additionalSettings.title'
                            defaultMessage='Additional Settings'
                        />
                    </h1>
                    <h5 className='content-flagging-section-description'>
                        <FormattedMessage
                            id='admin.contentFlagging.additionalSettings.description'
                            defaultMessage='Configure how you want the flagging to behave'
                        />
                    </h5>
                </hgroup>
            </SectionHeader>
            <SectionContent>
                <div className='content-flagging-section-setting-wrapper'>

                    {/*Reasons for flagging*/}
                    <div className='content-flagging-section-setting'>
                        <div className='setting-title'>
                            <FormattedMessage
                                id='admin.contentFlagging.additionalSettings.reasonsForFlagging'
                                defaultMessage='Reasons for flagging'
                            />
                        </div>

                        <div className='setting-content'>
                            <CreatableReactSelect
                                className='contentFlaggingReasons'
                                classNamePrefix='contentFlaggingReasons_'
                                inputId='contentFlaggingReasons'
                                isClearable={false}
                                isMulti={true}
                                value={reasons}
                                placeholder={'TODO placeholder'}
                                onChange={handleReasonsChange}
                                components={{
                                    DropdownIndicator: () => null,
                                    Menu: () => null,
                                    MenuList: () => null,
                                    IndicatorSeparator: () => null,
                                    Input: CreatableReactSelectInput,
                                    MultiValue: ReasonOption,
                                }}
                            />
                        </div>
                    </div>

                    <div className='content-flagging-section-setting'>
                        <div className='setting-title'>
                            <FormattedMessage
                                id='admin.contentFlagging.additionalSettings.requireReporterComment'
                                defaultMessage='Require reporters to add comment'
                            />
                        </div>

                        <div className='setting-content'>
                            <Label isDisabled={false}>
                                <input
                                    data-testid='requireReporterComment_true'
                                    id='requireReporterComment_true'
                                    type='radio'
                                    value='true'
                                    checked={requireReporterComment}
                                    onChange={() => setRequireReporterComment(true)}
                                />
                                <FormattedMessage
                                    id='admin.true'
                                    defaultMessage='True'
                                />
                            </Label>

                            <Label isDisabled={false}>
                                <input
                                    data-testid='requireReporterComment_false'
                                    id='requireReporterComment_false'
                                    type='radio'
                                    value='false'
                                    checked={!requireReporterComment}
                                    onChange={() => setRequireReporterComment(false)}
                                />
                                <FormattedMessage
                                    id='admin.false'
                                    defaultMessage='False'
                                />
                            </Label>
                        </div>
                    </div>

                    <div className='content-flagging-section-setting'>
                        <div className='setting-title'>
                            <FormattedMessage
                                id='admin.contentFlagging.additionalSettings.requireReviewerComment'
                                defaultMessage='Require reviewers to add comment'
                            />
                        </div>

                        <div className='setting-content'>
                            <Label isDisabled={false}>
                                <input
                                    data-testid='requireReviewerComment_true'
                                    id='requireReviewerComment_true'
                                    type='radio'
                                    value='true'
                                    checked={requireReviewerComment}
                                    onChange={() => setRequireReviewerComment(true)}
                                />
                                <FormattedMessage
                                    id='admin.true'
                                    defaultMessage='True'
                                />
                            </Label>

                            <Label isDisabled={false}>
                                <input
                                    data-testid='requireReviewerComment_false'
                                    id='requireReviewerComment_false'
                                    type='radio'
                                    value='false'
                                    checked={!requireReviewerComment}
                                    onChange={() => setRequireReviewerComment(false)}
                                />
                                <FormattedMessage
                                    id='admin.false'
                                    defaultMessage='False'
                                />
                            </Label>
                        </div>
                    </div>

                    <div className='content-flagging-section-setting'>
                        <div className='setting-title'>
                            <FormattedMessage
                                id='admin.contentFlagging.additionalSettings.hideFlaggedPosts'
                                defaultMessage='Hide message from channel while it is being reviewed'
                            />
                        </div>

                        <div className='setting-content'>
                            <Label isDisabled={false}>
                                <input
                                    data-testid='hideFlaggedPosts_true'
                                    id='hideFlaggedPosts_true'
                                    type='radio'
                                    value='true'
                                    checked={hideFlaggedPosts}
                                    onChange={() => setHideFlaggedPosts(true)}
                                />
                                <FormattedMessage
                                    id='admin.true'
                                    defaultMessage='True'
                                />
                            </Label>

                            <Label isDisabled={false}>
                                <input
                                    data-testid='setHideFlaggedPosts_false'
                                    id='setHideFlaggedPosts_false'
                                    type='radio'
                                    value='false'
                                    checked={!hideFlaggedPosts}
                                    onChange={() => setHideFlaggedPosts(false)}
                                />
                                <FormattedMessage
                                    id='admin.false'
                                    defaultMessage='False'
                                />
                            </Label>
                        </div>
                    </div>
                </div>
            </SectionContent>
        </AdminSection>
    );
}
