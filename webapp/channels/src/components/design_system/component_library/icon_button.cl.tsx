// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/* eslint-disable no-alert */

import classNames from 'classnames';
import React, {useCallback, useMemo, useState} from 'react';

import {
    PlusIcon,
    StarOutlineIcon,
    TrashCanOutlineIcon,
    DotsHorizontalIcon,
    ChevronRightIcon,
} from '@mattermost/compass-icons/components';

import DropdownInput from 'components/dropdown_input';
import CheckboxSettingItem from 'components/widgets/modals/components/checkbox_setting_item';

import IconButton from '../icon_button';

import './component_library.scss';

const sizeValues = ['xs', 'sm', 'md', 'lg'];

// Helper function to format size names for better readability
const formatSizeLabel = (size: string) => {
    switch (size) {
    case 'xs': return 'X-small';
    case 'sm': return 'Small';
    case 'md': return 'Medium';
    case 'lg': return 'Large';
    default: return size;
    }
};

const IconButtonComponentLibrary = () => {
    // Interactive Controls State
    const [size, setSize] = useState<'xs' | 'sm' | 'md' | 'lg'>('md');
    const [padding, setPadding] = useState<'default' | 'compact'>('default');
    const [disabled, setDisabled] = useState(false);
    const [loading, setLoading] = useState(false);
    const [toggled, setToggled] = useState(false);
    const [destructive, setDestructive] = useState(false);
    const [inverted, setInverted] = useState(false);
    const [rounded, setRounded] = useState(false);

    // Variants Panel State
    const [variantsExpanded, setVariantsExpanded] = useState(false);

    // Toggle function for variants panel
    const toggleVariantsExpanded = useCallback(() => {
        setVariantsExpanded((prev) => !prev);
    }, []);

    // Control Components
    const sizeOptions = sizeValues.map((value) => ({
        label: formatSizeLabel(value),
        value,
    }));

    const sizeSelect = (
        <div className='cl__input-wrapper'>
            <DropdownInput
                name='size'
                placeholder='Size'
                value={sizeOptions.find((option) => option.value === size)}
                options={sizeOptions}
                onChange={(option: any) => setSize(option.value)}
            />
        </div>
    );

    const paddingOptions = [
        {label: 'Default', value: 'default'},
        {label: 'Compact', value: 'compact'},
    ];

    const paddingSelect = (
        <div className='cl__input-wrapper'>
            <DropdownInput
                name='padding'
                placeholder='Padding'
                value={paddingOptions.find((option) => option.value === padding)}
                options={paddingOptions}
                onChange={(option: any) => setPadding(option.value)}
            />
        </div>
    );

    const disabledCheckbox = (
        <div className='cl__input-wrapper'>
            <CheckboxSettingItem
                inputFieldData={{name: 'disabled', dataTestId: 'disabled'}}
                inputFieldValue={disabled}
                inputFieldTitle='Disabled'
                handleChange={setDisabled}
            />
        </div>
    );

    const loadingCheckbox = (
        <div className='cl__input-wrapper'>
            <CheckboxSettingItem
                inputFieldData={{name: 'loading', dataTestId: 'loading'}}
                inputFieldValue={loading}
                inputFieldTitle='Loading'
                handleChange={setLoading}
            />
        </div>
    );

    const toggledCheckbox = (
        <div className='cl__input-wrapper'>
            <CheckboxSettingItem
                inputFieldData={{name: 'toggled', dataTestId: 'toggled'}}
                inputFieldValue={toggled}
                inputFieldTitle='Toggled'
                handleChange={setToggled}
            />
        </div>
    );

    const destructiveCheckbox = (
        <div className='cl__input-wrapper'>
            <CheckboxSettingItem
                inputFieldData={{name: 'destructive', dataTestId: 'destructive'}}
                inputFieldValue={destructive}
                inputFieldTitle='Destructive'
                handleChange={setDestructive}
            />
        </div>
    );

    const invertedCheckbox = (
        <div className='cl__input-wrapper'>
            <CheckboxSettingItem
                inputFieldData={{name: 'inverted', dataTestId: 'inverted'}}
                inputFieldValue={inverted}
                inputFieldTitle='Inverted'
                handleChange={setInverted}
            />
        </div>
    );

    const roundedCheckbox = (
        <div className='cl__input-wrapper'>
            <CheckboxSettingItem
                inputFieldData={{name: 'rounded', dataTestId: 'rounded'}}
                inputFieldValue={rounded}
                inputFieldTitle='Rounded'
                handleChange={setRounded}
            />
        </div>
    );

    // Build interactive icon button
    const interactiveIconButton = useMemo(() => {
        const allProps = {
            size,
            padding,
            disabled,
            loading,
            toggled,
            destructive,
            inverted,
            rounded,
            icon: <PlusIcon/>,
            'aria-label': 'Add item',
            title: 'Add item',
            onClick: () => window.alert('Icon Button clicked!'),
        };

        return (
            <IconButton {...allProps}/>
        );
    }, [size, padding, disabled, loading, toggled, destructive, inverted, rounded]);

    // Static variant definitions for comprehensive view
    const sizes = ['xs', 'sm', 'md', 'lg'] as const;
    const states = [
        {label: 'Default', props: {}},
        {label: 'Disabled', props: {disabled: true}},
        {label: 'Loading', props: {loading: true}},
        {label: 'Toggled', props: {toggled: true}},
        {label: 'Destructive', props: {destructive: true}},
    ];
    const variants = [
        {label: 'Default', props: {}},
        {label: 'Compact', props: {padding: 'compact' as const}},
        {label: 'Rounded', props: {rounded: true}},
        {label: 'Inverted', props: {inverted: true}},
    ];
    const icons = [
        {label: 'Plus', props: {icon: <PlusIcon/>, 'aria-label': 'Add item', title: 'Add item'}},
        {label: 'Star', props: {icon: <StarOutlineIcon/>, 'aria-label': 'Favorite', title: 'Favorite'}},
        {label: 'Trash', props: {icon: <TrashCanOutlineIcon/>, 'aria-label': 'Delete', title: 'Delete'}},
        {label: 'Menu', props: {icon: <DotsHorizontalIcon/>, 'aria-label': 'Menu', title: 'Menu'}},
    ];

    return (
        <>
            <div className='cl__intro'>
                <div className='cl__intro-content'>
                    <p className='cl__intro-subtitle'>{'Component'}</p>
                    <h1 className='cl__intro-title'>{'Icon Button'}</h1>
                    <p className='cl__description'>
                        {'Icon Buttons are smaller buttons used when real estate is confined or where less emphasis is needed for an action.'}
                    </p>
                    <p className='cl__description'>
                        {'Icon Buttons aren’t highly emphasized as they are typically used for secondary actions for things like closing modals or triggering menus. They should always include tooltips for added clarity.'}
                    </p>
                </div>
            </div>

            {/* Interactive Testing Section */}
            <div className={classNames('cl__live-component-wrapper')}>
                <div className='cl__interactive-section'>
                    {/* Controls Panel (Left) */}
                    <div className='cl__controls-panel'>
                        <h3 className='cl__controls-panel-title'>{'Component controls'}</h3>
                        <div className='cl__inputs--controls'>
                            {sizeSelect}
                            {paddingSelect}
                            {disabledCheckbox}
                            {loadingCheckbox}
                            {toggledCheckbox}
                            {destructiveCheckbox}
                            {invertedCheckbox}
                            {roundedCheckbox}
                        </div>
                    </div>

                    {/* Interactive Example (Right) */}
                    <div
                        className={classNames('cl__live-component-panel', {
                            'cl__live-component-panel--inverted': inverted,
                        })}
                    >
                        {interactiveIconButton}
                    </div>
                </div>
            </div>

            <div className='cl__text-content-block'>
                <h3>{'Sizes'}</h3>
                <p>
                    {'Icon buttons come in four sizes: x-small, small, medium, and large. The Medium size is used as the default for most interfaces, while smaller sizes are used in compact layouts and larger sizes for prominent actions.'}
                </p>
            </div>

            <div className='cl__variants-row'>
                {sizes.map((size) => (
                    <IconButton
                        key={size}
                        size={size}
                        icon={<PlusIcon/>}
                        aria-label={`${formatSizeLabel(size)} Icon button`}
                        title={`${formatSizeLabel(size)} Icon button`}
                    />
                ))}
            </div>

            <div className='cl__text-content-block'>
                <h3>{'States'}</h3>
                <p>
                    <strong>{'Disabled:'}</strong> {'Not clickable with reduced opacity.'}
                </p>
                <p>
                    <strong>{'Loading:'}</strong> {'Shows spinner during loading state.'}
                </p>
                <p>
                    <strong>{'Toggled:'}</strong> {'Indicates active/selected state with primary styling.'}
                </p>
                <p>
                    <strong>{'Destructive:'}</strong> {'Used for destructive actions with error styling.'}
                </p>
            </div>

            <div className='cl__variants-row'>
                {states.map((state) => (
                    <IconButton
                        key={state.label}
                        size='md'
                        icon={<PlusIcon/>}
                        aria-label={`${state.label} button`}
                        title={`${state.label} button`}
                        {...state.props}
                    />
                ))}
            </div>

            <div className='cl__text-content-block'>
                <h3>{'Variants'}</h3>
                <p>
                    <strong>{'Compact:'}</strong> {'Reduced padding for dense layouts.'}
                </p>
                <p>
                    <strong>{'Rounded:'}</strong> {'Circular shape using 50% border-radius.'}
                </p>
            </div>

            <div className='cl__variants-row'>
                {variants.map((variant) => (
                    <IconButton
                        key={variant.label}
                        size='md'
                        icon={<PlusIcon/>}
                        aria-label={`${variant.label} button`}
                        title={`${variant.label} button`}
                        {...variant.props}
                    />
                ))}
            </div>

            <div className='cl__text-content-block'>
                <h3>{'Inverted Styles'}</h3>
                <p>
                    {'When icon buttons appear on backgrounds with insufficient contrast (e.g. the sidebar) the inverted styles should be used.'}
                </p>
            </div>

            <div className='cl__variants-row cl__variants-row--inverted'>
                {states.map((state) => (
                    <IconButton
                        key={state.label}
                        size='md'
                        icon={<PlusIcon/>}
                        aria-label={`${state.label} inverted button`}
                        title={`${state.label} inverted button`}
                        inverted={true}
                        {...state.props}
                    />
                ))}
            </div>

            <div className='cl__text-content-block'>
                <h3>{'Icon Variations'}</h3>
                <p>
                    {'Icon buttons can display various icons. Always provide appropriate aria-label text for accessibility.'}
                </p>
            </div>

            <div className='cl__variants-row'>
                {icons.map((icon) => (
                    <IconButton
                        key={icon.label}
                        size='md'
                        {...icon.props}
                    />
                ))}
            </div>

            {/* Comprehensive Variants */}
            <div className={'cl__component-variants'}>
                <div
                    className='cl__variants-header'
                    onClick={toggleVariantsExpanded}
                    role='button'
                    tabIndex={0}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            toggleVariantsExpanded();
                        }
                    }}
                >
                    <h2>{'All variants'}</h2>
                    <ChevronRightIcon className={variantsExpanded ? 'cl__variants-header--expanded' : ''}/>
                </div>

                <div className={`cl__variants-content ${variantsExpanded ? 'cl__variants-content--expanded' : 'cl__variants-content--collapsed'}`}>
                    {/* MASTER TABLE: COMPREHENSIVE ICON BUTTON VARIANTS */}
                    <div className={'cl__section'}>
                        <div className='cl__section-header'>
                            <h3>{'Master Component Matrix - All Icon Button Variants'}</h3>
                        </div>
                        <div className='cl__section-content'>
                            <table className='cl__master-table'>
                                <thead>
                                    <tr>
                                        <th rowSpan={2}>{'Size'}</th>
                                        <th colSpan={5}>{'States'}</th>
                                        <th colSpan={4}>{'Variants'}</th>
                                        <th colSpan={4}>{'Icons'}</th>
                                    </tr>
                                    <tr>
                                        {/* States */}
                                        <th>{'Default'}</th>
                                        <th>{'Disabled'}</th>
                                        <th>{'Loading'}</th>
                                        <th>{'Toggled'}</th>
                                        <th>{'Destructive'}</th>
                                        {/* Variants */}
                                        <th>{'Default'}</th>
                                        <th>{'Compact'}</th>
                                        <th>{'Rounded'}</th>
                                        <th>{'Inverted'}</th>
                                        {/* Icons */}
                                        <th>{'Plus'}</th>
                                        <th>{'Star'}</th>
                                        <th>{'Trash'}</th>
                                        <th>{'Menu'}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {sizes.map((size) => (
                                        <tr key={size}>
                                            <td className='cl__row-header'>{formatSizeLabel(size)}</td>

                                            {/* States */}
                                            {states.map((state) => (
                                                <td key={`state-${state.label}`}>
                                                    <IconButton
                                                        size={size}
                                                        icon={<PlusIcon/>}
                                                        aria-label={`${state.label} ${size} button`}
                                                        title={`${state.label} ${size} button`}
                                                        {...state.props}
                                                    />
                                                </td>
                                            ))}

                                            {/* Variants */}
                                            {variants.map((variant) => (
                                                <td key={`variant-${variant.label}`}>
                                                    <IconButton
                                                        size={size}
                                                        icon={<PlusIcon/>}
                                                        aria-label={`${variant.label} ${size} button`}
                                                        title={`${variant.label} ${size} button`}
                                                        {...variant.props}
                                                    />
                                                </td>
                                            ))}

                                            {/* Icons */}
                                            {icons.map((icon) => (
                                                <td key={`icon-${icon.label}`}>
                                                    <IconButton
                                                        size={size}
                                                        {...icon.props}
                                                    />
                                                </td>
                                            ))}

                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* INVERTED MASTER TABLE: ALL INVERTED VARIANTS ON DARK BACKGROUND */}
                    <div className={'cl__section cl__section--inverted'}>
                        <div className={'cl__section'}>
                            <div className='cl__section-header'>
                                <h3>{'Master Component Matrix - All Inverted Icon Button Variants'}</h3>
                            </div>
                            <div className='cl__section-content'>
                                <table className='cl__master-table'>
                                    <thead>
                                        <tr>
                                            <th rowSpan={2}>{'Size'}</th>
                                            <th colSpan={5}>{'States'}</th>
                                            <th colSpan={4}>{'Variants'}</th>
                                            <th colSpan={4}>{'Icons'}</th>
                                        </tr>
                                        <tr>
                                            {/* States */}
                                            <th>{'Default'}</th>
                                            <th>{'Disabled'}</th>
                                            <th>{'Loading'}</th>
                                            <th>{'Toggled'}</th>
                                            <th>{'Destructive'}</th>
                                            {/* Variants */}
                                            <th>{'Default'}</th>
                                            <th>{'Compact'}</th>
                                            <th>{'Rounded'}</th>
                                            <th>{'Inverted'}</th>
                                            {/* Icons */}
                                            <th>{'Plus'}</th>
                                            <th>{'Star'}</th>
                                            <th>{'Trash'}</th>
                                            <th>{'Menu'}</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {sizes.map((size) => (
                                            <tr key={size}>
                                                <td className='cl__row-header'>{formatSizeLabel(size)}</td>

                                                {/* States */}
                                                {states.map((state) => (
                                                    <td key={`state-${state.label}`}>
                                                        <IconButton
                                                            size={size}
                                                            icon={<PlusIcon/>}
                                                            aria-label={`${state.label} ${size} inverted button`}
                                                            title={`${state.label} ${size} inverted button`}
                                                            inverted={true}
                                                            {...state.props}
                                                        />
                                                    </td>
                                                ))}

                                                {/* Variants */}
                                                {variants.map((variant) => (
                                                    <td key={`variant-${variant.label}`}>
                                                        <IconButton
                                                            size={size}
                                                            icon={<PlusIcon/>}
                                                            aria-label={`${variant.label} ${size} inverted button`}
                                                            title={`${variant.label} ${size} inverted button`}
                                                            inverted={true}
                                                            {...variant.props}
                                                        />
                                                    </td>
                                                ))}

                                                {/* Icons */}
                                                {icons.map((icon) => (
                                                    <td key={`icon-${icon.label}`}>
                                                        <IconButton
                                                            size={size}
                                                            inverted={true}
                                                            {...icon.props}
                                                        />
                                                    </td>
                                                ))}

                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
};

export default IconButtonComponentLibrary;
