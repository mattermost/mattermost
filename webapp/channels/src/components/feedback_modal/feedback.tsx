// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState} from 'react';

import {injectIntl, WrappedComponentProps} from 'react-intl';
import {useDispatch} from 'react-redux';

import {GenericModal} from '@mattermost/components';
import {Feedback} from '@mattermost/types/cloud';
import {closeModal} from 'actions/views/modals';
import RadioButtonGroup from 'components/common/radio_group';

import {ModalIdentifiers} from 'utils/constants';

import './feedback.scss';

type Props = {
    onSubmit: (deleteFeedback: Feedback) => void;
    title: string;
    submitText: string;
    feedbackOptions: string[];
    freeformTextPlaceholder: string;
} & WrappedComponentProps

function FeedbackModal(props: Props) {
    const maxFreeFormTextLength = 500;
    const optionOther = props.intl.formatMessage({id: 'feedback.other', defaultMessage: 'Other'});
    const feedbackModalOptions: string[] = [
        ...props.feedbackOptions,
        optionOther,
    ];

    const [reason, setReason] = useState('');
    const [comments, setComments] = useState('');
    const reasonNotSelected = reason === '';
    const reasonOther = reason === optionOther;
    const commentsNotProvided = comments.trim() === '';
    const submitDisabled = reasonNotSelected || (reason === optionOther && commentsNotProvided);

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
        <GenericModal
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
                        value: option,
                        key: option,
                        testId: option,
                    };
                })}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
            />
            {reason === optionOther &&
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
        </GenericModal>
    );
}

export default injectIntl(FeedbackModal);
