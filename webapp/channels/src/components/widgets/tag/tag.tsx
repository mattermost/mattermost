// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {memo, useMemo} from 'react';
import styled, {css} from 'styled-components';

import glyphMap from '@mattermost/compass-icons/components';

import type {IconGlyphTypes} from '@mattermost/compass-icons/IconGlyphs';
import type {MouseEventHandler} from 'react';

export type TagVariant = 'info' | 'success' | 'warning' | 'danger';

export type TagSize = 'xs' | 'sm' | 'md' | 'lg'

type Props = {
    text: React.ReactNode;
    uppercase?: boolean;
    icon?: IconGlyphTypes;
    variant?: TagVariant;
    size?: TagSize;
    onClick?: MouseEventHandler;
    className?: string;
};

type TagWrapperProps = Required<Pick<Props, 'uppercase'>>;

const TagWrapper = styled.div<TagWrapperProps>`
    --tag-bg: var(--semantic-color-general);
    --tag-bg-opacity: 0.08;
    --tag-color: var(--semantic-color-general);

    appearance: none;

    display: inline-flex;
    align-items: center;
    align-content: center;
    align-self: center;
    gap: 4px;
    max-width: 100%;
    margin: 0;
    overflow: hidden;

    border: none;
    border-radius: 4px;

    font-family: 'Open Sans', sans-serif;
    font-weight: 600;
    line-height: 16px;
    ${({uppercase}) => (
        uppercase ? css`
            letter-spacing: 0.02em;
            text-transform: uppercase;
        ` : css`
            text-transform: none;
        `
    )}

    &.Tag--xs {
        height: 16px;
        font-size: 10px;
        line-height: 12px;
        padding: 1px 4px;
    }

    &.Tag--sm {
        height: 20px;
        font-size: 12px;
        line-height: 16px;
        padding: 2px 5px;
    }

    &.Tag--md {
        height: 24px;
        font-size: 14px;
        line-height: 20px;
        padding: 2px 5px;
    }

    &.Tag--lg {
        height: 28px;
        font-size: 16px;
        line-height: 22px;
        padding: 2px 5px;
    }

    &.Tag--info,
    &.Tag--success,
    &.Tag--warning,
    &.Tag--danger {
        --tag-bg-opacity: 1;
        --tag-color: 255, 255, 255;
    }

    &.Tag--info {
        --tag-bg: var(--semantic-color-info);
    }

    &.Tag--success {
        --tag-bg: var(--semantic-color-success);
    }

    &.Tag--warning {
        --tag-bg: var(--semantic-color-warning);
    }

    &.Tag--danger {
        --tag-bg: var(--semantic-color-danger);
    }

    background: rgba(var(--tag-bg), var(--tag-bg-opacity));
    color: rgb(var(--tag-color));

    ${({onClick}) => typeof onClick === 'function' && (
        css`
            &:hover,
            &:focus {
                background: rgba(var(--tag-bg), 0.08);
                cursor: pointer;
            }
        `
    )}

`;

const TagText = styled.span`
    max-width: 100%;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
`;

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
        case 'lg':
            return 16;
        case 'md':
            return 14;
        case 'sm':
            return 12;
        case 'xs':
        default:
            return 10;
        }
    }, [size]);

    return (
        <TagWrapper
            {...rest}
            as={element}
            uppercase={uppercase}
            onClick={onClick}
            className={classNames('Tag', {[`Tag--${variant}`]: variant, [`Tag--${size}`]: size}, className)}
        >
            {Icon && <Icon size={iconSize}/>}
            <TagText>{text}</TagText>
        </TagWrapper>
    );
};

export default memo(Tag);
