// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import type {CSSProperties, ComponentProps} from 'react';
import {Tooltip as RBTooltip} from 'react-bootstrap';
import type {MessageDescriptor} from 'react-intl';
import {FormattedMessage} from 'react-intl';

import RenderEmoji from 'components/emoji/render_emoji';
import {ShortcutKey, ShortcutKeyVariant} from 'components/shortcut_key';

type Props = {
    id?: string;
    className?: string;
    style?: CSSProperties;
    children?: React.ReactNode;
    positionLeft?: number;
    placement?: string;
};

export default function Tooltip(props: Props) {
    return (
        <RBTooltip
            id={props.id}
            className={props.className}
            positionLeft={props.positionLeft}
            style={props.style}
            placement={props.placement}
        >
            {props.children}
        </RBTooltip>
    );
}

type CommonTooltipProps = {
    id: string;
    title: string | MessageDescriptor;
    hint?: string | MessageDescriptor;
    shortcut?: string[];
    emoji?: string;
}

function getStringOrDescriptorComponent(v: string | MessageDescriptor | undefined, values?: ComponentProps<typeof FormattedMessage>['values']) {
    if (!v) {
        return undefined;
    }

    if (typeof v === 'string') {
        return v;
    }

    return (
        <FormattedMessage
            {...v}
            values={values}
        />
    );
}

export function createTooltip(commonTooltipProps: CommonTooltipProps) {
    return (props: Omit<Props, 'children' | 'id'>) => {
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
