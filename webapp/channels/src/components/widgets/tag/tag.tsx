// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {memo, useMemo} from 'react';
import type {MouseEventHandler} from 'react';
import styled, {css} from 'styled-components';

import glyphMap from '@mattermost/compass-icons/components';
import type {IconGlyphTypes} from '@mattermost/compass-icons/IconGlyphs';

export type TagVariant = 'info' | 'success' | 'warning' | 'danger' | 'dangerDim' | 'default';

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

    background: rgba(var(--semantic-color-general), 0.08);
    color: rgb(var(--semantic-color-general));

    &.Tag--info {
        background: rgba(var(--semantic-color-info), 1);
        color: rgb(255, 255, 255);
    }

    &.Tag--success {
        background: rgba(var(--semantic-color-success), 1);
        color: rgb(255, 255, 255);
    }

    &.Tag--warning {
        background: rgba(var(--semantic-color-warning), 1);
        color: rgb(255, 255, 255);
    }

    &.Tag--danger {
        background: rgba(var(--semantic-color-danger), 1);
        color: rgb(255, 255, 255);
    }

    &.Tag--dangerDim {
        background: rgba(var(--semantic-color-danger), 0.08);
        color: rgb(var(--semantic-color-danger));
    }

    ${({onClick}) => typeof onClick === 'function' && (
        css`
            &:hover,
            &:focus {
                background: rgba(var(--semantic-color-general), 0.08);
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
