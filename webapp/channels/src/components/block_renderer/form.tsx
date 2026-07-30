// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {createContext, useCallback, useContext, useMemo, useState} from 'react';
import type {ReactNode} from 'react';

/** Value stored for a form input field (keyed by field `name`). */
export type MmFormValue = string | string[] | boolean | number | null;

export type MmBlocksFormValues = Record<string, MmFormValue>;
export type MmBlocksFormErrors = Record<string, string>;

/** Absolute replace or functional update (same shape as React setState). */
export type MmBlocksFormErrorsChange = (
    errors: MmBlocksFormErrors | ((prev: MmBlocksFormErrors) => MmBlocksFormErrors),
) => void;

export type MmBlocksFormContextValue = {
    values: MmBlocksFormValues;
    getValue: (name: string) => MmFormValue | undefined;
    setValue: (name: string, value: MmFormValue) => void;

    /** Seeds a field only if it has not been set yet (survives block re-translation). */
    setDefaultValue: (name: string, value: MmFormValue) => void;

    /** Server/integration field errors keyed by input `name`. */
    errors: MmBlocksFormErrors;
    setErrors: (errors: MmBlocksFormErrors) => void;
    clearError: (name: string) => void;
};

export const MmBlocksFormContext = createContext<MmBlocksFormContextValue | null>(null);

export function useMmBlocksForm(): MmBlocksFormContextValue {
    const ctx = useContext(MmBlocksFormContext);
    if (!ctx) {
        throw new Error('useMmBlocksForm must be used within MmBlocksForm');
    }
    return ctx;
}

type MmBlocksFormProps = {
    children: ReactNode;

    /** Field errors owned by the parent (e.g. from do-block-action `errors`). */
    errors: MmBlocksFormErrors;
    onErrorsChange: MmBlocksFormErrorsChange;
};

/**
 * Tracks form input values for mm_blocks and exposes them via context.
 * Wraps the root block container so input blocks can read/update their values.
 * Field errors are always controlled by the parent.
 */
export function MmBlocksForm({children, errors, onErrorsChange}: MmBlocksFormProps) {
    const [values, setValues] = useState<MmBlocksFormValues>({});

    const setErrors = useCallback((next: MmBlocksFormErrors) => {
        onErrorsChange(next);
    }, [onErrorsChange]);

    const clearError = useCallback((name: string) => {
        onErrorsChange((prev) => {
            if (!Object.prototype.hasOwnProperty.call(prev, name)) {
                return prev;
            }
            const next = {...prev};
            delete next[name];
            return next;
        });
    }, [onErrorsChange]);

    const getValue = useCallback((name: string) => values[name], [values]);

    const setValue = useCallback((name: string, value: MmFormValue) => {
        setValues((prev) => {
            if (prev[name] === value) {
                return prev;
            }
            return {...prev, [name]: value};
        });
        clearError(name);
    }, [clearError]);

    const setDefaultValue = useCallback((name: string, value: MmFormValue) => {
        setValues((prev) => {
            if (Object.prototype.hasOwnProperty.call(prev, name)) {
                return prev;
            }
            return {...prev, [name]: value};
        });
    }, []);

    const contextValue = useMemo((): MmBlocksFormContextValue => ({
        values,
        getValue,
        setValue,
        setDefaultValue,
        errors,
        setErrors,
        clearError,
    }), [values, getValue, setValue, setDefaultValue, errors, setErrors, clearError]);

    return (
        <MmBlocksFormContext.Provider value={contextValue}>
            <form
                className='MmBlocksForm'
                onSubmit={(e) => e.preventDefault()}
            >
                {children}
            </form>
        </MmBlocksFormContext.Provider>
    );
}

/** Renders a field-level integration error under an input, if present. */
export function MmBlocksFieldError({name}: {name: string}) {
    const {errors} = useMmBlocksForm();
    const message = errors[name];
    if (!message) {
        return null;
    }
    return (
        <div
            className='has-error'
            data-testid={`${name}-error`}
        >
            <label className='control-label'>{message}</label>
        </div>
    );
}
