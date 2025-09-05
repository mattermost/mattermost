// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback} from 'react';
import {useIntl} from 'react-intl';

import {GenericModal} from '@mattermost/components';
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
    const [showCommentPreview, setShowCommentPreview] = React.useState<boolean>(false);

    const handleCommentChange = useCallback((e: React.ChangeEvent<TextboxElement>) => {
        setComment(e.target.value);

        if (contentFlaggingConfig?.reviewer_comment_required && e.target.value.trim() === '') {
            setCommentError(formatMessage({id: 'flag_message_modal.empty_comment_error', defaultMessage: 'Please add a comment explaining why you’re flagging this message.'}));
        } else {
            setCommentError('');
        }
    }, [contentFlaggingConfig?.reviewer_comment_required, formatMessage]);

    const handleToggleCommentPreview = useCallback(() => {
        setShowCommentPreview((prev) => !prev);
    }, []);

    const removeActionLabel = formatMessage({id: 'keep_remove_flag_content_modal.action_remove.title', defaultMessage: 'Remove message from channel'});
    const keepActionLabel = formatMessage({id: 'keep_remove_flag_content_modal.action_keep.title', defaultMessage: 'Keep message'});

    const body = formatMessage({
        id: 'remove_flag_confirm_modal.body',
        defaultMessage: 'You are about to remove a message authored by {flaggedPostAuthor} posed in the {flaggedPostChannel} channel and flagged for review by {reportingUser}.',
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
    let buttonText;
    let confirmButtonClass;

    if (action === 'remove') {
        label = removeActionLabel;
        buttonText = removeMessageButtonText;
        confirmButtonClass = 'btn-danger';

        if (contentFlaggingConfig?.notify_reporter_on_removal) {
            subtext = removeActionBodySubTextReporterNotification;
        } else {
            subtext = removeActionBodySubTextNoReporterNotification;
        }
    } else {
        label = keepActionLabel;
        buttonText = keepMessageButtonText;
        confirmButtonClass = 'btn-primary';

        if (contentFlaggingConfig?.notify_reporter_on_dismissal) {
            subtext = keepActionBodySubTextReporterNotification;
        } else {
            subtext = keepActionBodySubTextNoReporterNotification;
        }
    }

    const handleConfirm = useCallback(async () => {
        if (action === 'remove') {
            await Client4.removeFlaggedPost(flaggedPost.id, comment);
            onExited();
        } else if (action === 'keep') {
            await Client4.keepFlaggedPost(flaggedPost.id, comment);
            onExited();
        }
    }, [action, comment, flaggedPost.id, onExited]);

    return (
        <GenericModal
            id='KeepRemoveFlaggedMessageConfirmationModal'
            ariaLabel={label}
            modalHeaderText={label}
            compassDesign={true}
            keyboardEscape={true}
            enforceFocus={false}
            handleConfirm={handleConfirm}
            handleCancel={onExited}
            confirmButtonText={buttonText}
            confirmButtonClassName={confirmButtonClass}
            autoCloseOnConfirmButton={false}
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
            </div>
        </GenericModal>
    );
}
