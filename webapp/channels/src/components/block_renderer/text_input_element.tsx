// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useContext, useEffect, useMemo} from 'react';
import {FormattedMessage} from 'react-intl';

import type {MmTextInputBlock} from '@mattermost/types/mm_blocks';

import Markdown from 'components/markdown';
import TextSetting from 'components/widgets/settings/text_setting';
import type {InputTypes} from 'components/widgets/settings/text_setting';

import {MmBlocksInteractionsDisabledContext, useMmBlocksHandlers} from './context';
import type {MmFormValue} from './form';
import {MmBlocksFieldError, useMmBlocksForm} from './form';
import {mmBlocksFieldDomId} from './utils/field_dom_id';

const TEXT_DEFAULT_MAX_LENGTH = 150;
const TEXTAREA_DEFAULT_MAX_LENGTH = 3000;

type TextInputElementProps = {
    element: MmTextInputBlock;
    postId: string;
};

function textInputType(element: MmTextInputBlock): InputTypes {
    if (element.multiline) {
        return 'textarea';
    }
    const subtype = element.subtype || 'text';
    switch (subtype) {
    case 'email':
    case 'number':
    case 'password':
    case 'tel':
    case 'url':
    case 'text':
        return subtype;
    default:
        return 'text';
    }
}

function isNumberInput(element: MmTextInputBlock): boolean {
    return !element.multiline && element.subtype === 'number';
}

/** TextSetting emits numbers for type=number (including NaN when cleared). */
function normalizeTextValue(value: unknown, asNumber: boolean): string | number | null {
    if (asNumber) {
        if (typeof value === 'number') {
            return Number.isFinite(value) ? value : null;
        }
        if (value === '' || value === null || value === undefined) {
            return null;
        }
        const parsed = typeof value === 'string' ? Number(value) : NaN;
        return Number.isFinite(parsed) ? parsed : null;
    }
    if (value === null || value === undefined) {
        return '';
    }
    return String(value);
}

function initialTextFormValue(element: MmTextInputBlock): string | number | null {
    if (isNumberInput(element)) {
        if (element.initial_value === undefined || element.initial_value === '') {
            return null;
        }
        const parsed = Number(element.initial_value);
        return Number.isFinite(parsed) ? parsed : null;
    }
    return element.initial_value ?? '';
}

function displayTextValue(
    rawValue: MmFormValue | undefined,
    element: MmTextInputBlock,
    inputType: InputTypes,
): string | number {
    if (inputType === 'number') {
        if (typeof rawValue === 'number' && Number.isFinite(rawValue)) {
            return rawValue;
        }
        if (rawValue === undefined || rawValue === null) {
            return initialTextFormValue(element) ?? '';
        }
        const parsed = typeof rawValue === 'string' ? Number(rawValue) : NaN;
        return Number.isFinite(parsed) ? parsed : '';
    }
    if (rawValue === undefined || rawValue === null) {
        return element.initial_value ?? '';
    }
    return String(rawValue);
}

export const TextInputElement = ({element, postId}: TextInputElementProps) => {
    const interactionsDisabled = useContext(MmBlocksInteractionsDisabledContext);
    const {onAction} = useMmBlocksHandlers();
    const {values, setValue, setDefaultValue} = useMmBlocksForm();
    const fieldDomId = mmBlocksFieldDomId(postId, element.name);
    const asNumber = isNumberInput(element);

    useEffect(() => {
        setDefaultValue(element.name, initialTextFormValue(element));
    }, [element.name, element.initial_value, element.subtype, element.multiline, setDefaultValue]);

    const handleChange = useCallback((_id: string, value: unknown) => {
        const next = normalizeTextValue(value, asNumber);
        setValue(element.name, next);

        if (!element.onChange || interactionsDisabled) {
            return;
        }

        const formValues = {...values, [element.name]: next};
        onAction(element.onChange, undefined, undefined, undefined, formValues);
    }, [asNumber, element.name, element.onChange, interactionsDisabled, onAction, setValue, values]);

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

    const inputType = textInputType(element);
    const maxLength = element.max_length ?? (
        inputType === 'textarea' ? TEXTAREA_DEFAULT_MAX_LENGTH : TEXT_DEFAULT_MAX_LENGTH
    );
    const value = displayTextValue(values[element.name], element, inputType);

    return (
        <div className='mm-blocks-text-input'>
            <TextSetting
                id={fieldDomId}
                label={label}
                type={inputType}
                value={value}
                placeholder={element.placeholder ?? ''}
                helpText={helpText}
                maxLength={maxLength}
                disabled={interactionsDisabled || element.disabled === true}
                onChange={handleChange}
                resizable={false}
                footer={<MmBlocksFieldError name={element.name}/>}
            />
        </div>
    );
};
