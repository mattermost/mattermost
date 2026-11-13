// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {useMemo} from 'react';

import glyphMap from '@mattermost/compass-icons/components';
import type {IconGlyphTypes} from '@mattermost/compass-icons/IconGlyphs';
import {Button} from '@mattermost/compass-ui/components/button';
import type {ButtonAppearance, ButtonSize} from '@mattermost/compass-ui/components/button';
import {Icon} from '@mattermost/compass-ui/components/icon';

import {useBooleanProp, useDropdownProp, useStringProp} from './hooks';
import {buildComponent} from './utils';

const propPossibilities = {};

const iconValues = [''].concat(Object.keys(glyphMap));

const emphasisValues = ['primary', 'secondary', 'tertiary', 'quaternary'];
const sizeValues = ['x-small', 'small', 'medium', 'large'];

type Props = {
    backgroundClass: string;
};

function iconFromName(name: string | undefined) {
    if (!name) {
        return undefined;
    }

    const Glyph = glyphMap[name as IconGlyphTypes];
    if (!Glyph) {
        return undefined;
    }

    return <Icon glyph={<Glyph/>}/>;
}

export default function ButtonComponentLibrary({backgroundClass}: Props) {
    const [label, labelSelector] = useStringProp('label', 'Label', false);

    const [leadingIcon, , leadingIconSelector] = useDropdownProp('leadingIcon', 'mattermost', iconValues, false);
    const [trailingIcon, , trailingIconSelector] = useDropdownProp('trailingIcon', '', iconValues, false);

    const [emphasis, emphasisPossibilities, emphasisSelector] = useDropdownProp('emphasis', 'primary', emphasisValues, true);
    const [size, sizePossibilities, sizeSelector] = useDropdownProp('size', 'medium', sizeValues, true);
    const [destructive, destructiveSelector] = useBooleanProp('destructive', false);

    const [disabled, disabledSelector] = useBooleanProp('disabled', false);

    const leadingIconProp = useMemo(() => {
        const icon = iconFromName(leadingIcon?.leadingIcon);
        return icon ? {leadingIcon: icon} : undefined;
    }, [leadingIcon]);

    const trailingIconProp = useMemo(() => {
        const icon = iconFromName(trailingIcon?.trailingIcon);
        return icon ? {trailingIcon: icon} : undefined;
    }, [trailingIcon]);

    const children = useMemo(() => label.label, [label]);

    const components = useMemo(
        () => buildComponent(
            Button,
            propPossibilities,
            [
                emphasisPossibilities,
                sizePossibilities,
            ], [
                {children},
                leadingIconProp,
                trailingIconProp,
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
            leadingIconProp,
            size,
            sizePossibilities,
            trailingIconProp,
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
