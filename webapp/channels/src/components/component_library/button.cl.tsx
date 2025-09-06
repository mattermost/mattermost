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

type Props = {
    backgroundClass: string;
};

const ButtonComponentLibrary = ({
    backgroundClass,
}: Props) => {
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
        label: value.charAt(0).toUpperCase() + value.slice(1),
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
        { label: 'Destructive + Disabled', props: { destructive: true, disabled: true } },
        { label: 'Destructive + Loading', props: { destructive: true, loading: true } },
    ];
    const icons = [
        { label: 'No Icon', props: {} },
        { label: 'Before', props: { iconBefore: <i className="icon icon-plus"/> } },
        { label: 'After', props: { iconAfter: <i className="icon icon-chevron-right"/> } },
        { label: 'Both', props: { iconBefore: <i className="icon icon-plus"/>, iconAfter: <i className="icon icon-chevron-down"/> } },
    ];

    return (
        <>
            {/* Interactive Testing Section */}
            <div className={classNames('clLiveComponentWrapper')}>
                <div className='clInteractiveSection'>
                    {/* Controls Panel (Left) */}
                    <div className='clControlsPanel'>
                        <h2>Button</h2>
                        <div className='clInputs'>
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
                    <div className={classNames('clLiveComponentPanel', backgroundClass)}>
                        {interactiveButton}
                    </div>
                </div>
            </div>

            {/* Comprehensive Variants */}
            <div className={`clComponentVariants ${backgroundClass || ''}`}>
                    <div>
                        <h2>Button Component - All variants</h2>
                
                {/* MATRIX 1: ALL EMPHASIS × ALL SIZES (20 combinations) */}
                <div className={'clSection'}>
                    <h3>Emphasis × Sizes (20 combinations)</h3>
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
                                    <td>{emphasis}</td>
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

                
                {/* MATRIX 3: ALL EMPHASIS × ALL STATES (30 combinations) */}
                <div className={'clSection'}>
                    <h3>Emphasis × States (30 combinations)</h3>
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
                                    <td>{emphasis}</td>
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

                {/* MATRIX 2: ALL SIZES × ALL ICON VARIANTS (16 combinations) */}
                <div className={'clSection'}>
                    <h3>Sizes × All Icon Variants (16 combinations)</h3>
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

                {/* MATRIX 4: ALL EMPHASIS × ALL ICON COMBINATIONS (20 combinations) */}
                <div className={'clSection'}>
                    <h3>Emphasis × Icon Combinations (20 combinations)</h3>
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
                                    <td>{emphasis}</td>
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

                {/* MATRIX 5: ALL SIZES × ALL STATES FOR PRIMARY (24 combinations) */}
                <div className={'clSection'}>
                    <h3>ALL Sizes × ALL States (Primary) (24 combinations)</h3>
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
                                            <Button emphasis="primary" size={size} {...state.props}>
                                                {(size === 'xs' ? 'X-small' : size === 'sm' ? 'Small' : size === 'md' ? 'Medium' : 'Large')} {state.label}
                                            </Button>
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* MATRIX 6: FULL WIDTH × ALL EMPHASIS × SELECTED STATES */}
                <div className={'clSection'}>
                    <h3>Full Width × Selected Emphasis × Key States</h3>
                    {emphases.filter(emphasis => !['quaternary', 'link'].includes(emphasis)).map((emphasis) => (
                        <div key={emphasis} className={'clSection'}>
                            <h5>{emphasis}</h5>
                            <div className='clVariantsWrapper'>
                                <Button emphasis={emphasis} fullWidth>Full Width</Button>
                                <Button emphasis={emphasis} fullWidth disabled>Full Width Disabled</Button>
                                <Button emphasis={emphasis} fullWidth loading>Full Width Loading</Button>
                                <Button emphasis={emphasis} fullWidth destructive>Full Width Destructive</Button>
                                <Button emphasis={emphasis} fullWidth iconBefore={<i className="icon icon-plus"/>}>Full Width + Icon</Button>
                            </div>
                        </div>
                    ))}
                </div>

                {/* MATRIX 7: INVERTED STYLES - ALL COMBINATIONS ON DARK BACKGROUND */}
                <div className={'clInvertedWrapper'}>
                    <h3>INVERTED × ALL Combinations (Dark Background)</h3>
                    
                    {/* INVERTED MATRIX 1: ALL EMPHASIS × ALL SIZES (20 combinations) */}
                    <div className={'clSection'}>
                        <h4>Emphasis × Sizes (Inverted) - 20 combinations</h4>
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
                                        <td>{emphasis}</td>
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

                    {/* INVERTED MATRIX 2: ALL EMPHASIS × ALL STATES (30 combinations) */}
                    <div className={'clSection'}>
                        <h4>Emphasis × States (Inverted) - 30 combinations</h4>
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
                                        <td>{emphasis}</td>
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

                    {/* INVERTED MATRIX 3: ALL SIZES × ALL ICON VARIANTS (16 combinations) */}
                    <div className={'clSection'}>
                        <h4>Sizes × Icon Variants (Inverted) - 16 combinations</h4>
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

                    {/* INVERTED MATRIX 4: ALL EMPHASIS × ALL ICON COMBINATIONS (20 combinations) */}
                    <div className={'clSection'}>
                        <h4>Emphasis × Icon Combinations (Inverted) - 20 combinations</h4>
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
                                        <td>{emphasis}</td>
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
                    <div className={'clSection'}>
                        <h4>Sizes × States (Primary Inverted) - 24 combinations</h4>
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

                    {/* INVERTED MATRIX 6: FULL WIDTH × SELECTED EMPHASIS × SELECTED STATES */}
                    <div className={'clSection'}>
                        <h4>Full Width × Selected Emphasis × Key States (Inverted)</h4>
                        {emphases.filter(emphasis => !['quaternary', 'link'].includes(emphasis)).map((emphasis) => (
                            <div key={emphasis} className={'clSection'}>
                                <h5>{emphasis}</h5>
                                <div className='clVariantsWrapper'>
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
        </>
    );
};

export default ButtonComponentLibrary;
