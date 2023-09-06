// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect} from 'react';
import {useIntl} from 'react-intl';
import {useSelector} from 'react-redux';

import {getConfig} from 'mattermost-redux/selectors/entities/general';

import ExternalLink from 'components/external_link';

type Props = {
    children?: React.ReactNode | React.ReactNodeArray;
}

const HeaderFooterNotLoggedIn = (props: Props) => {
    const intl = useIntl();
    const {formatMessage} = intl;
    const config = useSelector(getConfig);

    useEffect(() => {
        document.body.classList.add('sticky');
        const rootElement: HTMLElement | null = document.getElementById('root');
        if (rootElement) {
            rootElement.classList.add('container-fluid');
        }

        return () => {
            document.body.classList.remove('sticky');
            const rootElement: HTMLElement | null = document.getElementById('root');
            if (rootElement) {
                rootElement.classList.remove('container-fluid');
            }
        };
    }, []);

    if (!config) {
        return null;
    }

    const content = [];

    if (config.AboutLink) {
        content.push(
            <ExternalLink
                key='about_link'
                id='about_link'
                className='footer-link'
                location='header_footer_template'
                href={config.AboutLink}
            >
                {formatMessage({id: 'web.footer.about', defaultMessage: 'About'})}
            </ExternalLink>,
        );
    }

    if (config.PrivacyPolicyLink) {
        content.push(
            <ExternalLink
                key='privacy_link'
                id='privacy_link'
                className='footer-link'
                location='header_footer_template'
                href={config.PrivacyPolicyLink}
            >
                {formatMessage({id: 'web.footer.privacy', defaultMessage: 'Privacy Policy'})}
            </ExternalLink>,
        );
    }

    if (config.TermsOfServiceLink) {
        content.push(
            <ExternalLink
                key='terms_link'
                id='terms_link'
                className='footer-link'
                location='header_footer_template'
                href={config.TermsOfServiceLink}
            >
                {formatMessage({id: 'web.footer.terms', defaultMessage: 'Terms'})}
            </ExternalLink>,
        );
    }

    if (config.HelpLink) {
        content.push(
            <ExternalLink
                key='help_link'
                id='help_link'
                className='footer-link'
                location='header_footer_template'
                href={config.HelpLink}
            >
                {formatMessage({id: 'web.footer.help', defaultMessage: 'Help'})}
            </ExternalLink>,
        );
    }

    return (
        <div className='inner-wrap'>
            <div className='row content'>
                {props.children}
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
};

export default HeaderFooterNotLoggedIn;
