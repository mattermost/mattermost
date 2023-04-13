// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect} from 'react';
import {useIntl} from 'react-intl';

import {trackEvent} from 'actions/telemetry_actions';

import AccessProblemSVG from 'components/common/svg_images_components/access_problem_svg';

import './access_problem.scss';

const AccessProblem = () => {
    const {formatMessage} = useIntl();
    useEffect(() => {
        trackEvent('signup', 'click_login_no_account__closed_server');
    }, []);
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
