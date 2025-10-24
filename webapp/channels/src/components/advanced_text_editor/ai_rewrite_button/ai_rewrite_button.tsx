// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {memo, useCallback} from 'react';
import {useIntl} from 'react-intl';

import {LightbulbOutlineIcon} from '@mattermost/compass-icons/components';

import * as Menu from 'components/menu';

import './ai_rewrite_button.scss';

export type AIRewriteAction = 'more_succinct' | 'more_professional' | 'format_markdown' | 'make_longer';

interface AIRewriteButtonProps {
    onClick: (action: AIRewriteAction) => void;
    disabled: boolean;
    isLoading?: boolean;
}

const AIRewriteButton = ({onClick, disabled, isLoading = false}: AIRewriteButtonProps): JSX.Element => {
    const {formatMessage} = useIntl();

    const handleMenuItemClick = useCallback((action: AIRewriteAction) => {
        onClick(action);
    }, [onClick]);

    const tooltipTitle = formatMessage({
        id: 'textbox.ai_rewrite.tooltip',
        defaultMessage: 'Rewrite with AI',
    });

    return (
        <Menu.Container
            menuButtonTooltip={{
                text: tooltipTitle,
                disabled: disabled || isLoading,
            }}
            menuButton={{
                id: 'aiRewriteButton',
                class: classNames('AIRewriteButton__button', {disabled, loading: isLoading}),
                children: (
                    <LightbulbOutlineIcon
                        size={18}
                        color={'currentColor'}
                        className={isLoading ? 'spinning' : ''}
                    />
                ),
                disabled: disabled || isLoading,
                'aria-label': formatMessage({id: 'accessibility.button.ai_rewrite', defaultMessage: 'AI Rewrite'}),
            }}
            menu={{
                id: 'dropdown_ai_rewrite_options',
            }}
            transformOrigin={{
                horizontal: 'right',
                vertical: 'bottom',
            }}
            anchorOrigin={{
                vertical: 'top',
                horizontal: 'right',
            }}
        >
            <Menu.Item
                onClick={() => handleMenuItemClick('more_succinct')}
                labels={formatMessage({
                    id: 'textbox.ai_rewrite.more_succinct',
                    defaultMessage: 'More Succinct',
                })}
                ariaLabel={formatMessage({
                    id: 'textbox.ai_rewrite.more_succinct.aria',
                    defaultMessage: 'Rewrite message to be more succinct',
                })}
            />
            <Menu.Item
                onClick={() => handleMenuItemClick('more_professional')}
                labels={formatMessage({
                    id: 'textbox.ai_rewrite.more_professional',
                    defaultMessage: 'More Professional',
                })}
                ariaLabel={formatMessage({
                    id: 'textbox.ai_rewrite.more_professional.aria',
                    defaultMessage: 'Rewrite message to be more professional',
                })}
            />
            <Menu.Item
                onClick={() => handleMenuItemClick('format_markdown')}
                labels={formatMessage({
                    id: 'textbox.ai_rewrite.format_markdown',
                    defaultMessage: 'Format with Markdown',
                })}
                ariaLabel={formatMessage({
                    id: 'textbox.ai_rewrite.format_markdown.aria',
                    defaultMessage: 'Format message with Markdown',
                })}
            />
            <Menu.Item
                onClick={() => handleMenuItemClick('make_longer')}
                labels={formatMessage({
                    id: 'textbox.ai_rewrite.make_longer',
                    defaultMessage: 'Make it Longer',
                })}
                ariaLabel={formatMessage({
                    id: 'textbox.ai_rewrite.make_longer.aria',
                    defaultMessage: 'Expand and elaborate on the message',
                })}
            />
        </Menu.Container>
    );
};

export default memo(AIRewriteButton);

