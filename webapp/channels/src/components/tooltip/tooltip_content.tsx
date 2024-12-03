// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import type {ReactNode} from 'react';
import React, {memo} from 'react';

import RenderEmoji from 'components/emoji/render_emoji';
import {TooltipShortcut} from 'components/tooltip/tooltip_shortcut';
import {type ShortcutDefinition} from 'components/tooltip/tooltip_shortcut';

const TOOLTIP_EMOTICON_SIZE = 16;
const TOOLTIP_EMOTICON_LARGE_SIZE = 48;

interface Props {
    title: string | ReactNode;
    emoticon?: string;
    isEmoticonLarge?: boolean;
    hint?: string;
    shortcut?: ShortcutDefinition;
}

function TooltipContent(props: Props) {
    return (
        <div className='tooltipContent'>
            <span
                className={classNames('tooltipContentTitleContainer', {
                    isEmoticonLarge: props.isEmoticonLarge,
                })}
            >
                {props.emoticon && (
                    <span className='tooltipContentEmoticon'>
                        <RenderEmoji
                            emojiName={props.emoticon}
                            size={props.isEmoticonLarge ? TOOLTIP_EMOTICON_LARGE_SIZE : TOOLTIP_EMOTICON_SIZE}
                        />
                    </span>
                )}
                <span className='tooltipContentTitle'>{props.title}</span>
            </span>
            {props.hint && (
                <span className='tooltipContentHint'>{props.hint}</span>
            )}
            {props.shortcut && (
                <span className='tooltipContentShortcut'>
                    <TooltipShortcut shortcut={props.shortcut}/>
                </span>
            )}
        </div>
    );
}

export default memo(TooltipContent);
