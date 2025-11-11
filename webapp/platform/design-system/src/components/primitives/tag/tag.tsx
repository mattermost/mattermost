// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {memo, useMemo} from 'react';
import type {MouseEventHandler} from 'react';

import glyphMap from '@mattermost/compass-icons/components';
import type {IconGlyphTypes} from '@mattermost/compass-icons/IconGlyphs';

import './tag.scss';

export type TagVariant = 'info' | 'success' | 'warning' | 'danger' | 'dangerDim' | 'default';

export type TagSize = 'xs' | 'sm' | 'md';

type Props = {
    text: React.ReactNode;
    uppercase?: boolean;
    icon?: IconGlyphTypes;
    variant?: TagVariant;
    size?: TagSize;
    onClick?: MouseEventHandler;
    className?: string;
};

const Tag = ({
    variant,
    onClick,
    className,
    text,
    icon: iconName,
    size = 'xs',
    uppercase = false,
    ...rest
}: Props) => {
    const Icon = iconName ? glyphMap[iconName] : null;
    const element = onClick ? 'button' : 'div';

    const iconSize = useMemo(() => {
        switch (size) {
        case 'md':
            return 14;
        case 'sm':
            return 12;
        case 'xs':
        default:
            return 10;
        }
    }, [size]);

    const tagClasses = useMemo(() => classNames(
        'Tag',
        `Tag--${size}`,
        {
            [`Tag--${variant}`]: variant,
            'Tag--uppercase': uppercase,
            'Tag--clickable': typeof onClick === 'function',
        },
        className,
    ), [size, variant, uppercase, onClick, className]);

    const TagElement = element as keyof JSX.IntrinsicElements;

    return (
        <TagElement
            {...rest}
            onClick={onClick}
            className={tagClasses}
        >
            {Icon && (
                <span className='Tag__icon'>
                    <Icon size={iconSize}/>
                </span>
            )}
            <span className='Tag__text'>{text}</span>
        </TagElement>
    );
};

export default memo(Tag);
