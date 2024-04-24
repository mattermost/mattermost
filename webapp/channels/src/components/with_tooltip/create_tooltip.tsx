// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import type {ComponentProps} from 'react';
import {type MessageDescriptor} from 'react-intl';

import RenderEmoji from 'components/emoji/render_emoji';
import Tooltip from 'components/tooltip';

import {TooltipShortcutSequence, type ShortcutDefinition} from './shortcut';
import {getAsFormattedMessage} from './utils';

type EmojiStyle = 'inline' | 'large' | undefined;

export type CommonTooltipProps = {
    id: string;
    title: string | MessageDescriptor | React.ReactElement;
    hint?: string | MessageDescriptor | React.ReactElement;
    shortcut?: ShortcutDefinition;
    emoji?: string;
    emojiStyle?: EmojiStyle;
}

export function createTooltip(commonTooltipProps: CommonTooltipProps) {
    return (props: Omit<ComponentProps<typeof Tooltip>, 'children' | 'id'>) => {
        const contents = [];

        if (commonTooltipProps.emoji && commonTooltipProps.emojiStyle === 'large') {
            contents.push(
                <div
                    key='emoji'
                    className='tooltip-large-emoji'
                >
                    <RenderEmoji
                        emojiName={commonTooltipProps.emoji}
                        size={48}
                    />
                </div>,
            );
        }

        const title = getAsFormattedMessage(commonTooltipProps.title);
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
                    <TooltipShortcutSequence shortcut={commonTooltipProps.shortcut}/>
                </div>,
            );
        }

        const hint = getAsFormattedMessage(commonTooltipProps.hint);
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
