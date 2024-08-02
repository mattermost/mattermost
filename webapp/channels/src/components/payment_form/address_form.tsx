// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import type {MessageDescriptor} from 'react-intl';

import type {Address} from '@mattermost/types/cloud';

import Input from 'components/widgets/inputs/input/input';

import CountrySelector from './country_selector';
import StateSelector from './state_selector';

import './payment_form.scss';

type AddressFormProps = {
    onAddressChange: (address: Address) => void;
    onBlur: () => void;
    title: MessageDescriptor;
    formId: string;
    address: Address;
}

const AddressForm = (props: AddressFormProps) => {
    const {formatMessage} = useIntl();
    const handleCountryChange = (option: any) => {
        props.onAddressChange({...props.address, country: option.value});
    };

    const handleStateChange = (option: any) => {
        props.onAddressChange({...props.address, state: option});
    };

    const handleInputChange = (key: keyof Address) => (
        event:
        | React.ChangeEvent<HTMLInputElement>
        | React.ChangeEvent<HTMLTextAreaElement>,
    ) => {
        const target = event.target;
        const value = target.value;

        const newStateValue = {
            [key]: value,
        } as unknown as Pick<Address, keyof Address>;

        const {onAddressChange} = props;
        onAddressChange({
            ...props.address,
            ...newStateValue,
        });
    };

    return (
        <div
            id={props.formId}
            className='PaymentForm'
        >
            <div className='section-title'>
                <FormattedMessage
                    {...props.title}
                />
            </div>
            <div className='third-dropdown-sibling-wrapper'>
                <CountrySelector
                    onChange={handleCountryChange}
                    value={props.address.country}
                />
            </div>
            <div className='form-row'>
                <Input
                    name='address'
                    type='text'
                    value={props.address.line1}
                    onChange={handleInputChange('line1')}
                    onBlur={props.onBlur}
                    placeholder={formatMessage({
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
                    value={props.address.line2}
                    onChange={handleInputChange('line2')}
                    onBlur={props.onBlur}
                    placeholder={formatMessage({
                        id: 'payment_form.address_2',
                        defaultMessage: 'Address 2',
                    })}
                />
            </div>
            <div className='form-row'>
                <Input
                    name='city'
                    type='text'
                    value={props.address.city}
                    onChange={handleInputChange('city')}
                    onBlur={props.onBlur}
                    placeholder={formatMessage({
                        id: 'payment_form.city',
                        defaultMessage: 'City',
                    })}
                    required={true}
                />
            </div>
            <div className='form-row'>
                <div className='form-row-third-1 selector fourth-dropdown-sibling-wrapper'>
                    <StateSelector
                        country={props.address.country}
                        state={props.address.state}
                        onChange={handleStateChange}
                        onBlur={props.onBlur}
                    />
                </div>
                <div className='form-row-third-2'>
                    <Input
                        name='postalCode'
                        type='text'
                        value={props.address.postal_code}
                        onChange={handleInputChange('postal_code')}
                        onBlur={props.onBlur}
                        placeholder={formatMessage({
                            id: 'payment_form.zipcode',
                            defaultMessage: 'Zip/Postal Code',
                        })}
                        required={true}
                    />
                </div>
            </div>
        </div>
    );
};

export default AddressForm;
