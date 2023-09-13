// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';
import {useSelector} from 'react-redux';

import {deprecateCloudFree} from 'mattermost-redux/selectors/entities/preferences';

import ExternalLink from 'components/external_link';
import TrialBenefitsModalStepMore from 'components/trial_benefits_modal/trial_benefits_modal_step_more';

import {AboutLinks, LicenseLinks} from 'utils/constants';

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
    const cloudFreeDeprecated = useSelector(deprecateCloudFree);
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
            {
                cloudFreeDeprecated ? '' : (
                    <div className='disclaimer'>
                        <span>
                            <FormattedMessage
                                id='start_trial.modal.disclaimer'
                                defaultMessage='By clicking “Start trial”, I agree to the <linkEvaluation>Mattermost Software and Services License Agreement</linkEvaluation>, <linkPrivacy>privacy policy</linkPrivacy> and receiving product emails.'
                                values={{
                                    linkEvaluation: (msg: React.ReactNode) => (
                                        <ExternalLink
                                            href={LicenseLinks.SOFTWARE_SERVICES_LICENSE_AGREEMENT}
                                            location='learn_more_trial_modal_step'
                                        >
                                            {msg}
                                        </ExternalLink>
                                    ),
                                    linkPrivacy: (msg: React.ReactNode) => (
                                        <ExternalLink
                                            href={AboutLinks.PRIVACY_POLICY}
                                            location='learn_more_trial_modal_step'
                                        >
                                            {msg}
                                        </ExternalLink>
                                    ),
                                }}
                            />
                        </span>
                    </div>
                )
            }
            {bottomLeftMessage && (
                <div className='bottom-text-left-message'>
                    {bottomLeftMessage}
                </div>
            )}
        </div>
    );
};

export default LearnMoreTrialModalStep;
