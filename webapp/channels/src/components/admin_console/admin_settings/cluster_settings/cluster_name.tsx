// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ComponentProps} from 'react';
import React from 'react';
import {defineMessage, FormattedMessage} from 'react-intl';

import TextSetting from 'components/admin_console/text_setting';

import {FIELD_IDS} from './constants';
import {messages} from './messages';

import {useIsSetByEnv} from '../hooks';

const label = <FormattedMessage {...messages.clusterName}/>;
const helpText = <FormattedMessage {...messages.clusterNameDesc}/>;
const placeholder = defineMessage({
    id: 'admin.cluster.ClusterNameEx',
    defaultMessage: 'E.g.: "Production" or "Staging"',
});

type Props = {
    value: ComponentProps<typeof TextSetting>['value'];
    onChange: ComponentProps<typeof TextSetting>['onChange'];
    isDisabled?: ComponentProps<typeof TextSetting>['disabled'];
}

const ClusterName = ({
    onChange,
    value,
    isDisabled,
}: Props) => {
    const setByEnv = useIsSetByEnv('ClusterSettings.ClusterName');
    return (
        <TextSetting
            id={FIELD_IDS.CLUSTER_NAME}
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

export default ClusterName;
