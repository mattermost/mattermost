// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {memo, useCallback, useMemo} from 'react';

import {WithTooltip} from '@mattermost/shared/components/tooltip';
import type {PostAction, PostActionOption} from '@mattermost/types/integration_actions';

import type {Theme} from 'mattermost-redux/selectors/entities/preferences';
import {secureGetFromRecord} from 'mattermost-redux/utils/post_utils';
import {changeOpacity} from 'mattermost-redux/utils/theme_utils';

import {Button} from 'components/compass_ui_button';
import Markdown from 'components/markdown';

const getStatusColors = (theme: Theme) => {
    return {
        good: '#339970',
        warning: '#CC8F00',
        danger: theme.errorTextColor,
        default: theme.centerChannelColor,
        primary: theme.buttonBg,
        success: '#339970',
    } as Record<string, string>;
};
const markdownOptions = {
    mentionHighlight: false,
    markdown: false,
};

type Props = {
    action: PostAction;
    handleAction: (e: React.MouseEvent, options?: PostActionOption[]) => void;
    disabled?: boolean;
    theme: Theme;
    actionExecuting?: boolean;
    actionExecutingMessage?: string;
};

const ActionButton = ({
    action,
    handleAction,
    disabled,
    theme,
    actionExecuting = false,
    actionExecutingMessage,
}: Props) => {
    const handleActionClick = useCallback((e: React.MouseEvent) => handleAction(e, action.options), [action.options, handleAction]);
    let hexColor: string | null | undefined;

    if (action.style) {
        const STATUS_COLORS = getStatusColors(theme);
        hexColor =
            secureGetFromRecord(STATUS_COLORS, action.style) ||
            secureGetFromRecord(theme, action.style) ||
            (action.style.match('^#(?:[0-9a-fA-F]{3}){1,2}$') && action.style);
    }

    const name = action.name || action.id || '';
    const label = actionExecuting && actionExecutingMessage ? actionExecutingMessage : name;

    const colorStyle = useMemo(() => {
        if (!hexColor) {
            return undefined;
        }
        return {
            backgroundColor: changeOpacity(hexColor, 0.08),
            color: hexColor,
        } as React.CSSProperties;
    }, [hexColor]);

    const button = (
        <Button
            data-action-id={action.id}
            data-action-cookie={action.cookie}
            disabled={disabled || actionExecuting}
            onClick={handleActionClick}
            size='small'
            emphasis='tertiary'
            loading={actionExecuting}
            aria-busy={actionExecuting || undefined}
            style={colorStyle}
        >
            <Markdown
                message={label}
                options={markdownOptions}
            />
        </Button>
    );

    if (!action.tooltip) {
        return button;
    }

    return (
        <WithTooltip title={action.tooltip}>
            {button}
        </WithTooltip>
    );
};

export default memo(ActionButton);
