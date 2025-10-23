// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {defineMessages, type IntlShape, type MessageDescriptor} from 'react-intl';

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
export const messages = defineMessages({
    shortcutAlt: {
        id: 'shortcuts.generic.alt',
        defaultMessage: 'Alt',
    },
    shortcutCtrl: {
        id: 'shortcuts.generic.ctrl',
        defaultMessage: 'Ctrl',
    },
    shortcutShift: {
        id: 'shortcuts.generic.shift',
        defaultMessage: 'Shift',
    },
    urlInputDone: {
        id: 'url_input.buttonLabel.done',
        defaultMessage: 'Done',
    },
    urlInputEdit: {
        id: 'url_input.buttonLabel.edit',
        defaultMessage: 'Edit',
    },
    urlInputLabel: {
        id: 'url_input.label.url',
        defaultMessage: 'URL: ',
    },
    widgetInputClear: {
        id: 'widget.input.clear',
        defaultMessage: 'Clear',
    },
    widgetInputMaxLength: {
        id: 'widget.input.max_length',
        defaultMessage: 'Must be no more than {limit} characters',
    },
    widgetInputMinLength: {
        id: 'widget.input.min_length',
        defaultMessage: 'Must be at least {minLength} characters',
    },
    passwordInputCreate: {
        id: 'widget.passwordInput.createPassword',
        defaultMessage: 'Choose a Password',
    },
    passwordInputPassword: {
        id: 'widget.passwordInput.password',
        defaultMessage: 'Password',
    },
});
