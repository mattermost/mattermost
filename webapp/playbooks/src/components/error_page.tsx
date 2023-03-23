
// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect} from 'react';
import {Link, useLocation} from 'react-router-dom';

import qs from 'qs';

import {FormattedMessage} from 'react-intl';

import WarningIcon from 'src/components/assets/icons/warning_icon';
import {ErrorPageTypes} from 'src/constants';
import {pluginUrl} from 'src/browser_routing';

const ErrorPage = () => {
    useEffect(() => {
        document.body.classList.add('error');
        return () => {
            document.body.classList.remove('error');
        };
    }, []);

    const queryString = useLocation().search.substr(1);
    const params = qs.parse(queryString);

    let title: React.ReactNode = 'Page not found';
    let message: React.ReactNode = 'The page you were trying to reach does not exist.';
    let returnTo = '/';
    let returnToMsg: React.ReactNode = 'Back to Mattermost';

    switch (params.type) {
    case ErrorPageTypes.PLAYBOOK_RUNS:
        title = <FormattedMessage defaultMessage='Run not found'/>;
        message = <FormattedMessage defaultMessage="The run you're requesting is private or does not exist."/>;
        returnTo = pluginUrl('/runs');
        returnToMsg = 'Back to runs';
        break;
    case ErrorPageTypes.PLAYBOOKS:
        title = <FormattedMessage defaultMessage='Playbook Not Found'/>;
        message = <FormattedMessage defaultMessage="The playbook you're requesting is private or does not exist."/>;
        returnTo = pluginUrl('/playbooks');
        returnToMsg = <FormattedMessage defaultMessage='Back to playbooks'/>;
        break;
    }

    return (
        <div className='container-fluid'>
            <div className='error__container'>
                <div className='error__icon'>
                    <WarningIcon/>
                </div>
                <h2 data-testid='errorMessageTitle'>
                    <span>{title}</span>
                </h2>
                <p>
                    <span>{message}</span>
                </p>
                <Link to={returnTo}>
                    {returnToMsg}
                </Link>
            </div>
        </div>
    );
};

export default ErrorPage;
