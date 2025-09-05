// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import TrialBenefitsModalStepMore from 'components/trial_benefits_modal/trial_benefits_modal_step_more';

import './learn_more_trial_modal_step.scss';

export type LearnMoreTrialModalStepProps = {
    id: string;
    title: string;
    description: string;
    svgWrapperClassName: string;
    svgElement: React.ReactNode;
    bottomLeftMessage?: string;
    pageURL?: string;
    buttonLabel?: string;
    handleOnClose?: () => void;
}

const LearnMoreTrialModalStep = (
    {
        id,
        title,
        description,
        svgWrapperClassName,
        svgElement,
        bottomLeftMessage,
        pageURL,
        buttonLabel,
        handleOnClose,
    }: LearnMoreTrialModalStepProps) => {
    return (
        <div
            id={`learnMoreTrialModalStep-${id}`}
            className='LearnMoreTrialModalStep slide-container'
        >
            <div className={`${svgWrapperClassName} svg-wrapper`}>
                {svgElement}
            </div>
            <div className='title'>
                {title}
            </div>
            <div className='description'>
                {description}
            </div>
            {(pageURL && buttonLabel) && (
                <TrialBenefitsModalStepMore
                    id={id}
                    route={pageURL}
                    message={buttonLabel}
                    onClick={handleOnClose}
                    styleLink={true}
                    telemetryId={'learn_more_trial_modal'}
                />
            )}
            {bottomLeftMessage && (
                <div className='bottom-text-left-message'>
                    {bottomLeftMessage}
                </div>
            )}
        </div>
    );
};

export default LearnMoreTrialModalStep;
