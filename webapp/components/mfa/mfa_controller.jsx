// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';
import {browserHistory, Link} from 'react-router/es6';

import $ from 'jquery';
import logoImage from 'images/logo.png';

export default class MFAController extends React.Component {
    componentDidMount() {
        if (window.mm_license.MFA !== 'true' || window.mm_config.EnableMultifactorAuthentication !== 'true') {
            browserHistory.push('/');
        }

        $('body').attr('class', 'sticky');
        $('#root').attr('class', 'container-fluid');
    }

    render() {
        return (
            <div className='inner-wrap'>
                <div className='row content'>
                    <div>
                        <div className='signup-header'>
                            <Link to='/'>
                                <span className='fa fa-chevron-left'/>
                                <FormattedMessage
                                    id='web.header.back'
                                />
                            </Link>
                        </div>
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
    location: React.PropTypes.object.isRequired,
    children: React.PropTypes.node
};
