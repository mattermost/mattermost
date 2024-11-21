// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {memo} from 'react';
import {useIntl} from 'react-intl';

import {ShortcutKeyVariant, ShortcutKey} from 'components/shortcut_key';

import {isMessageDescriptor} from 'utils/i18n';
import {isMac} from 'utils/user_agent';

import type {KeyboardShortcutDescriptor} from './keyboard_shortcuts';

import './keyboard_shortcuts_sequence.scss';

type Props = {
    shortcut: KeyboardShortcutDescriptor;
    hideDescription?: boolean;
    hoistDescription?: boolean;
    isInsideTooltip?: boolean;
};

function normalizeShortcutDescriptor(shortcut: KeyboardShortcutDescriptor) {
    if (isMessageDescriptor(shortcut)) {
        return shortcut;
    }
    const {default: standard, mac} = shortcut;
    return isMac() && mac ? mac : standard;
}

const KEY_SEPARATOR = '|';

function KeyboardShortcutSequence({shortcut, hideDescription, hoistDescription, isInsideTooltip}: Props) {
    const {formatMessage} = useIntl();
    const shortcutText = formatMessage(normalizeShortcutDescriptor(shortcut));
    const splitShortcut = shortcutText.split('\t');

    let description = '';
    let keys = '';
    let altKeys = '';

    if (splitShortcut.length > 1) {
        description = splitShortcut[0];
        keys = splitShortcut[1];
        altKeys = splitShortcut[2];
    } else if (splitShortcut[0].includes(KEY_SEPARATOR)) {
        keys = splitShortcut[0];
    } else {
        description = splitShortcut[0];
    }

    const renderAltKeys = () => {
        const shortcutKeys = altKeys.split(KEY_SEPARATOR).map((key) => (
            <ShortcutKey
                key={key}
                variant={isInsideTooltip ? ShortcutKeyVariant.Tooltip : ShortcutKeyVariant.ShortcutModal}
            >
                {key}
            </ShortcutKey>
        ));

        return (
            <>
                <span>{'\t|\t'}</span>
                {shortcutKeys}
            </>
        );
    };

    return (
        <>
            {hoistDescription && !hideDescription && description?.replace(/:{1,2}$/, '')}
            <div className='shortcut-line'>
                {!hoistDescription && !hideDescription && description && <span>{description}</span>}
                {keys && keys.split(KEY_SEPARATOR).map((key) => (
                    <ShortcutKey
                        key={key}
                        variant={isInsideTooltip ? ShortcutKeyVariant.Tooltip : ShortcutKeyVariant.ShortcutModal}
                    >
                        {key}
                    </ShortcutKey>
                ))}

                {altKeys && renderAltKeys()}
            </div>
        </>
    );
}

export default memo(KeyboardShortcutSequence);
