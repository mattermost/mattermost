// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {ReactNode} from 'react';
import {FormattedMessage} from 'react-intl';

import SaveButton from 'components/save_button';
import Constants from 'utils/constants';
import {a11yFocus, isKeyPressed} from 'utils/utils';
type Props = {

    // Array of inputs selection
    inputs?: ReactNode;
    containerStyle?: string;
    serverError?: ReactNode;

    /**
     * Client error
     */
    clientError?: ReactNode;

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
    section: string;
    updateSection?: (section: string) => void;
    setting?: string;
    submit?: ((setting?: string) => void) | null;
    disableEnterSubmit?: boolean;
    submitExtra?: ReactNode;
    saving?: boolean;
    title?: ReactNode;
    width?: string;
    cancelButtonText?: ReactNode;
    shiftEnter?: boolean;
    saveButtonText?: string;
}
export default class SettingItemMax extends React.PureComponent<Props> {
    settingList: React.RefObject<HTMLDivElement>;

    static defaultProps = {
        infoPosition: 'bottom',
        saving: false,
        section: '',
        containerStyle: '',
    };

    constructor(props: Props) {
        super(props);
        this.settingList = React.createRef();
    }

    componentDidMount() {
        if (this.settingList.current) {
            const focusableElements: NodeListOf<HTMLElement> = this.settingList.current.querySelectorAll('.btn:not(.save-button):not(.btn-cancel), input.form-control, input[type="radio"][checked], input[type="checkbox"], select, textarea, [tabindex]:not([tabindex="-1"])');
            if (focusableElements.length > 0) {
                a11yFocus(focusableElements[0]);
            } else {
                a11yFocus(this.settingList.current);
            }
        }

        document.addEventListener('keydown', this.onKeyDown);
    }

    componentWillUnmount() {
        document.removeEventListener('keydown', this.onKeyDown);
    }

    onKeyDown = (e: KeyboardEvent) => {
        const target = e.target as HTMLElement;
        if (this.props.shiftEnter && isKeyPressed(e, Constants.KeyCodes.ENTER) && e.shiftKey) {
            return;
        }
        if (this.props.disableEnterSubmit !== true &&
            isKeyPressed(e, Constants.KeyCodes.ENTER) &&
            this.props.submit &&
            target.tagName !== 'SELECT' &&
            target.parentElement &&
            target.parentElement.className !== 'react-select__input' &&
            !target.classList.contains('btn-cancel') &&
            this.settingList.current &&
            this.settingList.current.contains(target)) {
            this.handleSubmit(e);
        }
    }

    handleSubmit = (e: React.MouseEvent | KeyboardEvent) => {
        e.preventDefault();

        if (this.props.setting && this.props.submit) {
            this.props.submit(this.props.setting);
        } else if (this.props.submit) {
            this.props.submit();
        }
    }

    handleUpdateSection = (e: React.MouseEvent) => {
        if (this.props.updateSection) {
            this.props.updateSection(this.props.section);
        }
        e.preventDefault();
    }

    render() {
        let clientError = null;
        if (this.props.clientError) {
            clientError = (
                <div className='form-group'>
                    <label
                        id='clientError'
                        className='col-sm-12 has-error'
                    >
                        {this.props.clientError}
                    </label>
                </div>
            );
        }

        let serverError = null;
        if (this.props.serverError) {
            serverError = (
                <div className='form-group'>
                    <label
                        id='serverError'
                        className='col-sm-12 has-error'
                    >
                        {this.props.serverError}
                    </label>
                </div>
            );
        }

        let extraInfo = null;
        let hintClass = 'setting-list__hint';
        if (this.props.infoPosition === 'top') {
            hintClass = 'pb-3';
        }

        if (this.props.extraInfo) {
            extraInfo = (
                <div
                    id='extraInfo'
                    className={hintClass}
                >
                    {this.props.extraInfo}
                </div>
            );
        }

        let submit: JSX.Element | null = null;
        if (this.props.submit) {
            submit = (
                <SaveButton
                    defaultMessage={this.props.saveButtonText}
                    saving={this.props.saving}
                    disabled={this.props.saving}
                    onClick={this.handleSubmit}
                />
            );
        }

        const inputs = this.props.inputs;
        let widthClass;
        if (this.props.width === 'full') {
            widthClass = 'col-sm-12';
        } else if (this.props.width === 'medium') {
            widthClass = 'col-sm-10 col-sm-offset-2';
        } else {
            widthClass = 'col-sm-9 col-sm-offset-3';
        }

        let title;
        if (this.props.title) {
            title = (
                <h4
                    id='settingTitle'
                    className='col-sm-12 section-title'
                >
                    {this.props.title}
                </h4>
            );
        }

        let listContent = (
            <div className='setting-list-item'>
                {inputs}
                {extraInfo}
            </div>
        );

        if (this.props.infoPosition === 'top') {
            listContent = (
                <div>
                    {extraInfo}
                    {inputs}
                </div>
            );
        }

        let cancelButtonText;
        if (this.props.cancelButtonText) {
            cancelButtonText = this.props.cancelButtonText;
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
                className={`section-max form-horizontal ${this.props.containerStyle}`}
            >
                {title}
                <div className={widthClass}>
                    <div
                        tabIndex={-1}
                        ref={this.settingList}
                        className='setting-list'
                    >
                        {listContent}
                        <div className='setting-list-item'>
                            <hr/>
                            {this.props.submitExtra}
                            {serverError}
                            {clientError}
                            {submit}
                            <button
                                id={'cancelSetting'}
                                className='btn btn-sm btn-cancel cursor--pointer style--none'
                                onClick={this.handleUpdateSection}
                            >
                                {cancelButtonText}
                            </button>
                        </div>
                    </div>
                </div>
            </section>
        );
    }
}
