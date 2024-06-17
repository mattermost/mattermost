// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import type {MessageDescriptor} from 'react-intl';
import {useIntl} from 'react-intl';

import {isMessageDescriptor} from 'utils/i18n';

type Props = {
    devicePicture?: string;
    deviceTitle: MessageDescriptor | string;
}

export default function DeviceIcon(props: Props) {
    const intl = useIntl();

    let title;
    if (isMessageDescriptor(props.deviceTitle)) {
        title = intl.formatMessage(props.deviceTitle);
    } else {
        title = props.deviceTitle;
    }

    return (
        <i
            className={props.devicePicture}
            title={title}
        />
    );
}
