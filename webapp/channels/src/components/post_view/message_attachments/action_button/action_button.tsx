// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {changeOpacity} from 'mattermost-redux/utils/theme_utils';
import {Theme} from 'mattermost-redux/selectors/entities/preferences';
import {PostAction, PostActionOption} from '@mattermost/types/integration_actions';

import LoadingWrapper from 'components/widgets/loading/loading_wrapper';
import Markdown from 'components/markdown';

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
            good: '#00c100',
            warning: '#dede01',
            danger: theme.errorTextColor,
            default: theme.centerChannelColor,
            primary: theme.buttonBg,
            success: theme.onlineIndicator,
        } as Record<string, string>;
    }

    render() {
        const {action, handleAction, disabled, theme} = this.props;
        let customButtonStyle;
        const actionStyle = action.style || 'primary';

        const STATUS_COLORS = this.getStatusColors(theme);
        const hexColor =
            STATUS_COLORS[actionStyle] ||
            theme[actionStyle] ||
            (actionStyle.match('^#(?:[0-9a-fA-F]{3}){1,2}$') && actionStyle);

        if (hexColor) {
            customButtonStyle = {
                borderColor: changeOpacity(hexColor, 0.25),
                backgroundColor: hexColor,
                borderWidth: 2,
            };
        }

        return (
            <button
                data-action-id={action.id}
                data-action-cookie={action.cookie}
                disabled={disabled}
                key={action.id}
                onClick={(e) => handleAction(e, this.props.action.options)}
                style={customButtonStyle}
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
            </button>
        );
    }
}
