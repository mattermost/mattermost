// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {memo} from 'react';
import type {MessageDescriptor} from 'react-intl';
import {FormattedMessage} from 'react-intl';

import {isMac} from '@mattermost/shared/utils/user_agent';

import {ShortcutKey, ShortcutKeys, ShortcutKeyVariant} from 'components/shortcut_key';

import {isMessageDescriptor} from 'utils/i18n';

export {ShortcutKeys};

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
