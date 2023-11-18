// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
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
    successMessage: string | MessageDescriptor;

    /**
     * The message to show when the request returns an error.
     */
    errorMessage: string | MessageDescriptor;

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
};

type State = {
    busy: boolean;
    fail: string;
    success: boolean;
}

export default class RequestButton extends React.PureComponent<Props, State> {
    static defaultProps: Partial<Props> = {
        disabled: false,
        saveNeeded: false,
        showSuccessMessage: true,
        includeDetailedError: false,
        successMessage: defineMessage({
            id: 'admin.requestButton.requestSuccess',
            defaultMessage: 'Test Successful',
        }),
        errorMessage: defineMessage({
            id: 'admin.requestButton.requestFailure',
            defaultMessage: 'Test Failure: {error}',
        }),
    };

    constructor(props: Props) {
        super(props);

        this.state = {
            busy: false,
            fail: '',
            success: false,
        };
    }

    handleRequest = (e: React.MouseEvent<HTMLButtonElement>) => {
        e.preventDefault();

        this.setState({
            busy: true,
            fail: '',
            success: false,
        });

        const doRequest = () => this.props.requestAction(
            () => {
                this.setState({
                    busy: false,
                    success: true,
                });
            },
            (err) => {
                let errMsg = err.message;
                if (this.props.includeDetailedError && err.detailed_error) {
                    errMsg += ' - ' + err.detailed_error;
                }

                this.setState({
                    busy: false,
                    fail: errMsg,
                });
            },
        );

        if (this.props.saveNeeded && this.props.saveConfigAction) {
            this.props.saveConfigAction(doRequest);
        } else {
            doRequest();
        }
    };

    render() {
        let message = null;
        if (this.state.fail) {
            const text = typeof this.props.errorMessage === 'string' ?
                this.props.errorMessage :
                (
                    <FormattedMessage
                        {...this.props.errorMessage}
                        values={{
                            error: this.state.fail,
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
        } else if (this.state.success && this.props.showSuccessMessage) {
            const text = typeof this.props.successMessage === 'string' ?
                this.props.successMessage :
                (<FormattedMessage {...this.props.successMessage}/>);
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
        let label = null;
        if (this.props.label) {
            label = (
                <label className='control-label col-sm-4'>
                    {this.props.label}
                </label>
            );
        } else {
            widgetClassNames = 'col-sm-offset-4 ' + widgetClassNames;
        }

        return (
            <div
                className='form-group'
                id={this.props.id}
            >
                {label}
                <div className={widgetClassNames}>
                    <div>
                        <button
                            type='button'
                            className='btn btn-tertiary'
                            onClick={this.handleRequest}
                            disabled={this.props.disabled}
                        >
                            <LoadingWrapper
                                loading={this.state.busy}
                                text={
                                    this.props.loadingText ||
                                    (
                                        <FormattedMessage
                                            id={'admin.requestButton.loading'}
                                            defaultMessage={'Loading...'}
                                        />
                                    )
                                }
                            >
                                {this.props.buttonText}
                            </LoadingWrapper>
                        </button>
                        {this.props.alternativeActionElement}
                        {message}
                    </div>
                    <div className='help-text'>{this.props.helpText}</div>
                </div>
            </div>
        );
    }
}
