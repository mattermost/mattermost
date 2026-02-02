// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage, defineMessages} from 'react-intl';

import type {AdminConfig} from '@mattermost/types/config';
import type {DeepPartial} from '@mattermost/types/utilities';

import type {ActionResult} from 'mattermost-redux/types/actions';

import FeatureFlags from './feature_flags';

export const messages = defineMessages({
    title: {id: 'admin.mattermost_extended.features.title', defaultMessage: 'Features'},
});

// List of feature flags that belong to Mattermost Extended
const MATTERMOST_EXTENDED_FLAGS = [
    'Encryption',
    'CustomChannelIcons',
    'ThreadsInSidebar',
    'CustomThreadNames',
    'GuildedSounds',
    'DiscordReplies',
    'ErrorLogDashboard',
    'SystemConsoleTheming',
];

type Props = {
    config: AdminConfig;
    patchConfig: (config: DeepPartial<AdminConfig>) => Promise<ActionResult>;
    disabled?: boolean;
};

const MattermostExtendedFeatures: React.FC<Props> = (props) => {
    return (
        <FeatureFlags
            {...props}
            allowedFlags={MATTERMOST_EXTENDED_FLAGS}
            title={<FormattedMessage {...messages.title}/>}
            introBanner={
                <FormattedMessage
                    id='admin.mattermost_extended.features.introBanner'
                    defaultMessage='Toggle Mattermost Extended features on or off. Changes take effect after saving.'
                />
            }
            showStatusBadge={true}
        />
    );
};

export default MattermostExtendedFeatures;
