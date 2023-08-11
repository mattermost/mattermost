// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import PropTypes from 'prop-types';

import type {ClientConfig} from '@mattermost/types/config';

import ExternalLink from 'components/external_link';

import {localizeMessage} from 'utils/utils';

type Props = {
    config: Partial<ClientConfig> | undefined;
}

export default class NotLoggedIn extends React.PureComponent<Props> {
    static propTypes = {

        /*
         * Content of the page
         */
        children: PropTypes.object,

        /*
         * Mattermost configuration
         */
        config: PropTypes.object,
    };

    componentDidMount() {
        document.body.classList.add('sticky');
        const rootElement: HTMLElement | null = document.getElementById('root');
        if (rootElement) {
            rootElement.classList.add('container-fluid');
        }
    }
    componentWillUnmount() {
        document.body.classList.remove('sticky');
        const rootElement: HTMLElement | null = document.getElementById('root');
        if (rootElement) {
            rootElement.classList.remove('container-fluid');
        }
    }

    render() {
        const content = [];

        if (!this.props.config) {
            return null;
        }

        if (this.props.config.AboutLink) {
            content.push(
                <ExternalLink
                    key='about_link'
                    id='about_link'
                    className='footer-link'
                    location='header_footer_template'
                    href={this.props.config.AboutLink}
                >
                    {localizeMessage('web.footer.about', 'About')}
                </ExternalLink>,
            );
        }

        if (this.props.config.PrivacyPolicyLink) {
            content.push(
                <ExternalLink
                    key='privacy_link'
                    id='privacy_link'
                    className='footer-link'
                    location='header_footer_template'
                    href={this.props.config.PrivacyPolicyLink}
                >
                    {localizeMessage('web.footer.privacy', 'Privacy Policy')}
                </ExternalLink>,
            );
        }

        if (this.props.config.TermsOfServiceLink) {
            content.push(
                <ExternalLink
                    key='terms_link'
                    id='terms_link'
                    className='footer-link'
                    location='header_footer_template'
                    href={this.props.config.TermsOfServiceLink}
                >
                    {localizeMessage('web.footer.terms', 'Terms')}
                </ExternalLink>,
            );
        }

        if (this.props.config.HelpLink) {
            content.push(
                <ExternalLink
                    key='help_link'
                    id='help_link'
                    className='footer-link'
                    location='header_footer_template'
                    href={this.props.config.HelpLink}
                >
                    {localizeMessage('web.footer.help', 'Help')}
                </ExternalLink>,
            );
        }

        return (
            <div className='inner-wrap'>
                <div className='row content'>
                    {this.props.children}
                </div>
                <div className='row footer'>
                    <div
                        id='footer_section'
                        className='footer-pane col-xs-12'
                    >
                        <div className='col-xs-12'>
                            <span
                                id='company_name'
                                className='pull-right footer-site-name'
                            >
                                {'Mattermost'}
                            </span>
                        </div>
                        <div className='col-xs-12'>
                            <span
                                id='copyright'
                                className='pull-right footer-link copyright'
                            >
                                {`© 2015-${new Date().getFullYear()} Mattermost, Inc.`}
                            </span>
                            <span className='pull-right'>
                                {content}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        );
    }
}

