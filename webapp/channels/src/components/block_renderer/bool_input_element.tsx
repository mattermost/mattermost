// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useContext, useEffect, useMemo} from 'react';
import {FormattedMessage} from 'react-intl';

import type {MmBoolInputBlock} from '@mattermost/types/mm_blocks';

import Markdown from 'components/markdown';
import BoolSetting from 'components/widgets/settings/bool_setting';

import {MmBlocksInteractionsDisabledContext, useMmBlocksHandlers} from './context';
import {MmBlocksFieldError, useMmBlocksForm} from './form';
import {mmBlocksFieldDomId} from './utils/field_dom_id';

type BoolInputElementProps = {
    element: MmBoolInputBlock;
    postId: string;
};

function normalizeBoolValue(value: unknown): boolean {
    return value === true;
}

export const BoolInputElement = ({element, postId}: BoolInputElementProps) => {
    const interactionsDisabled = useContext(MmBlocksInteractionsDisabledContext);
    const {onAction} = useMmBlocksHandlers();
    const {values, setValue, setDefaultValue} = useMmBlocksForm();
    const fieldDomId = mmBlocksFieldDomId(postId, element.name);

    useEffect(() => {
        setDefaultValue(element.name, element.initial_value ?? false);
    }, [element.name, element.initial_value, setDefaultValue]);

    const handleChange = useCallback((_id: string, value: unknown) => {
        const next = normalizeBoolValue(value);
        setValue(element.name, next);

        if (!element.onChange || interactionsDisabled) {
            return;
        }

        const formValues = {...values, [element.name]: next};
        onAction(element.onChange, undefined, undefined, undefined, formValues);
    }, [element.name, element.onChange, interactionsDisabled, onAction, setValue, values]);

    const label = useMemo(() => {
        if (!element.label.trim()) {
            return null;
        }
        if (element.optional) {
            return (
                <>
                    {element.label}
                    <span className='light'>
                        {' '}
                        <FormattedMessage
                            id='interactive_dialog.element.optional'
                            defaultMessage='(optional)'
                        />
                    </span>
                </>
            );
        }
        return (
            <>
                {element.label}
                <span className='error-text'>{' *'}</span>
            </>
        );
    }, [element.label, element.optional]);

    const helpText = element.help_text ? <Markdown message={element.help_text}/> : undefined;

    if (!element.name) {
        return null;
    }

    const rawValue = values[element.name];
    const value = rawValue === undefined || rawValue === null ?
        (element.initial_value ?? false) :
        normalizeBoolValue(rawValue);

    return (
        <div className='mm-blocks-bool-input'>
            <BoolSetting
                id={fieldDomId}
                label={label}
                placeholder={element.placeholder ?? ''}
                value={value}
                helpText={helpText}
                disabled={interactionsDisabled || element.disabled === true}
                onChange={handleChange}
            />
            <MmBlocksFieldError name={element.name}/>
        </div>
    );
};
