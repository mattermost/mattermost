// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useContext, useEffect, useMemo} from 'react';
import {FormattedMessage} from 'react-intl';

import type {AppField} from '@mattermost/types/apps';
import type {MmDateInputBlock} from '@mattermost/types/mm_blocks';

import {AppFieldTypes} from 'mattermost-redux/constants/apps';

import AppsFormDateField from 'components/apps_form/apps_form_date_field';
import Markdown from 'components/markdown';

import {MmBlocksInteractionsDisabledContext, useMmBlocksHandlers} from './context';
import {MmBlocksFieldError, useMmBlocksForm} from './form';
import {mmBlocksFieldDomId} from './utils/field_dom_id';

type DateInputElementProps = {
    element: MmDateInputBlock;
    postId: string;
};

function normalizeDateValue(value: unknown): string | null {
    if (value === null || value === undefined || value === '') {
        return null;
    }
    return String(value);
}

function toAppField(element: MmDateInputBlock, interactionsDisabled: boolean): AppField {
    return {
        name: element.name,
        type: AppFieldTypes.DATE,
        label: element.label,

        // We use here the placeholder instead of the help_text, because hint in the
        // Apps Form Date Field component is the value placeholder.
        hint: element.placeholder,
        readonly: interactionsDisabled || element.disabled === true,
        is_required: element.optional !== true,
        datetime_config: element.datetime_config,
    };
}

export const DateInputElement = ({element, postId}: DateInputElementProps) => {
    const interactionsDisabled = useContext(MmBlocksInteractionsDisabledContext);
    const {onAction} = useMmBlocksHandlers();
    const {values, setValue, setDefaultValue} = useMmBlocksForm();
    const fieldDomId = mmBlocksFieldDomId(postId, element.name);

    useEffect(() => {
        setDefaultValue(element.name, element.initial_value ?? '');
    }, [element.name, element.initial_value, setDefaultValue]);

    const handleChange = useCallback((name: string, value: string | null) => {
        const next = value ?? '';
        setValue(name, next);

        if (!element.onChange || interactionsDisabled) {
            return;
        }

        const formValues = {...values, [name]: next};
        onAction(element.onChange, undefined, undefined, undefined, formValues);
    }, [element.onChange, interactionsDisabled, onAction, setValue, values]);

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
    const field = useMemo(
        () => toAppField(element, interactionsDisabled),
        [element, interactionsDisabled],
    );

    if (!element.name) {
        return null;
    }

    const rawValue = values[element.name];
    const value = rawValue === undefined || rawValue === null ?
        normalizeDateValue(element.initial_value) :
        normalizeDateValue(rawValue);

    return (
        <div className='mm-blocks-date-input form-group'>
            {label && (
                <label
                    className='control-label'
                    htmlFor={fieldDomId}
                >
                    {label}
                </label>
            )}
            <AppsFormDateField
                id={fieldDomId}
                field={field}
                value={value}
                onChange={handleChange}
            />
            {helpText && (
                <div className='help-text'>
                    {helpText}
                </div>
            )}
            <MmBlocksFieldError name={element.name}/>
        </div>
    );
};
