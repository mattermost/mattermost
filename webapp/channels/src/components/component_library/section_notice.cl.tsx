// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/* eslint-disable no-alert */

import classNames from 'classnames';
import React, {useCallback, useState} from 'react';

import SectionNotice from 'components/section_notice';

import {useBooleanProp, useLibraryComponent, useDropdownProp, useStringProp} from './hooks';

import './component_library.scss';

const propPossibilities = {};

const sectionTypeValues = ['danger', 'info', 'success', 'welcome', 'warning'];

const primaryButton = {primaryButton: {onClick: () => window.alert('primary!'), text: 'Primary'}};
const secondaryButton = {secondaryButton: {onClick: () => window.alert('secondary!'), text: 'Secondary'}};
const linkButton = {linkButton: {onClick: () => window.alert('link!'), text: 'Link'}};

type Props = {
    backgroundClass: string;
};

const SectionNoticeComponentLibrary = ({
    backgroundClass,
}: Props) => {
    const textProp = useStringProp('text', 'Some text', true);
    const titleProp = useStringProp('title', 'Some text', false);
    const dismissableProp = useBooleanProp('isDismissable', true);
    const sectionTypeProp = useDropdownProp('type', 'danger', sectionTypeValues, true);

    const [showPrimaryButton, setShowPrimaryButton] = useState(false);
    const onChangePrimaryButton = useCallback((e: React.ChangeEvent<HTMLInputElement>) => setShowPrimaryButton(e.target.checked), []);

    const [showSecondaryButton, setShowSecondaryButton] = useState(false);
    const onChangeSecondaryButton = useCallback((e: React.ChangeEvent<HTMLInputElement>) => setShowSecondaryButton(e.target.checked), []);

    const [showLinkButton, setShowLinkButton] = useState(false);
    const onChangeLinkButton = useCallback((e: React.ChangeEvent<HTMLInputElement>) => setShowLinkButton(e.target.checked), []);

    const {components, selectors} = useLibraryComponent(
        SectionNotice,
        propPossibilities,
        [
            textProp,
            titleProp,
            dismissableProp,
            sectionTypeProp,
            showPrimaryButton ? primaryButton : undefined,
            showSecondaryButton ? secondaryButton : undefined,
            showLinkButton ? linkButton : undefined,
            {onDismissClick: () => window.alert('dismiss!')},
        ],
    );

    return (
        <>
            {selectors}
            <label className='clInput'>
                {'Show primary button: '}
                <input
                    type='checkbox'
                    onChange={onChangePrimaryButton}
                    checked={showPrimaryButton}
                />
            </label>
            <label className='clInput'>
                {'Show secondary button: '}
                <input
                    type='checkbox'
                    onChange={onChangeSecondaryButton}
                    checked={showSecondaryButton}
                />
            </label>
            <label className='clInput'>
                {'Show link button: '}
                <input
                    type='checkbox'
                    onChange={onChangeLinkButton}
                    checked={showLinkButton}
                />
            </label>
            <div className={classNames('clWrapper', backgroundClass)}>{components}</div>
        </>
    );
};

export default SectionNoticeComponentLibrary;
