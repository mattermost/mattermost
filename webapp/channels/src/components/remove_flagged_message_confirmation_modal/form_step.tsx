// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React from 'react';
import {FormattedMessage, useIntl} from 'react-intl';

import type {ContentFlaggingConfig} from '@mattermost/types/content_flagging';
import type {Post} from '@mattermost/types/posts';
import type {UserProfile} from '@mattermost/types/users';

import type {TextboxElement} from 'components/textbox';
import AdvancedTextbox from 'components/widgets/advanced_textbox/advanced_textbox';

import FlaggedMessageBody from './flagged_message_body';

type BodyProps = {
    action: 'keep' | 'remove';
    flaggedPost: Post;
    reportingUser: UserProfile;
    contentFlaggingConfig: ContentFlaggingConfig | undefined;
    comment: string;
    commentError: string;
    showCommentPreview: boolean;
    onCommentChange: (e: React.ChangeEvent<TextboxElement>) => void;
    onToggleCommentPreview: () => void;
};

export function FormStepBody({
    action,
    flaggedPost,
    reportingUser,
    contentFlaggingConfig,
    comment,
    commentError,
    showCommentPreview,
    onCommentChange,
    onToggleCommentPreview,
}: BodyProps) {
    const {formatMessage} = useIntl();

    const requiredTitle = formatMessage({id: 'remove_flag_post_confirm_modal.required_comment.title', defaultMessage: 'Comment (required)'});
    const optionalTitle = formatMessage({id: 'remove_flag_post_confirm_modal.optional_comment.title', defaultMessage: 'Comment (optional)'});
    const sectionTitle = contentFlaggingConfig?.reviewer_comment_required ? requiredTitle : optionalTitle;

    const commentPlaceholder = formatMessage({id: 'keep_remove_quarantined_content_modal.comment.placeholder', defaultMessage: 'Add your comment here'});

    return (
        <>
            <FlaggedMessageBody
                action={action}
                flaggedPost={flaggedPost}
                reportingUser={reportingUser}
                contentFlaggingConfig={contentFlaggingConfig}
            />

            <div className='section comment_section'>
                <div
                    className='section_title'
                    data-testid='keep-remove-flagged-message-comment-title'
                >
                    {sectionTitle}
                </div>

                <AdvancedTextbox
                    id='RemoveFlaggedMessageConfirmationModal__comment'
                    channelId={flaggedPost.channel_id}
                    value={comment}
                    onChange={onCommentChange}
                    createMessage={commentPlaceholder}
                    preview={showCommentPreview}
                    togglePreview={onToggleCommentPreview}
                    useChannelMentions={false}
                    onKeyPress={() => {}}
                    hasError={false}
                    errorMessage={commentError}
                    maxLength={1000}
                />
            </div>
        </>
    );
}

type FooterProps = {
    action: 'keep' | 'remove';
    downloadReport: boolean;
    submitting: boolean;
    onToggleDownloadReport: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onCancel: () => void;
    onPrimary: () => void;
};

export function FormStepFooter({
    action,
    downloadReport,
    submitting,
    onToggleDownloadReport,
    onCancel,
    onPrimary,
}: FooterProps) {
    const {formatMessage} = useIntl();

    const cancelText = formatMessage({id: 'generic_modal.cancel', defaultMessage: 'Cancel'});
    const continueText = formatMessage({id: 'keep_remove_quarantined_content_modal.continue.button_text', defaultMessage: 'Continue'});
    const removeText = formatMessage({id: 'keep_remove_quarantined_content_modal.action_remove.button_text', defaultMessage: 'Remove message'});
    const keepText = formatMessage({id: 'keep_remove_quarantined_content_modal.action_keep.button_text', defaultMessage: 'Keep message'});

    const actionText = action === 'remove' ? removeText : keepText;
    const uncheckedClass = action === 'remove' ? 'btn-danger' : 'btn-primary';

    const primaryText = downloadReport ? continueText : actionText;
    const primaryClass = downloadReport ? 'btn-primary' : uncheckedClass;

    return (
        <div className='ModalFooterRow'>
            <div className='ModalFooterRow__left'>
                <label
                    className='download_report_checkbox'
                    data-testid='download-report-checkbox-label'
                >
                    <input
                        type='checkbox'
                        checked={downloadReport}
                        onChange={onToggleDownloadReport}
                        data-testid='download-report-checkbox'
                    />
                    <span>
                        <FormattedMessage
                            id='keep_remove_quarantined_content_modal.download_report_checkbox.label'
                            defaultMessage='Download quarantined message report'
                        />
                    </span>
                </label>
            </div>
            <div className='ModalFooterRow__right'>
                <button
                    type='button'
                    className='GenericModal__button btn btn-tertiary'
                    onClick={onCancel}
                    data-testid='form-cancel-button'
                >
                    {cancelText}
                </button>
                <button
                    type='button'
                    className={classNames('GenericModal__button btn', primaryClass)}
                    onClick={onPrimary}
                    disabled={submitting}
                    data-testid='form-primary-button'
                >
                    {primaryText}
                </button>
            </div>
        </div>
    );
}
