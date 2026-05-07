// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React from 'react';

import './shortcut_key.css';

export enum ShortcutKeyVariant {
    Contrast = 'contrast',
    Tooltip = 'tooltip',
    TutorialTip = 'tutorialTip',
    ShortcutModal = 'shortcut',
}

export interface ShortcutKeyProps {
    variant?: ShortcutKeyVariant;
    children: React.ReactNode;
}

export function ShortcutKey({children, variant}: ShortcutKeyProps) {
    return (
        <mark
            className={classNames('shortcut-key', {
                'shortcut-key--contrast': variant === ShortcutKeyVariant.Contrast,
                'shortcut-key--tooltip': variant === ShortcutKeyVariant.Tooltip,
                'shortcut-key--tutorial-tip': variant === ShortcutKeyVariant.TutorialTip,
                'shortcut-key--shortcut-modal': variant === ShortcutKeyVariant.ShortcutModal,
            })}
        >
            {children}
        </mark>
    );
}
