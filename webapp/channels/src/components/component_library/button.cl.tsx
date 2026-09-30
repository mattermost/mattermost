// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {useMemo} from 'react';

import glyphMap from '@mattermost/compass-icons/components';
import {Button} from '@mattermost/compass-ui/components/button';
import type {ButtonAppearance, ButtonSize} from '@mattermost/compass-ui/components/button';

import {useBooleanProp, useDropdownProp, useStringProp} from './hooks';
import {buildComponent} from './utils';

const propPossibilities = {};

const iconValues = [''].concat(Object.keys(glyphMap));

const emphasisValues = ['primary', 'secondary', 'tertiary', 'quaternary'];
const sizeValues = ['x-small', 'small', 'medium', 'large'];

type Props = {
    backgroundClass: string;
};

export default function ButtonComponentLibrary({backgroundClass}: Props) {
    const [label, labelSelector] = useStringProp('label', 'Label', false);

    const [leadingIcon, leadingIconPossibilities, leadingIconSelector] = useDropdownProp('leadingIcon', 'mattermost', iconValues, false);
    const [trailingIcon, trailingIconPossibilities, trailingIconSelector] = useDropdownProp('trailingIcon', '', iconValues, false);

    const [emphasis, emphasisPossibilities, emphasisSelector] = useDropdownProp('emphasis', 'primary', emphasisValues, true);
    const [size, sizePossibilities, sizeSelector] = useDropdownProp('size', 'medium', sizeValues, true);
    const [destructive, destructiveSelector] = useBooleanProp('destructive', false);

    const [disabled, disabledSelector] = useBooleanProp('disabled', false);

    const children = useMemo(() => (
        <>
            {leadingIcon?.leadingIcon ? <i className={classNames('icon', `icon-${leadingIcon.leadingIcon}`)}/> : null}
            {label.label}
            {trailingIcon?.trailingIcon ? <i className={classNames('icon', `icon-${trailingIcon.trailingIcon}`)}/> : null}
        </>
    ), [label, leadingIcon, trailingIcon]);

    const components = useMemo(
        () => buildComponent(
            Button,
            propPossibilities,
            [
                emphasisPossibilities,
                leadingIconPossibilities,
                sizePossibilities,
                trailingIconPossibilities,
            ], [
                {children},
                emphasis,
                size,
                destructive,
                disabled,
            ],
        ),
        [
            children,
            destructive,
            disabled,
            emphasis,
            emphasisPossibilities,
            leadingIconPossibilities,
            size,
            sizePossibilities,
            trailingIconPossibilities,
        ],
    );

    return (
        <>
            {labelSelector}
            {leadingIconSelector}
            {trailingIconSelector}
            <hr/>
            {emphasisSelector}
            {sizeSelector}
            {destructiveSelector}
            <hr/>
            {disabledSelector}
            <div className={classNames('clWrapper', backgroundClass)}>{components}</div>
            <ButtonGrid/>
        </>
    );
}

function ButtonGrid() {
    const sizes: ButtonSize[] = ['medium', 'x-small', 'small', 'large'];
    const appearances: Array<{label: string; appearance?: ButtonAppearance; destructive?: boolean}> = [
        {label: 'default'},
        {label: 'destructive', destructive: true},
        {label: 'inverted', appearance: 'inverted'},
    ];
    const states = ['default', 'hover', 'active', 'focus', 'disabled'] as const;

    const emphasisLevels = ['primary', 'secondary', 'tertiary', 'quaternary'] as const;

    const rows = [];
    for (const size of sizes) {
        for (const appearance of appearances) {
            for (const state of states) {
                const row = [];

                if (appearance.label === 'default' && state === 'default') {
                    row.push(
                        <th
                            key='size'
                            scope='row'
                        >
                            {size}
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
                            {appearance.label}
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
                            className={classNames({inverted: appearance.appearance === 'inverted'})}
                        >
                            <Button
                                emphasis={emphasis}
                                size={size}
                                destructive={appearance.destructive}
                                appearance={appearance.appearance}
                                className={stateClassName}
                                disabled={state === 'disabled'}
                            >
                                {'Button'}
                            </Button>
                        </td>,
                    );
                }

                rows.push(
                    <tr key={`${size}-${appearance.label}-${state}`} >
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
