// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useEffect, useRef, useState} from 'react';
import {useIntl} from 'react-intl';
import {useDispatch} from 'react-redux';

import {GenericModal} from '@mattermost/components';
import type {ServerError} from '@mattermost/types/errors';
import type {Post} from '@mattermost/types/posts';
import type {UserProfile} from '@mattermost/types/users';

import {removeContentFlaggingPost} from 'mattermost-redux/actions/content_flagging';
import {Client4} from 'mattermost-redux/client';

import {useChannel} from 'components/common/hooks/useChannel';
import {useContentFlaggingConfig} from 'components/common/hooks/useContentFlaggingFields';
import type {TextboxElement} from 'components/textbox';

import ErrorStepBody from './error_step/error_step_body';
import ErrorStepFooter from './error_step/error_step_footer';
import {FormStepBody} from './form_step/form_step_body';
import {FormStepFooter} from './form_step/form_step_footer';
import GeneratedStepBody from './generated_step/generated_step_body';
import GeneratedStepFooter from './generated_step/generated_step_footer';
import {GeneratingStepBody} from './generating_step/generating_step_body';
import {GeneratingStepFooter} from './generating_step/generating_step_footer';
import {SkipConfirmStepBody} from './skip_confirm_step/skip_confirm_step_body';
import {SkipConfirmStepFooter} from './skip_confirm_step/skip_confirm_step_footer';

import './remove_flagged_message_confirmation_modal.scss';

type Props = {
    action: 'keep' | 'remove';
    onExited: () => void;
    flaggedPost: Post;
    reportingUser: UserProfile;
};

type Step = 'form' | 'skip_confirm' | 'generating' | 'generated' | 'error';

export default function KeepRemoveFlaggedMessageConfirmationModal({action, onExited, flaggedPost, reportingUser}: Props) {
    const {formatMessage} = useIntl();
    const dispatch = useDispatch();

    const flaggedPostChannel = useChannel(flaggedPost.channel_id);
    const contentFlaggingConfig = useContentFlaggingConfig(flaggedPostChannel?.team_id || '');

    const [comment, setComment] = useState<string>('');
    const [commentError, setCommentError] = useState<string>('');
    const [requestError, setRequestError] = useState<string>('');
    const [submitting, setSubmitting] = useState<boolean>(false);
    const [showCommentPreview, setShowCommentPreview] = useState<boolean>(false);
    const [downloadReport, setDownloadReport] = useState<boolean>(true);
    const [step, setStep] = useState<Step>('form');

    const abortControllerRef = useRef<AbortController | null>(null);

    const handleClose = useCallback(() => {
        abortControllerRef.current?.abort();
        onExited();
    }, [onExited]);

    const handleCommentChange = useCallback((e: React.ChangeEvent<TextboxElement>) => {
        setComment(e.target.value);

        if (contentFlaggingConfig?.reviewer_comment_required && e.target.value.trim() === '') {
            setCommentError(formatMessage({id: 'keep_remove_quarantined_content_modal.comment_required.error', defaultMessage: 'Please add a comment.'}));
        } else {
            setCommentError('');
        }
    }, [contentFlaggingConfig?.reviewer_comment_required, formatMessage]);

    const handleToggleCommentPreview = useCallback(() => {
        setShowCommentPreview((prev) => !prev);
    }, []);

    const handleToggleDownloadReport = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        setDownloadReport(e.target.checked);
    }, []);

    const validateForm = useCallback(() => {
        if (contentFlaggingConfig?.reviewer_comment_required && comment.trim() === '') {
            setCommentError(formatMessage({id: 'keep_remove_quarantined_content_modal.comment_required.error', defaultMessage: 'Please add a comment.'}));
            return true;
        }
        setCommentError('');
        return false;
    }, [comment, contentFlaggingConfig?.reviewer_comment_required, formatMessage]);

    const callActionAPI = useCallback(async () => {
        const actionFunc = action === 'remove' ? Client4.removeFlaggedPost : Client4.keepFlaggedPost;
        try {
            setSubmitting(true);
            setRequestError('');
            await actionFunc(flaggedPost.id, comment);
            if (action === 'remove') {
                dispatch(removeContentFlaggingPost(flaggedPost.id));
            }
            handleClose();
        } catch (error) {
            // eslint-disable-next-line no-console
            console.error(error);
            setRequestError((error as ServerError).message);
        } finally {
            setSubmitting(false);
        }
    }, [action, comment, dispatch, flaggedPost.id, handleClose]);

    const handleFormPrimary = useCallback(() => {
        if (validateForm()) {
            return;
        }
        setRequestError('');
        if (downloadReport) {
            setStep('generating');
        } else if (action === 'keep') {
            callActionAPI();
        } else {
            setStep('skip_confirm');
        }
    }, [validateForm, downloadReport, action, callActionAPI]);

    const handleSkipConfirmBack = useCallback(() => {
        setRequestError('');
        setStep('form');
    }, []);

    const handleSkipFromGenerating = useCallback(() => {
        abortControllerRef.current?.abort();
        setRequestError('');
        if (action === 'keep') {
            callActionAPI();
        } else {
            setStep('skip_confirm');
        }
    }, [action, callActionAPI]);

    const handleBackToForm = useCallback(() => {
        abortControllerRef.current?.abort();
        setRequestError('');
        setStep('form');
    }, []);

    const handleRetryGeneration = useCallback(() => {
        setRequestError('');
        setStep('generating');
    }, []);

    useEffect(() => {
        if (step !== 'generating') {
            return undefined;
        }

        const controller = new AbortController();
        abortControllerRef.current = controller;

        (async () => {
            try {
                const blob = await Client4.generateFlaggedPostReport(flaggedPost.id, comment, action, controller.signal);
                if (controller.signal.aborted) {
                    return;
                }

                const downloadUrl = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = downloadUrl;
                a.download = `flagged-post-${flaggedPost.id}-${Date.now()}.zip`;
                document.body.appendChild(a);
                a.click();
                a.remove();
                URL.revokeObjectURL(downloadUrl);

                setStep('generated');
            } catch (err) {
                if (controller.signal.aborted) {
                    return;
                }

                // eslint-disable-next-line no-console
                console.error(err);
                setStep('error');
            }
        })();

        return () => {
            controller.abort();
        };
    }, [step, flaggedPost.id, comment, action]);

    const removeLabel = formatMessage({id: 'keep_remove_quarantined_content_modal.action_remove.title', defaultMessage: 'Remove message from channel'});
    const keepLabel = formatMessage({id: 'keep_remove_quarantined_content_modal.action_keep.title', defaultMessage: 'Keep message'});

    const removeWithoutReportLabel = formatMessage({id: 'keep_remove_quarantined_content_modal.action_remove_without_report.title', defaultMessage: 'Remove without report?'});

    const bodyContentProps = {
        action,
        flaggedPost,
        reportingUser,
        contentFlaggingConfig,
    };

    let label = action === 'remove' ? removeLabel : keepLabel;
    let modalBody: React.ReactNode = null;
    let footer: React.ReactNode = null;

    switch (step) {
    case 'form':
        modalBody = (
            <FormStepBody
                {...bodyContentProps}
                comment={comment}
                commentError={commentError}
                showCommentPreview={showCommentPreview}
                onCommentChange={handleCommentChange}
                onToggleCommentPreview={handleToggleCommentPreview}
            />
        );
        footer = (
            <FormStepFooter
                action={action}
                downloadReport={downloadReport}
                submitting={submitting}
                onToggleDownloadReport={handleToggleDownloadReport}
                onCancel={handleClose}
                onPrimary={handleFormPrimary}
            />
        );
        break;
    case 'skip_confirm':
        label = removeWithoutReportLabel;
        modalBody = (
            <SkipConfirmStepBody
                flaggedPost={flaggedPost}
                reportingUser={reportingUser}
            />);
        footer = (
            <SkipConfirmStepFooter
                submitting={submitting}
                onBack={handleSkipConfirmBack}
                onPrimary={callActionAPI}
            />
        );
        break;
    case 'generating':
        modalBody = <GeneratingStepBody {...bodyContentProps}/>;
        footer = (
            <GeneratingStepFooter
                action={action}
                onSkip={handleSkipFromGenerating}
                onBack={handleBackToForm}
            />
        );
        break;
    case 'generated':
        modalBody = <GeneratedStepBody {...bodyContentProps}/>;
        footer = (
            <GeneratedStepFooter
                action={action}
                submitting={submitting}
                onDownloadAgain={handleRetryGeneration}
                onBack={handleBackToForm}
                onPermanent={callActionAPI}
            />
        );
        break;
    case 'error':
        modalBody = (
            <ErrorStepBody
                {...bodyContentProps}
                onRetry={handleRetryGeneration}
            />
        );
        footer = (
            <ErrorStepFooter
                action={action}
                onSkip={handleSkipFromGenerating}
                onBack={handleBackToForm}
            />
        );
        break;
    }

    return (
        <GenericModal
            className='KeepRemoveFlaggedMessageConfirmationModal'
            dataTestId='keep-remove-flagged-message-confirmation-modal'
            ariaLabel={label}
            modalHeaderText={label}
            compassDesign={true}
            keyboardEscape={true}
            enforceFocus={false}
            onHide={handleClose}
            onExited={onExited}
            footerContent={footer}
        >
            <div className='body'>
                {modalBody}
                {requestError && (
                    <div
                        className='request_error'
                        data-testid='keep-remove-flagged-message-request-error'
                    >
                        <i className='icon icon-alert-outline'/>
                        <span>{requestError}</span>
                    </div>
                )}
            </div>
        </GenericModal>
    );
}
