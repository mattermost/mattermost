// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useIntl} from 'react-intl';

import React, {useMemo} from 'react';
import {Duration} from 'luxon';

import {Mode, Option, useMakeOption} from 'src/components/datetime_input';
import {StyledSelect} from 'src/components/backstage/styles';

interface Props {
    seconds: number;
    onChange: (seconds: number) => void;
    disabled?: boolean;

}
const RetrospectiveIntervalSelector = (props: Props) => {
    const {formatMessage} = useIntl();
    const makeOption = useMakeOption(Mode.DurationValue);

    const options = useMemo(() => [
        makeOption({seconds: 0}, formatMessage({defaultMessage: 'Once'})),
        makeOption({hours: 1}),
        makeOption({hours: 4}),
        makeOption({hours: 24}),
        makeOption({days: 7}),
    ], [formatMessage, makeOption]);

    const onChange = (option: Option) => {
        if (!Duration.isDuration(option.value)) {
            return;
        }
        props.onChange(option.value.as('seconds'));
    };

    return (
        <StyledSelect
            value={options.find((option) => Duration.isDuration(option.value) && option.value.as('seconds') === props.seconds)}
            onChange={onChange}
            options={options}
            isClearable={false}
            isDisabled={props.disabled}
        />
    );
};

export default RetrospectiveIntervalSelector;
