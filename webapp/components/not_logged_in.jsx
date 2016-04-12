// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import $ from 'jquery';
import {FormattedMessage} from 'react-intl';

import React from 'react';
import {Link} from 'react-router';

export default class NotLoggedIn extends React.Component {
    componentDidMount() {
        $('body').addClass('sticky');
        $('#root').addClass('container-fluid');
    }
    componentWillUnmount() {
        $('body').removeClass('sticky');
        $('#root').removeClass('container-fluid');
    }
    render() {
        return (
            <div className='inner-wrap'>
                <div className='row content'>
                    {this.props.children}
                    <div className='footer-push'></div>
                </div>
                <div className='row footer'>
                    <div className='footer-pane col-xs-12'>
                        <div className='col-xs-12'>
                            <span className='pull-right footer-site-name'>{global.window.mm_config.SiteName}</span>
                        </div>
                        <div className='col-xs-12'>
                            <span className='pull-right footer-link copyright'>{'© 2015 Mattermost, Inc.'}</span>
                            <Link
                                id='help_link'
                                className='pull-right footer-link'
                                to={global.window.mm_config.HelpLink}
                            >
                                <FormattedMessage id='web.footer.help'/>
                            </Link>
                            <Link
                                id='terms_link'
                                className='pull-right footer-link'
                                to={global.window.mm_config.TermsOfServiceLink}
                            >
                                <FormattedMessage id='web.footer.terms'/>
                            </Link>
                            <Link
                                id='privacy_link'
                                className='pull-right footer-link'
                                to={global.window.mm_config.PrivacyPolicyLink}
                            >
                                <FormattedMessage id='web.footer.privacy'/>
                            </Link>
                            <Link
                                id='about_link'
                                className='pull-right footer-link'
                                to={global.window.mm_config.AboutLink}
                            >
                                <FormattedMessage id='web.footer.about'/>
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        );
    }
}

NotLoggedIn.defaultProps = {
};

NotLoggedIn.propTypes = {
    children: React.PropTypes.object
};
