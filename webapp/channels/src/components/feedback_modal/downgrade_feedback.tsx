// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {injectIntl, WrappedComponentProps} from 'react-intl';

import {Feedback} from '@mattermost/types/cloud';
import FeedbackModal, {FeedbackOption} from 'components/feedback_modal/feedback';

type Props = {
    onSubmit: (downgradeFeedback: Feedback) => void;
} &WrappedComponentProps

const DowngradeFeedbackModal = (props: Props) => {
    const downgradeFeedbackModalTitle = props.intl.formatMessage({
        id: 'feedback.downgradeWorkspace.feedbackTitle',
        defaultMessage: 'Please share your reason for downgrading',
    });

    const placeHolder = props.intl.formatMessage({
        id: 'feedback.downgradeWorkspace.tellUsWhy',
        defaultMessage: 'Please tell us why you are downgrading',
    });

    const downgradeButtonText = props.intl.formatMessage({
        id: 'feedback.downgradeWorkspace.downgrade',
        defaultMessage: 'Downgrade',
    });

    const downgradeFeedbackOptions: FeedbackOption[] = [
        {
            translatedMessage: props.intl.formatMessage({
                id: 'feedback.downgradeWorkspace.technicalIssues',
                defaultMessage: 'Experienced technical issues',
            }),
            submissionValue: 'Experienced technical issues',
        },
        {
            translatedMessage: props.intl.formatMessage({
                id: 'feedback.downgradeWorkspace.noLongerNeeded',
                defaultMessage: 'No longer need Cloud Professional features',
            }),
            submissionValue: 'No longer need Cloud Professional features',
        },
        {
            translatedMessage: props.intl.formatMessage({
                id: 'feedback.downgradeWorkspace.exploringOptions',
                defaultMessage: 'Exploring other solutions',
            }),
            submissionValue: 'Exploring other solutions',
        },
        {
            translatedMessage: props.intl.formatMessage({
                id: 'feedback.downgradeWorkspace.tooExpensive',
                defaultMessage: 'Too expensive',
            }),
            submissionValue: 'Too expensive',
        },
    ];

    return (
        <FeedbackModal
            title={downgradeFeedbackModalTitle}
            feedbackOptions={downgradeFeedbackOptions}
            freeformTextPlaceholder={placeHolder}
            submitText={downgradeButtonText}
            onSubmit={props.onSubmit}
        />
    );
};

export default injectIntl(DowngradeFeedbackModal);
