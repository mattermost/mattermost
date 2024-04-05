// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {getName} from 'country-list';
import React from 'react';
import {useIntl} from 'react-intl';

import DropdownInput from 'components/dropdown_input';

import {COUNTRIES} from 'utils/countries';

type CountrySelectorProps = {
    onChange: (option: any) => void;
    value?: string;
    testId?: string;
}

const CountrySelector = (props: CountrySelectorProps) => {
    const {formatMessage} = useIntl();

    return (
        <DropdownInput
            testId={props.testId || 'CountrySelector'}
            onChange={props.onChange}
            value={props.value ? {value: props.value, label: getName(props.value) || ''} : undefined}
            options={COUNTRIES.map((country) => ({
                value: country.code,
                label: country.name,
            }))}
            legend={formatMessage({
                id: 'payment_form.country',
                defaultMessage: 'Country/Region',
            })}
            placeholder={formatMessage({
                id: 'payment_form.country',
                defaultMessage: 'Country/Region',
            })}
            name={'country_dropdown'}
        />
    );
};

export default CountrySelector;
