// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useEffect} from 'react';
import {useIntl} from 'react-intl';
import {useHistory} from 'react-router-dom';

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
        history.goBack();
    }, [history]);

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
