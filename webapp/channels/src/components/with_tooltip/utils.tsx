// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import type {ComponentProps} from 'react';
import type {MessageDescriptor} from 'react-intl';
import {FormattedMessage} from 'react-intl';

import {isMessageDescriptor} from 'utils/i18n';

export function getAsFormattedMessage(v: string | MessageDescriptor | React.ReactElement | undefined, values?: ComponentProps<typeof FormattedMessage>['values']) {
    if (!v) {
        return undefined;
    }

    if (isMessageDescriptor(v)) {
        return (
            <FormattedMessage
                {...v}
                values={values}
            />
        );
    }

    return v;
}
