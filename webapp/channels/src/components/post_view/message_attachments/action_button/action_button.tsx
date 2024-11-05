// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {memo, useCallback} from 'react';
import styled, {css} from 'styled-components';

import type {PostAction, PostActionOption} from '@mattermost/types/integration_actions';

import type {Theme} from 'mattermost-redux/selectors/entities/preferences';
import {changeOpacity} from 'mattermost-redux/utils/theme_utils';

import Markdown from 'components/markdown';
import LoadingWrapper from 'components/widgets/loading/loading_wrapper';

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
    autolinkedUrlSchemes: [],
};

type Props = {
    action: PostAction;
    handleAction: (e: React.MouseEvent, options?: PostActionOption[]) => void;
    disabled?: boolean;
    theme: Theme;
    actionExecuting?: boolean;
    actionExecutingMessage?: string;
}

const ActionButton = ({
    action,
    handleAction,
    disabled,
    theme,
    actionExecuting,
    actionExecutingMessage,
}: Props) => {
    const handleActionClick = useCallback((e) => handleAction(e, action.options), [action.options, handleAction]);
    let hexColor: string | null | undefined;

    if (action.style) {
        const STATUS_COLORS = getStatusColors(theme);
        hexColor =
            STATUS_COLORS[action.style] ||
            theme[action.style] ||
            (action.style.match('^#(?:[0-9a-fA-F]{3}){1,2}$') && action.style);
    }

    return (
        <ActionBtn
            data-action-id={action.id}
            data-action-cookie={action.cookie}
            disabled={disabled}
            key={action.id}
            onClick={handleActionClick}
            className='btn btn-sm'
            hexColor={hexColor}
        >
            <LoadingWrapper
                loading={actionExecuting}
                text={actionExecutingMessage}
            >
                <Markdown
                    message={action.name}
                    options={markdownOptions}
                />
            </LoadingWrapper>
        </ActionBtn>
    );
};

type ActionBtnProps = {hexColor: string | null | undefined};
const ActionBtn = styled.button<ActionBtnProps>`
    ${({hexColor}) => hexColor && css`
        background-color: ${changeOpacity(hexColor, 0.08)} !important;
        color: ${hexColor} !important;
        &:hover {
            background-color: ${changeOpacity(hexColor, 0.12)} !important;
        }
        &:active {
            background-color: ${changeOpacity(hexColor, 0.16)} !important;
        }
    `}
`;

export default memo(ActionButton);
