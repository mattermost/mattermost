// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {Modal} from 'react-bootstrap';

import warningIcon from 'images/icons/warning-icon.svg';

import './gather_intent.scss';
import {FormDataState} from './useGatherIntent';

export interface GatherIntentModalProps {
    onClose: () => void;
    onSave: (formData: FormDataState) => void;
    isSubmitting: boolean;
    showError: boolean;
}

const isOtherUnchecked = (name: string, value: boolean): boolean => {
    return name === 'other' && value === false;
};

const isOtherChecked = (name: string, value: boolean): boolean => {
    return name === 'other' && value === true;
};

const isEmptyInput = (value: undefined | string) => {
    return value == null || value.trim() === '';
};

const isFormEmpty = (formDataState: FormDataState) => {
    if (formDataState.other) {
        return isEmptyInput(formDataState.otherPaymentOption) && !formDataState.wire && !formDataState.ach;
    }

    return Object.values(formDataState).every((value) => value === false || value == null);
};

export const GatherIntentModal = ({onClose, onSave, isSubmitting, showError}: GatherIntentModalProps) => {
    const [formState, setFormState] = useState<FormDataState>({
        ach: false,
        wire: false,
        other: false,
        otherPaymentOption: undefined,
    });
    const intl = useIntl();

    const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        event.stopPropagation();

        onSave(formState);
    };

    const handleTextAreaChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
        const {name, value} = event.target;

        setFormState((formDataState) => ({
            ...formDataState,
            [name]: value,
        }));
    };
    const handleCheckboxChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const {name, checked} = event.target;

        if (isOtherUnchecked(name, checked)) {
            setFormState((formDataState) => ({
                ...formDataState,
                other: false,
                otherPaymentOption: undefined,
            }));
        }

        if (isOtherChecked(name, checked)) {
            setFormState((formDataState) => ({
                ...formDataState,
                other: true,
                otherPaymentOption: '',
            }));
        }

        setFormState((formDataState) => ({
            ...formDataState,
            [name]: checked,
        }));
    };

    return (
        <>
            <Modal.Header className='AltPaymentsModal__header '>
                <FormattedMessage
                    id={'payment_form.gather_wire_transfer_intent_title'}
                    defaultMessage='Alternate Payment Options'
                >
                    {(text) => (
                        <h3 className='Form-section-title'>
                            {text}
                        </h3>)
                    }
                </FormattedMessage>
                <button
                    id='closeIcon'
                    className='icon icon-close'
                    aria-label='Close'
                    title='Close'
                    onClick={onClose}
                />
            </Modal.Header>
            <Modal.Body>
                <form
                    id='gather_intent_wire_transfer'
                    className='Form'
                    onSubmit={handleSubmit}
                >
                    <FormattedMessage
                        id='payment_form.gather_wire_transfer_intent_modal.question'
                        defaultMessage='Which payment options are you interested in using?'
                    >
                        {(text) => <p className='AltPaymentsModal__body__question'>{text}</p>}
                    </FormattedMessage>
                    <div className='Form-checkbox AltPaymentsModal__body__option'>
                        <input
                            className='AltPaymentsModal__body__checkbox'
                            id='wire'
                            name='wire'
                            type='checkbox'
                            checked={formState.wire}
                            onChange={handleCheckboxChange}
                        />
                        <FormattedMessage
                            id='payment_form.gather_wire_transfer_intent_modal.wire'
                            defaultMessage='Wire'
                        >
                            {(text) => (
                                <label
                                    className='AltPaymentsModal__body__label'
                                    htmlFor='wire'
                                >
                                    {text}
                                </label>)
                            }
                        </FormattedMessage>
                    </div>
                    <div className='AltPaymentsModal__body__option'>
                        <input
                            className='AltPaymentsModal__body__checkbox'
                            id='ach'
                            name='ach'
                            type='checkbox'
                            checked={formState.ach}
                            onChange={handleCheckboxChange}
                        />
                        <FormattedMessage
                            id='payment_form.gather_wire_transfer_intent_modal.ach'
                            defaultMessage='ACH'
                        >
                            {(text) => (
                                <label
                                    className='AltPaymentsModal__body__label'
                                    htmlFor='ach'
                                >
                                    {text}
                                </label>)
                            }
                        </FormattedMessage>
                    </div>
                    <div className='AltPaymentsModal__body__option'>
                        <input
                            className='AltPaymentsModal__body__checkbox'
                            id='other'
                            name='other'
                            type='checkbox'
                            checked={formState.other}
                            onChange={handleCheckboxChange}
                        />
                        <FormattedMessage
                            id='payment_form.gather_wire_transfer_intent_modal.other'
                            defaultMessage='Other'
                        >
                            {(text) => (
                                <label
                                    className='AltPaymentsModal__body__label'
                                    htmlFor='other'
                                >
                                    {text}
                                </label>)
                            }
                        </FormattedMessage>
                    </div>
                    {formState.other && <div className='AltPaymentsModal__body__option'>
                        <textarea
                            id='other-payment-option'
                            name='otherPaymentOption'
                            className='AltPaymentsModal__body__textarea'
                            value={formState.otherPaymentOption}
                            onChange={handleTextAreaChange}
                            placeholder={intl.formatMessage({id: 'payment_form.gather_wire_transfer_intent_modal.otherPaymentOptionPlaceholder', defaultMessage: 'Enter payment option here'})}
                            rows={2}
                            maxLength={400}
                        />
                    </div>}
                    {showError &&
                    <div className='AltPaymentsModal__body__error'>
                        <div>
                            <img
                                className='AltPaymentsModal__body__error__icon'
                                alt=''
                                src={warningIcon}
                            />
                        </div>
                        <FormattedMessage
                            id='gather_intent.error_feedback'
                            defaultMessage='Sorry, there was an error sending feedback. Please try again.'
                        >
                            {(text) => <span className='AltPaymentsModal__body__error__text'>{text}</span>}
                        </FormattedMessage>
                    </div>}

                </form>
            </Modal.Body>
            <Modal.Footer className={'AltPaymentsModal__footer '}>
                <button
                    className={'AltPaymentsModal__footer--secondary'}
                    id={'cancelFeedback'}
                    onClick={onClose}
                    disabled={isSubmitting}
                >
                    <FormattedMessage
                        id='payment_form.gather_wire_transfer_intent_modal.cancel'
                        defaultMessage='Cancel'
                    />
                </button>

                <button
                    className={'AltPaymentsModal__footer--primary'}
                    id={'submitFeedback'}
                    type='submit'
                    form='gather_intent_wire_transfer'
                    disabled={isFormEmpty(formState) || isSubmitting}
                >
                    <FormattedMessage
                        id='payment_form.gather_wire_transfer_intent_modal.save'
                        defaultMessage='Save'
                    />
                </button>
            </Modal.Footer>
        </>);
};
