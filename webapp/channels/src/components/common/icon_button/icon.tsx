// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React from 'react';

type IconProps = {
    className?: string;
    glyph?: string;
    size?: 8 | 10 | 12 | 16 | 20 | 28 | 32 | 40 | 52 | 64 | 104;
} & React.HTMLAttributes<HTMLSpanElement>;

export function Icon({
    className = '',
    glyph = 'mattermost',
    size = 20,
    ...otherProps
}: IconProps) {
    return (
        <i
            className={classNames(className, 'MMIcon', `icon-${glyph}`)}
            style={{
                '--icon-size': `${size}px`,
                '--icon-font-size': `${iconFontSizes[size]}px`,
            } as React.CSSProperties}
            {...otherProps}
        />
    );
}

const iconFontSizes = {
    8: 10,
    10: 12,
    12: 14,
    16: 20,
    20: 24,
    28: 31,
    32: 36,
    40: 48,
    52: 60,
    64: 72,
    104: 120,
};
