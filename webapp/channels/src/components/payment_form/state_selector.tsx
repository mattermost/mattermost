// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useIntl} from 'react-intl';
import {getName} from 'country-list';

import DropdownInput from 'components/dropdown_input';

import Input from 'components/widgets/inputs/input/input';

import {US_STATES, CA_PROVINCES, StateCode} from 'utils/states';

type Props = {
    country: string;
    state: string;
    testId?: string;
    onChange: (newValue: string) => void;
    onBlur?: () => void;
}

// StateSelector will display a state dropdown for US and Canada.
// Will display a open text input for any other country.
export default function StateSelector(props: Props) {
    // Making TS happy here with the react-select event handler
    const {formatMessage} = useIntl();
    const onStateSelected = (option: any) => {
        props.onChange(option.value);
    };

    let stateList = [] as StateCode[];
    if (props.country === getName('US')) {
        stateList = US_STATES;
    } else if (props.country === getName('CA')) {
        stateList = CA_PROVINCES;
    }

    if (stateList.length > 0) {
        const withId: {testId?: string} = {};
        if (props.testId) {
            withId.testId = props.testId;
        }
        return (
            <DropdownInput
                {...withId}
                onChange={onStateSelected}
                value={props.state ? {value: props.state, label: props.state} : undefined}
                options={stateList.map((stateCode) => ({
                    value: stateCode.code,
                    label: stateCode.name,
                }))}
                legend={formatMessage({id: 'admin.billing.subscription.stateprovince', defaultMessage: 'State/Province'})}
                placeholder={formatMessage({id: 'admin.billing.subscription.stateprovince', defaultMessage: 'State/Province'})}
                name={'billing_dropdown'}
            />
        );
    }

    return (
        <Input
            name='state'
            type='text'
            value={props.state}
            onChange={(e) => {
                props.onChange(e.target.value);
            }}
            onBlur={props.onBlur}
            placeholder={formatMessage({id: 'admin.billing.subscription.stateprovince', defaultMessage: 'State/Province'})}
            required={true}
        />
    );
}

