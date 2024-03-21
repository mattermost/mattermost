// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import type {MessageDescriptor} from 'react-intl';
import {FormattedMessage, defineMessage} from 'react-intl';

import {ShortcutKey, ShortcutKeyVariant} from 'components/shortcut_key';

import {isMessageDescriptor} from 'utils/i18n';
import {isMac} from 'utils/user_agent';

export type ShortcutDefinition = {
    default: ShortcutKeyDescriptor[];
    mac?: ShortcutKeyDescriptor[];
}
export type ShortcutKeyDescriptor = string | MessageDescriptor;

export const ShortcutKeys = {
    alt: defineMessage({
        id: 'shortcuts.generic.alt',
        defaultMessage: 'Alt',
    }),
    cmd: '⌘',
    ctrl: defineMessage({
        id: 'shortcuts.generic.ctrl',
        defaultMessage: 'Ctrl',
    }),
    option: '⌥',
    shift: defineMessage({
        id: 'shortcuts.generic.shift',
        defaultMessage: 'Shift',
    }),
};

type Props = {
    shortcut: ShortcutDefinition;
}

export function TooltipShortcutSequence(props: Props) {
    let shortcut = props.shortcut.default;
    if (props.shortcut.mac && isMac()) {
        shortcut = props.shortcut.mac;
    }

    return (
        <>
            {shortcut.map((v) => {
                let key;
                let content;
                if (isMessageDescriptor(v)) {
                    key = v.id;
                    content = <FormattedMessage {...v}/>;
                } else {
                    key = v;
                    content = v;
                }

                return (
                    <ShortcutKey
                        key={key}
                        variant={ShortcutKeyVariant.Tooltip}
                    >
                        {content}
                    </ShortcutKey>
                );
            })}
        </>
    );
}
