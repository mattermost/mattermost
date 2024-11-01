// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ComponentProps} from 'react';
import React from 'react';
import {defineMessage, FormattedMessage} from 'react-intl';

import TextSetting from 'components/admin_console/text_setting';
import ExternalLink from 'components/external_link';

import {FIELD_IDS} from './constants';
import {messages} from './messages';

import {useIsSetByEnv} from '../hooks';

const label = <FormattedMessage {...messages.minimumHashtagLengthTitle}/>;
const helpText = (
    <FormattedMessage
        {...messages.minimumHashtagLengthDescription}
        values={{
            link: (msg) => (
                <ExternalLink
                    location='database_settings'
                    href='https://dev.mysql.com/doc/refman/8.0/en/fulltext-fine-tuning.html'
                >
                    {msg}
                </ExternalLink>
            ),
        }}
    />
);
const placeholder = defineMessage({
    id: 'admin.service.minimumHashtagLengthExample',
    defaultMessage: 'E.g.: "3"',
});

type Props = {
    value: ComponentProps<typeof TextSetting>['value'];
    onChange: ComponentProps<typeof TextSetting>['onChange'];
    isDisabled?: ComponentProps<typeof TextSetting>['disabled'];
}

const MinimumHashtagLength = ({
    onChange,
    value,
    isDisabled,
}: Props) => {
    const setByEnv = useIsSetByEnv('ServiceSettings.MinimumHashtagLength');
    return (
        <TextSetting
            id={FIELD_IDS.MINIMUM_HASHTAG_LENGTH}
            placeholder={placeholder}
            label={label}
            helpText={helpText}
            value={value}
            onChange={onChange}
            setByEnv={setByEnv}
            disabled={isDisabled}
            type='text'
        />
    );
};

export default MinimumHashtagLength;
