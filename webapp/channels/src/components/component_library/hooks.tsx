// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useMemo, useState} from 'react';

import './component_library.scss';
import {buildComponent} from './utils';

type HookResult<T> = [
    {[x: string]: T},
    JSX.Element,
];
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

type PropResult = HookResult<any> | DropdownHookResult | {[x: string]: unknown} | undefined;

export const useComponentWithProps = (
    Component: React.ComponentType<any>,
    propPossibilities: {[x: string]: any[]},
    propsArray: PropResult[],
): React.ReactNode[] => {
    const dropdownPossibilities = useMemo(
        () => propsArray.filter(isDropdownHookResult).map((r) => r[1]),

        // eslint-disable-next-line react-hooks/exhaustive-deps
        [...propsArray],
    );
    const setProps = useMemo(
        () => propsArray.map((r) => {
            return Array.isArray(r) ? r[0] : r;
        }),

        // eslint-disable-next-line react-hooks/exhaustive-deps
        [...propsArray],
    );

    return useMemo(
        () => buildComponent(Component, propPossibilities, dropdownPossibilities, setProps),

        // eslint-disable-next-line react-hooks/exhaustive-deps
        [Component, ...Object.values(propPossibilities), ...dropdownPossibilities, ...setProps],
    );
};

export const usePropSelectors = (
    propsOrComponents: Array<PropResult | React.ReactNode>,
) => {
    return useMemo(
        () => propsOrComponents.flatMap((r) => {
            if (React.isValidElement(r)) {
                return [r];
            }

            if (!Array.isArray(r)) {
                return [];
            }

            return isDropdownHookResult(r) ? r[2] : r[1];
        }).map((r, index) => React.cloneElement(r, {key: index})),

        // eslint-disable-next-line react-hooks/exhaustive-deps
        propsOrComponents,
    );
};

function isDropdownHookResult(o: PropResult): o is DropdownHookResult {
    return Array.isArray(o) && o.length === 3;
}
