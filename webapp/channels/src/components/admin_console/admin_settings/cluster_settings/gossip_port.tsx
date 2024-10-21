// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ComponentProps} from 'react';
import React from 'react';
import {defineMessage, FormattedMessage} from 'react-intl';

import TextSetting from 'components/admin_console/text_setting';

import {FIELD_IDS} from './constants';
import {messages} from './messages';

import {useIsSetByEnv} from '../hooks';

const label = <FormattedMessage {...messages.gossipPort}/>;
const helpText = <FormattedMessage {...messages.gossipPortDesc}/>;
const placeholder = defineMessage({
    id: 'admin.cluster.GossipPortEx',
    defaultMessage: 'E.g.: "8074"',
});

type Props = {
    value: ComponentProps<typeof TextSetting>['value'];
    onChange: ComponentProps<typeof TextSetting>['onChange'];
    isDisabled?: ComponentProps<typeof TextSetting>['disabled'];
}

const GossipPort = ({
    onChange,
    value,
    isDisabled,
}: Props) => {
    const setByEnv = useIsSetByEnv('ClusterSettings.GossipPort');
    return (
        <TextSetting
            id={FIELD_IDS.GOSSIP_PORT}
            placeholder={placeholder}
            label={label}
            helpText={helpText}
            value={value}
            onChange={onChange}
            setByEnv={setByEnv}
            disabled={isDisabled}
        />
    );
};

export default GossipPort;
