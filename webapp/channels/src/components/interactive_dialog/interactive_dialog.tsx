// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {Modal} from 'react-bootstrap';
import {FormattedMessage} from 'react-intl';

import type {DialogSubmission} from '@mattermost/types/integrations';

import {
    checkDialogElementForError,
    checkIfErrorsMatchElements,
} from 'mattermost-redux/utils/integration_utils';

import SpinnerButton from 'components/spinner_button';

import DialogElement from './dialog_element';
import DialogIntroductionText from './dialog_introduction_text';

import type {PropsFromRedux} from './index';

// We are using Partial as we are returning empty object with dialog redux state is empty in connect
type OptionalProsFromRedux = Partial<PropsFromRedux> & Pick<PropsFromRedux, 'actions'>;

export type Props = {
    onExited?: () => void;
} & OptionalProsFromRedux;

type State = {
    show: boolean;
    values: Record<string, string | number | boolean>;
    error: string | null;
    errors: Record<string, React.ReactNode>;
    submitting: boolean;
}

export default class InteractiveDialog extends React.PureComponent<Props, State> {
    constructor(props: Props) {
        super(props);

        const values: Record<string, string | number | boolean> = {};
        if (props.elements != null) {
            props.elements.forEach((e) => {
                if (e.type === 'bool') {
                    values[e.name] = String(e.default).toLowerCase() === 'true';
                } else {
                    values[e.name] = e.default ?? null;
                }
            });
        }

        this.state = {
            show: true,
            values,
            error: null,
            errors: {},
            submitting: false,
        };
    }

    handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();

        const {elements} = this.props;
        const values = this.state.values;
        const errors: Record<string, JSX.Element> = {};

        if (elements) {
            elements.forEach((elem) => {
                const error = checkDialogElementForError(
                    elem,
                    values[elem.name],
                );
                if (error) {
                    errors[elem.name] = (
                        <FormattedMessage
                            id={error.id}
                            defaultMessage={error.defaultMessage}
                            values={error.values}
                        />
                    );
                }
            });
        }

        this.setState({errors});

        if (Object.keys(errors).length !== 0) {
            return;
        }

        const {url, callbackId, state} = this.props;

        const dialog: DialogSubmission = {
            url,
            callback_id: callbackId ?? '',
            state: state ?? '',
            submission: values as { [x: string]: string },
            user_id: '',
            channel_id: '',
            team_id: '',
            cancelled: false,
        };

        this.setState({submitting: true});

        const {data} = await this.props.actions.submitInteractiveDialog(dialog) ?? {};

        this.setState({submitting: false});

        let hasErrors = false;

        if (data) {
            if (data.error) {
                hasErrors = true;
                this.setState({error: data.error});
            }

            if (
                data.errors &&
                Object.keys(data.errors).length >= 0 &&
                checkIfErrorsMatchElements(data.errors, elements)
            ) {
                hasErrors = true;
                this.setState({errors: data.errors});
            }
        }

        if (!hasErrors) {
            this.handleHide(true);
        }
    };

    onHide = () => {
        this.handleHide(false);
    };

    handleHide = (submitted = false) => {
        const {url, callbackId, state, notifyOnCancel} = this.props;

        if (!submitted && notifyOnCancel) {
            const dialog: DialogSubmission = {
                url,
                callback_id: callbackId ?? '',
                state: state ?? '',
                cancelled: true,
                user_id: '',
                channel_id: '',
                team_id: '',
                submission: {},
            };

            this.props.actions.submitInteractiveDialog(dialog);
        }

        this.setState({show: false});
    };

    onChange = (name: string, value: string) => {
        const values = {...this.state.values, [name]: value};
        this.setState({values});
    };

    render() {
        const {
            title,
            introductionText,
            iconUrl,
            submitLabel,
            elements,
        } = this.props;

        let submitText: JSX.Element | string = (
            <FormattedMessage
                id='interactive_dialog.submit'
                defaultMessage='Submit'
            />
        );

        if (submitLabel) {
            submitText = submitLabel;
        }

        let icon;
        if (iconUrl) {
            icon = (
                <img
                    id='interactiveDialogIconUrl'
                    alt={'modal title icon'}
                    className='more-modal__image'
                    width='36'
                    height='36'
                    src={iconUrl}
                />
            );
        }

        return (
            <Modal
                id='interactiveDialogModal'
                dialogClassName='a11y__modal about-modal'
                show={this.state.show}
                onHide={this.onHide}
                onExited={this.props.onExited}
                backdrop='static'
                role='none'
                aria-labelledby='interactiveDialogModalLabel'
            >
                <form
                    onSubmit={this.handleSubmit}
                    autoComplete={'off'}
                >
                    <Modal.Header
                        closeButton={true}
                        style={{borderBottom: elements == null ? '0px' : undefined}}
                    >
                        <Modal.Title
                            componentClass='h1'
                            id='interactiveDialogModalLabel'
                        >
                            {icon}
                            {title}
                        </Modal.Title>
                    </Modal.Header>
                    {(elements || introductionText) && (
                        <Modal.Body>
                            {introductionText && (
                                <DialogIntroductionText
                                    id='interactiveDialogModalIntroductionText'
                                    value={introductionText}
                                    emojiMap={this.props.emojiMap}
                                />
                            )}
                            {elements &&
                            elements.map((e, index) => {
                                return (
                                    <DialogElement
                                        autoFocus={index === 0}
                                        key={'dialogelement' + e.name}
                                        displayName={e.display_name}
                                        name={e.name}
                                        type={e.type}
                                        subtype={e.subtype}
                                        helpText={e.help_text}
                                        errorText={this.state.errors[e.name]}
                                        placeholder={e.placeholder}
                                        maxLength={e.max_length}
                                        dataSource={e.data_source}
                                        optional={e.optional}
                                        options={e.options}
                                        value={this.state.values[e.name]}
                                        onChange={this.onChange}
                                    />
                                );
                            })}
                        </Modal.Body>
                    )}
                    <Modal.Footer>
                        {this.state.error && (
                            <div className='error-text'>{this.state.error}</div>
                        )}
                        <button
                            id='interactiveDialogCancel'
                            type='button'
                            className='btn btn-tertiary cancel-button'
                            onClick={this.onHide}
                        >
                            <FormattedMessage
                                id='interactive_dialog.cancel'
                                defaultMessage='Cancel'
                            />
                        </button>
                        <SpinnerButton
                            id='interactiveDialogSubmit'
                            type='submit'
                            autoFocus={!elements || elements.length === 0}
                            className='btn btn-primary save-button'
                            spinning={this.state.submitting}
                            spinningText={
                                <FormattedMessage
                                    id='interactive_dialog.submitting'
                                    defaultMessage='Submitting...'
                                />
                            }
                        >
                            {submitText}
                        </SpinnerButton>
                    </Modal.Footer>
                </form>
            </Modal>
        );
    }
}
