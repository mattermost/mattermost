// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {type ChangeEvent, useCallback, useMemo} from 'react';
import {FormattedMessage} from 'react-intl';
import type {OnChangeValue} from 'react-select';
import CreatableReactSelect from 'react-select/creatable';

import type {ContentFlaggingAdditionalSettings} from '@mattermost/types/config';

import {Label} from 'components/admin_console/boolean_setting';
import type {SystemConsoleCustomSettingChangeHandler} from 'components/admin_console/schema_admin_settings';
import {CreatableReactSelectInput} from 'components/user_settings/notifications/user_settings_notifications';

import {ReasonOption} from './reason_option';

import {
    AdminSection,
    SectionContent,
    SectionHeader,
} from '../../system_properties/controls';

import '../content_flagging_section_base.scss';
import './additional_settings.scss';

type Props = {
    id: string;
    onChange: SystemConsoleCustomSettingChangeHandler;
    value: ContentFlaggingAdditionalSettings;
}

export default function ContentFlaggingAdditionalSettingsSection({id, onChange, value}: Props) {
    const [additionalSettings, setAdditionalSettings] = React.useState<ContentFlaggingAdditionalSettings>(value as ContentFlaggingAdditionalSettings);

    const handleReasonsChange = useCallback((newValues: OnChangeValue<{ value: string }, true>) => {
        const updatedSettings: ContentFlaggingAdditionalSettings = {
            ...additionalSettings,
            Reasons: newValues.map((v) => v.value),
        };
        setAdditionalSettings(updatedSettings);
        onChange(id, updatedSettings);
    }, [additionalSettings, id, onChange]);

    const handleRequireReporterCommentChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
        const updatedSettings: ContentFlaggingAdditionalSettings = {
            ...additionalSettings,
            ReporterCommentRequired: e.target.value === 'true',
        };
        setAdditionalSettings(updatedSettings);
        onChange(id, updatedSettings);
    }, [additionalSettings, id, onChange]);

    const handleRequireReviewerCommentChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
        const updatedSettings: ContentFlaggingAdditionalSettings = {
            ...additionalSettings,
            ReviewerCommentRequired: e.target.value === 'true',
        };
        setAdditionalSettings(updatedSettings);
        onChange(id, updatedSettings);
    }, [additionalSettings, id, onChange]);

    const handleHideFlaggedPosts = useCallback((e: ChangeEvent<HTMLInputElement>) => {
        const updatedSettings: ContentFlaggingAdditionalSettings = {
            ...additionalSettings,
            HideFlaggedContent: e.target.value === 'true',
        };
        setAdditionalSettings(updatedSettings);
        onChange(id, updatedSettings);
    }, [additionalSettings, id, onChange]);

    const reasonOptions = useMemo(() => {
        return additionalSettings.Reasons.map((reason) => ({
            label: reason,
            value: reason,
        }));
    }, [additionalSettings.Reasons]);

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
                                value={reasonOptions}
                                placeholder={'Type and press Tab to add a reason'}
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
                                    checked={additionalSettings.ReporterCommentRequired}
                                    onChange={handleRequireReporterCommentChange}
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
                                    checked={!additionalSettings.ReporterCommentRequired}
                                    onChange={handleRequireReporterCommentChange}
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
                                    checked={additionalSettings.ReviewerCommentRequired}
                                    onChange={handleRequireReviewerCommentChange}
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
                                    checked={!additionalSettings.ReviewerCommentRequired}
                                    onChange={handleRequireReviewerCommentChange}
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
                                    checked={additionalSettings.HideFlaggedContent}
                                    onChange={handleHideFlaggedPosts}
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
                                    checked={!additionalSettings.HideFlaggedContent}
                                    onChange={handleHideFlaggedPosts}
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
