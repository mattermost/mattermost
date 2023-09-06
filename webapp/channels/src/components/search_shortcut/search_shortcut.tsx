// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React from 'react';

import {ShortcutKey, ShortcutKeyVariant} from 'components/shortcut_key';

import {isDesktopApp, isMac} from 'utils/user_agent';

import './search_shortcut.scss';

export type SearchShortcutProps = {
    className?: string;
    variant?: ShortcutKeyVariant;
}

export const SearchShortcut = ({className, variant}: SearchShortcutProps) => {
    const controlKey = isMac() ? '⌘' : 'Ctrl';
    const shortcutKeyVariant = variant || ShortcutKeyVariant.Contrast;

    return (
        <span className={classNames('search-shortcut', className)}>
            <ShortcutKey variant={shortcutKeyVariant}>{controlKey}</ShortcutKey>
            {!isDesktopApp() && <ShortcutKey variant={shortcutKeyVariant}>{'Shift'}</ShortcutKey>}
            <ShortcutKey variant={shortcutKeyVariant}>{'F'}</ShortcutKey>
        </span>
    );
};
