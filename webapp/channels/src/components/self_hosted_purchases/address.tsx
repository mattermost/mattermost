// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useIntl} from 'react-intl';

import classNames from 'classnames';

import DropdownInput from 'components/dropdown_input';
import StateSelector from 'components/payment_form/state_selector';
import Input from 'components/widgets/inputs/input/input';

import {COUNTRIES} from 'utils/countries';

interface Props {
    type: 'shipping' | 'billing';
    testPrefix?: string;

    country: string;
    changeCountry: (option: {value: string}) => void;

    address: string;
    changeAddress: (e: React.ChangeEvent<HTMLInputElement>) => void;

    address2: string;
    changeAddress2: (e: React.ChangeEvent<HTMLInputElement>) => void;

    city: string;
    changeCity: (e: React.ChangeEvent<HTMLInputElement>) => void;

    state: string;
    changeState: (postalCode: string) => void;

    postalCode: string;
    changePostalCode: (e: React.ChangeEvent<HTMLInputElement>) => void;
}
export default function Address(props: Props) {
    const testPrefix = props.testPrefix || 'selfHostedPurchase';
    const intl = useIntl();
    let countrySelectorId = `${testPrefix}CountrySelector`;
    let stateSelectorId = `${testPrefix}StateSelector`;
    if (props.type === 'shipping') {
        countrySelectorId += '_Shipping';
        stateSelectorId += '_Shipping';
    }
    return (
        <>
            <div className={classNames({'third-dropdown-sibling-wrapper': props.type === 'shipping'})}>
                <DropdownInput
                    testId={countrySelectorId}
                    onChange={props.changeCountry}
                    value={
                        props.country ? {value: props.country, label: props.country} : undefined
                    }
                    options={COUNTRIES.map((country) => ({
                        value: country.name,
                        label: country.name,
                    }))}
                    legend={intl.formatMessage({
                        id: 'payment_form.country',
                        defaultMessage: 'Country',
                    })}
                    placeholder={intl.formatMessage({
                        id: 'payment_form.country',
                        defaultMessage: 'Country',
                    })}
                    name={'billing_dropdown'}
                />
            </div>
            <div className='form-row'>
                <Input
                    name='address'
                    type='text'
                    value={props.address}
                    onChange={props.changeAddress}
                    placeholder={intl.formatMessage({
                        id: 'payment_form.address',
                        defaultMessage: 'Address',
                    })}
                    required={true}
                />
            </div>
            <div className='form-row'>
                <Input
                    name='address2'
                    type='text'
                    value={props.address2}
                    onChange={props.changeAddress2}
                    placeholder={intl.formatMessage({
                        id: 'payment_form.address_2',
                        defaultMessage: 'Address 2',
                    })}
                />
            </div>
            <div className='form-row'>
                <Input
                    name='city'
                    type='text'
                    value={props.city}
                    onChange={props.changeCity}
                    placeholder={intl.formatMessage({
                        id: 'payment_form.city',
                        defaultMessage: 'City',
                    })}
                    required={true}
                />
            </div>
            <div className='form-row'>
                <div className={classNames('form-row-third-1', {'second-dropdown-sibling-wrapper': props.type === 'billing', 'fourth-dropdown-sibling-wrapper': props.type === 'shipping'})}>
                    <StateSelector
                        testId={stateSelectorId}
                        country={props.country}
                        state={props.state}
                        onChange={props.changeState}
                    />
                </div>
                <div className='form-row-third-2'>
                    <Input
                        name='postalCode'
                        type='text'
                        value={props.postalCode}
                        onChange={props.changePostalCode}
                        placeholder={intl.formatMessage({
                            id: 'payment_form.zipcode',
                            defaultMessage: 'Zip/Postal Code',
                        })}
                        required={true}
                    />
                </div>
            </div>
        </>
    );
}
