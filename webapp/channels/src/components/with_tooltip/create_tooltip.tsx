// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import type {ComponentProps} from 'react';
import type {MessageDescriptor} from 'react-intl';

import RenderEmoji from 'components/emoji/render_emoji';
import {ShortcutKey, ShortcutKeyVariant} from 'components/shortcut_key';
import Tooltip from 'components/tooltip';

import {getStringOrDescriptorComponent} from './utils';

export type CommonTooltipProps = {
    id: string;
    title: string | MessageDescriptor;
    hint?: string | MessageDescriptor;
    shortcut?: string[];
    emoji?: string;
}

export function createTooltip(commonTooltipProps: CommonTooltipProps) {
    return (props: Omit<ComponentProps<typeof Tooltip>, 'children' | 'id'>) => {
        const title = getStringOrDescriptorComponent(commonTooltipProps.title);
        const hint = getStringOrDescriptorComponent(commonTooltipProps.hint);

        const emoji = commonTooltipProps.emoji && (
            <RenderEmoji
                emojiName={commonTooltipProps.emoji}
                size={12}
            />
        );
        return (
            <Tooltip
                {...props}
                id={commonTooltipProps.id}
            >
                <div className={'tooltip-title'}>
                    {emoji}
                    {title}
                </div>
                {commonTooltipProps.shortcut && (
                    <div className={'tooltip-shortcuts-container'}>
                        {commonTooltipProps.shortcut.map((v) => (
                            <ShortcutKey
                                key={v}
                                variant={ShortcutKeyVariant.Tooltip}
                            >
                                {v}
                            </ShortcutKey>
                        ))}
                    </div>
                )}
                {commonTooltipProps.hint && (<div className={'tooltip-hint'}>{hint}</div>)}
            </Tooltip>
        );
    };
}
