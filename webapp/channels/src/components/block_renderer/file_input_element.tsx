// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useContext, useEffect, useMemo} from 'react';
import {FormattedMessage} from 'react-intl';

import type {MmFileInputBlock} from '@mattermost/types/mm_blocks';

import AppsFormFileUpload from 'components/apps_form/apps_form_file_upload';
import Markdown from 'components/markdown';

import {MmBlocksFieldUploadingContext, MmBlocksInteractionsDisabledContext, useMmBlocksHandlers} from './context';
import {MmBlocksFieldError, useMmBlocksForm} from './form';
import {mmBlocksFieldDomId} from './utils/field_dom_id';

type FileInputElementProps = {
    element: MmFileInputBlock;
    postId: string;
};

function normalizeFileIds(value: unknown): string[] {
    if (Array.isArray(value)) {
        return value.filter((id): id is string => typeof id === 'string' && id.length > 0);
    }
    if (typeof value === 'string' && value.trim()) {
        return value.split(',').map((id) => id.trim()).filter(Boolean);
    }
    return [];
}

export const FileInputElement = ({element, postId}: FileInputElementProps) => {
    const interactionsDisabled = useContext(MmBlocksInteractionsDisabledContext);
    const setFieldUploading = useContext(MmBlocksFieldUploadingContext);
    const {onAction} = useMmBlocksHandlers();
    const {values, setValue, setDefaultValue} = useMmBlocksForm();
    const fieldDomId = mmBlocksFieldDomId(postId, element.name);

    useEffect(() => {
        setDefaultValue(element.name, normalizeFileIds(element.initial_value));
    }, [element.name, element.initial_value, setDefaultValue]);

    const handleFileSelected = useCallback(async (fileIds: string[]) => {
        setValue(element.name, fileIds);

        if (!element.onChange || interactionsDisabled) {
            return;
        }

        const formValues = {...values, [element.name]: fileIds};
        try {
            await onAction(element.onChange, undefined, undefined, undefined, formValues);
        } catch (error) {
            // eslint-disable-next-line no-console
            console.error('mm_blocks file_input onChange action failed', error);
        }
    }, [element.name, element.onChange, interactionsDisabled, onAction, setValue, values]);

    const handlePendingChange = useCallback((uploading: boolean) => {
        setFieldUploading?.(element.name, uploading);
    }, [element.name, setFieldUploading]);

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
        normalizeFileIds(element.initial_value) :
        normalizeFileIds(rawValue);

    return (
        <div className='mm-blocks-file-input'>
            <AppsFormFileUpload
                id={fieldDomId}
                label={label}
                helpText={helpText}
                placeholder={element.placeholder}
                value={value}
                allowMultiple={element.allow_multiple === true}
                disabled={interactionsDisabled || element.disabled === true}
                onFileSelected={handleFileSelected}
                onPendingChange={handlePendingChange}
            />
            <MmBlocksFieldError name={element.name}/>
        </div>
    );
};
