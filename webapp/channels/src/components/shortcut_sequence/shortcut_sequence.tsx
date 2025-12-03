// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import type {MessageDescriptor} from 'react-intl';
import {FormattedMessage} from 'react-intl';

import {ShortcutKey, ShortcutKeyVariant} from 'components/shortcut_key';

import {isMessageDescriptor} from 'utils/i18n';

export const KEY_SEPARATOR = '|';

export {ShortcutKeyVariant};

export type ShortcutKeyDescriptor = string | MessageDescriptor;

export type ShortcutSequenceProps = {
    keys: string | ShortcutKeyDescriptor[];
    variant?: ShortcutKeyVariant;
};

export const ShortcutSequence = ({keys, variant}: ShortcutSequenceProps) => {
    const keysArr = typeof keys === 'string' ? keys.split(KEY_SEPARATOR) : keys;

    return (
        <>
            {keysArr.map((shortcutKey) => {
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
                        variant={variant}
                    >
                        {content}
                    </ShortcutKey>
                );
            })}
        </>
    );
};
