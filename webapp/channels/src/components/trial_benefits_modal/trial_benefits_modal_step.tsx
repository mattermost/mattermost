// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import TrialBenefitsModalStepMore from './trial_benefits_modal_step_more';

import './trial_benefits_modal_step.scss';

export type TrialBenefitsModalStepProps = {
    id: string;
    title: string;
    description: string | JSX.Element;
    svgWrapperClassName: string;
    svgElement: React.ReactNode;
    bottomLeftMessage?: string;
    buttonLabel?: string;
    pageURL?: string;
    isCloud?: boolean;
    onClose?: () => void;
}

const TrialBenefitsModalStep = (
    {
        id,
        title,
        description,
        svgWrapperClassName,
        svgElement,
        bottomLeftMessage,
        buttonLabel,
        pageURL,
        onClose,
    }: TrialBenefitsModalStepProps) => {
    return (
        <div
            id={`trialBenefitsModalStep-${id}`}
            className='TrialBenefitsModalStep slide-container'
        >
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
                    onClick={onClose}
                />
            )}
            <div className={`${svgWrapperClassName} svg-wrapper`}>
                {svgElement}
            </div>
            {bottomLeftMessage && (
                <div className='bottom-text-left-message'>
                    {bottomLeftMessage}
                </div>
            )}
        </div>
    );
};

export default TrialBenefitsModalStep;
