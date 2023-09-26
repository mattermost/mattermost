// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import ExternalLink from 'components/external_link';
import FormattedMarkdownMessage from 'components/formatted_markdown_message';
import type {Notice} from 'components/system_notice/types';
import InfoIcon from 'components/widgets/icons/info_icon';

import {DocLinks} from 'utils/constants';
import * as ServerVersion from 'utils/server_version';
import * as UserAgent from 'utils/user_agent';

// Notices are objects with the following fields:
//  - name - string identifier
//  - adminOnly - set to true if only system admins should see this message
//  - icon - the image to display for the notice icon
//  - title - JSX node to display for the notice title
//  - body - JSX node to display for the notice body
//  - allowForget - boolean to allow forget the notice
//  - show - function that check if we need to show the notice
//
// Order is important! The notices at the top are shown first.

const notices: Notice[] = [
    {
        name: 'apiv3_deprecation',
        adminOnly: true,
        title: (
            <FormattedMessage
                id='system_notice.title'
                defaultMessage='Notice from Mattermost'
            />
        ),
        body: (
            <FormattedMessage
                id='system_notice.body.api3'
                defaultMessage='If you’ve created or installed integrations in the last two years, find out how <link>recent changes</link> may have affected them.'
                values={{
                    link: (msg: React.ReactNode) => (
                        <ExternalLink
                            href='https://api.mattermost.com/#tag/APIv3-Deprecation'
                            location='system_notices'
                        >
                            {msg}
                        </ExternalLink>
                    ),
                }}
            />
        ),
        allowForget: true,
        show: (serverVersion, config) => {
            if (config.InstallationDate >= new Date(2018, 5, 16, 0, 0, 0, 0).getTime()) {
                return false;
            }
            return true;
        },
    },
    {
        name: 'advanced_permissions',
        adminOnly: true,
        title: (
            <FormattedMessage
                id='system_notice.title'
                defaultMessage='Notice from Mattermost'
            />
        ),
        body: (
            <FormattedMessage
                id='system_notice.body.permissions'
                defaultMessage='Some policy and permission System Console settings have moved with the release of <link>advanced permissions</link> into Mattermost Free and Professional.'
                values={{
                    link: (msg: React.ReactNode) => (
                        <ExternalLink
                            href={DocLinks.ONBOARD_ADVANCED_PERMISSIONS}
                            location='system_notices'
                        >
                            {msg}
                        </ExternalLink>
                    ),
                }}
            />
        ),
        allowForget: true,
        show: (serverVersion, config, license) => {
            if (license.IsLicensed === 'false') {
                return false;
            }
            if (config.InstallationDate > new Date(2018, 5, 16, 0, 0, 0, 0).getTime()) {
                return false;
            }
            if (license.IsLicensed === 'true' && license.IssuedAt > new Date(2018, 5, 16, 0, 0, 0, 0).getTime()) {
                return false;
            }
            return true;
        },
    },
    {
        name: 'ee_upgrade_advice',
        adminOnly: true,
        title: (
            <FormattedMessage
                id='system_notice.title'
                defaultMessage='Notice from Mattermost'
            />
        ),
        body: (
            <FormattedMessage
                id='system_notice.body.ee_upgrade_advice'
                defaultMessage='Enterprise Edition is recommended to ensure optimal operation and reliability. <link>Learn more</link>.'
                values={{
                    link: (msg: React.ReactNode) => (
                        <ExternalLink
                            href='https://mattermost.com/performance'
                            location='system_notices'
                        >
                            {msg}
                        </ExternalLink>
                    ),
                }}
            />
        ),
        allowForget: false,
        show: (serverVersion, config, license, analytics) => {
            const USERS_THRESHOLD = 10000;

            // If we don't have the analytics yet, don't show
            if (!analytics?.hasOwnProperty('TOTAL_USERS')) {
                return false;
            }

            if (analytics.TOTAL_USERS < USERS_THRESHOLD) {
                return false;
            }

            if (license.IsLicensed === 'true' && license.Cluster === 'true') {
                return false;
            }

            return true;
        },
    },
    {
        name: 'ie11_deprecation',
        title: (
            <FormattedMarkdownMessage
                id='system_notice.title'
                defaultMessage='Notice from Mattermost'
            />
        ),
        allowForget: false,
        body: (
            <FormattedMessage
                id='system_notice.body.ie11_deprecation'
                defaultMessage='Your browser, IE11, will no longer be supported in an upcoming release. <link>Find out how to move to another browser in one simple step</link>.'
                values={{
                    link: (msg: React.ReactNode) => (
                        <ExternalLink
                            href='https://forum.mattermost.com/t/mattermost-is-dropping-support-for-internet-explorer-ie11-in-v5-16/7575'
                            location='system_notices'
                        >
                            {msg}
                        </ExternalLink>
                    ),
                }}
            />
        ),
        show: (serverVersion) => {
            // Don't show the notice after v5.16, show a different notice
            if (ServerVersion.isServerVersionGreaterThanOrEqualTo(serverVersion, '5.16.0')) {
                return false;
            }

            // Only show if they're using IE
            if (!UserAgent.isInternetExplorer()) {
                return false;
            }

            return true;
        },
    },
    {

        // This notice is marked as viewed by default for new users on the server.
        // Any change on this notice should be handled also in the server side.
        name: 'GMasDM',
        allowForget: true,
        title: (
            <FormattedMessage
                id='system_notice.title.gm_as_dm'
                defaultMessage='Updates to Group Messages'
            />
        ),
        icon: (<InfoIcon/>),
        body: (
            <FormattedMessage
                id='system_noticy.body.gm_as_dm'
                defaultMessage='You wil now be notified for all activity in your group messages along with a notification badge for every new message.{br}{br}You can configure this in notification preferences for each group message.'
                values={{br: (<br/>)}}
            />
        ),
        show: (serverVersion, config, license, analytics, currentChannel) => {
            return currentChannel?.type === 'G';
        },
    },
];

export default notices;
