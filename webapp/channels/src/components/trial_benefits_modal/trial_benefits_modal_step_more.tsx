// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback} from 'react';
import {useHistory} from 'react-router-dom';

import './trial_benefits_modal_step_more.scss';

export type TrialBenefitsModalStepMoreProps = {
    route: string;
    message: string;
    onClick?: () => void;
    styleLink?: boolean; // show as a anchor link
}

const TrialBenefitsModalStepMore = (
    {
        route,
        message,
        onClick,
        styleLink = false,
    }: TrialBenefitsModalStepMoreProps) => {
    const history = useHistory();

    const redirect = useCallback(() => {
        if (route.indexOf('http://') === 0 || route.indexOf('https://') === 0) {
            window.open(route);
        } else {
            history.push(route);
        }

        if (onClick) {
            onClick();
        }
    }, [route, onClick]);

    return (
        <a
            className={`TrialBenefitsModalStepMore ${styleLink ? '' : 'learn-more-button'}`}
            onClick={redirect}
        >
            {message}
        </a>
    );
};

export default TrialBenefitsModalStepMore;
