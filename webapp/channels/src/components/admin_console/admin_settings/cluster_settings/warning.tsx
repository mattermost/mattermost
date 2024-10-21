// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import ExternalLink from 'components/external_link';
import WarningIcon from 'components/widgets/icons/fa_warning_icon';

import {DocLinks} from 'utils/constants';

const style = {marginBottom: 10};
type Props = {
    showWarning: boolean;
}

const linkRenderer = (msg: string) => (
    <ExternalLink
        location='cluster_settings'
        href={DocLinks.HIGH_AVAILABILITY_CLUSTER}
    >
        {msg}
    </ExternalLink>
);

const Warning = ({
    showWarning,
}: Props) => {
    if (!showWarning) {
        return null;
    }
    return (
        <div
            style={style}
            className='alert alert-warning'
        >
            <WarningIcon/>
            <FormattedMessage
                id='admin.cluster.should_not_change'
                defaultMessage='WARNING: These settings may not sync with the other servers in the cluster. High Availability inter-node communication will not start until you modify the config.json to be identical on all servers and restart Mattermost. Please see the <link>documentation</link> on how to add or remove a server from the cluster. If you are accessing the System Console through a load balancer and experiencing issues, please see the Troubleshooting Guide in our <link>documentation</link>.'
                values={{
                    link: linkRenderer,
                }}
            />
        </div>
    );
};

export default Warning;
