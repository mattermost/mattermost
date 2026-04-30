// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React from 'react';
import {FormattedMessage, useIntl} from 'react-intl';

import type {ContentFlaggingConfig} from '@mattermost/types/content_flagging';
import type {Post} from '@mattermost/types/posts';
import type {UserProfile} from '@mattermost/types/users';

import LoadingSpinner from 'components/widgets/loading/loading_spinner';

import FlaggedMessageBody from './flagged_message_body';
import ReportNotice from './report_notice';

type BodyProps = {
    action: 'keep' | 'remove';
    flaggedPost: Post;
    reportingUser: UserProfile;
    contentFlaggingConfig: ContentFlaggingConfig | undefined;
};

export function GeneratingStepBody({action, flaggedPost, reportingUser, contentFlaggingConfig}: BodyProps) {
    return (
        <>
            <FlaggedMessageBody
                action={action}
                flaggedPost={flaggedPost}
                reportingUser={reportingUser}
                contentFlaggingConfig={contentFlaggingConfig}
            />
            <ReportNotice
                variant='info'
                testId='generating-section'
                icon={<LoadingSpinner/>}
                title={
                    <FormattedMessage
                        id='keep_remove_quarantined_content_modal.generating.title'
                        defaultMessage='Generating report…'
                    />
                }
                body={
                    action === 'remove' ? (
                        <FormattedMessage
                            id='keep_remove_quarantined_content_modal.action_remove.generating.body'
                            defaultMessage='Please wait for the report to download before you remove the message permanently. There will be no way to recover the message contents once it is removed.'
                        />
                    ) : (
                        <FormattedMessage
                            id='keep_remove_quarantined_content_modal.action_keep.generating.body'
                            defaultMessage='Please wait for the report to download before you keep the message permanently.'
                        />
                    )
                }
            />
        </>
    );
}

type FooterProps = {
    action: 'keep' | 'remove';
    onSkip: () => void;
    onBack: () => void;
};

export function GeneratingStepFooter({action, onSkip, onBack}: FooterProps) {
    const {formatMessage} = useIntl();

    const skipText = formatMessage({id: 'keep_remove_quarantined_content_modal.skip_report_download.button_text', defaultMessage: 'Skip report download'});
    const backText = formatMessage({id: 'keep_remove_quarantined_content_modal.back.button_text', defaultMessage: 'Back'});
    const removePermanentlyText = formatMessage({id: 'keep_remove_quarantined_content_modal.action_remove.permanent_button_text', defaultMessage: 'Remove permanently'});
    const keepPermanentlyText = formatMessage({id: 'keep_remove_quarantined_content_modal.action_keep.permanent_button_text', defaultMessage: 'Keep permanently'});

    const permanentText = action === 'remove' ? removePermanentlyText : keepPermanentlyText;
    const permanentClass = action === 'remove' ? 'btn-danger' : 'btn-primary';

    return (
        <div className='ModalFooterRow'>
            <div className='ModalFooterRow__left'>
                <button
                    type='button'
                    className='GenericModal__button btn btn-tertiary btn-danger skipReportBtn'
                    onClick={onSkip}
                    data-testid='generating-skip-button'
                >
                    {skipText}
                </button>
            </div>
            <div className='ModalFooterRow__right'>
                <button
                    type='button'
                    className='GenericModal__button btn btn-tertiary'
                    onClick={onBack}
                    data-testid='generating-back-button'
                >
                    {backText}
                </button>
                <button
                    type='button'
                    className={classNames(
                        'GenericModal__button btn',
                        permanentClass,
                    )}
                    disabled={true}
                    data-testid='generating-permanent-button'
                >
                    {permanentText}
                </button>
            </div>
        </div>
    );
}
