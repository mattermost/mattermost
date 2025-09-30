// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useEffect, useMemo} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';
import ReactSelect, {type StylesConfig} from 'react-select';

import {GenericModal} from '@mattermost/components';
import type {ServerError} from '@mattermost/types/errors';
import type {PostPreviewMetadata} from '@mattermost/types/posts';

import {getContentFlaggingConfig} from 'mattermost-redux/actions/content_flagging';
import {Client4} from 'mattermost-redux/client';
import {getChannel} from 'mattermost-redux/selectors/entities/channels';
import {contentFlaggingConfig} from 'mattermost-redux/selectors/entities/content_flagging';
import {getPost} from 'mattermost-redux/selectors/entities/posts';
import {getCurrentTeam} from 'mattermost-redux/selectors/entities/teams';

import PostMessagePreview from 'components/post_view/post_message_preview';
import type {TextboxElement} from 'components/textbox';
import AdvancedTextbox from 'components/widgets/advanced_textbox/advanced_textbox';

import type {GlobalState} from 'types/store';

import './flag_post_modal.scss';

const noop = () => {};

type SelectedOption = {
    value: string;
    label: string;
}

type Props = {
    postId: string;
    onExited: () => void;
}

export default function FlagPostModal({postId, onExited}: Props) {
    const {formatMessage} = useIntl();
    const dispatch = useDispatch();

    useEffect(() => {
        dispatch(getContentFlaggingConfig());
    }, [dispatch]);

    const [comment, setComment] = React.useState<string>('');
    const [reason, setReason] = React.useState<string>('');
    const [commentError, setCommentError] = React.useState<string>('');
    const [reasonError, setReasonError] = React.useState<string>('');
    const [requestError, setRequestError] = React.useState<string>('');
    const [submitting, setSubmitting] = React.useState<boolean>(false);
    const [showCommentPreview, setShowCommentPreview] = React.useState<boolean>(false);

    const label = formatMessage({id: 'flag_message_modal.heading', defaultMessage: 'Flag message'});
    const subHeading = formatMessage({id: 'flag_message_modal.subheading', defaultMessage: 'Flagged messages will be sent to Content Reviewers for review'});
    const submitButtonText = formatMessage({id: 'generic.submit', defaultMessage: 'Submit'});
    const requiredCommentSectionTitle = formatMessage({id: 'flag_message_modal.required_comment.title', defaultMessage: 'Comment (required)'});
    const optionalCommentSectionTitle = formatMessage({id: 'flag_message_modal.optional_comment.title', defaultMessage: 'Comment (optional)'});
    const reasonSelectPlaceholder = formatMessage({id: 'flag_message_modal.reason_select.placeholder', defaultMessage: 'Select a reason for flagging'});
    const commentPlaceholder = formatMessage({id: 'flag_message_modal.comment.placeholder', defaultMessage: 'Describe your concern...'});

    const post = useSelector((state: GlobalState) => getPost(state, postId));
    const channel = useSelector((state: GlobalState) => getChannel(state, post.channel_id));
    const currentTeam = useSelector(getCurrentTeam);
    const contentFlaggingSettings = useSelector(contentFlaggingConfig);

    const reasons = useMemo(() => {
        if (!contentFlaggingSettings || !contentFlaggingSettings.reasons) {
            return [];
        }

        return contentFlaggingSettings.reasons.map((reason: string) => ({
            value: reason,
            label: reason,
        }));
    }, [contentFlaggingSettings]);

    const previewMetadata: PostPreviewMetadata = useMemo(() => {
        return {
            post_id: post.id,
            team_name: currentTeam?.name || '',
            channel_display_name: channel?.display_name || '',
            channel_type: channel?.type || 'O',
            channel_id: channel?.id || '',
        };
    }, [channel?.display_name, channel?.id, channel?.type, currentTeam?.name, post]);

    // This is to bring react select dropdown above the modal body
    const reactStyles = useMemo(() => {
        return {
            menuPortal: (provided) => ({
                ...provided,
                zIndex: 9999,
            }),
        } satisfies StylesConfig<SelectedOption, boolean>;
    }, []);

    const handleOptionChange = useCallback((selectedOption: SelectedOption | null) => {
        const reason = selectedOption ? selectedOption.label : '';
        setReason(reason);

        if (reason === '') {
            setReasonError(formatMessage({id: 'flag_message_modal.reason_required_error', defaultMessage: 'Please select a reason for flagging this message.'}));
        } else {
            setReasonError('');
        }
    }, [formatMessage]);

    const handleCommentChange = useCallback((e: React.ChangeEvent<TextboxElement>) => {
        setComment(e.target.value);

        if (contentFlaggingSettings?.reporter_comment_required && e.target.value.trim() === '') {
            setCommentError(formatMessage({id: 'flag_message_modal.empty_comment_error', defaultMessage: 'Please add a comment explaining why you’re flagging this message.'}));
        } else {
            setCommentError('');
        }
    }, [contentFlaggingSettings, formatMessage]);

    const handleToggleCommentPreview = useCallback(() => {
        setShowCommentPreview((prev) => !prev);
    }, []);

    const validateForm = useCallback((): boolean => {
        let hasError = false;

        if (contentFlaggingSettings?.reporter_comment_required && comment.trim() === '') {
            setCommentError(formatMessage({id: 'flag_message_modal.empty_comment_error', defaultMessage: 'Please add a comment explaining why you’re flagging this message.'}));
            hasError = true;
        } else {
            setCommentError('');
        }

        if (reason === '') {
            setReasonError(formatMessage({id: 'flag_message_modal.reason_required_error', defaultMessage: 'Please select a reason for flagging this message.'}));
            hasError = true;
        } else {
            setReasonError('');
        }

        return hasError;
    }, [comment, contentFlaggingSettings?.reporter_comment_required, formatMessage, reason]);

    const handleConfirm = useCallback(async () => {
        const hasError = validateForm();
        if (hasError) {
            return;
        }

        try {
            setSubmitting(true);
            await Client4.flagPost(post.id, reason, comment);
            onExited();
        } catch (error) {
            // eslint-disable-next-line no-console
            console.error(error);
            setRequestError((error as ServerError).message);
        } finally {
            setSubmitting(false);
        }
    }, [validateForm, post.id, reason, comment, onExited]);

    return (
        <GenericModal
            id='FlagPostModal'
            ariaLabel={label}
            modalHeaderText={label}
            modalSubheaderText={subHeading}
            compassDesign={true}
            keyboardEscape={true}
            enforceFocus={false}
            handleConfirm={handleConfirm}
            handleCancel={noop}
            confirmButtonText={submitButtonText}
            onExited={onExited}
            autoCloseOnConfirmButton={false}
            isConfirmDisabled={submitting}
        >
            <div className='FlagPostModal FlagPostModal__body'>
                <div className='FlagPostModal__section FlagPostModal__post_preview'>
                    <div className='FlagPostModal__section_title'>
                        <FormattedMessage
                            id='flag_message_modal.post_preview.title'
                            defaultMessage='Message to be flagged'
                        />
                    </div>
                    <div
                        className='post forward-post__post-preview--override'
                        data-testid='FlagPostModal__post-preview_container'
                    >
                        <PostMessagePreview
                            metadata={previewMetadata}
                            handleFileDropdownOpened={noop}
                            preventClickAction={true}
                        />
                    </div>
                </div>

                <div className='FlagPostModal__section FlagPostModal__flagging_reason'>
                    <div className='FlagPostModal__section_title'>
                        <FormattedMessage
                            id='flag_message_modal.flag_reason.title'
                            defaultMessage='Reason for flagging this message'
                        />
                    </div>
                    <ReactSelect
                        className='FlagPostModal__reason react-select react-select-top'
                        classNamePrefix='react-select'
                        id='FlagPostModal__reason'
                        menuPortalTarget={document.body}
                        isClearable={false}
                        options={reasons}
                        styles={reactStyles}
                        onChange={handleOptionChange}
                        placeholder={reasonSelectPlaceholder}
                    />
                    {reasonError &&
                        <div className='FlagPostModal__reason__error-message'>
                            <i className='icon icon-alert-circle-outline'/>
                            <span>{reasonError}</span>
                        </div>
                    }
                </div>

                <div className='FlagPostModal__section FlagPostModal__comment'>
                    <div
                        className='FlagPostModal__section_title'
                        data-testid='FlagPostModal__comment_section_title'
                    >
                        {contentFlaggingSettings?.reporter_comment_required ? requiredCommentSectionTitle : optionalCommentSectionTitle}
                    </div>

                    <AdvancedTextbox
                        id='FlagPostModal__comment'
                        channelId={post.channel_id}
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
                    <div className='FlagPostModal__request-error'>
                        <i className='icon icon-alert-outline'/>
                        <span>{requestError}</span>
                    </div>
                }
            </div>
        </GenericModal>
    );
}
