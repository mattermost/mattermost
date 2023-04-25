// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback} from 'react';
import {useHistory} from 'react-router-dom';

import {trackEvent} from 'actions/telemetry_actions';

import './three_days_left_trial_modal.scss';

export type LearnMoreActionButtonProps = {
    id: string;
    route: string;
    message: string;
    telemetryCategory: string;
    telemetryId: string;
    onClick?: () => void;
    styleLink?: boolean; // show as a anchor link
}

const LearnMoreActionButton = (
    {
        id,
        route,
        message,
        onClick,
        styleLink = false,
        telemetryId,
        telemetryCategory,
    }: LearnMoreActionButtonProps) => {
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

        trackEvent(
            telemetryCategory,
            telemetryId + '_section_opened_' + id,
        );
    }, [route, onClick]);

    return (
        <a
            className={`LearnMoreActionButton ${styleLink ? '' : 'learn-more-button'}`}
            onClick={redirect}
        >
            {message}
        </a>
    );
};

export default LearnMoreActionButton;
