// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/* eslint-disable no-alert */

import classNames from 'classnames';
import React, {useCallback, useMemo, useState} from 'react';

import DropdownInput from 'components/dropdown_input';
import Input from 'components/widgets/inputs/input/input';
import CheckboxSettingItem from 'components/widgets/modals/components/checkbox_setting_item';

import Button from '../button/button';

import './component_library.scss';

const emphasisValues = ['primary', 'secondary', 'tertiary', 'quaternary', 'link'];
const sizeValues = ['xs', 'sm', 'md', 'lg'];

// Helper function to format emphasis names consistently with select menu
const formatEmphasisLabel = (emphasis: string) => emphasis.charAt(0).toUpperCase() + emphasis.slice(1);

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

const ButtonComponentLibrary = () => {
    // Interactive Controls State
    const [buttonText, setButtonText] = useState('Button Text');
    const [emphasis, setEmphasis] = useState<'primary' | 'secondary' | 'tertiary' | 'quaternary' | 'link'>('primary');
    const [size, setSize] = useState<'xs' | 'sm' | 'md' | 'lg'>('md');
    const [disabled, setDisabled] = useState(false);
    const [loading, setLoading] = useState(false);
    const [destructive, setDestructive] = useState(false);
    const [widthOption, setWidthOption] = useState<'default' | 'fixed-width' | 'full-width'>('default');
    const [widthValue, setWidthValue] = useState(200);
    const [inverted, setInverted] = useState(false);
    const [showIconBefore, setShowIconBefore] = useState(false);
    const [showIconAfter, setShowIconAfter] = useState(false);

    // Variants Panel State
    const [variantsExpanded, setVariantsExpanded] = useState(false);

    // Toggle function for variants panel
    const toggleVariantsExpanded = useCallback(() => {
        setVariantsExpanded((prev) => !prev);
    }, []);

    // Control Components
    const buttonTextInput = (
        <div className='cl__input-wrapper'>
            <Input
                name='buttonText'
                label='Button Text'
                value={buttonText}
                onChange={(e) => setButtonText(e.target.value)}
            />
        </div>
    );

    const emphasisOptions = emphasisValues.map((value) => ({
        label: formatEmphasisLabel(value),
        value,
    }));

    const emphasisSelect = (
        <div className='cl__input-wrapper'>
            <DropdownInput
                name='emphasis'
                placeholder='Emphasis'
                value={emphasisOptions.find((option) => option.value === emphasis)}
                options={emphasisOptions}
                onChange={(option: any) => setEmphasis(option.value)}
            />
        </div>
    );

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

    const widthOptions = [
        {label: 'Default', value: 'default'},
        {label: 'Fixed Width', value: 'fixed-width'},
        {label: 'Full Width', value: 'full-width'},
    ];

    const widthOptionSelect = (
        <div className='cl__input-wrapper'>
            <DropdownInput
                name='widthOption'
                placeholder='Width Option'
                value={widthOptions.find((option) => option.value === widthOption)}
                options={widthOptions}
                onChange={(option: any) => setWidthOption(option.value)}
            />
        </div>
    );

    const widthValueInput = widthOption === 'fixed-width' ? (
        <div className='cl__input-wrapper'>
            <Input
                name='widthValue'
                label='Width (px)'
                type='number'
                value={widthValue.toString()}
                onChange={(e) => setWidthValue(parseInt(e.target.value, 10) || 200)}
                min={50}
                max={800}
            />
        </div>
    ) : null;

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

    const iconBeforeCheckbox = (
        <div className='cl__input-wrapper'>
            <CheckboxSettingItem
                inputFieldData={{name: 'showIconBefore', dataTestId: 'showIconBefore'}}
                inputFieldValue={showIconBefore}
                inputFieldTitle='Icon Before'
                handleChange={setShowIconBefore}
            />
        </div>
    );

    const iconAfterCheckbox = (
        <div className='cl__input-wrapper'>
            <CheckboxSettingItem
                inputFieldData={{name: 'showIconAfter', dataTestId: 'showIconAfter'}}
                inputFieldValue={showIconAfter}
                inputFieldTitle='Icon After'
                handleChange={setShowIconAfter}
            />
        </div>
    );

    // Build interactive button
    const interactiveButton = useMemo(() => {
        const allProps = {
            emphasis,
            size,
            disabled,
            loading,
            destructive,
            ...(widthOption === 'full-width' ? {fullWidth: true} : {}),
            ...(widthOption === 'fixed-width' ? {width: `${widthValue}px`} : {}),
            inverted,
            ...(showIconBefore ? {iconBefore: <i className='icon icon-plus'/>} : {}),
            ...(showIconAfter ? {iconAfter: <i className='icon icon-chevron-right'/>} : {}),
            onClick: () => window.alert('Button clicked!'),
        };

        return (
            <Button {...allProps}>
                {buttonText}
            </Button>
        );
    }, [buttonText, emphasis, size, disabled, loading, destructive, widthOption, widthValue, inverted, showIconBefore, showIconAfter]);

    // Static variant definitions for comprehensive view
    const emphases = ['primary', 'secondary', 'tertiary', 'quaternary', 'link'] as const;
    const sizes = ['xs', 'sm', 'md', 'lg'] as const;
    const states = [
        {label: 'Default', props: {}},
        {label: 'Disabled', props: {disabled: true}},
        {label: 'Loading', props: {loading: true}},
        {label: 'Destructive', props: {destructive: true}},
    ];
    const icons = [
        {label: 'No Icon', props: {}},
        {label: 'Before', props: {iconBefore: <i className='icon icon-plus'/>}},
        {label: 'After', props: {iconAfter: <i className='icon icon-chevron-right'/>}},
        {label: 'Both', props: {iconBefore: <i className='icon icon-plus'/>, iconAfter: <i className='icon icon-chevron-down'/>}},
    ];

    return (
        <>
            <div className='cl__intro'>
                <div className='cl__intro-content'>
                    <p className='cl__intro-subtitle'>{'Component'}</p>
                    <h1 className='cl__intro-title'>{'Button'}</h1>
                    <p className='cl__description'>
                        {'Buttons enable users to take actions or make decisions with a single tap or click. They are used for core actions within the product like saving data in a form, sending a message, or confirming something in a dialog.'}
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
                            {buttonTextInput}
                            {sizeSelect}
                            {emphasisSelect}
                            <div className='cl__width-options'>
                                {widthOptionSelect}
                                {widthValueInput}
                            </div>
                            {disabledCheckbox}
                            {loadingCheckbox}
                            {destructiveCheckbox}
                            {invertedCheckbox}
                            {iconBeforeCheckbox}
                            {iconAfterCheckbox}
                        </div>
                    </div>

                    {/* Interactive Example (Right) */}
                    <div
                        className={classNames('cl__live-component-panel', {
                            'cl__live-component-panel--inverted': inverted,
                        })}
                    >
                        {interactiveButton}
                    </div>
                </div>
            </div>

            <div className='cl__text-content-block'>
                <h3>{'Sizes'}</h3>
                <p>
                    {'Buttons come in four sizes: x-small, small, medium, and large. The Medium Button size is used as the default button size for the web application, while the Large Button size is used as the default for mobile.'}
                </p>
            </div>

            <div className='cl__variants-row'>
                {sizes.map((size) => (
                    <Button
                        key={size}
                        emphasis='primary'
                        size={size}
                    >
                        {formatSizeLabel(size)}
                    </Button>
                ))}
            </div>

            <div className='cl__text-content-block'>
                <h3>{'Emphasis'}</h3>
                <p>
                    <strong>{'Primary Buttons:'}</strong> {'used to highlight the strongest call to action on a page. They should only appear once per screen. In a group of Buttons, Primary Buttons should be paired with Tertiary Buttons.'}
                </p>
                <p>
                    <strong>{'Secondary Buttons:'}</strong> {'are treated like Primary Buttons, but should be used in cases where you may not want the same level of visual disruption that a Primary Button provides.'}
                </p>
                <p>
                    <strong>{'Tertiary Buttons:'}</strong> {'have a more subtle appearance than Secondary and Primary Buttons.'}
                </p>
                <p>
                    <strong>{'Quarternary Buttons:'}</strong> {'occupy the same visual space as Tertiary Buttons, but without the background.'}
                </p>
                <p>
                    <strong>{'Link Buttons:'}</strong> {'text-based buttons with the least emphasis.'}
                </p>
            </div>

            <div className='cl__variants-row'>
                {emphases.map((emphasis) => (
                    <Button
                        key={emphasis}
                        emphasis={emphasis}
                        size='md'
                    >
                        {formatEmphasisLabel(emphasis)}
                    </Button>
                ))}
            </div>

            <div className='cl__text-content-block'>
                <h3>{'Width Variations'}</h3>
                <p>
                    {'By default, buttons are constrained to the width of their content. However, there are times when you may want to use a button that takes up the full width of its container or set a fixed width.'}
                </p>
            </div>

            <div className='cl__variants-row'>
                <Button emphasis='primary'>{'Default'}</Button>
                <Button
                    emphasis='primary'
                    fullWidth={true}
                >{'Full Width'}</Button>
                <Button
                    emphasis='primary'
                    width='240px'
                >{'Fixed Width'}</Button>
            </div>

            <div className='cl__text-content-block'>
                <h3>{'States'}</h3>
                <p>
                    <strong>{'Disabled Buttons:'}</strong> {'not clickable with a grayed out appearance.'}
                </p>
                <p>
                    <strong>{'Loading Buttons:'}</strong> {'used during a loading state with an animated spinner.'}
                </p>
                <p>
                    <strong>{'Destructive Buttons:'}</strong> {'used to indicate a destructive action with a red background.'}
                </p>
            </div>

            <div className='cl__variants-row'>
                {states.map((state) => (
                    <Button
                        key={state.label}
                        emphasis='primary'
                        {...state.props}
                    >
                        {state.label}
                    </Button>
                ))}
            </div>

            <div className='cl__text-content-block'>
                <h3>{'Inverted Styles'}</h3>
                <p>
                    {'When buttons appear on a background with insufficient contrast (e.g. the sidebar) the inverted styles should be used.'}
                </p>
            </div>

            <div className='cl__variants-row cl__variants-row--inverted'>
                {emphases.map((emphasis) => (
                    <Button
                        key={emphasis}
                        emphasis={emphasis}
                        size='md'
                        inverted={true}
                    >
                        {formatEmphasisLabel(emphasis)}
                    </Button>
                ))}
            </div>

            <div className='cl__text-content-block'>
                <h3>{'Icon Variations'}</h3>
                <p>
                    {'Buttons can have leading or trailing icons.'}
                </p>
            </div>

            <div className='cl__variants-row'>
                {icons.map((icon) => (
                    <Button
                        key={icon.label}
                        emphasis='primary'
                        {...icon.props}
                    >
                        {icon.label}
                    </Button>
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
                    <i className={`icon icon-chevron-right ${variantsExpanded ? 'cl__variants-header--expanded' : ''}`}/>
                </div>

                <div className={`cl__variants-content ${variantsExpanded ? 'cl__variants-content--expanded' : 'cl__variants-content--collapsed'}`}>
                    {/* MASTER TABLE: COMPREHENSIVE BUTTON VARIANTS */}
                    <div className={'cl__section'}>
                        <div className='cl__section-header'>
                            <h3>{'Master Component Matrix - All Button Variants'}</h3>
                        </div>
                        <div className='cl__section-content'>
                            <table className='cl__master-table'>
                                <thead>
                                    <tr>
                                        <th rowSpan={2}>{'Emphasis'}</th>
                                        <th colSpan={4}>{'Core Sizes'}</th>
                                        <th colSpan={4}>{'States (md)'}</th>
                                        <th colSpan={4}>{'Icons (md)'}</th>
                                    </tr>
                                    <tr>
                                        {/* Core Sizes */}
                                        <th>{'xs'}</th>
                                        <th>{'sm'}</th>
                                        <th>{'md'}</th>
                                        <th>{'lg'}</th>
                                        {/* States */}
                                        <th>{'Default'}</th>
                                        <th>{'Disabled'}</th>
                                        <th>{'Loading'}</th>
                                        <th>{'Destructive'}</th>
                                        {/* Icons */}
                                        <th>{'No Icon'}</th>
                                        <th>{'Before'}</th>
                                        <th>{'After'}</th>
                                        <th>{'Both'}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {emphases.map((emphasis) => (
                                        <tr key={emphasis}>
                                            <td className='cl__row-header'>{formatEmphasisLabel(emphasis)}</td>

                                            {/* Core Sizes */}
                                            {sizes.map((size) => (
                                                <td key={`size-${size}`}>
                                                    <Button
                                                        emphasis={emphasis}
                                                        size={size}
                                                    >
                                                        {size.toUpperCase()}
                                                    </Button>
                                                </td>
                                            ))}

                                            {/* States */}
                                            {states.map((state) => (
                                                <td key={`state-${state.label}`}>
                                                    <Button
                                                        emphasis={emphasis}
                                                        size='md'
                                                        {...state.props}
                                                    >
                                                        {state.label}
                                                    </Button>
                                                </td>
                                            ))}

                                            {/* Icons */}
                                            {icons.map((icon) => (
                                                <td key={`icon-${icon.label}`}>
                                                    <Button
                                                        emphasis={emphasis}
                                                        size='md'
                                                        {...icon.props}
                                                    >
                                                        {icon.label}
                                                    </Button>
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
                                <h3>{'Master Component Matrix - All Inverted Button Variants'}</h3>
                            </div>
                            <div className='cl__section-content'>
                                <table className='cl__master-table'>
                                    <thead>
                                        <tr>
                                            <th rowSpan={2}>{'Emphasis'}</th>
                                            <th colSpan={4}>{'Core Sizes'}</th>
                                            <th colSpan={4}>{'States (md)'}</th>
                                            <th colSpan={4}>{'Icons (md)'}</th>
                                        </tr>
                                        <tr>
                                            {/* Core Sizes */}
                                            <th>{'xs'}</th>
                                            <th>{'sm'}</th>
                                            <th>{'md'}</th>
                                            <th>{'lg'}</th>
                                            {/* States */}
                                            <th>{'Default'}</th>
                                            <th>{'Disabled'}</th>
                                            <th>{'Loading'}</th>
                                            <th>{'Destructive'}</th>
                                            {/* Icons */}
                                            <th>{'No Icon'}</th>
                                            <th>{'Before'}</th>
                                            <th>{'After'}</th>
                                            <th>{'Both'}</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {emphases.map((emphasis) => (
                                            <tr key={emphasis}>
                                                <td className='cl__row-header'>{formatEmphasisLabel(emphasis)}</td>

                                                {/* Core Sizes */}
                                                {sizes.map((size) => (
                                                    <td key={`size-${size}`}>
                                                        <Button
                                                            emphasis={emphasis}
                                                            size={size}
                                                            inverted={true}
                                                        >
                                                            {size.toUpperCase()}
                                                        </Button>
                                                    </td>
                                                ))}

                                                {/* States */}
                                                {states.map((state) => (
                                                    <td key={`state-${state.label}`}>
                                                        <Button
                                                            emphasis={emphasis}
                                                            size='md'
                                                            inverted={true}
                                                            {...state.props}
                                                        >
                                                            {state.label}
                                                        </Button>
                                                    </td>
                                                ))}

                                                {/* Icons */}
                                                {icons.map((icon) => (
                                                    <td key={`icon-${icon.label}`}>
                                                        <Button
                                                            emphasis={emphasis}
                                                            size='md'
                                                            inverted={true}
                                                            {...icon.props}
                                                        >
                                                            {icon.label}
                                                        </Button>
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

export default ButtonComponentLibrary;
