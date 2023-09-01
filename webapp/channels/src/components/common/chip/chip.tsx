// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';
import styled from 'styled-components';

import RenderEmoji from 'components/emoji/render_emoji';

// This component is a temporary placeholder for use until the authoritative `compass-components` Chip is implemented.

type Props = {
    onClick?: () => void;
    id?: string;
    defaultMessage?: string;
    values?: Record<string, any>;
    className?: string;

    // for the "other" option unlike the others, e.g. free-form response
    otherOption?: boolean;
    leadingIcon?: string;
    additionalMarkup?: React.ReactNode | React.ReactNodeArray;
}

const StyledChip = styled.button<{ otherOption?: boolean }>`
    display: flex;
    flex-shrink: 0;
    align-items: center;
    box-shadow: var(--elevation-1);
    font-weight: bold;

    padding: 6px 12px;
    margin-right: 12px;
    margin-bottom: 12px;

    &:last-child {
        margin-right: 0;
    }

    border: 1px solid rgba(var(--center-channel-color-rgb), 0.08);
    border-radius: 16px;

    background-color: var(--center-channel-bg);
    ${(p) => (p.otherOption ? 'color: rgba(var(--center-channel-color-rgb), 0.75);' : '')}

    &:hover {
        background-color: rgba(var(--center-channel-color-rgb), 0.08);
    }

    &:active {
        background-color: rgba(var(--mention-highlight-link-rgb), 0.08);
    }
`;

export default class Chip extends React.PureComponent<Props> {
    onClick = (e: React.MouseEvent) => {
        e.preventDefault();
        this.props.onClick?.();
    };

    render() {
        return (
            <StyledChip
                onClick={this.onClick}
                otherOption={this.props.otherOption}
                className={this.props.className || ''}
            >
                {this.props.leadingIcon && (
                    <RenderEmoji
                        emojiName={this.props.leadingIcon}
                        emojiStyle={{marginRight: '11px'}}
                    />
                )}
                {(this.props.id && this.props.defaultMessage && this.props.values) && (
                    <FormattedMessage
                        id={this.props.id}
                        defaultMessage={this.props.defaultMessage}
                        values={this.props.values}
                    />
                )}
                {this.props.additionalMarkup}
            </StyledChip>
        );
    }
}
