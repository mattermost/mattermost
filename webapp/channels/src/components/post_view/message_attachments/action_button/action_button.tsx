// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import styled, {css} from 'styled-components';

import type {PostAction, PostActionOption} from '@mattermost/types/integration_actions';

import type {Theme} from 'mattermost-redux/selectors/entities/preferences';
import {changeOpacity} from 'mattermost-redux/utils/theme_utils';

import Markdown from 'components/markdown';
import LoadingWrapper from 'components/widgets/loading/loading_wrapper';

type Props = {
    action: PostAction;
    handleAction: (e: React.MouseEvent, options?: PostActionOption[]) => void;
    disabled?: boolean;
    theme: Theme;
    actionExecuting?: boolean;
    actionExecutingMessage?: string;
}

export default class ActionButton extends React.PureComponent<Props> {
    getStatusColors(theme: Theme) {
        return {
            good: '#339970',
            warning: '#CC8F00',
            danger: theme.errorTextColor,
            default: theme.centerChannelColor,
            primary: theme.buttonBg,
            success: '#339970',
        } as Record<string, string>;
    }

    render() {
        const {action, handleAction, disabled, theme} = this.props;
        let hexColor: string | null | undefined;

        if (action.style) {
            const STATUS_COLORS = this.getStatusColors(theme);
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
                onClick={(e) => handleAction(e, this.props.action.options)}
                className='btn btn-sm'
                hexColor={hexColor}
            >
                <LoadingWrapper
                    loading={this.props.actionExecuting}
                    text={this.props.actionExecutingMessage}
                >
                    <Markdown
                        message={action.name}
                        options={{
                            mentionHighlight: false,
                            markdown: false,
                            autolinkedUrlSchemes: [],
                        }}
                    />
                </LoadingWrapper>
            </ActionBtn>
        );
    }
}

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
