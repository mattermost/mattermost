// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState} from 'react';
import type {MessageDescriptor} from 'react-intl';
import {FormattedMessage, defineMessage} from 'react-intl';

import SuccessIcon from 'components/widgets/icons/fa_success_icon';
import WarningIcon from 'components/widgets/icons/fa_warning_icon';
import LoadingWrapper from 'components/widgets/loading/loading_wrapper';

/**
 * A button which, when clicked, performs an action and displays
 * its outcome as either success, or failure accompanied by the
 * `message` property of the `err` object.
 */
type Props = {

    /**
     * ID to assign to the form
     */
    id?: string;

    /**
     * The action to be called to carry out the request.
     */
    requestAction: (
        success: () => void,
        error: (error: {message: string; detailed_error?: string}) => void
    ) => void;

    /**
     * A component that displays help text for the request button.
     *
     * Typically, this will be a <FormattedMessage />.
     */
    helpText?: React.ReactNode;

    /**
     * A component to be displayed on the button.
     *
     * Typically, this will be a <FormattedMessage />
     */
    loadingText?: React.ReactNode;

    /**
     * A component to be displayed on the button.
     *
     * Typically, this will be a <FormattedMessage />
     */
    buttonText: React.ReactNode;

    /**
     * The element to display as the field label.
     *
     * Typically, this will be a <FormattedMessage />
     */
    label?: React.ReactNode;

    /**
     * True if the button form control should be disabled, otherwise false.
     */
    disabled?: boolean;

    /**
     * True if the config needs to be saved before running the request, otherwise false.
     *
     * If set to true, the action provided in the `saveConfigAction` property will be
     * called before the action provided in the `requestAction` property, with the later
     * only being called if the former is successful.
     */
    saveNeeded?: boolean;

    /**
     * Action to be called to save the config, if saveNeeded is set to true.
     */
    saveConfigAction?: (callback: () => void) => void;

    /**
     * True if the success message should be shown when the request completes successfully,
     * otherwise false.
     */
    showSuccessMessage?: boolean;

    /**
     * The message to show when the request completes successfully.
     */
    successMessage?: string | MessageDescriptor;

    /**
     * The message to show when the request returns an error.
     */
    errorMessage?: string | MessageDescriptor;

    /**
     * True if the {error} placeholder for the `errorMessage` property should include both
     * the `message` and `detailed_error` properties of the error returned from the server,
     * otherwise false to include only the `message` property.
     */
    includeDetailedError?: boolean;

    /**
     * An element to display adjacent to the request button.
     */
    alternativeActionElement?: React.ReactNode;

    /**
     * True if the button should be displayed flush left without the col-sm-offset-4 class,
     * otherwise false.
     */
    flushLeft?: boolean;

    /**
     * The button type/variant to apply. Determines the button's visual style.
     * Defaults to 'tertiary'.
     */
    buttonType?: 'primary' | 'secondary' | 'tertiary';
};

const defaultSuccessMessage = defineMessage({
    id: 'admin.requestButton.requestSuccess',
    defaultMessage: 'Test Successful',
});

const defaultErrorMessage = defineMessage({
    id: 'admin.requestButton.requestFailure',
    defaultMessage: 'Test Failure: {error}',
});

const RequestButton: React.FC<Props> = ({
    id,
    requestAction,
    helpText,
    loadingText,
    buttonText,
    label,
    disabled = false,
    saveNeeded = false,
    saveConfigAction,
    showSuccessMessage = true,
    successMessage = defaultSuccessMessage,
    errorMessage = defaultErrorMessage,
    includeDetailedError = false,
    alternativeActionElement,
    flushLeft,
    buttonType = 'tertiary',
}) => {
    const [busy, setBusy] = useState(false);
    const [fail, setFail] = useState('');
    const [success, setSuccess] = useState(false);

    const handleRequest = (e: React.MouseEvent<HTMLButtonElement>) => {
        e.preventDefault();

        setBusy(true);
        setFail('');
        setSuccess(false);

        const doRequest = () => requestAction(
            () => {
                setBusy(false);
                setSuccess(true);
            },
            (err) => {
                let errMsg = err.message;
                if (includeDetailedError && err.detailed_error) {
                    errMsg += ' - ' + err.detailed_error;
                }

                setBusy(false);
                setFail(errMsg);
            },
        );

        if (saveNeeded && saveConfigAction) {
            saveConfigAction(doRequest);
        } else {
            doRequest();
        }
    };

    let message = null;
    if (fail) {
        const text = typeof errorMessage === 'string' ?
            errorMessage :
            (
                <FormattedMessage
                    {...errorMessage}
                    values={{
                        error: fail,
                    }}
                />
            );
        message = (
            <div>
                <div className='alert alert-warning'>
                    <WarningIcon/>
                    {text}
                </div>
            </div>
        );
    } else if (success && showSuccessMessage) {
        const text = typeof successMessage === 'string' ?
            successMessage :
            (<FormattedMessage {...successMessage}/>);
        message = (
            <div>
                <div className='alert alert-success'>
                    <SuccessIcon/>
                    {text}
                </div>
            </div>
        );
    }

    let widgetClassNames = 'col-sm-8';
    let labelElement = null;
    if (label) {
        // When there's a label, widget takes remaining 8 columns regardless of flushLeft
        labelElement = (
            <label className='control-label col-sm-4'>
                {label}
            </label>
        );
    } else if (flushLeft) {
        widgetClassNames = 'col-sm-12';
    } else {
        widgetClassNames = 'col-sm-offset-4 ' + widgetClassNames;
    }

    return (
        <div
            className='form-group'
            id={id}
        >
            {labelElement}
            <div className={widgetClassNames}>
                <div>
                    <button
                        type='button'
                        className={`btn btn-${buttonType}`}
                        onClick={handleRequest}
                        disabled={disabled}
                    >
                        <LoadingWrapper
                            loading={busy}
                            text={
                                loadingText ||
                                (
                                    <FormattedMessage
                                        id={'admin.requestButton.loading'}
                                        defaultMessage={'Loading...'}
                                    />
                                )
                            }
                        >
                            {buttonText}
                        </LoadingWrapper>
                    </button>
                    {alternativeActionElement}
                    {message}
                </div>
                <div className='help-text'>{helpText}</div>
            </div>
        </div>
    );
};

export default RequestButton;
