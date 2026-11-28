// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useIntl} from 'react-intl';
import {useSelector} from 'react-redux';

import {getConfig} from 'mattermost-redux/selectors/entities/general';

import './footer.scss';
import ExternalLink from 'components/external_link';

const Footer = () => {
    const {formatMessage} = useIntl();

    const {AboutLink, PrivacyPolicyLink, TermsOfServiceLink, HelpLink} = useSelector(getConfig);

    // Check if MMEMBED cookie is set and if so, don't show the footer
    if (document.cookie.includes('MMEMBED=1')) {
        return null;
    }

    return (
        <div
            data-testid='public.footer'
            className='hfroute-footer'
        >
            <span
                key='footer-copyright'
                className='footer-copyright'
                data-testid='public.footer.copyright--text'
            >
                {`© ${new Date().getFullYear()} Mattermost Inc.`}
            </span>
            {AboutLink && (
                <ExternalLink
                    key='footer-link-about'
                    className='footer-link'
                    data-testid='public.footer.link:about--link'
                    href={AboutLink}
                    location='footer'
                >
                    {formatMessage({id: 'web.footer.about', defaultMessage: 'About'})}
                </ExternalLink>
            )}
            {PrivacyPolicyLink && (
                <ExternalLink
                    key='footer-link-privacy'
                    className='footer-link'
                    data-testid='public.footer.link:privacy--link'
                    href={PrivacyPolicyLink}
                    location='footer'
                >
                    {formatMessage({id: 'web.footer.privacy', defaultMessage: 'Privacy Policy'})}
                </ExternalLink>
            )}
            {TermsOfServiceLink && (
                <ExternalLink
                    key='footer-link-terms'
                    className='footer-link'
                    data-testid='public.footer.link:terms--link'
                    href={TermsOfServiceLink}
                    location='footer'
                >
                    {formatMessage({id: 'web.footer.terms', defaultMessage: 'Terms'})}
                </ExternalLink>
            )}
            {HelpLink && (
                <ExternalLink
                    key='footer-link-help'
                    className='footer-link'
                    data-testid='public.footer.link:help--link'
                    href={HelpLink}
                    location='footer'
                >
                    {formatMessage({id: 'web.footer.help', defaultMessage: 'Help'})}
                </ExternalLink>
            )}
        </div>
    );
};

export default Footer;
