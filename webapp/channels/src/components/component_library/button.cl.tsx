// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/* eslint-disable no-alert */

import classNames from 'classnames';
import React, {useCallback, useMemo, useState} from 'react';

import Button from '../button/button';
import Input from 'components/widgets/inputs/input/input';
import DropdownInput from 'components/dropdown_input';
import CheckboxSettingItem from 'components/widgets/modals/components/checkbox_setting_item';

import {buildComponent} from './utils';

import './component_library.scss';

const propPossibilities = {};

const emphasisValues = ['primary', 'secondary', 'tertiary', 'quaternary', 'link'];
const sizeValues = ['xs', 'sm', 'md', 'lg'];

// Helper function to format emphasis names consistently with select menu
const formatEmphasisLabel = (emphasis: string) => emphasis.charAt(0).toUpperCase() + emphasis.slice(1);

const ButtonComponentLibrary = () => {
    // Interactive Controls State
    const [buttonText, setButtonText] = useState('Button Text');
    const [emphasis, setEmphasis] = useState<'primary' | 'secondary' | 'tertiary' | 'quaternary' | 'link'>('primary');
    const [size, setSize] = useState<'xs' | 'sm' | 'md' | 'lg'>('md');
    const [disabled, setDisabled] = useState(false);
    const [loading, setLoading] = useState(false);
    const [destructive, setDestructive] = useState(false);
    const [fullWidth, setFullWidth] = useState(false);
    const [inverted, setInverted] = useState(false);
    const [showIconBefore, setShowIconBefore] = useState(false);
    const [showIconAfter, setShowIconAfter] = useState(false);

    // Variants Panel State
    const [variantsExpanded, setVariantsExpanded] = useState(false);

    // Toggle function for variants panel
    const toggleVariantsExpanded = useCallback(() => {
        setVariantsExpanded(prev => !prev);
    }, []);

    // Control Components
    const buttonTextInput = (
        <div className='clInputWrapper'>
            <Input
                name='buttonText'
                label='Button Text'
                value={buttonText}
                onChange={(e) => setButtonText(e.target.value)}
            />
        </div>
    );

    const emphasisOptions = emphasisValues.map(value => ({
        label: formatEmphasisLabel(value),
        value: value,
    }));

    const emphasisSelect = (
        <div className='clInputWrapper'>
            <DropdownInput
                name='emphasis'
                placeholder='Emphasis'
                value={emphasisOptions.find(option => option.value === emphasis)}
                options={emphasisOptions}
                onChange={(option: any) => setEmphasis(option.value)}
            />
        </div>
    );

    const sizeOptions = sizeValues.map(value => ({
        label: value.toUpperCase(),
        value: value,
    }));

    const sizeSelect = (
        <div className='clInputWrapper'>
            <DropdownInput
                name='size'
                placeholder='Size'
                value={sizeOptions.find(option => option.value === size)}
                options={sizeOptions}
                onChange={(option: any) => setSize(option.value)}
            />
        </div>
    );

    const disabledCheckbox = (
        <div className='clInputWrapper'>
            <CheckboxSettingItem
                inputFieldData={{ name: 'disabled', dataTestId: 'disabled' }}
                inputFieldValue={disabled}
                inputFieldTitle='Disabled'
                handleChange={setDisabled}
            />
        </div>
    );

    const loadingCheckbox = (
        <div className='clInputWrapper'>
            <CheckboxSettingItem
                inputFieldData={{ name: 'loading', dataTestId: 'loading' }}
                inputFieldValue={loading}
                inputFieldTitle='Loading'
                handleChange={setLoading}
            />
        </div>
    );

    const destructiveCheckbox = (
        <div className='clInputWrapper'>
            <CheckboxSettingItem
                inputFieldData={{ name: 'destructive', dataTestId: 'destructive' }}
                inputFieldValue={destructive}
                inputFieldTitle='Destructive'
                handleChange={setDestructive}
            />
        </div>
    );

    const fullWidthCheckbox = (
        <div className='clInputWrapper'>
            <CheckboxSettingItem
                inputFieldData={{ name: 'fullWidth', dataTestId: 'fullWidth' }}
                inputFieldValue={fullWidth}
                inputFieldTitle='Full Width'
                handleChange={setFullWidth}
            />
        </div>
    );

    const invertedCheckbox = (
        <div className='clInputWrapper'>
            <CheckboxSettingItem
                inputFieldData={{ name: 'inverted', dataTestId: 'inverted' }}
                inputFieldValue={inverted}
                inputFieldTitle='Inverted'
                handleChange={setInverted}
            />
        </div>
    );

    const iconBeforeCheckbox = (
        <div className='clInputWrapper'>
            <CheckboxSettingItem
                inputFieldData={{ name: 'showIconBefore', dataTestId: 'showIconBefore' }}
                inputFieldValue={showIconBefore}
                inputFieldTitle='Icon Before'
                handleChange={setShowIconBefore}
            />
        </div>
    );

    const iconAfterCheckbox = (
        <div className='clInputWrapper'>
            <CheckboxSettingItem
                inputFieldData={{ name: 'showIconAfter', dataTestId: 'showIconAfter' }}
                inputFieldValue={showIconAfter}
                inputFieldTitle='Icon After'
                handleChange={setShowIconAfter}
            />
        </div>
    );

    // Build interactive button
    const interactiveButton = useMemo(() => {
        const allProps = {
            emphasis: emphasis,
            size: size,
            disabled: disabled,
            loading: loading,
            destructive: destructive,
            fullWidth: fullWidth,
            inverted: inverted,
            ...(showIconBefore ? {iconBefore: <i className="icon icon-plus"/>} : {}),
            ...(showIconAfter ? {iconAfter: <i className="icon icon-chevron-right"/>} : {}),
            onClick: () => window.alert('Button clicked!'),
        };

        return (
            <Button {...allProps}>
                {buttonText}
            </Button>
        );
    }, [buttonText, emphasis, size, disabled, loading, destructive, fullWidth, inverted, showIconBefore, showIconAfter]);

    // Static variant definitions for comprehensive view
    const emphases = ['primary', 'secondary', 'tertiary', 'quaternary', 'link'] as const;
    const sizes = ['xs', 'sm', 'md', 'lg'] as const;
    const states = [
        { label: 'Default', props: {} },
        { label: 'Disabled', props: { disabled: true } },
        { label: 'Loading', props: { loading: true } },
        { label: 'Destructive', props: { destructive: true } },
    ];
    const icons = [
        { label: 'No Icon', props: {} },
        { label: 'Before', props: { iconBefore: <i className="icon icon-plus"/> } },
        { label: 'After', props: { iconAfter: <i className="icon icon-chevron-right"/> } },
        { label: 'Both', props: { iconBefore: <i className="icon icon-plus"/>, iconAfter: <i className="icon icon-chevron-down"/> } },
    ];

    return (
        <>
            <div className='cl__intro'>
                <div className='cl__intro-content'>
                    <p className='cl__intro-subtitle'>Component</p>
                    <h1 className='cl__intro-title'>Button</h1>
                    <p className='cl__description'>
                        Buttons enable users to take actions or make decisions with a single tap or click. They are used for core actions within the product like saving data in a form, sending a message, or confirming something in a dialog. There are many Button Variants, as described below, but all have a cohesive look and feel.
                    </p>
                </div>
            </div>
            {/* Interactive Testing Section */}
            <div className={classNames('cl__live-component-wrapper')}>
                <div className='cl__interactive-section'>
                    {/* Controls Panel (Left) */}
                    <div className='cl__controls-panel'>
                        <h3>Component controls</h3>
                        <div className='cl__inputs--controls'>
                            {buttonTextInput}
                            {emphasisSelect}
                            {sizeSelect}
                            {disabledCheckbox}
                            {loadingCheckbox}
                            {destructiveCheckbox}
                            {fullWidthCheckbox}
                            {invertedCheckbox}
                            {iconBeforeCheckbox}
                            {iconAfterCheckbox}
                        </div>
                    </div>

                    {/* Interactive Example (Right) */}
                    <div className={classNames('cl__live-component-panel')}>
                        {interactiveButton}
                    </div>
                </div>
            </div>

            <div className='cl_text-content-block'>
                <h3>Sizes</h3>
                <p>
                    Buttons come in four sizes: x-small, small, medium, and large. The Medium Button size is used as the default button size for the web application, while the Large Button size is used as the default for mobile.
                </p>
            </div>


            <div className='cl__variants-row'>
                {sizes.map((size) => (
                    <Button key={size} emphasis="primary" size={size}>
                        {size === 'xs' ? 'X-small' : size === 'sm' ? 'Small' : size === 'md' ? 'Medium' : 'Large'}
                    </Button>
                ))}
            </div>


            <div className='cl_text-content-block'>
                <h3>Emphasis</h3>
                <p>
                    <strong>Primary Buttons:</strong> used to highlight the strongest call to action on a page. They should only appear once per screen. In a group of Buttons, Primary Buttons should be paired with Tertiary Buttons.
                </p>
                <p>
                    <strong>Secondary Buttons:</strong> are treated like Primary Buttons, but should be used in cases where you may not want the same level of visual disruption that a Primary Button provides.
                </p>
                <p>
                    <strong>Tertiary Buttons:</strong> have a more subtle appearance than Secondary and Primary Buttons.
                </p>
                <p>
                    <strong>Quarternary Buttons:</strong> occupy the same visual space as Tertiary Buttons, but without the background.
                </p>
                <p>
                    <strong>Link Buttons:</strong> text-based buttons with the least emphasis.
                </p>
            </div>

            
            <div className='cl__variants-row'>
                {emphases.map((emphasis) => (
                    <Button key={emphasis} emphasis={emphasis} size="md">
                        {formatEmphasisLabel(emphasis)}
                    </Button>
                ))}
            </div>

            <div className='cl_text-content-block'>
                <h3>States</h3>
                <p>
                    <strong>Disabled Buttons:</strong> not clickable with a grayed out appearance.
                </p>
                <p>
                    <strong>Loading Buttons:</strong> used during a loading state with an animated spinner.
                </p>
                <p>
                    <strong>Destructive Buttons:</strong> used to indicate a destructive action with a red background.
                </p>
            </div>

            <div className='cl__variants-row'>
                {states.map((state) => (
                    <Button key={state.label} emphasis="primary" {...state.props}>
                        {state.label}
                    </Button>
                ))}
            </div>

            <div className='cl_text-content-block'>
                <h3>Inverted Styles</h3>
                <p>
                    When buttons appear on a background with insufficient contrast (e.g. the sidebar) the inverted styles should be used.
                </p>
            </div>

            <div className='cl__variants-row cl__variants-row--inverted'>
                {emphases.map((emphasis) => (
                    <Button key={emphasis} emphasis={emphasis} size="md" inverted>
                        {formatEmphasisLabel(emphasis)}
                    </Button>
                ))}
            </div>

            <div className='cl_text-content-block'>
                <h3>Width Variations</h3>
                <p>
                    By default, buttons are constrained to the width of their content. However, there are times when you may want to use a button that takes up the full width of its container or set a fixed width.
                </p>
            </div>

            <div className='cl__variants-row'>
                <Button emphasis="primary">Default</Button>
                <Button emphasis="primary" fullWidth>Full Width</Button>
                <Button emphasis="primary" width="240px">Fixed Width</Button>
            </div>

            {/* Comprehensive Variants */}
            <div className={`cl__component-variants`}>
                <div 
                    className="cl__variants-header" 
                    onClick={toggleVariantsExpanded}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            toggleVariantsExpanded();
                        }
                    }}
                >
                    <h2>All variants</h2>
                    <i className={`icon icon-chevron-right ${variantsExpanded ? 'cl__variants-header--expanded' : ''}`} />
                </div>
                
                <div className={`cl__variants-content ${variantsExpanded ? 'cl__variants-content--expanded' : 'cl__variants-content--collapsed'}`}>
                        {/* MATRIX 1: ALL EMPHASIS × ALL SIZES (20 combinations) */}
                    <div className={'cl__section'}>
                        <div className='cl__section-header'>
                            <h3>Emphasis & Sizes</h3>
                        </div>
                        <div className='cl__section-content'>
                            <table>
                                <thead>
                                    <tr>
                                        <th>Emphasis</th>
                                        {sizes.map(size => (
                                            <th key={size}>{size}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {emphases.map((emphasis) => (
                                        <tr key={emphasis}>
                                            <td>{formatEmphasisLabel(emphasis)}</td>
                                            {sizes.map((size) => (
                                                <td key={size}>
                                                    <Button emphasis={emphasis} size={size}>
                                                        {size === 'xs' ? 'X-small' : size === 'sm' ? 'Small' : size === 'md' ? 'Medium' : 'Large'}
                                                    </Button>
                                                </td>
                                            ))}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                
                {/* MATRIX 3: ALL EMPHASIS × ALL STATES (30 combinations) */}
                <div className={'cl__section'}>
                    <div className='cl__section-header'>
                        <h3>Emphasis & States</h3>
                    </div>
                    <div className='cl__section-content'>
                        <table>
                        <thead>
                            <tr>
                                <th>Emphasis</th>
                                {states.map(state => (
                                    <th key={state.label}>{state.label}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {emphases.map((emphasis) => (
                                <tr key={emphasis}>
                                    <td>{formatEmphasisLabel(emphasis)}</td>
                                    {states.map((state) => (
                                        <td key={state.label}>
                                            <Button emphasis={emphasis} {...state.props}>
                                                {state.label}
                                            </Button>
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    </div>
                </div>

                {/* MATRIX 2: ALL SIZES × ALL ICON VARIANTS (16 combinations) */}
                <div className={'cl__section'}>
                    <div className='cl__section-header'>
                        <h3>Sizes & Icons</h3>
                    </div>
                    <div className='cl__section-content'>
                        <table>
                        <thead>
                            <tr>
                                <th>Size</th>
                                {icons.map(icon => (
                                    <th key={icon.label}>{icon.label}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {sizes.map((size) => (
                                <tr key={size}>
                                    <td>
                                        {size}
                                    </td>
                                    {icons.map((icon) => (
                                        <td key={icon.label}>
                                            <Button emphasis="primary" size={size} {...icon.props}>
                                                {size === 'xs' ? 'X-small' : size === 'sm' ? 'Small' : size === 'md' ? 'Medium' : 'Large'}
                                            </Button>
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    </div>
                </div>

                {/* MATRIX 4: ALL EMPHASIS × ALL ICON COMBINATIONS (20 combinations) */}
                <div className={'cl__section'}>
                    <div className='cl__section-header'>
                        <h3>Emphasis & Icons</h3>
                    </div>
                    <div className='cl__section-content'>
                        <table>
                        <thead>
                            <tr>
                                <th>Emphasis</th>
                                {icons.map(icon => (
                                    <th key={icon.label}>{icon.label}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {emphases.map((emphasis) => (
                                <tr key={emphasis}>
                                    <td>{formatEmphasisLabel(emphasis)}</td>
                                    {icons.map((icon) => (
                                        <td key={icon.label}>
                                            <Button emphasis={emphasis} {...icon.props}>
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

                {/* MATRIX 6: FULL WIDTH × ALL EMPHASIS × SELECTED STATES */}
                <div className={'cl__section'}>
                    <div className='cl__section-header'>
                        <h3>Full Width × Selected Emphasis × Key States</h3>
                    </div>
                    <div className='cl__section-content'>
                        {emphases.filter(emphasis => !['quaternary', 'link'].includes(emphasis)).map((emphasis) => (
                            <div key={emphasis} className={'cl__section'}>
                                <div className='cl__section-header'>
                                 <h4>{formatEmphasisLabel(emphasis)}</h4>
                                </div>
                                <div className='cl__section-content'>
                                    <div className='cl__variants-wrapper'>
                                        <Button emphasis={emphasis} fullWidth>Full Width</Button>
                                        <Button emphasis={emphasis} fullWidth disabled>Full Width Disabled</Button>
                                        <Button emphasis={emphasis} fullWidth loading>Full Width Loading</Button>
                                        <Button emphasis={emphasis} fullWidth destructive>Full Width Destructive</Button>
                                        <Button emphasis={emphasis} fullWidth iconBefore={<i className="icon icon-plus"/>}>Full Width + Icon</Button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* MATRIX 7: INVERTED STYLES - ALL COMBINATIONS ON DARK BACKGROUND */}
                <div className={'cl__section cl__section--inverted'}>                   
                    {/* INVERTED MATRIX 1: ALL EMPHASIS × ALL SIZES (20 combinations) */}
                    <div className={'cl__section'}>
                        <div className='cl__section-header'>
                            <h3>Emphasis × Sizes (Inverted) - 20 combinations</h3>
                        </div>
                        <div className='cl__section-content'>
                            <table>
                            <thead>
                                <tr>
                                    <th>Emphasis</th>
                                    {sizes.map(size => (
                                        <th key={size}>{size}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {emphases.map((emphasis) => (
                                    <tr key={emphasis}>
                                        <td>{formatEmphasisLabel(emphasis)}</td>
                                        {sizes.map((size) => (
                                            <td key={size}>
                                                <Button emphasis={emphasis} size={size} inverted>
                                                    {size === 'xs' ? 'X-small' : size === 'sm' ? 'Small' : size === 'md' ? 'Medium' : 'Large'}
                                                </Button>
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        </div>
                    </div>

                    {/* INVERTED MATRIX 2: ALL EMPHASIS × ALL STATES (30 combinations) */}
                    <div className={'cl__section'}>
                        <div className='cl__section-header'>
                            <h3>Emphasis × States (Inverted) - 30 combinations</h3>
                        </div>
                        <div className='cl__section-content'>
                            <table>
                            <thead>
                                <tr>
                                    <th>Emphasis</th>
                                    {states.map(state => (
                                        <th key={state.label}>{state.label}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {emphases.map((emphasis) => (
                                    <tr key={emphasis}>
                                        <td>{formatEmphasisLabel(emphasis)}</td>
                                        {states.map((state) => (
                                            <td key={state.label}>
                                                <Button emphasis={emphasis} inverted {...state.props}>
                                                    {state.label}
                                                </Button>
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        </div>
                    </div>

                    {/* INVERTED MATRIX 3: ALL SIZES × ALL ICON VARIANTS (16 combinations) */}
                    <div className={'cl__section'}>
                        <div className='cl__section-header'>
                            <h3>Sizes × Icon Variants (Inverted) - 16 combinations</h3>
                        </div>
                        <div className='cl__section-content'>
                            <table>
                            <thead>
                                <tr>
                                    <th>Size</th>
                                    {icons.map(icon => (
                                        <th key={icon.label}>{icon.label}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {sizes.map((size) => (
                                    <tr key={size}>
                                        <td>
                                            {size}
                                        </td>
                                        {icons.map((icon) => (
                                            <td key={icon.label}>
                                                <Button emphasis="primary" size={size} inverted {...icon.props}>
                                                    {size === 'xs' ? 'X-small' : size === 'sm' ? 'Small' : size === 'md' ? 'Medium' : 'Large'}
                                                </Button>
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        </div>
                    </div>

                    {/* INVERTED MATRIX 4: ALL EMPHASIS × ALL ICON COMBINATIONS (20 combinations) */}
                    <div className={'cl__section'}>
                        <div className='cl__section-header'>
                            <h3>Emphasis × Icon Combinations (Inverted) - 20 combinations</h3>
                        </div>
                        <table>
                            <thead>
                                <tr>
                                    <th>Emphasis</th>
                                    {icons.map(icon => (
                                        <th key={icon.label}>{icon.label}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {emphases.map((emphasis) => (
                                    <tr key={emphasis}>
                                        <td>{formatEmphasisLabel(emphasis)}</td>
                                        {icons.map((icon) => (
                                            <td key={icon.label}>
                                                <Button emphasis={emphasis} inverted {...icon.props}>
                                                    {icon.label}
                                                </Button>
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* INVERTED MATRIX 5: ALL SIZES × ALL STATES FOR PRIMARY (24 combinations) */}
                    <div className={'cl__section'}>
                        <div className='cl__section-header'>
                            <h3>Sizes × States (Primary Inverted) - 24 combinations</h3>
                        </div>
                        <div className='cl__section-content'>
                            <table>
                            <thead>
                                <tr>
                                    <th>Size</th>
                                    {states.map(state => (
                                        <th key={state.label}>{state.label}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {sizes.map((size) => (
                                    <tr key={size}>
                                        <td>{size}</td>
                                        {states.map((state) => (
                                            <td key={state.label}>
                                                <Button emphasis="primary" size={size} inverted {...state.props}>
                                                    {(size === 'xs' ? 'X-small' : size === 'sm' ? 'Small' : size === 'md' ? 'Medium' : 'Large')} {state.label}
                                                </Button>
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        </div>
                    </div>

                    {/* INVERTED MATRIX 6: FULL WIDTH × SELECTED EMPHASIS × SELECTED STATES */}
                    <div className={'cl__section'}>
                        <div className='cl__section-header'>
                            <h3>Full Width × Selected Emphasis × Key States (Inverted)</h3>
                        </div>
                        <div className='cl__section-content'>
                            {emphases.filter(emphasis => !['quaternary', 'link'].includes(emphasis)).map((emphasis) => (
                                <div key={emphasis} className={'cl__section'}>
                                    <div className='cl__section-header'>
                                        <h4>{formatEmphasisLabel(emphasis)}</h4>
                                    </div>
                                    <div className='cl__variants-wrapper'>
                                        <Button emphasis={emphasis} fullWidth inverted>Full Width</Button>
                                        <Button emphasis={emphasis} fullWidth disabled inverted>Full Width Disabled</Button>
                                        <Button emphasis={emphasis} fullWidth loading inverted>Full Width Loading</Button>
                                        <Button emphasis={emphasis} fullWidth destructive inverted>Full Width Destructive</Button>
                                        <Button emphasis={emphasis} fullWidth inverted iconBefore={<i className="icon icon-plus"/>}>Full Width + Icon</Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
                </div>
            </div>
        </>
    );
};

export default ButtonComponentLibrary;
