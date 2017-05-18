// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import $ from 'jquery';
import {FormattedMessage} from 'react-intl';

import PropTypes from 'prop-types';

import React from 'react';

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
        const content = [];

        if (global.window.mm_config.HelpLink) {
            content.push(
                <a
                    key='help_link'
                    id='help_link'
                    className='pull-right footer-link'
                    target='_blank'
                    rel='noopener noreferrer'
                    href={global.window.mm_config.HelpLink}
                >
                    <FormattedMessage id='web.footer.help'/>
                </a>
            );
        }

        content.push(
            <a
                key='terms_link'
                id='terms_link'
                className='pull-right footer-link'
                target='_blank'
                rel='noopener noreferrer'
                href={global.window.mm_config.TermsOfServiceLink}
            >
                <FormattedMessage id='web.footer.terms'/>
            </a>
        );

        if (global.window.mm_config.PrivacyPolicyLink) {
            content.push(
                <a
                    key='privacy_link'
                    id='privacy_link'
                    className='pull-right footer-link'
                    target='_blank'
                    rel='noopener noreferrer'
                    href={global.window.mm_config.PrivacyPolicyLink}
                >
                    <FormattedMessage id='web.footer.privacy'/>
                </a>
            );
        }

        if (global.window.mm_config.AboutLink) {
            content.push(
                <a
                    key='about_link'
                    id='about_link'
                    className='pull-right footer-link'
                    target='_blank'
                    rel='noopener noreferrer'
                    href={global.window.mm_config.AboutLink}
                >
                    <FormattedMessage id='web.footer.about'/>
                </a>
            );
        }

        return (
            <div className='inner-wrap'>
                <div className='row content'>
                    {this.props.children}
                    <div className='footer-push'/>
                </div>
                <div className='row footer'>
                    <div className='footer-pane col-xs-12'>
                        <div className='col-xs-12'>
                            <span className='pull-right footer-site-name'>{'Mattermost'}</span>
                        </div>
                        <div className='col-xs-12'>
                            <span className='pull-right footer-link copyright'>
                                {`© 2015-${new Date().getFullYear()} Mattermost, Inc.`}
                            </span>
                            {content}
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
    children: PropTypes.object
};
