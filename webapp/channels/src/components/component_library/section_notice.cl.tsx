// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/* eslint-disable no-alert */

import classNames from 'classnames';
import React, {useMemo, useState} from 'react';

import DropdownInput from 'components/dropdown_input';
import SectionNotice from 'components/section_notice';
import Input from 'components/widgets/inputs/input/input';
import CheckboxSettingItem from 'components/widgets/modals/components/checkbox_setting_item';

import './component_library.scss';

const sectionTypeValues = ['info', 'success', 'danger', 'welcome', 'warning', 'hint'];

// Helper function to format type names consistently with select menu
const formatTypeLabel = (type: string) => type.charAt(0).toUpperCase() + type.slice(1);

const SectionNoticeComponentLibrary = () => {
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

    const sectionTypeOptions = sectionTypeValues.map((value) => ({
        label: formatTypeLabel(value),
        value,
    }));

    const typeSelect = (
        <div className='clInputWrapper'>
            <DropdownInput
                name='type'
                placeholder='Section Type'
                value={sectionTypeOptions.find((option) => option.value === sectionType)}
                options={sectionTypeOptions}
                onChange={(option: any) => setSectionType(option.value)}
            />
        </div>
    );

    const dismissableCheckbox = (
        <div className='clInputWrapper'>
            <CheckboxSettingItem
                inputFieldData={{name: 'isDismissable', dataTestId: 'isDismissable'}}
                inputFieldValue={dismissable}
                inputFieldTitle='Is Dismissable'
                handleChange={setDismissable}
            />
        </div>
    );

    const primaryButtonCheckbox = (
        <div className='clInputWrapper'>
            <CheckboxSettingItem
                inputFieldData={{name: 'showPrimaryButton', dataTestId: 'showPrimaryButton'}}
                inputFieldValue={showPrimaryButton}
                inputFieldTitle='Show Primary Button'
                handleChange={setShowPrimaryButton}
            />
        </div>
    );

    const secondaryButtonCheckbox = (
        <div className='clInputWrapper'>
            <CheckboxSettingItem
                inputFieldData={{name: 'showSecondaryButton', dataTestId: 'showSecondaryButton'}}
                inputFieldValue={showSecondaryButton}
                inputFieldTitle='Show Secondary Button'
                handleChange={setShowSecondaryButton}
            />
        </div>
    );

    const tertiaryButtonCheckbox = (
        <div className='clInputWrapper'>
            <CheckboxSettingItem
                inputFieldData={{name: 'showTertiaryButton', dataTestId: 'showTertiaryButton'}}
                inputFieldValue={showTertiaryButton}
                inputFieldTitle='Show Tertiary Button'
                handleChange={setShowTertiaryButton}
            />
        </div>
    );

    const linkButtonCheckbox = (
        <div className='clInputWrapper'>
            <CheckboxSettingItem
                inputFieldData={{name: 'showLinkButton', dataTestId: 'showLinkButton'}}
                inputFieldValue={showLinkButton}
                inputFieldTitle='Show Link Button'
                handleChange={setShowLinkButton}
            />
        </div>
    );

    // Build interactive section notice
    const interactiveSectionNotice = useMemo(() => {
        const allProps = {
            title,
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

        return <SectionNotice {...allProps}/>;
    }, [title, text, sectionType, dismissable, showPrimaryButton, showSecondaryButton, showTertiaryButton, showLinkButton]);

    // Static variant definitions for comprehensive view
    const types = ['info', 'success', 'danger', 'welcome', 'warning', 'hint'] as const;

    return (
        <>
            <div className='cl__intro'>
                <div className='cl__intro-content'>
                    <p className='cl__intro-subtitle'>{'Component'}</p>
                    <h1 className='cl__intro-title'>{'Section Notice'}</h1>
                    <p className='cl__description'>
                        {'A Section Notice is used to alert users to a particular area of the screen. It can be used to highlight important information, signify a change in state, or alert users when a problem occurs.'}
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
                    <div className={classNames('cl__live-component-panel')}>
                        {interactiveSectionNotice}
                    </div>
                </div>
            </div>

            <div className='cl__text-content-block'>
                <h3>{'Types'}</h3>
                <p>
                    {'Section notices come in six types: info, success, danger, welcome, warning, and hint.'}
                </p>
            </div>

            <div className='cl__variants-stack'>
                {types.map((type) => (
                    <SectionNotice
                        key={type}
                        type={type}
                        title={`${formatTypeLabel(type)} Notice`}
                        text={`This is a ${type} section notice.`}
                    />
                ))}
            </div>

            <div className='cl__text-content-block'>
                <h3>{'Dismiss Option'}</h3>
                <p>
                    {'Section notices can either be dismissable or not.'}
                </p>
            </div>

            <div className='cl__variants-stack'>
                <SectionNotice
                    type='info'
                    title='Dismissable Notice'
                    text='This notice can be dismissed'
                    isDismissable={true}
                    onDismissClick={() => window.alert('Dismissed!')}
                />
                <SectionNotice
                    type='info'
                    title='Not Dismissable Notice'
                    text='This notice cannot be dismissed'
                    isDismissable={false}
                />
            </div>

            <div className='cl__text-content-block'>
                <h3>{'Button Options'}</h3>
                <p>
                    {'Section notices can have primary, secondary, tertiary, and link buttons. No more than 2 buttons per notice. Typically we use primary and tertiary buttons together.'}
                </p>
            </div>
            <div className='cl__variants-stack'>
                <SectionNotice
                    type='info'
                    title='Primary Button Only'
                    text='Section notice with primary action'
                    primaryButton={{onClick: () => window.alert('Primary!'), text: 'Primary Action'}}
                />
                <SectionNotice
                    type='info'
                    title='Primary and Secondary'
                    text='Section notice with primary and secondary actions'
                    primaryButton={{onClick: () => window.alert('Primary!'), text: 'Continue'}}
                    secondaryButton={{onClick: () => window.alert('Secondary!'), text: 'Cancel'}}
                />
                <SectionNotice
                    type='info'
                    title='Primary and Tertiary'
                    text='Section notice with primary and tertiary actions'
                    primaryButton={{onClick: () => window.alert('Primary!'), text: 'Save'}}
                    tertiaryButton={{onClick: () => window.alert('Tertiary!'), text: 'Skip'}}
                />
                <SectionNotice
                    type='info'
                    title='Tertiary and Link'
                    text='Section notice with tertiary and link actions'
                    tertiaryButton={{onClick: () => window.alert('Tertiary!'), text: 'Dismiss'}}
                    linkButton={{onClick: () => window.alert('Link!'), text: 'Learn More'}}
                />
            </div>

            <div className='cl__text-content-block'>
                <h3>{'Text Variations'}</h3>
                <p>
                    {'Section notices can have short text, long text, and no text.'}
                </p>
            </div>
            <div className='cl__variants-stack'>
                <SectionNotice
                    type='info'
                    title='Short Text'
                    text='This is a short section notice.'
                />
                <SectionNotice
                    type='info'
                    title='Long Text'
                    text='This is a long section notice. It can have multiple lines of text and will wrap to the next line if it exceeds the width of the container.'
                />
                <SectionNotice
                    type='info'
                    title='Title only'
                    text={undefined}
                />
            </div>
        </>
    );
};

export default SectionNoticeComponentLibrary;
