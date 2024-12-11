// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import type {ReactNode} from 'react';
import React, {memo} from 'react';
import type {MessageDescriptor} from 'react-intl';
import {useIntl} from 'react-intl';

import RenderEmoji from 'components/emoji/render_emoji';

import {isMessageDescriptor} from 'utils/i18n';

import TooltipShortcut from './tooltip_shortcut';
import {type ShortcutDefinition} from './tooltip_shortcut';

const TOOLTIP_EMOTICON_SIZE = 16;
const TOOLTIP_EMOTICON_LARGE_SIZE = 48;

interface Props {
    title: string | ReactNode | MessageDescriptor;
    emoji?: string;
    isEmojiLarge?: boolean;
    hint?: string | ReactNode | MessageDescriptor;
    shortcut?: ShortcutDefinition;
}

function TooltipContent(props: Props) {
    const {formatMessage} = useIntl();

    let title = props.title;
    if (isMessageDescriptor(title)) {
        title = formatMessage(title);
    }

    let hint = props.hint;
    if (isMessageDescriptor(hint)) {
        hint = formatMessage(hint);
    }

    return (
        <div className='tooltipContent'>
            <span
                className={classNames('tooltipContentTitleContainer', {
                    isEmojiLarge: props.isEmojiLarge,
                })}
            >
                {props.emoji && (
                    <span className='tooltipContentEmoji'>
                        <RenderEmoji
                            emojiName={props.emoji}
                            size={props.isEmojiLarge ? TOOLTIP_EMOTICON_LARGE_SIZE : TOOLTIP_EMOTICON_SIZE}
                        />
                    </span>
                )}
                <span className='tooltipContentTitle'>{title}</span>
            </span>
            {props.hint && (
                <span className='tooltipContentHint'>{hint}</span>
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
