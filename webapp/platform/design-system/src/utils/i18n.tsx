// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {IntlShape, MessageDescriptor} from 'react-intl';

export function isMessageDescriptor(descriptor: unknown): descriptor is MessageDescriptor {
    return Boolean(descriptor && (descriptor as MessageDescriptor).id);
}

export function formatAsString(formatMessage: IntlShape['formatMessage'], messageOrDescriptor: string | MessageDescriptor | undefined): string | undefined {
    if (!messageOrDescriptor) {
        return undefined;
    }

    if (isMessageDescriptor(messageOrDescriptor)) {
        return formatMessage(messageOrDescriptor);
    }

    return messageOrDescriptor;
}

