// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {FormattedMessage, useIntl} from 'react-intl';
import {Link} from 'react-router-dom';

import * as I18n from 'i18n/i18n';

import {useQuery} from 'utils/http_utils';

import {HelpLink} from 'components/help/types';

type Props = {
    excludedLinks?: HelpLink[];
}

type HelpLinkContent = {
    path: string;
    message: string;
}

const HelpLinks: React.FC<Props> = ({excludedLinks = []}: Props) => {
    // If the current page has locale query param in it, we want to preserve it when navigating to any of the help pages
    let localeQueryParam = '';
    const currentLocaleFromQueryParam = useQuery().get('locale');
    if (currentLocaleFromQueryParam && I18n.isLanguageAvailable(currentLocaleFromQueryParam)) {
        localeQueryParam = `?locale=${currentLocaleFromQueryParam}`;
    }

    const {formatMessage} = useIntl();

    const HELP_LINK_CONTENT: {[key in HelpLink]: HelpLinkContent} = {
        [HelpLink.Messaging]: {
            path: '/help/messaging',
            message: formatMessage({
                id: 'help.link.messaging',
                defaultMessage: 'Basic Messaging',
            }),
        },
        [HelpLink.Composing]: {
            path: '/help/composing',
            message: formatMessage({
                id: 'help.link.composing',
                defaultMessage: 'Composing Messages and Replies',
            }),
        },
        [HelpLink.Mentioning]: {
            path: '/help/mentioning',
            message: formatMessage({
                id: 'help.link.mentioning',
                defaultMessage: 'Mentioning Teammates',
            }),
        },
        [HelpLink.Formatting]: {
            path: '/help/formatting',
            message: formatMessage({
                id: 'help.link.formatting',
                defaultMessage: 'Formatting Messages Using Markdown',
            }),
        },
        [HelpLink.Attaching]: {
            path: '/help/attaching',
            message: formatMessage({
                id: 'help.link.attaching',
                defaultMessage: 'Attaching Files',
            }),
        },
        [HelpLink.Commands]: {
            path: '/help/commands',
            message: formatMessage({
                id: 'help.link.commands',
                defaultMessage: 'Executing Commands',
            }),
        },
    };

    const linksToBeRendered: HelpLink[] = Object.values(HelpLink).
        filter((link: HelpLink) => !excludedLinks.includes(link));

    return (
        <>
            <p className='links'>
                <FormattedMessage
                    id='help.learnMore'
                    defaultMessage='Learn more about:'
                />
            </p>
            <ul>
                {
                    linksToBeRendered.map((linkType: HelpLink) => {
                        const {path, message}: HelpLinkContent = HELP_LINK_CONTENT[linkType];

                        return (
                            <li key={linkType}>
                                <Link to={`${path}${localeQueryParam}`}>
                                    {message}
                                </Link>
                            </li>
                        );
                    })
                }
            </ul>
        </>
    );
};

export default HelpLinks;
