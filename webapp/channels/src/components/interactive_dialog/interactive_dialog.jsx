// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import PropTypes from 'prop-types';
import {Modal} from 'react-bootstrap';
import {FormattedMessage} from 'react-intl';

import {
    checkDialogElementForError,
    checkIfErrorsMatchElements,
} from 'mattermost-redux/utils/integration_utils';

import SpinnerButton from 'components/spinner_button';

import {localizeMessage} from 'utils/utils';

import DialogElement from './dialog_element';
import DialogIntroductionText from './dialog_introduction_text';

export default class InteractiveDialog extends React.PureComponent {
    static propTypes = {
        url: PropTypes.string.isRequired,
        callbackId: PropTypes.string,
        elements: PropTypes.arrayOf(PropTypes.object),
        title: PropTypes.string.isRequired,
        introductionText: PropTypes.string,
        iconUrl: PropTypes.string,
        submitLabel: PropTypes.string,
        notifyOnCancel: PropTypes.bool,
        state: PropTypes.string,
        onExited: PropTypes.func,
        actions: PropTypes.shape({
            submitInteractiveDialog: PropTypes.func.isRequired,
        }).isRequired,
        emojiMap: PropTypes.object.isRequired,
    };

    constructor(props) {
        super(props);

        const values = {};
        if (props.elements != null) {
            props.elements.forEach((e) => {
                if (e.type === 'bool') {
                    values[e.name] =
                        e.default === true ||
                        String(e.default).toLowerCase() === 'true';
                } else {
                    values[e.name] = e.default || null;
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

    handleSubmit = async (e) => {
        e.preventDefault();

        const {elements} = this.props;
        const values = this.state.values;
        const errors = {};
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

        const dialog = {
            url,
            callback_id: callbackId,
            state,
            submission: values,
        };

        this.setState({submitting: true});

        const {data} = await this.props.actions.submitInteractiveDialog(
            dialog,
        );

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
            const dialog = {
                url,
                callback_id: callbackId,
                state,
                cancelled: true,
            };

            this.props.actions.submitInteractiveDialog(dialog);
        }

        this.setState({show: false});
    };

    onChange = (name, value) => {
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

        let submitText = (
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
                role='dialog'
                aria-labelledby='interactiveDialogModalLabel'
            >
                <form
                    onSubmit={this.handleSubmit}
                    autoComplete={'off'}
                >
                    <Modal.Header
                        closeButton={true}
                        style={{borderBottom: elements == null && '0px'}}
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
                                        minLength={e.min_length}
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
                            spinningText={localizeMessage(
                                'interactive_dialog.submitting',
                                'Submitting...',
                            )}
                        >
                            {submitText}
                        </SpinnerButton>
                    </Modal.Footer>
                </form>
            </Modal>
        );
    }
}
