// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import type {ComponentProps} from 'react';
import type {MessageDescriptor} from 'react-intl';
import {FormattedMessage} from 'react-intl';

export function getStringOrDescriptorComponent(v: string | MessageDescriptor | undefined, values?: ComponentProps<typeof FormattedMessage>['values']) {
    if (!v) {
        return undefined;
    }

    if (typeof v === 'string') {
        return v;
    }

    return (
        <FormattedMessage
            {...v}
            values={values}
        />
    );
}
