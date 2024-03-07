// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import type {ComponentProps} from 'react';
import type {MessageDescriptor} from 'react-intl';

import RenderEmoji from 'components/emoji/render_emoji';
import {ShortcutKey, ShortcutKeyVariant} from 'components/shortcut_key';
import Tooltip from 'components/tooltip';

import {getStringOrDescriptorComponent} from './utils';

type EmojiStyle = 'inline' | 'large' | undefined;

export type CommonTooltipProps = {
    id: string;
    title: string | MessageDescriptor;
    hint?: string | MessageDescriptor;
    shortcut?: string[];
    emoji?: string;
    emojiStyle?: EmojiStyle;
}

export function createTooltip(commonTooltipProps: CommonTooltipProps) {
    return (props: Omit<ComponentProps<typeof Tooltip>, 'children' | 'id'>) => {
        const contents = [];

        if (commonTooltipProps.emoji && commonTooltipProps.emojiStyle === 'large') {
            // HARRISONTODO The vertical padding in the designs is larger than this, but it isn't final yet
            contents.push(
                <RenderEmoji
                    emojiName={commonTooltipProps.emoji}
                    size={48}
                />,
            );
        }

        const title = getStringOrDescriptorComponent(commonTooltipProps.title);
        if (commonTooltipProps.emoji && commonTooltipProps.emojiStyle !== 'large') {
            contents.push(
                <div
                    key='title'
                    className={'tooltip-title'}
                >
                    <RenderEmoji
                        emojiName={commonTooltipProps.emoji}
                        size={16}
                    />
                    {title}
                </div>,
            );
        } else {
            contents.push(
                <div
                    key='title'
                    className={'tooltip-title'}
                >
                    {title}
                </div>,
            );
        }

        if (commonTooltipProps.shortcut) {
            contents.push(
                <div
                    key='shortcut'
                    className={'tooltip-shortcuts-container'}
                >
                    {commonTooltipProps.shortcut.map((v) => (
                        <ShortcutKey
                            key={v}
                            variant={ShortcutKeyVariant.Tooltip}
                        >
                            {v}
                        </ShortcutKey>
                    ))}
                </div>,
            );
        }

        const hint = getStringOrDescriptorComponent(commonTooltipProps.hint);
        if (commonTooltipProps.hint) {
            contents.push(
                <div
                    key='hint'
                    className={'tooltip-hint'}
                >
                    {hint}
                </div>,
            );
        }

        return (
            <Tooltip
                {...props}
                id={commonTooltipProps.id}
            >
                {contents}
            </Tooltip>
        );
    };
}
