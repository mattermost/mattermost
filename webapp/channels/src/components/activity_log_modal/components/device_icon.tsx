// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import type {MessageDescriptor} from 'react-intl';
import {useIntl} from 'react-intl';

import {formatAsString} from 'utils/i18n';

type Props = {
    devicePicture?: string;
    deviceTitle: MessageDescriptor | string;
}

export default function DeviceIcon(props: Props) {
    const intl = useIntl();

    return (
        <i
            className={props.devicePicture}
            title={formatAsString(intl.formatMessage, props.deviceTitle)}
        />
    );
}
