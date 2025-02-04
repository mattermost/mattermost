// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {memo} from 'react';
import type {MessageDescriptor} from 'react-intl';
import {defineMessage, FormattedMessage} from 'react-intl';

import {ShortcutKey, ShortcutKeyVariant} from 'components/shortcut_key';

import {isMessageDescriptor} from 'utils/i18n';
import {isMac} from 'utils/user_agent';

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

type ShortcutKeyDescriptor = string | MessageDescriptor;

export type ShortcutDefinition = {
    default: ShortcutKeyDescriptor[];
    mac?: ShortcutKeyDescriptor[];
}

type Props = {
    shortcut: ShortcutDefinition;
}

function TooltipShortcut(props: Props) {
    let shortcut = props.shortcut.default;
    if (props.shortcut.mac && isMac()) {
        shortcut = props.shortcut.mac;
    }

    return (
        <>
            {shortcut.map((shortcutKey) => {
                let key;
                let content;
                if (isMessageDescriptor(shortcutKey)) {
                    key = shortcutKey.id;
                    content = <FormattedMessage {...shortcutKey}/>;
                } else {
                    key = shortcutKey;
                    content = shortcutKey;
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

export default memo(TooltipShortcut);
