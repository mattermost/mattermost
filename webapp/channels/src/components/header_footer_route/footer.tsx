// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useIntl} from 'react-intl';
import {useSelector} from 'react-redux';

import {getConfig} from 'mattermost-redux/selectors/entities/general';

import './footer.scss';

const Footer = () => {
    const {formatMessage} = useIntl();

    const {AboutLink, PrivacyPolicyLink, TermsOfServiceLink, HelpLink} = useSelector(getConfig);

    return (
        <div className='hfroute-footer'>
            <span
                key='footer-copyright'
                className='footer-copyright'
            >
                {`© ${new Date().getFullYear()} Mattermost Inc.`}
            </span>
            {AboutLink && (
                <a
                    key='footer-link-about'
                    className='footer-link'
                    href={AboutLink}
                    target='_blank'
                    rel='noopener noreferrer'
                >
                    {formatMessage({id: 'web.footer.about', defaultMessage: 'About'})}
                </a>
            )}
            {PrivacyPolicyLink && (
                <a
                    key='footer-link-privacy'
                    className='footer-link'
                    href={PrivacyPolicyLink}
                    target='_blank'
                    rel='noopener noreferrer'
                >
                    {formatMessage({id: 'web.footer.privacy', defaultMessage: 'Privacy Policy'})}
                </a>
            )}
            {TermsOfServiceLink && (
                <a
                    key='footer-link-terms'
                    className='footer-link'
                    href={TermsOfServiceLink}
                    target='_blank'
                    rel='noopener noreferrer'
                >
                    {formatMessage({id: 'web.footer.terms', defaultMessage: 'Terms'})}
                </a>
            )}
            {HelpLink && (
                <a
                    key='footer-link-help'
                    className='footer-link'
                    href={HelpLink}
                    target='_blank'
                    rel='noopener noreferrer'
                >
                    {formatMessage({id: 'web.footer.help', defaultMessage: 'Help'})}
                </a>
            )}
        </div>
    );
};

export default Footer;
