// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ComponentProps} from 'react';
import React from 'react';
import {FormattedMessage} from 'react-intl';

import BooleanSetting from 'components/admin_console/boolean_setting';
import ExternalLink from 'components/external_link';

import {DocLinks} from 'utils/constants';

import {FIELD_IDS} from './constants';
import {messages} from './messages';

import {useIsSetByEnv} from '../hooks';

const label = <FormattedMessage {...messages.disableDatabaseSearchTitle}/>;
const helpText = (
    <FormattedMessage
        {...messages.disableDatabaseSearchDescription}
        values={{
            link: (msg) => (
                <ExternalLink
                    location='database_settings'
                    href={DocLinks.ELASTICSEARCH}
                >
                    {msg}
                </ExternalLink>
            ),
        }}
    />
);

type Props = {
    value: ComponentProps<typeof BooleanSetting>['value'];
    onChange: ComponentProps<typeof BooleanSetting>['onChange'];
    isDisabled?: boolean;
}
const DisableDatabaseSearch = ({
    value,
    onChange,
    isDisabled,
}: Props) => {
    const setByEnv = useIsSetByEnv('SqlSettings.DisableDatabaseSearch');
    return (
        <BooleanSetting
            id={FIELD_IDS.DISABLE_DATABASE_SEARCH}
            label={label}
            helpText={helpText}
            value={value}
            onChange={onChange}
            setByEnv={setByEnv}
            disabled={isDisabled}
        />
    );
};

export default DisableDatabaseSearch;
