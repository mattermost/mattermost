// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/* eslint-disable no-alert */

import classNames from 'classnames';
import React, {useCallback, useMemo, useState} from 'react';

import IconButton from 'components/design_system/icon-button';

import {useBooleanProp, useDropdownProp, useStringProp} from '../../component_library/hooks';
import {buildComponent} from '../../component_library/utils';

import '../../component_library/component_library.scss';

const propPossibilities = {};

const sizeValues = ['xs', 'sm', 'md', 'lg'];
const paddingValues = ['default', 'compact'];

// Sample icons for testing
const SampleIcon = () => (
    <i className="icon icon-plus" style={{fontSize: 'inherit', width: '1em', height: '1em'}}/>
);

const HeartIcon = () => (
    <i className="icon icon-heart" style={{fontSize: 'inherit', width: '1em', height: '1em'}}/>
);

const TrashIcon = () => (
    <i className="icon icon-trash" style={{fontSize: 'inherit', width: '1em', height: '1em'}}/>
);

const iconOptions = {
    'plus': <SampleIcon />,
    'heart': <HeartIcon />,
    'trash': <TrashIcon />,
};

type Props = {
    backgroundClass: string;
};

const IconButtonComponentLibrary = ({
    backgroundClass,
}: Props) => {
    const [ariaLabel, ariaLabelSelector] = useStringProp('aria-label', 'Icon button', false);
    const [title, titleSelector] = useStringProp('title', 'Click me', false);
    const [size, sizePosibilities, sizeSelector] = useDropdownProp('size', 'md', sizeValues, true);
    const [padding, paddingPosibilities, paddingSelector] = useDropdownProp('padding', 'default', paddingValues, true);
    const [toggled, toggledSelector] = useBooleanProp('toggled', false);
    const [destructive, destructiveSelector] = useBooleanProp('destructive', false);
    const [inverted, invertedSelector] = useBooleanProp('inverted', false);
    const [rounded, roundedSelector] = useBooleanProp('rounded', false);
    const [disabled, disabledSelector] = useBooleanProp('disabled', false);
    const [loading, loadingSelector] = useBooleanProp('loading', false);

    const [selectedIcon, setSelectedIcon] = useState<keyof typeof iconOptions>('plus');
    const onChangeIcon = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
        setSelectedIcon(e.target.value as keyof typeof iconOptions);
    }, []);

    const iconSelector = useMemo(() => (
        <label className='clInput'>
            {'icon: '}
            <select
                onChange={onChangeIcon}
                value={selectedIcon}
            >
                {Object.keys(iconOptions).map((iconKey) => (
                    <option
                        key={iconKey}
                        value={iconKey}
                    >
                        {iconKey}
                    </option>
                ))}
            </select>
        </label>
    ), [onChangeIcon, selectedIcon]);

    const components = useMemo(
        () => buildComponent(IconButton, propPossibilities, [sizePosibilities, paddingPosibilities], [
            ariaLabel,
            title,
            size,
            padding,
            toggled,
            destructive,
            inverted,
            rounded,
            disabled,
            loading,
            {icon: iconOptions[selectedIcon]},
            {onClick: () => window.alert('Icon button clicked!')},
        ]),
        [
            ariaLabel,
            title,
            size,
            sizePosibilities,
            padding,
            paddingPosibilities,
            toggled,
            destructive,
            inverted,
            rounded,
            disabled,
            loading,
            selectedIcon,
        ],
    );

    return (
        <>
            {ariaLabelSelector}
            {titleSelector}
            {sizeSelector}
            {paddingSelector}
            {iconSelector}
            {toggledSelector}
            {destructiveSelector}
            {invertedSelector}
            {roundedSelector}
            {disabledSelector}
            {loadingSelector}
            <div className={classNames('clWrapper', backgroundClass)}>{components}</div>
        </>
    );
};

export default IconButtonComponentLibrary;