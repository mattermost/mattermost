// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {useMemo} from 'react';

import glyphMap from '@mattermost/compass-icons/components';
import {Button} from '@mattermost/shared/components/button';

import {useBooleanProp, useLibraryComponent, useDropdownProp, useStringProp} from './hooks';

const propPossibilities = {};

const iconValues = [''].concat(Object.keys(glyphMap));

const emphasisValues = ['primary', 'secondary', 'tertiary', 'quaternary'];
const sizeValues = ['xs', 'sm', 'md', 'lg'];
const variantValues = ['', 'destructive'];

type Props = {
    backgroundClass: string;
};

export default function ButtonComponentLibrary({backgroundClass}: Props) {
    const labelProp = useStringProp('label', 'Label', false);

    const [leadingIcon, leadingIconPossibilities, leadingIconSelector] = useDropdownProp('leadingIcon', 'mattermost', iconValues, false);
    const [trailingIcon, trailingIconPossibilities, trailingIconSelector] = useDropdownProp('trailingIcon', '', iconValues, false);

    const emphasisProp = useDropdownProp('emphasis', 'primary', emphasisValues, true);
    const sizeProp = useDropdownProp('size', 'md', sizeValues, true);
    const variantProp = useDropdownProp('variant', '', variantValues, true);

    const disabledProp = useBooleanProp('disabled', false);

    const children = useMemo(() => ({
        children: (
            <>
                {leadingIconProp[0]?.leadingIcon ? <i className={classNames('icon', `icon-${leadingIconProp[0]?.leadingIcon}`)}/> : null}
                {labelProp[0]?.label}
                {trailingIconProp[0]?.trailingIcon ? <i className={classNames('icon', `icon-${trailingIconProp[0]?.trailingIcon}`)}/> : null}
            </>
        ),
    }), [labelProp, leadingIconProp, trailingIconProp]);

    const {components, selectors} = useLibraryComponent(
        Button,
        propPossibilities,
        [
            children,
            <hr key='first-selector'/>,
            emphasisProp,
            sizeProp,
            variantProp,
            <hr key='second-selector'/>,
            disabledProp,
        ],
    );

    return (
        <>
            {labelProp[1]}
            {leadingIconProp[2]}
            {trailingIconProp[2]}
            {selectors}
            <div className={classNames('clWrapper', backgroundClass)}>{components}</div>
            <ButtonGrid/>
        </>
    );
}

function ButtonGrid() {
    const sizes = ['md', 'xs', 'sm', 'lg'] as const;
    const variants = ['', 'destructive', 'inverted'] as const;
    const states = ['default', 'hover', 'active', 'focus', 'disabled'] as const;

    const emphasisLevels = ['primary', 'secondary', 'tertiary', 'quaternary'] as const;

    const rows = [];
    for (const size of sizes) {
        for (const variant of variants) {
            for (const state of states) {
                const row = [];

                if (variant === '' && state === 'default') {
                    const sizeLabels = {md: 'medium', xs: 'x-small', sm: 'small', lg: 'large'} as const;
                    row.push(
                        <th
                            key='size'
                            scope='row'
                        >
                            {sizeLabels[size]}
                        </th>,
                    );
                } else {
                    row.push(
                        <th key='size'/>,
                    );
                }

                if (state === 'default') {
                    row.push(
                        <th
                            key='variant'
                            scope='row'
                        >
                            {variant}
                        </th>,
                    );
                } else {
                    row.push(
                        <th key='variant'/>,
                    );
                }

                row.push(
                    <th
                        key='state'
                        scope='row'
                    >
                        {state}
                    </th>,
                );

                let stateClassName = '';
                if (state === 'hover' || state === 'active' || state === 'focus') {
                    stateClassName = `btn-force-${state}`;
                }

                for (const emphasis of emphasisLevels) {
                    row.push(
                        <td
                            key={emphasis}
                            className={classNames({inverted: variant === 'inverted'})}
                        >
                            <Button
                                emphasis={emphasis}
                                size={size}
                                variant={variant}
                                className={stateClassName}
                                disabled={state === 'disabled'}
                            >
                                {'Button'}
                            </Button>
                        </td>,
                    );
                }

                rows.push(
                    <tr key={`${size}-${variant}-${state}`} >
                        {row}
                    </tr>,
                );
            }
        }
    }

    return (
        <table className='clWrapper clTable'>
            <thead>
                <tr>
                    <th colSpan={3}/>
                    {emphasisLevels.map((emphasis) => (
                        <th
                            key={emphasis}
                            scope='col'
                        >
                            {emphasis}
                        </th>
                    ))}
                </tr>
            </thead>
            <tbody>
                {rows}
            </tbody>
        </table>
    );
}
