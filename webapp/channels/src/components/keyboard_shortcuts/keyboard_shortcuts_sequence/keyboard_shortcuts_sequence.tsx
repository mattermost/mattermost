// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {memo} from 'react';
import {useIntl} from 'react-intl';

import {ShortcutSequence, ShortcutKeyVariant, KEY_SEPARATOR} from 'components/shortcut_sequence';

import {isMessageDescriptor} from 'utils/i18n';
import {isMac} from 'utils/user_agent';

import {type KeyboardShortcutDescriptor} from './keyboard_shortcuts';

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

function KeyboardShortcutSequence({shortcut, hideDescription, hoistDescription, isInsideTooltip}: Props) {
    const {formatMessage} = useIntl();
    const shortcutText = formatMessage(normalizeShortcutDescriptor(shortcut));
    const splitShortcut = shortcutText.split('\t');
    const variant = isInsideTooltip ? ShortcutKeyVariant.Tooltip : ShortcutKeyVariant.ShortcutModal;

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
        return (
            <>
                <span>{'\t|\t'}</span>
                <ShortcutSequence
                    keys={altKeys}
                    variant={variant}
                />
            </>
        );
    };

    return (
        <>
            {hoistDescription && !hideDescription && description?.replace(/:{1,2}$/, '')}
            <div className='shortcut-line'>
                {!hoistDescription && !hideDescription && description && <span>{description}</span>}
                {keys && (
                    <ShortcutSequence
                        keys={keys}
                        variant={variant}
                    />
                )}

                {altKeys && renderAltKeys()}
            </div>
        </>
    );
}

export default memo(KeyboardShortcutSequence);
