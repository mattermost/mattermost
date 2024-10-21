// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

function buildPropsLists(inputPossibilities: {[x: string]: any[]}): Array<{[x: string]: any}> {
    const keys = Object.keys(inputPossibilities);
    if (!keys.length) {
        return [{}];
    }

    const selectedKey = keys[0];
    const restPossibilities = {...inputPossibilities};
    delete restPossibilities[selectedKey];
    const subProps = buildPropsLists(restPossibilities);
    const result: Array<{[x: string]: any}> = [];
    inputPossibilities[selectedKey].forEach((v) => {
        subProps.forEach((rest) => {
            result.push({...rest, [selectedKey]: v});
        });
    });

    return result;
}

function buildPropString(inputProps: {[x: string]: any}) {
    const propKeys = Object.keys(inputProps);
    if (!propKeys.length) {
        return undefined;
    }

    const result = [(<>{'PROPS: '}</>)];
    propKeys.forEach((v) => {
        result.push((<><b>{v}</b>{`: ${inputProps[v]}, `}</>));
    });
    return result;
}

export function buildComponent(
    Component: React.ComponentType<any>,
    propPossibilities: {[x: string]: any[]},
    dropdownPossibilities: Array<{[x: string]: string[]} | undefined>,
    setProps: Array<{[x: string]: any} | undefined>,
) {
    const res: React.ReactNode[] = [];
    let currentPropPossibilities = {...propPossibilities};
    dropdownPossibilities.forEach((v) => {
        if (v) {
            currentPropPossibilities = {
                ...currentPropPossibilities,
                ...v,
            };
        }
    });

    const propsVariations = buildPropsLists(currentPropPossibilities);
    let builtSetProps = {};
    setProps.forEach((v) => {
        if (v) {
            builtSetProps = {
                ...builtSetProps,
                ...v,
            };
        }
    });
    propsVariations.forEach((v) => {
        const propString = buildPropString(v);
        res.push(
            <>
                {Boolean(propString) && <p>{propString}</p>}
                <Component
                    {...builtSetProps}
                    {...v}
                />
            </>,
        );
    });
    return res;
}
