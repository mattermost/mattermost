// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {memo} from 'react';
import type {MessageDescriptor} from 'react-intl';
import {defineMessage} from 'react-intl';

import {ShortcutSequence, ShortcutKeyVariant} from 'components/shortcut_sequence';

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
    escape: defineMessage({
        id: 'general_button.esc',
        defaultMessage: 'Esc',
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
        <ShortcutSequence
            keys={shortcut}
            variant={ShortcutKeyVariant.Tooltip}
        />
    );
}

export default memo(TooltipShortcut);
