// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {getName} from 'country-list';
import {FormattedMessage} from 'react-intl';

import {
    StripeCardElementChangeEvent,
} from '@stripe/stripe-js';

import {CloudCustomer, PaymentMethod} from '@mattermost/types/cloud';

import {BillingDetails} from 'types/cloud/sku';
import {Theme} from 'mattermost-redux/selectors/entities/preferences';

import DropdownInput from 'components/dropdown_input';
import Input from 'components/widgets/inputs/input/input';
import * as Utils from 'utils/utils';
import {COUNTRIES} from 'utils/countries';

import StateSelector from './state_selector';
import CardInput, {CardInputType} from './card_input';
import CardImage from './card_image';
import {GatherIntent, GatherIntentModal} from './gather_intent';

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

export default class PaymentForm extends React.PureComponent<Props, State> {
    static defaultProps = {
        showSaveCard: false,
        className: '',
    };

    cardRef: React.RefObject<CardInputType>;

    public constructor(props: Props) {
        super(props);

        this.cardRef = React.createRef<CardInputType>();

        this.state = this.getResetState(props);
    }

    public componentDidUpdate(prevProps: Props) {
        if (prevProps.paymentMethod == null && this.props.paymentMethod != null) {
            this.resetState();
            return;
        }

        if (prevProps.initialBillingDetails === undefined && this.props.initialBillingDetails !== undefined) {
            this.resetState();
        }
    }

    private resetState = () => {
        this.setState(this.getResetState());
    };

    private getResetState = (props = this.props) => {
        const {initialBillingDetails, paymentMethod, customer} = props;

        const billingDetails = initialBillingDetails || {} as BillingDetails;

        return {
            address: billingDetails.address,
            address2: billingDetails.address2,
            city: billingDetails.city,
            state: billingDetails.state,
            country: getName(billingDetails.country || '') || getName('US') || '',
            postalCode: billingDetails.postalCode,
            name: billingDetails.name,
            changePaymentMethod: paymentMethod == null,
            company_name: customer?.name || '',
        };
    };

    private handleInputChange = (event: React.ChangeEvent<HTMLInputElement> | React.ChangeEvent<HTMLSelectElement>) => {
        const target = event.target;
        const name = target.name;
        const value = target.value;

        const newStateValue = {
            [name]: value,
        } as unknown as Pick<State, keyof State>;

        this.setState(newStateValue);

        const {onInputChange} = this.props;
        if (onInputChange) {
            onInputChange({...this.state, ...newStateValue, card: this.cardRef.current?.getCard()} as BillingDetails);
        }
    };

    private handleCardInputChange = (event: StripeCardElementChangeEvent) => {
        if (this.props.onCardInputChange) {
            this.props.onCardInputChange(event);
        }
    };

    private handleStateChange = (stateValue: string) => {
        const newStateValue = {
            state: stateValue,
        } as unknown as Pick<State, keyof State>;
        this.setState(newStateValue);

        if (this.props.onInputChange) {
            this.props.onInputChange({...this.state, ...newStateValue, card: this.cardRef.current?.getCard()} as BillingDetails);
        }
    };

    private handleCountryChange = (option: any) => {
        const newStateValue = {
            country: option.value,
        } as unknown as Pick<State, keyof State>;
        this.setState(newStateValue);

        if (this.props.onInputChange) {
            this.props.onInputChange({...this.state, ...newStateValue, card: this.cardRef.current?.getCard()} as BillingDetails);
        }
    };

    private onBlur = () => {
        const {onInputBlur} = this.props;
        if (onInputBlur) {
            onInputBlur({...this.state, card: this.cardRef.current?.getCard()} as BillingDetails);
        }
    };

    private changePaymentMethod = (event: React.MouseEvent<HTMLElement>) => {
        event.preventDefault();
        this.setState({changePaymentMethod: true});
    };

    public render() {
        const {className, paymentMethod, buttonFooter, theme} = this.props;
        const {changePaymentMethod} = this.state;

        let paymentDetails: JSX.Element;
        if (changePaymentMethod) {
            paymentDetails = (
                <React.Fragment>
                    <div className='form-row'>
                        <Input
                            name='company_name'
                            type='text'
                            value={this.state.company_name}
                            onChange={this.handleInputChange}
                            onBlur={this.onBlur}
                            placeholder={Utils.localizeMessage(
                                'payment_form.company_name',
                                'Company Name',
                            )}
                            required={true}
                        />
                    </div>
                    <div className='form-row'>
                        <CardInput
                            forwardedRef={this.cardRef}
                            required={true}
                            onBlur={this.onBlur}
                            onCardInputChange={this.handleCardInputChange}
                            theme={theme}
                        />
                    </div>
                    <div className='form-row'>
                        <Input
                            name='name'
                            type='text'
                            value={this.state.name}
                            onChange={this.handleInputChange}
                            onBlur={this.onBlur}
                            placeholder={Utils.localizeMessage(
                                'payment_form.name_on_card',
                                'Name on Card',
                            )}
                            required={true}
                        />
                    </div>
                    <div className='section-title'>
                        <FormattedMessage
                            id='payment_form.billing_address'
                            defaultMessage='Billing address'
                        />
                    </div>
                    <DropdownInput
                        onChange={this.handleCountryChange}
                        value={
                            this.state.country ? {value: this.state.country, label: this.state.country} : undefined
                        }
                        options={COUNTRIES.map((country) => ({
                            value: country.name,
                            label: country.name,
                        }))}
                        legend={Utils.localizeMessage(
                            'payment_form.country',
                            'Country',
                        )}
                        placeholder={Utils.localizeMessage(
                            'payment_form.country',
                            'Country',
                        )}
                        name={'billing_dropdown'}
                    />
                    <div className='form-row'>
                        <Input
                            name='address'
                            type='text'
                            value={this.state.address}
                            onChange={this.handleInputChange}
                            onBlur={this.onBlur}
                            placeholder={Utils.localizeMessage(
                                'payment_form.address',
                                'Address',
                            )}
                            required={true}
                        />
                    </div>
                    <div className='form-row'>
                        <Input
                            name='address2'
                            type='text'
                            value={this.state.address2}
                            onChange={this.handleInputChange}
                            onBlur={this.onBlur}
                            placeholder={Utils.localizeMessage(
                                'payment_form.address_2',
                                'Address 2',
                            )}
                        />
                    </div>
                    <div className='form-row'>
                        <Input
                            name='city'
                            type='text'
                            value={this.state.city}
                            onChange={this.handleInputChange}
                            onBlur={this.onBlur}
                            placeholder={Utils.localizeMessage(
                                'payment_form.city',
                                'City',
                            )}
                            required={true}
                        />
                    </div>
                    <div className='form-row'>
                        <div className='form-row-third-1 selector second-dropdown-sibling-wrapper'>
                            <StateSelector
                                country={this.state.country}
                                state={this.state.state}
                                onChange={this.handleStateChange}
                                onBlur={this.onBlur}
                            />
                        </div>
                        <div className='form-row-third-2'>
                            <Input
                                name='postalCode'
                                type='text'
                                value={this.state.postalCode}
                                onChange={this.handleInputChange}
                                onBlur={this.onBlur}
                                placeholder={Utils.localizeMessage(
                                    'payment_form.zipcode',
                                    'Zip/Postal Code',
                                )}
                                required={true}
                            />
                        </div>
                    </div>
                    {changePaymentMethod ? buttonFooter : null}
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
                if (this.state.state) {
                    addressDetails = (
                        <React.Fragment>
                            {this.state.address}
                            {this.state.address2}
                            <br/>
                            {`${this.state.city}, ${this.state.state}, ${this.state.country}`}
                            <br/>
                            {this.state.postalCode}
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
                        onClick={this.changePaymentMethod}
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
    }
}
