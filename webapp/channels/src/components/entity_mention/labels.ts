// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {defineMessages, type IntlShape} from 'react-intl';

const messages = defineMessages({
    time: {
        id: 'entity_label.mm.time',
        defaultMessage: 'Time',
    },
});

const labels: Record<string, typeof messages[keyof typeof messages]> = {
    'mm.time': messages.time,
};

export function entityLabel(typeId: string, formatMessage: IntlShape['formatMessage']) {
    const message = labels[typeId];
    return message ? formatMessage(message) : typeId;
}
