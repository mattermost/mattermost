// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {
    ComponentProps,
    ReactNode,
    useEffect,
    useMemo,
    useState,
} from 'react';

import {debounce} from 'debounce';
import Select from 'react-select';

import {
    DateObjectUnits,
    DateTime,
    Duration,
    DurationLikeObject,
} from 'luxon';

import {useIntl} from 'react-intl';

import {StyledSelect} from 'src/components/backstage/styles';

import {Timestamp} from 'src/webapp_globals';
import {formatDuration} from 'src/components/formatted_duration';

import {Mode, parse, parseDateTimes} from './datetime_parsing';

export const ms = (value: Option['value']): number => value?.valueOf() ?? 0;

export const useMakeOption = (mode: Mode) => {
    const {locale} = useIntl();
    return (input: string | DateObjectUnits | DurationLikeObject, label?: string): Option => {
        const value = parse(locale, input, mode);
        return {
            label: label ?? (value && labelFrom(value, mode)),
            value,
        };
    };
};

export type Option = {
    value: DateTime | Duration | null;
    label?: ReactNode | null;
    mode?: Mode.DateTimeValue | Mode.DurationValue;
}

export const defaultMakeOptions: Props['makeOptions'] = (query, datetimes, durations, mode) => {
    if (!query) {
        return null;
    }

    let options: Option[] = [];

    if (datetimes.length && mode === Mode.DateTimeValue) {
        options = options.concat(datetimes.map((datetime) => ({value: datetime})));
    }

    if (durations.length) {
        if (mode === Mode.DurationValue) {
            options = options.concat(durations.map((duration) => ({value: duration, mode})));
        } else if (mode === Mode.DateTimeValue && !options.length) {
            const now = DateTime.now();
            options = options.concat(durations.map((duration) => ({value: now.plus(duration), mode})));
        }
    }

    return options;
};

type Props = {
    mode?: Mode.DateTimeValue | Mode.DurationValue;
    onChange: (value: Option | null) => void;
    defaultOption?: Option;
    defaultOptions?: Option[];
    makeOptions?: (
        query: string,
        datetimeResults: DateTime[],
        durationResults: Duration[],
        mode: Mode,
    ) => Option[] | null;
    disabled?:boolean;
} & Partial<ComponentProps<typeof StyledSelect>>;

const DateTimeInput = ({
    mode = Mode.DateTimeValue,
    value,
    defaultOptions,
    makeOptions = defaultMakeOptions,
    isClearable = true,
    placeholder,
    disabled,
    ...selectProps
}: Props) => {
    const [options, setOptions] = useState<Option[] | null>(null);
    const {locale, formatMessage} = useIntl();

    const updateOptions = useMemo(() => debounce((query: string) => {
        const datetimes = parseDateTimes(locale, query)?.map(({start}) => DateTime.fromJSDate(start.date()));
        const duration = parse(locale, query, Mode.DurationValue);
        setOptions(makeOptions(query, datetimes, duration ? [duration] : [], mode) || null);
    }, 150), [locale, setOptions, makeOptions, mode]);

    return (
        <StyledSelect
            {...selectProps}
            filterOption={null}
            isMulti={false}

            //
            placeholder={placeholder ?? formatMessage({
                defaultMessage: 'Select or specify a {mode, select, DurationValue {time span ("4 hours", "7 days"...)} DateTimeValue {time ("in 4 hours", "May 1", "Tomorrow at 1 PM"...)} other {time or time span}}',
            }, {mode})}

            // options & value
            onInputChange={updateOptions}
            options={options ?? defaultOptions}
            value={value}
            isClearable={isClearable}

            // styling
            maxMenuHeight={380}
            styles={customStyles}
            formatOptionLabel={OptionLabel}
            isDisabled={disabled}
        />
    );
};

const customStyles: ComponentProps<typeof Select>['styles'] = {
    control: (provided) => ({...provided, minHeight: 34}),
};

const TIME_SPEC = {
    useDate: (_: string, {weekday, day, month, year}: any) => ({weekday, day, month, year}),
};

const OptionLabel = ({label, value, mode}: Option) => {
    if (label) {
        return label;
    }

    if (!value) {
        return null;
    }

    return labelFrom(value, mode);
};

export const labelFrom = (value: DateTime | Duration, mode?: Mode) => {
    if (mode === Mode.DateTimeValue || (!mode && DateTime.isDateTime(value))) {
        return (
            <Timestamp
                value={DateTime.isDateTime(value) ? value : DateTime.now().plus(value)}
                {...TIME_SPEC}
            />
        );
    }
    return Duration.isDuration(value) && formatDuration(value, 'long');
};

export const useDateTimeInput = ({defaultValue, ...props}: Partial<Exclude<Props, 'value' | 'onChange'>>) => {
    const [value, setValue] = useState<Option | null>();

    useEffect(() => {
        if (value === undefined) {
            setValue(defaultValue);
        }
    }, [defaultValue]);

    const input = (
        <DateTimeInput
            {...props}
            value={value}
            onChange={setValue}
        />
    );

    return {input, value};
};

// ts-prune-ignore-next
export default DateTimeInput;

export {Mode};
