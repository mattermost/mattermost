// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useContext, useState} from 'react';
import {useSelector} from 'react-redux';

import {WithTooltip} from '@mattermost/shared/components/tooltip';
import type {MmButtonBlock} from '@mattermost/types/mm_blocks';

import {getTheme} from 'mattermost-redux/selectors/entities/preferences';

import Markdown from 'components/markdown';
import LoadingSpinner from 'components/widgets/loading/loading_spinner';

import {MmBlocksHasUploadingFieldsContext, MmBlocksInteractionsDisabledContext, useMmBlocksHandlers} from './context';
import {useMmBlocksForm} from './form';
import {mmBlocksButtonClassName, mmBlocksButtonInlineStyle} from './utils/button';

const buttonMarkdownOptions = {
    mentionHighlight: false,
    markdown: false,
};

type ButtonElementProps = {
    element: MmButtonBlock;
};

export const ButtonElement = ({element}: ButtonElementProps) => {
    const theme = useSelector(getTheme);
    const interactionsDisabled = useContext(MmBlocksInteractionsDisabledContext);
    const hasUploadingFields = useContext(MmBlocksHasUploadingFieldsContext);
    const {onAction} = useMmBlocksHandlers();
    const {values} = useMmBlocksForm();
    const [isExecuting, setIsExecuting] = useState(false);

    const isSubmit = element.subtype === 'submit';
    const blockedByUpload = isSubmit && hasUploadingFields;

    const handleClick = useCallback(async () => {
        if (interactionsDisabled || isExecuting || blockedByUpload || !element.text || !element.action_id) {
            return;
        }
        setIsExecuting(true);
        try {
            const formValues = isSubmit ? values : undefined;
            await onAction(element.action_id, undefined, element.query, element.cookie, formValues);
        } finally {
            setIsExecuting(false);
        }
    }, [blockedByUpload, element.action_id, element.cookie, element.query, element.text, interactionsDisabled, isExecuting, isSubmit, onAction, values]);

    if (!element.text || (!element.action_id)) {
        return null;
    }

    const button = (
        <button
            type='button'
            className={mmBlocksButtonClassName(element.style)}
            style={mmBlocksButtonInlineStyle(element.style, theme)}
            onClick={handleClick}
            disabled={interactionsDisabled || element.disabled === true || isExecuting || blockedByUpload}
            aria-busy={isExecuting}
        >
            {isExecuting && <LoadingSpinner/>}
            <Markdown
                message={element.text}
                options={buttonMarkdownOptions}
            />
        </button>
    );

    if (!element.tooltip) {
        return button;
    }

    return (
        <WithTooltip title={element.tooltip}>
            {button}
        </WithTooltip>
    );
};
