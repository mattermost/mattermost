// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useEffect} from 'react';
import {useIntl} from 'react-intl';
import {useHistory} from 'react-router-dom';

import {trackEvent} from 'actions/telemetry_actions';

import AccessProblemSVG from 'components/common/svg_images_components/access_problem_svg';
import type {CustomizeHeaderType} from 'components/header_footer_route/header_footer_route';

import './access_problem.scss';

type AccessProblemProps = {
    onCustomizeHeader?: CustomizeHeaderType;
}

const AccessProblem = ({
    onCustomizeHeader,
}: AccessProblemProps) => {
    const {formatMessage} = useIntl();
    const history = useHistory();

    const handleHeaderBackButtonOnClick = useCallback(() => {
        trackEvent('access_problem', 'click_back');
        history.goBack();
    }, [history]);

    useEffect(() => {
        trackEvent('signup', 'click_login_no_account__closed_server');
    }, []);

    useEffect(() => {
        if (onCustomizeHeader) {
            onCustomizeHeader({
                onBackButtonClick: handleHeaderBackButtonOnClick,
            });
        }
    }, [onCustomizeHeader, handleHeaderBackButtonOnClick]);

    return (
        <div className='AccessProblem__body'>
            <AccessProblemSVG/>
            <div className='AccessProblem__title'>
                {formatMessage({id: 'login.contact_admin.title'})}
            </div>
            <div className='AccessProblem__description'>
                {formatMessage({id: 'login.contact_admin.detail'})}
            </div>
        </div>
    );
};

export default AccessProblem;
