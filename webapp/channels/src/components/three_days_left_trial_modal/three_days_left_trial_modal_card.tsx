// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {TELEMETRY_CATEGORIES} from 'utils/constants';

import LearnMoreActionButton from './learn_more_action_button';

import './three_days_left_trial_modal.scss';

export type ThreeDaysLeftTrialCardProps = {
    id: string;
    title: string;
    description: string | JSX.Element;
    svgWrapperClassName: string;
    svgElement: React.ReactNode;
    buttonLabel?: string;
    pageURL?: string;
    isCloud?: boolean;
    onClose?: () => void;
}

const ThreeDaysLeftTrialCard = (
    {
        id,
        title,
        description,
        svgWrapperClassName,
        svgElement,
        buttonLabel,
        pageURL,
        onClose,
    }: ThreeDaysLeftTrialCardProps) => {
    return (
        <div
            id={`threeDaysLeftTrialCard-${id}`}
            className='three-days-left-card slide-container'
        >
            <div className={`${svgWrapperClassName} svg-wrapper`}>
                {svgElement}
            </div>
            <div className='content-wrapper'>
                <div className='title'>
                    {title}
                </div>
                <div className='description'>
                    {description}
                    {(pageURL && buttonLabel) && (
                        <LearnMoreActionButton
                            id={id}
                            route={pageURL}
                            message={buttonLabel}
                            onClick={onClose}
                            telemetryCategory={TELEMETRY_CATEGORIES.CLOUD_THREE_DAYS_LEFT_MODAL}
                            telemetryId={'three_days_left_trial'}
                        />
                    )}
                </div>
            </div>
        </div>
    );
};

export default ThreeDaysLeftTrialCard;
