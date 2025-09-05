// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback} from 'react';
import {useIntl} from 'react-intl';

import {GenericModal} from '@mattermost/components';
import type {Post} from '@mattermost/types/posts';
import type {UserProfile} from '@mattermost/types/users';

import AtMention from 'components/at_mention';
import {useContentFlaggingConfig} from 'components/common/hooks/useContentFlaggingFields';
import {useUser} from 'components/common/hooks/useUser';
import type {TextboxElement} from 'components/textbox';
import AdvancedTextbox from 'components/widgets/advanced_textbox/advanced_textbox';

import './remove_flagged_message_confirmation_modal.scss';

type Props = {
    onExited: () => void;
    flaggedPost: Post;
    reportingUser: UserProfile;
}

export default function RemoveFlaggedMessageConfirmationModal({onExited, flaggedPost, reportingUser}: Props) {
    const {formatMessage} = useIntl();
    const label = formatMessage({id: 'remove_flag_post_confirm_modal.headingf', defaultMessage: 'Remove message from channel'});

    const contentFlaggingConfig = useContentFlaggingConfig('true');
    const flaggedPostAuthor = useUser(flaggedPost.user_id);
    const flaggedPostChannel = useUser(flaggedPost.channel_id);

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

    const x = ' and a notification will be sent to the reporter of the flag';

    const body = formatMessage({
        id: 'remove_flag_confirm_modal.body',
        defaultMessage:
            'You are about to remove a message authored by {flaggedPostAuthor} posed in the {flaggedPostChannel} channel and flagged for review by {reportingUser}.' +
            '{br}{br}If you confirm, the message will be removed from the channel{reporterNotificationText}. This action cannot be reverted.',
    }, {
        br: <br/>,
        flaggedPostChannel,
        reportingUser: <AtMention mentionName={reportingUser?.username || ''}/>,
        flaggedPostAuthor: <AtMention mentionName={flaggedPostAuthor?.username || ''}/>,
        reporterNotificationText: x,
    });

    const requiredCommentSectionTitle = formatMessage({id: 'remove_flag_post_confirm_modal.required_comment.title', defaultMessage: 'Comment (required)'});
    const optionalCommentSectionTitle = formatMessage({id: 'remove_flag_post_confirm_modal.optional_comment.title', defaultMessage: 'Comment (optional)'});
    const commentPlaceholder = formatMessage({id: 'remove_flag_post_confirm_modal.comment.placeholder', defaultMessage: 'Describe your concern...'});
    const removeMessageButtonText = formatMessage({id: 'data_spillage_report.remove_message.button_text', defaultMessage: 'Remove message'});

    return (
        <GenericModal
            id='RemoveFlaggedMessageConfirmationModal'
            ariaLabel={label}
            modalHeaderText={label}
            compassDesign={true}
            keyboardEscape={true}
            enforceFocus={false}
            handleConfirm={() => {}}
            handleCancel={() => {}}
            confirmButtonText={removeMessageButtonText}
            confirmButtonClassName='btn-danger'
            autoCloseOnConfirmButton={false}
        >
            <div className='body'>
                <div className='section'>
                    {body}
                </div>

                <div className='section'>
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
