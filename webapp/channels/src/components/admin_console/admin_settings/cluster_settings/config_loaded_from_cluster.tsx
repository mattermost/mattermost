// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import {Client4} from 'mattermost-redux/client';

import ExternalLink from 'components/external_link';
import WarningIcon from 'components/widgets/icons/fa_warning_icon';

import {DocLinks} from 'utils/constants';

const linkRenderer = (msg: string) => (
    <ExternalLink
        location='cluster_settings'
        href={DocLinks.HIGH_AVAILABILITY_CLUSTER}
    >
        {msg}
    </ExternalLink>
);

const style = {marginBottom: 10};

const ConfigLoadedFromCluster = () => {
    if (!Client4.clusterId) {
        return null;
    }

    return (
        <div
            style={style}
            className='alert alert-warning'
        >
            <WarningIcon/>
            <FormattedMessage
                id='admin.cluster.loadedFrom'
                defaultMessage='This configuration file was loaded from Node ID {clusterId}. Please see the Troubleshooting Guide in our <link>documentation</link> if you are accessing the System Console through a load balancer and experiencing issues.'
                values={{
                    clusterId: Client4.clusterId,
                    link: linkRenderer,
                }}
            />
        </div>
    );
};

export default ConfigLoadedFromCluster;
