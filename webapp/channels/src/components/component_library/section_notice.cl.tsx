// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/* eslint-disable no-alert */

import classNames from 'classnames';
import React, {useCallback, useMemo, useState} from 'react';

import SectionNotice from 'components/section_notice';
import Input from 'components/widgets/inputs/input/input';
import DropdownInput from 'components/dropdown_input';
import CheckboxSettingItem from 'components/widgets/modals/components/checkbox_setting_item';

import {buildComponent} from './utils';

import './component_library.scss';

const propPossibilities = {};

const sectionTypeValues = ['info', 'success', 'danger', 'welcome', 'warning', 'hint'];

// Helper function to format type names consistently with select menu
const formatTypeLabel = (type: string) => type.charAt(0).toUpperCase() + type.slice(1);

type Props = {
    backgroundClass: string;
};

const SectionNoticeComponentLibrary = ({
    backgroundClass,
}: Props) => {
    // Interactive Controls State
    const [title, setTitle] = useState('Section Notice Title');
    const [text, setText] = useState('This is some descriptive text for the section notice.');
    const [sectionType, setSectionType] = useState<'info' | 'success' | 'danger' | 'welcome' | 'warning' | 'hint'>('info');
    const [dismissable, setDismissable] = useState(false);
    const [showPrimaryButton, setShowPrimaryButton] = useState(false);
    const [showSecondaryButton, setShowSecondaryButton] = useState(false);
    const [showTertiaryButton, setShowTertiaryButton] = useState(false);
    const [showLinkButton, setShowLinkButton] = useState(false);

    // Variants Panel State
    const [variantsExpanded, setVariantsExpanded] = useState(false);

    // Toggle function for variants panel
    const toggleVariantsExpanded = useCallback(() => {
        setVariantsExpanded(prev => !prev);
    }, []);

    // Control Components
    const titleInput = (
        <div className='clInputWrapper'>
            <Input
                name='title'
                label='Title'
                value={title}
                onChange={(e) => setTitle(e.target.value)}
            />
        </div>
    );

    const textInput = (
        <div className='clInputWrapper'>
            <Input
                name='text'
                label='Text'
                type='textarea'
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={3}
            />
        </div>
    );

    const sectionTypeOptions = sectionTypeValues.map(value => ({
        label: formatTypeLabel(value),
        value: value,
    }));

    const typeSelect = (
        <div className='clInputWrapper'>
            <DropdownInput
                name='type'
                placeholder='Section Type'
                value={sectionTypeOptions.find(option => option.value === sectionType)}
                options={sectionTypeOptions}
                onChange={(option: any) => setSectionType(option.value)}
            />
        </div>
    );

    const dismissableCheckbox = (
        <div className='clInputWrapper'>
            <CheckboxSettingItem
                inputFieldData={{ name: 'isDismissable', dataTestId: 'isDismissable' }}
                inputFieldValue={dismissable}
                inputFieldTitle='Is Dismissable'
                handleChange={setDismissable}
            />
        </div>
    );

    const primaryButtonCheckbox = (
        <div className='clInputWrapper'>
            <CheckboxSettingItem
                inputFieldData={{ name: 'showPrimaryButton', dataTestId: 'showPrimaryButton' }}
                inputFieldValue={showPrimaryButton}
                inputFieldTitle='Show Primary Button'
                handleChange={setShowPrimaryButton}
            />
        </div>
    );

    const secondaryButtonCheckbox = (
        <div className='clInputWrapper'>
            <CheckboxSettingItem
                inputFieldData={{ name: 'showSecondaryButton', dataTestId: 'showSecondaryButton' }}
                inputFieldValue={showSecondaryButton}
                inputFieldTitle='Show Secondary Button'
                handleChange={setShowSecondaryButton}
            />
        </div>
    );

    const tertiaryButtonCheckbox = (
        <div className='clInputWrapper'>
            <CheckboxSettingItem
                inputFieldData={{ name: 'showTertiaryButton', dataTestId: 'showTertiaryButton' }}
                inputFieldValue={showTertiaryButton}
                inputFieldTitle='Show Tertiary Button'
                handleChange={setShowTertiaryButton}
            />
        </div>
    );

    const linkButtonCheckbox = (
        <div className='clInputWrapper'>
            <CheckboxSettingItem
                inputFieldData={{ name: 'showLinkButton', dataTestId: 'showLinkButton' }}
                inputFieldValue={showLinkButton}
                inputFieldTitle='Show Link Button'
                handleChange={setShowLinkButton}
            />
        </div>
    );

    // Build interactive section notice
    const interactiveSectionNotice = useMemo(() => {
        const allProps = {
            title: title,
            text: text || undefined,
            type: sectionType,
            isDismissable: dismissable,
            onDismissClick: dismissable ? () => window.alert('Dismissed!') : undefined,
            ...(showPrimaryButton ? {
                primaryButton: {
                    onClick: () => window.alert('Primary button clicked!'),
                    text: 'Primary Action',
                },
            } : {}),
            ...(showSecondaryButton ? {
                secondaryButton: {
                    onClick: () => window.alert('Secondary button clicked!'),
                    text: 'Secondary Action',
                },
            } : {}),
            ...(showTertiaryButton ? {
                tertiaryButton: {
                    onClick: () => window.alert('Tertiary button clicked!'),
                    text: 'Tertiary Action',
                },
            } : {}),
            ...(showLinkButton ? {
                linkButton: {
                    onClick: () => window.alert('Link button clicked!'),
                    text: 'Link Action',
                },
            } : {}),
        };

        return <SectionNotice {...allProps} />;
    }, [title, text, sectionType, dismissable, showPrimaryButton, showSecondaryButton, showTertiaryButton, showLinkButton]);

    // Static variant definitions for comprehensive view
    const types = ['info', 'success', 'danger', 'welcome', 'warning', 'hint'] as const;

    return (
        <>
            {/* Interactive Testing Section */}
            <div className={classNames('clLiveComponentWrapper')}>
                <div className='clInteractiveSection'>
                    {/* Controls Panel (Left) */}
                    <div className='clControlsPanel'>
                        <h2>Section Notice</h2>
                        <div className='clInputs'>
                            {titleInput}
                            {textInput}
                            {typeSelect}
                            {dismissableCheckbox}
                            {primaryButtonCheckbox}
                            {secondaryButtonCheckbox}
                            {tertiaryButtonCheckbox}
                            {linkButtonCheckbox}
                        </div>
                    </div>

                    {/* Interactive Example (Right) */}
                    <div className={classNames('clLiveComponentPanel', backgroundClass)}>
                        {interactiveSectionNotice}
                    </div>
                </div>
            </div>

            {/* Comprehensive Variants */}
            <div className={`clComponentVariants ${backgroundClass || ''}`}>
                <div 
                    className="clVariantsHeader" 
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
                    <i className={`icon icon-chevron-right ${variantsExpanded ? 'clVariantsHeader--expanded' : ''}`} />
                </div>

                <div className={`clVariantsContent ${variantsExpanded ? 'clVariantsContent--expanded' : 'clVariantsContent--collapsed'}`}>
                    {/* MATRIX 1: ALL TYPES × BASIC CONTENT */}
                    <div className={'clSection'}>
                        <div className='clSection-header'>
                            <h3>All Types - Basic (6 combinations)</h3>
                        </div>
                        <div className='clSection-content'>
                            <table>
                                <thead>
                                    <tr>
                                        <th>Type</th>
                                        <th>Example</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {types.map((type) => (
                                        <tr key={type}>
                                            <td>{formatTypeLabel(type)}</td>
                                            <td>
                                                <SectionNotice 
                                                    type={type} 
                                                    title={`${formatTypeLabel(type)} Notice`}
                                                    text={`This is a ${type} section notice.`}
                                                />
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* MATRIX 2: ALL TYPES × DISMISS STATES */}
                    <div className={'clSection'}>
                        <div className='clSection-header'>
                            <h3>Types × Dismiss States (12 combinations)</h3>
                        </div>
                        <div className='clSection-content'>
                            <table>
                                <thead>
                                    <tr>
                                        <th>Type</th>
                                        <th>Not Dismissable</th>
                                        <th>Dismissable</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {types.map((type) => (
                                        <tr key={type}>
                                            <td>{formatTypeLabel(type)}</td>
                                            <td>
                                                <SectionNotice 
                                                    type={type}
                                                    title={`${formatTypeLabel(type)} Notice`}
                                                    text="This notice cannot be dismissed"
                                                />
                                            </td>
                                            <td>
                                                <SectionNotice 
                                                    type={type}
                                                    title={`${formatTypeLabel(type)} Notice`}
                                                    text="This notice can be dismissed"
                                                    isDismissable={true}
                                                    onDismissClick={() => window.alert('Dismissed!')}
                                                />
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* MATRIX 3: SELECTED TYPES × BUTTON COMBINATIONS */}
                    <div className={'clSection'}>
                        <div className='clSection-header'>
                            <h3>Selected Types × Button Combinations</h3>
                        </div>
                        <div className='clSection-content'>
                            <div className='clVariantsWrapper'>
                                <SectionNotice 
                                    type="info"
                                    title="Primary Button Only"
                                    text="Section notice with primary action"
                                    primaryButton={{ onClick: () => window.alert('Primary!'), text: 'Primary Action' }}
                                />
                                <SectionNotice 
                                    type="success"
                                    title="Multiple Buttons"
                                    text="Section notice with multiple action buttons"
                                    primaryButton={{ onClick: () => window.alert('Primary!'), text: 'Continue' }}
                                    secondaryButton={{ onClick: () => window.alert('Secondary!'), text: 'Cancel' }}
                                    linkButton={{ onClick: () => window.alert('Link!'), text: 'Learn More' }}
                                />
                                <SectionNotice 
                                    type="danger"
                                    title="All Button Types"
                                    text="Section notice showing all available button types"
                                    primaryButton={{ onClick: () => window.alert('Primary!'), text: 'Primary' }}
                                    secondaryButton={{ onClick: () => window.alert('Secondary!'), text: 'Secondary' }}
                                    tertiaryButton={{ onClick: () => window.alert('Tertiary!'), text: 'Tertiary' }}
                                    linkButton={{ onClick: () => window.alert('Link!'), text: 'Link' }}
                                />
                            </div>
                        </div>
                    </div>

                    {/* MATRIX 4: TEXT VARIATIONS */}
                    <div className={'clSection'}>
                        <div className='clSection-header'>
                            <h3>Text Variations (Selected types)</h3>
                        </div>
                        <div className='clSection-content'>
                            <div className='clVariantsWrapper'>
                                <SectionNotice 
                                    type="info"
                                    title="Short Text"
                                    text="Brief notice."
                                />
                                <SectionNotice 
                                    type="warning"
                                    title="Long Text"
                                    text="This is a much longer section notice text that demonstrates how the component handles multiple lines of content and wrapping behavior within the notice container. It shows proper text flow and spacing."
                                />
                                <SectionNotice 
                                    type="success"
                                    title="No Text"
                                />
                            </div>
                        </div>
                    </div>

                    {/* MATRIX 5: BUTTON STATES */}
                    <div className={'clSection'}>
                        <div className='clSection-header'>
                            <h3>Button States - Loading & Disabled</h3>
                        </div>
                        <div className='clSection-content'>
                            <div className='clVariantsWrapper'>
                                <SectionNotice 
                                    type="info"
                                    title="Normal Buttons"
                                    text="All button types in normal state"
                                    primaryButton={{ onClick: () => window.alert('Primary!'), text: 'Primary' }}
                                    secondaryButton={{ onClick: () => window.alert('Secondary!'), text: 'Secondary' }}
                                />
                                <SectionNotice 
                                    type="info"
                                    title="Loading Buttons"
                                    text="Buttons in loading state"
                                    primaryButton={{ onClick: () => window.alert('Primary!'), text: 'Primary', loading: true }}
                                    secondaryButton={{ onClick: () => window.alert('Secondary!'), text: 'Secondary', loading: true }}
                                />
                                <SectionNotice 
                                    type="info"
                                    title="Disabled Buttons"
                                    text="Buttons in disabled state"
                                    primaryButton={{ onClick: () => window.alert('Primary!'), text: 'Primary', disabled: true }}
                                    secondaryButton={{ onClick: () => window.alert('Secondary!'), text: 'Secondary', disabled: true }}
                                />
                            </div>
                        </div>
                    </div>

                    {/* MATRIX 6: BUTTON ICONS */}
                    <div className={'clSection'}>
                        <div className='clSection-header'>
                            <h3>Button Icons</h3>
                        </div>
                        <div className='clSection-content'>
                            <div className='clVariantsWrapper'>
                                <SectionNotice 
                                    type="info"
                                    title="Leading Icons"
                                    text="Buttons with leading icons"
                                    primaryButton={{ onClick: () => window.alert('Primary!'), text: 'Save', leadingIcon: 'icon-content-save' }}
                                    secondaryButton={{ onClick: () => window.alert('Secondary!'), text: 'Cancel', leadingIcon: 'icon-close' }}
                                />
                                <SectionNotice 
                                    type="success"
                                    title="Trailing Icons"
                                    text="Buttons with trailing icons"
                                    primaryButton={{ onClick: () => window.alert('Primary!'), text: 'Continue', trailingIcon: 'icon-arrow-right' }}
                                    linkButton={{ onClick: () => window.alert('Link!'), text: 'Learn More', trailingIcon: 'icon-open-in-new' }}
                                />
                                <SectionNotice 
                                    type="warning"
                                    title="Mixed Icons"
                                    text="Buttons with different icon configurations"
                                    primaryButton={{ onClick: () => window.alert('Primary!'), text: 'Download', leadingIcon: 'icon-download' }}
                                    secondaryButton={{ onClick: () => window.alert('Secondary!'), text: 'Share', trailingIcon: 'icon-share-variant' }}
                                    linkButton={{ onClick: () => window.alert('Link!'), text: 'Help', leadingIcon: 'icon-help-circle' }}
                                />
                            </div>
                        </div>
                    </div>

                    {/* MATRIX 7: COMPLEX COMBINATIONS */}
                    <div className={'clSection'}>
                        <div className='clSection-header'>
                            <h3>Complex Real-World Examples</h3>
                        </div>
                        <div className='clSection-content'>
                            <div className='clVariantsWrapper'>
                                <SectionNotice 
                                    type="danger"
                                    title="Error with Actions"
                                    text="This is a dismissable error notice with multiple action buttons and mixed states."
                                    isDismissable={true}
                                    onDismissClick={() => window.alert('Dismissed!')}
                                    primaryButton={{ onClick: () => window.alert('Retry!'), text: 'Retry', leadingIcon: 'icon-refresh' }}
                                    secondaryButton={{ onClick: () => window.alert('Cancel!'), text: 'Cancel' }}
                                    linkButton={{ onClick: () => window.alert('Help!'), text: 'Get Help', trailingIcon: 'icon-open-in-new' }}
                                />
                                <SectionNotice 
                                    type="welcome"
                                    title="Welcome Message"
                                    text="Welcome to the platform! Get started by exploring these options."
                                    primaryButton={{ onClick: () => window.alert('Start!'), text: 'Get Started', trailingIcon: 'icon-arrow-right' }}
                                    secondaryButton={{ onClick: () => window.alert('Tour!'), text: 'Take Tour' }}
                                    tertiaryButton={{ onClick: () => window.alert('Skip!'), text: 'Skip for now' }}
                                />
                                <SectionNotice 
                                    type="hint"
                                    title="Pro Tip"
                                    text="You can customize your experience by adjusting these settings."
                                    isDismissable={true}
                                    onDismissClick={() => window.alert('Dismissed!')}
                                    linkButton={{ onClick: () => window.alert('Settings!'), text: 'Open Settings' }}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
};

export default SectionNoticeComponentLibrary;