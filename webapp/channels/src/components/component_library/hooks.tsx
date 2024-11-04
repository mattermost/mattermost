// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useMemo, useState} from 'react';

import './component_library.scss';

type HookResult<T> = [
    {[x: string]: T},
    JSX.Element,
]
export const useStringProp = (
    propName: string,
    defaultValue: string,
    isTextarea: boolean,
): HookResult<string> => {
    const [value, setValue] = useState(defaultValue);
    const onChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) => setValue(e.target.value), []);
    const selector = useMemo(() => {
        const input = isTextarea ? (
            <textarea
                onChange={onChange}
                value={value}
            />
        ) : (
            <input
                type='text'
                onChange={onChange}
                value={value}
            />
        );
        return (
            <label className='clInput'>
                {`${propName}: `}
                {input}
            </label>
        );
    }, [onChange, value, propName, isTextarea]);
    const preparedProp = useMemo(() => ({[propName]: value}), [propName, value]);

    return [preparedProp, selector];
};

export const useBooleanProp = (
    propName: string,
    defaultValue: boolean,
): HookResult<boolean> => {
    const [value, setValue] = useState(defaultValue);
    const onChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => setValue(e.target.checked), []);
    const selector = useMemo(() => (
        <label className='clInput'>
            {`${propName}: `}
            <input
                type='checkbox'
                onChange={onChange}
                checked={value}
            />
        </label>
    ), [onChange, propName, value]);
    const preparedProp = useMemo(() => ({[propName]: value}), [propName, value]);

    return [preparedProp, selector];
};

const ALL_OPTION = 'ALL';
type DropdownHookResult = [
    {[x: string]: string} | undefined,
    {[x: string]: string[]} | undefined,
    JSX.Element,
];
export const useDropdownProp = (
    propName: string,
    defaultValue: string,
    options: string[],
    allowAll: boolean,
): DropdownHookResult => {
    const [value, setValue] = useState(defaultValue);
    const onChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => setValue(e.target.value), []);
    const renderedOptions = useMemo(() => {
        const toReturn = options.map((v) => (
            <option
                key={v}
                value={v}
            >
                {v}
            </option>
        ));
        if (allowAll) {
            toReturn.unshift((
                <option
                    key={ALL_OPTION}
                    value={ALL_OPTION}
                >
                    {ALL_OPTION}
                </option>
            ));
        }
        return toReturn;
    }, [options, allowAll]);
    const selector = useMemo(() => (
        <label className='clInput'>
            {`${propName}: `}
            <select
                onChange={onChange}
                value={value}
            >
                {renderedOptions}
            </select>
        </label>
    ), [onChange, propName, renderedOptions, value]);
    const preparedProp = useMemo(() => (value === ALL_OPTION ? undefined : ({[propName]: value})), [propName, value]);
    const preparedPossibilities = useMemo(() => (value === ALL_OPTION ? ({[propName]: options}) : undefined), [propName, value, options]);
    return [preparedProp, preparedPossibilities, selector];
};
