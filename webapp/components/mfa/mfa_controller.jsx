// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import {emitUserLoggedOutEvent} from 'actions/global_actions.jsx';

import PropTypes from 'prop-types';

import React from 'react';
import {FormattedMessage} from 'react-intl';
import {browserHistory, Link} from 'react-router/es6';

import logoImage from 'images/logo.png';

export default class MFAController extends React.Component {
    componentDidMount() {
        if (window.mm_license.MFA !== 'true' || window.mm_config.EnableMultifactorAuthentication !== 'true') {
            browserHistory.push('/');
        }
    }

    render() {
        let backButton;
        if (window.mm_config.EnforceMultifactorAuthentication === 'true') {
            backButton = (
                <div className='signup-header'>
                    <a
                        href='#'
                        onClick={(e) => {
                            e.preventDefault();
                            emitUserLoggedOutEvent('/login');
                        }}
                    >
                        <span className='fa fa-chevron-left'/>
                        <FormattedMessage
                            id='web.header.logout'
                            defaultMessage='Logout'
                        />
                    </a>
                </div>
            );
        } else {
            backButton = (
                <div className='signup-header'>
                    <Link to='/'>
                        <span className='fa fa-chevron-left'/>
                        <FormattedMessage
                            id='web.header.back'
                            defaultMessage='Back'
                        />
                    </Link>
                </div>
            );
        }

        return (
            <div className='inner-wrap sticky'>
                <div className='content'>
                    <div>
                        {backButton}
                        <div className='col-sm-12'>
                            <div className='signup-team__container'>
                                <h3>
                                    <FormattedMessage
                                        id='mfa.setupTitle'
                                        defaultMessage='Multi-factor Authentication Setup'
                                    />
                                </h3>
                                <img
                                    className='signup-team-logo'
                                    src={logoImage}
                                />
                                <div id='mfa'>
                                    {React.cloneElement(this.props.children, {})}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }
}

MFAController.defaultProps = {
};
MFAController.propTypes = {
    location: PropTypes.object.isRequired,
    children: PropTypes.node
};
