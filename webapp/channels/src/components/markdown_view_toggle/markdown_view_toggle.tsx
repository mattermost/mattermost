// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React from 'react';
import {defineMessages, useIntl} from 'react-intl';

import CodeTagsIcon from '@mattermost/compass-icons/components/code-tags';
import EyeOutlineIcon from '@mattermost/compass-icons/components/eye-outline';
import {Icon} from '@mattermost/compass-ui/components/icon';
import {IconButton} from '@mattermost/compass-ui/components/icon-button';
import {WithTooltip} from '@mattermost/shared/components/tooltip';

import {MarkdownViews} from 'utils/constants';
import type {MarkdownView} from 'utils/constants';

import './markdown_view_toggle.scss';

type Props = {
    view: MarkdownView;
    onChange: (view: MarkdownView) => void;

    // 'onDark' is for surfaces that are always dark regardless of theme, like the file preview header
    appearance?: 'default' | 'onDark';
    size?: 'default' | 'compact';
    className?: string;
};

const messages = defineMessages({
    group: {
        id: 'markdown_view_toggle.group',
        defaultMessage: 'Markdown view',
        description: 'Accessible name of the segmented control that switches Markdown content between rendered output and raw source.',
    },
    rendered: {
        id: 'markdown_view_toggle.rendered',
        defaultMessage: 'Rendered',
        description: 'Label and tooltip of the segment that shows Markdown content as rendered output.',
    },
    raw: {
        id: 'markdown_view_toggle.raw',
        defaultMessage: 'Raw',
        description: 'Label and tooltip of the segment that shows Markdown content as raw source text.',
    },
});

const options = [
    {value: MarkdownViews.RENDERED, glyph: <EyeOutlineIcon/>, message: messages.rendered},
    {value: MarkdownViews.RAW, glyph: <CodeTagsIcon/>, message: messages.raw},
] as const;

const MarkdownViewToggle = ({view, onChange, appearance = 'default', size = 'default', className}: Props) => {
    const intl = useIntl();
    const onDark = appearance === 'onDark';
    const compact = size === 'compact';

    return (
        <div
            role='group'
            aria-label={intl.formatMessage(messages.group)}
            className={classNames('MarkdownViewToggle', {onDark, compact, raw: view === MarkdownViews.RAW}, className)}
        >
            <span
                className='MarkdownViewToggle__thumb'
                aria-hidden='true'
            />
            {options.map(({value, glyph, message}) => {
                const label = intl.formatMessage(message);
                const pressed = view === value;

                return (
                    <WithTooltip
                        key={value}
                        title={label}
                    >
                        <IconButton
                            className='MarkdownViewToggle__option'
                            size='small'
                            padding={compact ? 'compact' : 'default'}
                            style={onDark ? 'inverted' : 'default'}
                            icon={<Icon glyph={glyph}/>}
                            aria-label={label}
                            aria-pressed={pressed}
                            onClick={pressed ? undefined : () => onChange(value)}
                        />
                    </WithTooltip>
                );
            })}
        </div>
    );
};

export default MarkdownViewToggle;
