// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback} from 'react';
import {useSelector} from 'react-redux';

import {WithTooltip} from '@mattermost/shared/components/tooltip';
import type {MmButtonBlock} from '@mattermost/types/mm_blocks';

import {getTheme} from 'mattermost-redux/selectors/entities/preferences';

import {mmBlocksButtonClassName, mmBlocksButtonInlineStyle} from './button_utils';
import type {ActionHandler} from './types';

type ButtonElementProps = {
    element: MmButtonBlock;
    onAction: ActionHandler;
};

export const ButtonElement = ({element, onAction}: ButtonElementProps) => {
    const theme = useSelector(getTheme);

    const handleClick = useCallback(() => {
        if (!element.text) {
            return;
        }
        if (!element.action_id) {
            return;
        }
        onAction(element.action_id, undefined, element.query, element.cookie);
    }, [element.action_id, element.cookie, element.query, element.text, onAction]);

    if (!element.text || (!element.action_id)) {
        return null;
    }

    const button = (
        <button
            type='button'
            className={mmBlocksButtonClassName(element.style)}
            style={mmBlocksButtonInlineStyle(element.style, theme)}
            onClick={handleClick}
            disabled={element.disabled === true}
        >
            {element.text}
        </button>
    );

    return (
        <WithTooltip
            title={element.tooltip ?? ''}
            disabled={!element.tooltip}
        >
            {button}
        </WithTooltip>
    );
};
