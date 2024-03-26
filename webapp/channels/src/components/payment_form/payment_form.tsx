// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {
    StripeCardElementChangeEvent,
} from '@stripe/stripe-js';
import React, {useRef} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';

import type {CloudCustomer, PaymentMethod} from '@mattermost/types/cloud';

import type {Theme} from 'mattermost-redux/selectors/entities/preferences';

import Input from 'components/widgets/inputs/input/input';

import type {BillingDetails} from 'types/cloud/sku';

import CardImage from './card_image';
import CardInput from './card_input';
import type {CardInputType} from './card_input';
import CountrySelector from './country_selector';
import {GatherIntent, GatherIntentModal} from './gather_intent';
import StateSelector from './state_selector';

import './payment_form.scss';

type Props = {
    className: string;
    initialBillingDetails?: BillingDetails;
    paymentMethod?: PaymentMethod;
    theme: Theme;
    onCardInputChange?: (change: StripeCardElementChangeEvent) => void;
    onInputChange?: (billing: BillingDetails) => void;
    onInputBlur?: (billing: BillingDetails) => void;
    buttonFooter?: JSX.Element;
    customer?: CloudCustomer | undefined;
};

type State = {
    address: string;
    address2: string;
    city: string;
    state: string;
    country: string;
    postalCode: string;
    name: string;
    changePaymentMethod: boolean;
    company_name: string;
}

const PaymentForm: React.FC<Props> = (props: Props) => {
    const {className, paymentMethod, buttonFooter, theme} = props;
    const {formatMessage} = useIntl();
    const cardRef = useRef<CardInputType>(null);

    const [state, setState] = React.useState<State>({
        address: '',
        address2: '',
        city: '',
        state: '',
        country: '',
        postalCode: '',
        name: '',
        changePaymentMethod: paymentMethod == null,
        company_name: props.customer?.name || '',
    });

    const handleInputChange = (event: React.ChangeEvent<HTMLInputElement> | React.ChangeEvent<HTMLTextAreaElement>) => {
        const target = event.target;
        const name = target.name;
        const value = target.value;

        const newStateValue = {
            [name]: value,
        } as unknown as Pick<State, keyof State>;

        setState({...state, ...newStateValue});

        const {onInputChange} = props;
        if (onInputChange) {
            onInputChange({...state, ...newStateValue, card: cardRef.current?.getCard()} as BillingDetails);
        }
    };

    const handleCardInputChange = (event: StripeCardElementChangeEvent) => {
        if (props.onCardInputChange) {
            props.onCardInputChange(event);
        }
    };

    const handleStateChange = (stateValue: string) => {
        const newStateValue = {
            state: stateValue,
        } as unknown as Pick<State, keyof State>;
        setState({...state, ...newStateValue});

        if (props.onInputChange) {
            props.onInputChange({...state, ...newStateValue, card: cardRef.current?.getCard()} as BillingDetails);
        }
    };

    const handleCountryChange = (option: any) => {
        const newStateValue = {
            country: option.value,
        } as unknown as Pick<State, keyof State>;
        setState({...state, ...newStateValue});

        if (props.onInputChange) {
            props.onInputChange({...state, ...newStateValue, card: cardRef.current?.getCard()} as BillingDetails);
        }
    };

    const onBlur = () => {
        const {onInputBlur} = props;
        if (onInputBlur) {
            onInputBlur({...state, card: cardRef.current?.getCard()} as BillingDetails);
        }
    };

    const changePaymentMethod = (event: React.MouseEvent<HTMLElement>) => {
        event.preventDefault();
        setState({...state, changePaymentMethod: true});
    };

    let paymentDetails: JSX.Element;
    if (state.changePaymentMethod) {
        paymentDetails = (
            <React.Fragment>
                <div className='form-row'>
                    <Input
                        name='company_name'
                        type='text'
                        value={state.company_name}
                        onChange={handleInputChange}
                        onBlur={onBlur}
                        placeholder={formatMessage({id: 'payment_form.company_name', defaultMessage: 'Company Name'})}
                        required={true}
                    />
                </div>
                <div className='form-row'>
                    <CardInput
                        forwardedRef={cardRef}
                        required={true}
                        onBlur={onBlur}
                        onCardInputChange={handleCardInputChange}
                        theme={theme}
                    />
                </div>
                <div className='form-row'>
                    <Input
                        name='name'
                        type='text'
                        value={state.name}
                        onChange={handleInputChange}
                        onBlur={onBlur}
                        placeholder={formatMessage({id: 'payment_form.name_on_card', defaultMessage: 'Name on Card'})}
                        required={true}
                    />
                </div>
                <div className='section-title'>
                    <FormattedMessage
                        id='payment_form.billing_address'
                        defaultMessage='Billing address'
                    />
                </div>
                <CountrySelector
                    onChange={handleCountryChange}
                    value={state.country}
                />
                <div className='form-row'>
                    <Input
                        name='address'
                        type='text'
                        value={state.address}
                        onChange={handleInputChange}
                        onBlur={onBlur}
                        placeholder={formatMessage({id: 'payment_form.address', defaultMessage: 'Address'})}
                        required={true}
                    />
                </div>
                <div className='form-row'>
                    <Input
                        name='address2'
                        type='text'
                        value={state.address2}
                        onChange={handleInputChange}
                        onBlur={onBlur}
                        placeholder={formatMessage({id: 'payment_form.address_2', defaultMessage: 'Address 2'})}
                    />
                </div>
                <div className='form-row'>
                    <Input
                        name='city'
                        type='text'
                        value={state.city}
                        onChange={handleInputChange}
                        onBlur={onBlur}
                        placeholder={formatMessage({id: 'payment_form.city', defaultMessage: 'City'})}
                        required={true}
                    />
                </div>
                <div className='form-row'>
                    <div className='form-row-third-1 selector second-dropdown-sibling-wrapper'>
                        <StateSelector
                            country={state.country}
                            state={state.state}
                            onChange={handleStateChange}
                            onBlur={onBlur}
                        />
                    </div>
                    <div className='form-row-third-2'>
                        <Input
                            name='postalCode'
                            type='text'
                            value={state.postalCode}
                            onChange={handleInputChange}
                            onBlur={onBlur}
                            placeholder={formatMessage({id: 'payment_form.zipcode', defaultMessage: 'Zip/Postal Code'})}
                            required={true}
                        />
                    </div>
                </div>
                {state.changePaymentMethod ? buttonFooter : null}
            </React.Fragment>
        );
    } else {
        let cardContent: JSX.Element | null = null;

        if (paymentMethod) {
            let cardDetails = (
                <FormattedMessage
                    id='payment_form.no_credit_card'
                    defaultMessage='No credit card added'
                />
            );
            if (paymentMethod.last_four) {
                cardDetails = (
                    <React.Fragment>
                        <CardImage brand={paymentMethod.card_brand}/>
                        {`Card ending in ${paymentMethod.last_four}`}
                        <br/>
                        {`Expires ${paymentMethod.exp_month}/${paymentMethod.exp_year}`}
                    </React.Fragment>
                );
            }
            let addressDetails = (
                <i>
                    <FormattedMessage
                        id='payment_form.no_billing_address'
                        defaultMessage='No billing address added'
                    />
                </i>);
            if (state.state) {
                addressDetails = (
                    <React.Fragment>
                        {state.address}
                        {state.address2}
                        <br/>
                        {`${state.city}, ${state.state}, ${state.country}`}
                        <br/>
                        {state.postalCode}
                    </React.Fragment>
                );
            }

            cardContent = (
                <React.Fragment>
                    <div className='PaymentForm-saved-card'>
                        {cardDetails}
                    </div>
                    <div className='PaymentForm-saved-address'>
                        {addressDetails}
                    </div>
                </React.Fragment>
            );
        }

        paymentDetails = (
            <div
                id='console_payment_saved'
                className='PaymentForm-saved'
            >
                <div className='PaymentForm-saved-title'>
                    <FormattedMessage
                        id='payment_form.saved_payment_method'
                        defaultMessage='Saved Payment Method'
                    />
                </div>
                {cardContent}
                <button
                    className='Form-btn-link PaymentForm-change'
                    onClick={changePaymentMethod}
                >
                    <FormattedMessage
                        id='payment_form.change_payment_method'
                        defaultMessage='Change Payment Method'
                    />
                </button>
            </div>
        );
    }

    return (
        <form
            id='payment_form'
            className={`PaymentForm ${className}`}
        >
            <GatherIntent
                typeGatherIntent='monthlySubscription'
                modalComponent={GatherIntentModal}
                gatherIntentText={
                    <FormattedMessage
                        id='payment_form.gather_wire_transfer_intent'
                        defaultMessage='Looking for other payment options?'
                    />}
            />
            <div className='section-title'>
                <FormattedMessage
                    id='payment_form.credit_card'
                    defaultMessage='Credit Card'
                />
            </div>
            {paymentDetails}
        </form>
    );
};

PaymentForm.defaultProps = {
    className: '',
};

export default PaymentForm;
