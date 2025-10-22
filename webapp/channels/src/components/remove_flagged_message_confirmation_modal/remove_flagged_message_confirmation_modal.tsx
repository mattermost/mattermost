// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback} from 'react';
import {useIntl} from 'react-intl';

import {GenericModal} from '@mattermost/components';
import type {ServerError} from '@mattermost/types/errors';
import type {Post} from '@mattermost/types/posts';
import type {UserProfile} from '@mattermost/types/users';

import {Client4} from 'mattermost-redux/client';

import AtMention from 'components/at_mention';
import {useChannel} from 'components/common/hooks/useChannel';
import {useContentFlaggingConfig} from 'components/common/hooks/useContentFlaggingFields';
import {useUser} from 'components/common/hooks/useUser';
import type {TextboxElement} from 'components/textbox';
import AdvancedTextbox from 'components/widgets/advanced_textbox/advanced_textbox';

import './remove_flagged_message_confirmation_modal.scss';

const noop = () => {};

type Props = {
    action: 'keep' | 'remove';
    onExited: () => void;
    flaggedPost: Post;
    reportingUser: UserProfile;
}

export default function KeepRemoveFlaggedMessageConfirmationModal({action, onExited, flaggedPost, reportingUser}: Props) {
    const {formatMessage} = useIntl();

    const flaggedPostAuthor = useUser(flaggedPost.user_id);
    const flaggedPostChannel = useChannel(flaggedPost.channel_id);
    const contentFlaggingConfig = useContentFlaggingConfig(flaggedPostChannel?.team_id || '');

    const [comment, setComment] = React.useState<string>('');
    const [commentError, setCommentError] = React.useState<string>('');
    const [requestError, setRequestError] = React.useState<string>('');
    const [submitting, setSubmitting] = React.useState<boolean>(false);
    const [showCommentPreview, setShowCommentPreview] = React.useState<boolean>(false);

    const handleCommentChange = useCallback((e: React.ChangeEvent<TextboxElement>) => {
        setComment(e.target.value);

        if (contentFlaggingConfig?.reviewer_comment_required && e.target.value.trim() === '') {
            setCommentError(formatMessage({id: 'keep_remove_flag_content_modal.comment_required.error', defaultMessage: 'Please add a comment.'}));
        } else {
            setCommentError('');
        }
    }, [contentFlaggingConfig?.reviewer_comment_required, formatMessage]);

    const handleToggleCommentPreview = useCallback(() => {
        setShowCommentPreview((prev) => !prev);
    }, []);

    const removeActionLabel = formatMessage({id: 'keep_remove_flag_content_modal.action_remove.title', defaultMessage: 'Remove message from channel'});
    const keepActionLabel = formatMessage({id: 'keep_remove_flag_content_modal.action_keep.title', defaultMessage: 'Keep message'});

    const removeActionBody = formatMessage({
        id: 'keep_remove_flag_content_modal.action_remove.body',
        defaultMessage: 'You are about to remove a message authored by {flaggedPostAuthor} posed in the {flaggedPostChannel} channel and flagged for review by {reportingUser}.',
    }, {
        br: <br/>,
        flaggedPostChannel: flaggedPostChannel?.display_name,
        reportingUser: <AtMention mentionName={reportingUser?.username || ''}/>,
        flaggedPostAuthor: <AtMention mentionName={flaggedPostAuthor?.username || ''}/>,
    });
    const keepActionBody = formatMessage({
        id: 'keep_remove_flag_content_modal.action_keep.body',
        defaultMessage: 'You are about to keep a flagged message authored by {flaggedPostAuthor} posed in the {flaggedPostChannel} channel and flagged for review by {reportingUser}.',
    }, {
        br: <br/>,
        flaggedPostChannel: flaggedPostChannel?.display_name,
        reportingUser: <AtMention mentionName={reportingUser?.username || ''}/>,
        flaggedPostAuthor: <AtMention mentionName={flaggedPostAuthor?.username || ''}/>,
    });

    const removeActionBodySubTextReporterNotification = formatMessage({
        id: 'keep_remove_flag_content_modal.action_remove.subtext.notify_reporter',
        defaultMessage: 'If you confirm, the message will be removed from the channel and a notification will be sent to the reporter of the flag. This action cannot be reverted.',
    });
    const removeActionBodySubTextNoReporterNotification = formatMessage({
        id: 'keep_remove_flag_content_modal.action_remove.subtext.no_notify_reporter',
        defaultMessage: 'If you confirm, the message will be removed from the channel. This action cannot be reverted.',
    });

    const keepActionBodySubTextReporterNotification = formatMessage({
        id: 'keep_remove_flag_content_modal.action_keep.subtext.notify_reporter',
        defaultMessage: 'If you confirm, the message will be visible to all channel members and a notification will be sent to the reporter of the flag.',
    });
    const keepActionBodySubTextNoReporterNotification = formatMessage({
        id: 'keep_remove_flag_content_modal.action_keep.subtext.no_notify_reporter',
        defaultMessage: 'If you confirm, the message will be visible to all channel members.',
    });

    const requiredCommentSectionTitle = formatMessage({id: 'remove_flag_post_confirm_modal.required_comment.title', defaultMessage: 'Comment (required)'});
    const optionalCommentSectionTitle = formatMessage({id: 'remove_flag_post_confirm_modal.optional_comment.title', defaultMessage: 'Comment (optional)'});

    const commentPlaceholder = formatMessage({id: 'keep_remove_flag_content_modal.comment.placeholder', defaultMessage: 'Add your comment here'});
    const removeMessageButtonText = formatMessage({id: 'keep_remove_flag_content_modal.action_remove.button_text', defaultMessage: 'Remove message'});
    const keepMessageButtonText = formatMessage({id: 'keep_remove_flag_content_modal.action_keep.button_text', defaultMessage: 'Keep message'});

    let label;
    let subtext;
    let body;
    let buttonText;
    let confirmButtonClass;

    if (action === 'remove') {
        label = removeActionLabel;
        body = removeActionBody;
        buttonText = removeMessageButtonText;
        confirmButtonClass = 'btn-danger';

        if (contentFlaggingConfig?.notify_reporter_on_removal) {
            subtext = removeActionBodySubTextReporterNotification;
        } else {
            subtext = removeActionBodySubTextNoReporterNotification;
        }
    } else {
        label = keepActionLabel;
        body = keepActionBody;
        buttonText = keepMessageButtonText;
        confirmButtonClass = 'btn-primary';

        if (contentFlaggingConfig?.notify_reporter_on_dismissal) {
            subtext = keepActionBodySubTextReporterNotification;
        } else {
            subtext = keepActionBodySubTextNoReporterNotification;
        }
    }

    const validateForm = useCallback(() => {
        let hasErrors = false;

        if (contentFlaggingConfig?.reviewer_comment_required && comment.trim() === '') {
            setCommentError(formatMessage({id: 'keep_remove_flag_content_modal.comment_required.error', defaultMessage: 'Please add a comment.'}));
            hasErrors = true;
        } else {
            setCommentError('');
        }

        return hasErrors;
    }, [comment, contentFlaggingConfig?.reviewer_comment_required, formatMessage]);

    const handleConfirm = useCallback(async () => {
        const hasError = validateForm();
        if (hasError) {
            return;
        }

        const actionFunc = action === 'remove' ? Client4.removeFlaggedPost : Client4.keepFlaggedPost;
        try {
            setSubmitting(true);
            await actionFunc(flaggedPost.id, comment);
            onExited();
        } catch (error) {
            // eslint-disable-next-line no-console
            console.error(error);
            setRequestError((error as ServerError).message);
        } finally {
            setSubmitting(false);
        }
    }, [action, comment, flaggedPost.id, onExited, validateForm]);

    return (
        <GenericModal
            className='KeepRemoveFlaggedMessageConfirmationModal'
            dataTestId='keep-remove-flagged-message-confirmation-modal'
            ariaLabel={label}
            modalHeaderText={label}
            compassDesign={true}
            keyboardEscape={true}
            enforceFocus={false}
            handleConfirm={handleConfirm}
            handleCancel={noop}
            onExited={onExited}
            confirmButtonText={buttonText}
            confirmButtonClassName={confirmButtonClass}
            autoCloseOnConfirmButton={false}
            isConfirmDisabled={submitting}
        >
            <div className='body'>
                <div className='section'>
                    {body}
                    <br/>
                    <br/>
                    {subtext}
                </div>

                <div className='section comment_section'>
                    <div
                        className='section_title'
                    >
                        {contentFlaggingConfig?.reviewer_comment_required ? requiredCommentSectionTitle : optionalCommentSectionTitle}
                    </div>

                    <AdvancedTextbox
                        id='RemoveFlaggedMessageConfirmationModal__comment'
                        channelId={flaggedPost.channel_id}
                        value={comment}
                        onChange={handleCommentChange}
                        createMessage={commentPlaceholder}
                        preview={showCommentPreview}
                        togglePreview={handleToggleCommentPreview}
                        useChannelMentions={false}
                        onKeyPress={() => {}}
                        hasError={false}
                        errorMessage={commentError}
                        maxLength={1000}
                    />
                </div>
                {requestError &&
                    <div className='request_error'>
                        <i className='icon icon-alert-outline'/>
                        <span>{requestError}</span>
                    </div>
                }
            </div>
        </GenericModal>
    );
}
