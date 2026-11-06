// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {defineMessages, type IntlShape} from 'react-intl';

const messages = defineMessages({
    time: {
        id: 'entity_label.mm.time',
        defaultMessage: 'Time',
    },
    vuln: {
        id: 'entity_label.mm.vuln',
        defaultMessage: 'Vulnerability',
    },
    ip: {
        id: 'entity_label.mm.ip',
        defaultMessage: 'IP address',
    },
    attack: {
        id: 'entity_label.mm.attack',
        defaultMessage: 'ATT&CK',
    },
});

const labels: Record<string, typeof messages[keyof typeof messages]> = {
    'mm.time': messages.time,
    'mm.vuln': messages.vuln,
    'mm.ip': messages.ip,
    'mm.attack': messages.attack,
};

export function entityLabel(typeId: string, formatMessage: IntlShape['formatMessage']) {
    const message = labels[typeId];
    return message ? formatMessage(message) : typeId;
}
