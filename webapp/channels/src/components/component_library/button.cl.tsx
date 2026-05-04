// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {useMemo} from 'react';

import glyphMap from '@mattermost/compass-icons/components';
import {Button} from '@mattermost/shared/components/button';

import {useBooleanProp, useDropdownProp, useStringProp} from './hooks';
import {buildComponent} from './utils';

const propPossibilities = {};

const iconValues = [''].concat(Object.keys(glyphMap));

const emphasisValues = ['primary', 'secondary', 'tertiary', 'quaternary'];
const sizeValues = ['xs', 'sm', 'md', 'lg'];
const variantValues = ['', 'destructive'];

type Props = {
    backgroundClass: string;
};

export default function ButtonComponentLibrary({backgroundClass}: Props) {
    const [label, labelSelector] = useStringProp('label', 'Label', false);

    const [leadingIcon, leadingIconPossibilities, leadingIconSelector] = useDropdownProp('leadingIcon', 'mattermost', iconValues, false);
    const [trailingIcon, trailingIconPossibilities, trailingIconSelector] = useDropdownProp('trailingIcon', 'Trailing Icon', iconValues, false);

    const [emphasis, emphasisPossibilities, emphasisSelector] = useDropdownProp('emphasis', 'primary', emphasisValues, true);
    const [size, sizePossibilities, sizeSelector] = useDropdownProp('size', 'md', sizeValues, true);
    const [variant, variantPossibilities, variantSelector] = useDropdownProp('variant', '', variantValues, true);

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
                variantPossibilities,
            ], [
                {children},
                emphasis,
                size,
                variant,
                disabled,
            ],
        ),
        [
            children,
            disabled,
            emphasis,
            emphasisPossibilities,
            leadingIconPossibilities,
            size,
            sizePossibilities,
            trailingIconPossibilities,
            variant,
            variantPossibilities,
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
            {variantSelector}
            <hr/>
            {disabledSelector}
            <div className={classNames('clWrapper', backgroundClass)}>{components}</div>
        </>
    );
}
