// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState, useMemo} from 'react';
import {useIntl} from 'react-intl';
import classNames from 'classnames';

import {Address} from '@mattermost/types/cloud';

import {COUNTRIES} from 'utils/countries';

import DropdownInput from 'components/dropdown_input';
import Input from 'components/widgets/inputs/input/input';
import StateSelector from 'components/payment_form/state_selector';

interface Props {
    type: 'shipping' | 'billing';
    testPrefix?: string;

    addressReducer: AddressReducer;
}

interface SetAddress {
    city: (e: React.ChangeEvent<HTMLInputElement>) => void;
    country: (option: {value: string}) => void;
    line1: (e: React.ChangeEvent<HTMLInputElement>) => void;
    line2: (e: React.ChangeEvent<HTMLInputElement>) => void;
    postalCode: (e: React.ChangeEvent<HTMLInputElement>) => void;
    state: (postalCode: string) => void;
}

interface AddressReducer {
    address: Address;
    set: SetAddress;
}

export function useAddressReducer(): AddressReducer {
    const [city, setCity] = useState('');
    const [country, setCountry] = useState('');
    const [line1, setLine1] = useState('');
    const [line2, setLine2] = useState('');
    const [postalCode, setPostalCode] = useState('');
    const [state, setState] = useState('');
    return useMemo(() => ({
        set: {
            city: (e) => setCity(e.target.value),
            country: (option) => setCountry(option.value),
            line1: (e) => setLine1(e.target.value),
            line2: (e) => setLine2(e.target.value),
            postalCode: (e) => setPostalCode(e.target.value),
            state: setState,
        },
        address: {
            city,
            country,
            line1,
            line2,
            postal_code: postalCode,
            state,
        },

    }), [city, country, line1, line2, postalCode, state]);
}

export default function AddressComponent(props: Props) {
    const testPrefix = props.testPrefix || 'selfHostedPurchase';
    const intl = useIntl();
    let countrySelectorId = `${testPrefix}CountrySelector`;
    let stateSelectorId = `${testPrefix}StateSelector`;
    if (props.type === 'shipping') {
        countrySelectorId += '_Shipping';
        stateSelectorId += '_Shipping';
    }
    const {address, set} = props.addressReducer;
    return (
        <>
            <div className={classNames({'third-dropdown-sibling-wrapper': props.type === 'shipping'})}>
                <DropdownInput
                    testId={countrySelectorId}
                    onChange={set.country}
                    value={
                        address.country ? {value: address.country, label: address.country} : undefined
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
                    value={address.line1}
                    onChange={set.line1}
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
                    value={address.line2}
                    onChange={set.line2}
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
                    value={address.city}
                    onChange={set.city}
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
                        country={address.country}
                        state={address.state}
                        onChange={set.state}
                    />
                </div>
                <div className='form-row-third-2'>
                    <Input
                        name='postalCode'
                        type='text'
                        value={address.postal_code}
                        onChange={set.postalCode}
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
