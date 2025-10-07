// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {useCallback, useEffect, useRef} from 'react';
import type {ReactNode} from 'react';
import {FormattedMessage} from 'react-intl';

import SaveButton from 'components/save_button';

import Constants from 'utils/constants';
import {isKeyPressed} from 'utils/keyboard';
import {a11yFocus} from 'utils/utils';

type Props = {

    // Array of inputs selection
    inputs?: ReactNode;
    containerStyle?: string;
    serverError?: ReactNode;

    /**
     * Settings extra information
     */
    extraInfo?: ReactNode;

    /**
     * Info position
     */
    infoPosition?: string;

    /**
     * Settings or tab section
     */
    section?: string;
    updateSection?: (section: string) => void;
    setting?: string;
    submit?: ((setting?: string) => void) | null;
    disableEnterSubmit?: boolean;
    submitExtra?: ReactNode;
    saving?: boolean;
    title?: ReactNode;
    extraContentBeforeSettingList?: ReactNode;
    isFullWidth?: boolean;
    cancelButtonText?: ReactNode;
    shiftEnter?: boolean;
    saveButtonText?: string;
    saveButtonClassName?: string;
    isValid?: boolean;
}

const SettingItemMax = ({
    infoPosition = 'bottom',
    saving = false,
    section = '',
    containerStyle = '',
    shiftEnter,
    disableEnterSubmit,
    setting,
    updateSection,
    submit: submitFromProps,
    submitExtra,
    serverError: serverErrorFromProps,
    extraInfo: extraInfoFromProps,
    saveButtonText,
    isValid,
    isFullWidth,
    saveButtonClassName,
    title: titleFromProps,
    inputs: inputsFromProps,
    cancelButtonText: cancelButtonTextFromProps,
    extraContentBeforeSettingList,
}: Props) => {
    const settingList = useRef<HTMLDivElement>(null);

    const handleSubmit = useCallback((e: React.MouseEvent | KeyboardEvent) => {
        e.preventDefault();

        if (setting && submitFromProps) {
            submitFromProps(setting);
        } else if (submitFromProps) {
            submitFromProps();
        }
    }, [setting, submitFromProps]);

    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            const target = e.target as HTMLElement;
            if (shiftEnter && isKeyPressed(e, Constants.KeyCodes.ENTER) && e.shiftKey) {
                return;
            }
            if (disableEnterSubmit !== true &&
                isKeyPressed(e, Constants.KeyCodes.ENTER) &&
                submitFromProps &&
                target.tagName !== 'SELECT' &&
                target.parentElement &&
                target.parentElement.className !== 'react-select__input' &&
                !target.classList.contains('btn-tertiary') &&
                settingList.current &&
                settingList.current.contains(target)) {
                handleSubmit(e);
            }
        };

        if (settingList.current) {
            const focusableElements: NodeListOf<HTMLElement> = settingList.current.querySelectorAll('.btn:not(.save-button):not(.btn-tertiary), input.form-control, input[type="radio"][checked], input[type="checkbox"], select, textarea, [tabindex]:not([tabindex="-1"])');
            if (focusableElements.length > 0) {
                a11yFocus(focusableElements[0]);
            } else {
                a11yFocus(settingList.current);
            }
        }

        document.addEventListener('keydown', onKeyDown);

        return () => {
            document.removeEventListener('keydown', onKeyDown);
        };

        /* eslint-disable-next-line react-hooks/exhaustive-deps --
         * This 'useEffect' should only run once during mount.
         **/
    }, []);

    const handleUpdateSection = useCallback(
        (e: React.MouseEvent) => {
            if (updateSection) {
                updateSection(section);
            }
            e.preventDefault();
        }, [section, updateSection],
    );

    let serverError = null;
    if (serverErrorFromProps) {
        serverError = (
            <div className='form-group'>
                <label
                    className='col-sm-12 has-error'
                >
                    <i
                        className='icon icon-alert-circle-outline'
                        role='presentation'
                    />
                    <span className='sr-only'>
                        <FormattedMessage
                            id='setting_item_max.error'
                            defaultMessage='Error'
                        />
                    </span>
                    <span id='serverError'>
                        {serverErrorFromProps}
                    </span>
                </label>
            </div>
        );
    }

    let extraInfo = null;
    let hintClass = 'setting-list__hint';

    if (infoPosition === 'top') {
        hintClass = 'pb-3';
    }

    if (extraInfoFromProps) {
        extraInfo = (
            <div
                id='extraInfo'
                className={hintClass}
            >
                {extraInfoFromProps}
            </div>
        );
    }

    let submit: JSX.Element | null = null;
    if (submitFromProps) {
        submit = (
            <SaveButton
                defaultMessage={saveButtonText}
                saving={saving}
                disabled={saving || isValid === false}
                onClick={handleSubmit}
                btnClass={saveButtonClassName}
            />
        );
    }

    const inputs = inputsFromProps;

    let title;
    if (titleFromProps) {
        title = (
            <h4
                id='settingTitle'
                className='col-sm-12 section-title'
            >
                {titleFromProps}
            </h4>
        );
    }

    let listContent = (
        <div className='setting-list-item'>
            {inputs}
            {extraInfo}
        </div>
    );

    if (infoPosition === 'top') {
        listContent = (
            <div>
                {extraInfo}
                {inputs}
            </div>
        );
    }

    let cancelButtonText;
    if (cancelButtonTextFromProps) {
        cancelButtonText = cancelButtonTextFromProps;
    } else {
        cancelButtonText = (
            <FormattedMessage
                id='setting_item_max.cancel'
                defaultMessage='Cancel'
            />
        );
    }

    return (
        <section
            className={`section-max form-horizontal ${containerStyle}`}
            ref={settingList}
        >
            {title}
            {extraContentBeforeSettingList}
            <div
                className={classNames('sectionContent', {
                    'col-sm-12': isFullWidth,
                    'col-sm-10 col-sm-offset-2': !isFullWidth,
                })}
            >
                <div
                    tabIndex={-1}
                    className='setting-list'
                >
                    {listContent}
                    <div className='setting-list-item'>
                        <hr/>
                        {submitExtra}
                        <div
                            role='alert'
                        >
                            {serverError}
                        </div>
                        {submit}
                        <button
                            id='cancelSetting'
                            data-testid='cancelButton'
                            className='btn btn-tertiary'
                            onClick={handleUpdateSection}
                        >
                            {cancelButtonText}
                        </button>
                    </div>
                </div>
            </div>
        </section>
    );
};

export default React.memo(SettingItemMax);

