// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState} from 'react';

import {injectIntl, WrappedComponentProps} from 'react-intl';
import {useDispatch} from 'react-redux';

import {LegacyGenericModal} from '@mattermost/components';
import {Feedback} from '@mattermost/types/cloud';
import {closeModal} from 'actions/views/modals';
import RadioButtonGroup from 'components/common/radio_group';

import {ModalIdentifiers} from 'utils/constants';

import './feedback.scss';

export interface FeedbackOption {
    translatedMessage: string;
    submissionValue: string;
}

type Props = {
    onSubmit: (deleteFeedback: Feedback) => void;
    title: string;
    submitText: string;
    feedbackOptions: FeedbackOption[];
    freeformTextPlaceholder: string;
} & WrappedComponentProps

function FeedbackModal(props: Props) {
    const maxFreeFormTextLength = 500;
    const optionOther = {translatedMessage: props.intl.formatMessage({id: 'feedback.other', defaultMessage: 'Other'}), submissionValue: 'Other'};
    const feedbackModalOptions: FeedbackOption[] = [
        ...props.feedbackOptions,
        optionOther,
    ];

    const [reason, setReason] = useState('');
    const [comments, setComments] = useState('');
    const reasonNotSelected = reason === '';
    const reasonOther = reason === optionOther.submissionValue;
    const commentsNotProvided = comments.trim() === '';
    const submitDisabled = reasonNotSelected || (reasonOther && commentsNotProvided);

    const dispatch = useDispatch();

    const handleSubmitFeedbackModal = () => {
        if (submitDisabled) {
            return;
        }

        props.onSubmit({reason, comments: reasonOther ? comments.trim() : ''});
        dispatch(closeModal(ModalIdentifiers.FEEDBACK));
    };

    const handleCancel = () => {
        dispatch(closeModal(ModalIdentifiers.FEEDBACK));
    };

    return (
        <LegacyGenericModal
            compassDesign={true}
            onExited={handleCancel}
            className='FeedbackModal__Container'
            isConfirmDisabled={submitDisabled}
            handleCancel={handleCancel}
            handleConfirm={handleSubmitFeedbackModal}
            confirmButtonText={props.submitText}
            cancelButtonText={props.intl.formatMessage({id: 'feedback.cancelButton.text', defaultMessage: 'Cancel'})}
            modalHeaderText={props.title}
            autoCloseOnConfirmButton={false}
        >
            <RadioButtonGroup
                id='FeedbackModalRadioGroup'
                testId='FeedbackModalRadioGroup'
                values={feedbackModalOptions.map((option) => {
                    return {
                        value: option.submissionValue,
                        key: option.translatedMessage,
                        testId: option.submissionValue,
                    };
                })}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
            />
            {reasonOther &&
                <>
                    <textarea
                        data-testid={'FeedbackModal__TextInput'}
                        className='FeedbackModal__FreeFormText'
                        placeholder={props.freeformTextPlaceholder}
                        rows={3}
                        value={comments}
                        onChange={(e) => {
                            setComments(e.target.value);
                        }}
                        maxLength={maxFreeFormTextLength}
                    />
                    <span className='FeedbackModal__FreeFormTextLimit'>
                        {comments.length + '/' + maxFreeFormTextLength}
                    </span>
                </>
            }
        </LegacyGenericModal>
    );
}

export default injectIntl(FeedbackModal);
