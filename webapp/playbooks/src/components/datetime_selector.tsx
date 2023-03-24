// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useMemo, useState} from 'react';
import {useIntl} from 'react-intl';
import ReactSelect, {ActionTypes, ControlProps, StylesConfig} from 'react-select';
import styled from 'styled-components';

import {DateTime, Duration} from 'luxon';
import debounce from 'debounce';

import {Placement} from '@floating-ui/react-dom-interactions';

import Dropdown from 'src/components/dropdown';

import {Timestamp} from 'src/webapp_globals';

import {Option, defaultMakeOptions} from './datetime_input';
import {Mode, parse, parseDateTimes} from './datetime_parsing';

import {formatDuration} from './formatted_duration';

interface ActionObj {
    action: ActionTypes;
}

export type DateTimeOption = Option & {labelRHS?: JSX.Element;}

type Props = {
    testId?: string;
    date?: number;
    mode?: Mode.DateTimeValue | Mode.DurationValue;
    placeholder: React.ReactNode;
    onlyPlaceholder?: boolean;
    suggestedOptions: DateTimeOption[];
    customControl?: (props: ControlProps<DateTimeOption, boolean>) => React.ReactElement;
    controlledOpenToggle?: boolean;
    onSelectedChange: (value: DateTimeOption | undefined | null) => void;
    onOpenChange?: (isOpen: boolean) => void;
    customControlProps?: any;
    placement?: Placement;
    className?: string;

    makeOptions?: (
        query: string,
        datetimeResults: DateTime[],
        durationResults: Duration[],
        mode: Mode,
    ) => Option[] | null;
}

export const optionFromMillis = (ms: number, mode: Mode.DateTimeValue | Mode.DurationValue) => ({
    value: mode === Mode.DateTimeValue ? DateTime.fromMillis(ms) : Duration.fromMillis(ms),
    mode,
});

export const DateTimeSelector = ({
    mode = Mode.DateTimeValue,
    suggestedOptions,
    makeOptions = defaultMakeOptions,
    ...props
}: Props) => {
    const {locale, formatMessage} = useIntl();

    const [isOpen, realSetOpen] = useState(false);
    const setOpen = (open: boolean) => {
        props.onOpenChange?.(open);
        realSetOpen(open);
    };

    const toggleOpen = () => {
        setOpen(!isOpen);
    };

    // Allow the parent component to control the open state -- only after mounting.
    const [oldOpenToggle, setOldOpenToggle] = useState(props.controlledOpenToggle);
    useEffect(() => {
        // eslint-disable-next-line no-undefined
        if (props.controlledOpenToggle !== undefined && props.controlledOpenToggle !== oldOpenToggle) {
            setOpen(!isOpen);
            setOldOpenToggle(props.controlledOpenToggle);
        }
    }, [props.controlledOpenToggle]);

    const onSelectedChange = async (value: DateTimeOption | undefined, action: ActionObj) => {
        if (action.action === 'clear') {
            props.onSelectedChange(null);
            return;
        }
        toggleOpen();
        props.onSelectedChange(value);
    };

    const [options, setOptionsDateTime] = useState<DateTimeOption[]>([]);

    useEffect(() => {
        setOptionsDateTime(suggestedOptions);
    }, [suggestedOptions]);

    let target;
    if (props.onlyPlaceholder) {
        target = (
            <div
                onClick={toggleOpen}
            >
                {props.placeholder}
            </div>
        );
    }
    const targetWrapped = (
        <div
            data-testid={props.testId}
            className={props.className}
        >
            {target}
        </div>
    );

    const updateOptions = useMemo(() => debounce((query: string) => {
        const datetimes = parseDateTimes(locale, query)?.map(({start}) => DateTime.fromJSDate(start.date()));
        const duration = parse(locale, query, Mode.DurationValue);

        setOptionsDateTime(makeOptions?.(query, datetimes, duration ? [duration] : [], mode) ?? suggestedOptions);
    }, 150), [locale, makeOptions, suggestedOptions, mode]);

    const noDropdown = {DropdownIndicator: null, IndicatorSeparator: null};
    const components = props.customControl ? {
        ...noDropdown,
        Control: props.customControl,
    } : noDropdown;

    return (
        <Dropdown
            isOpen={isOpen}
            onOpenChange={setOpen}
            target={targetWrapped}
            placement={props.placement}
        >
            <ReactSelect
                isMulti={false}
                filterOption={null}
                onInputChange={updateOptions}
                autoFocus={true}
                components={components}
                controlShouldRenderValue={false}
                backspaceRemovesValue={false}
                tabSelectsValue={false}
                hideSelectedOptions={false}
                menuIsOpen={true}
                options={options}
                placeholder={mode === Mode.DateTimeValue ? formatMessage({defaultMessage: 'Specify date/time (“in 4 hours”, “May 1”...)'}) : formatMessage({defaultMessage: 'Specify duration ("8 hours", "3 days"...)'})}
                styles={selectStyles}
                noOptionsMessage={() => <InvalidLabel>{formatMessage({defaultMessage: 'Invalid time duration'})}</InvalidLabel>}
                onChange={onSelectedChange}
                classNamePrefix='playbook-react-select'
                className='playbook-react-select'
                formatOptionLabel={OptionLabel}
                {...props.customControlProps}
            />
        </Dropdown>
    );
};

const TIME_SPEC = {
    useDate: (_: string, {weekday, day, month, year}: any) => ({weekday, day, month, year}),
};

const OptionLabel = ({label, value, mode, labelRHS}: DateTimeOption) => {
    if (label) {
        return (
            <Wrapper>
                {label}
                {labelRHS && <Right>{labelRHS}</Right>}
            </Wrapper>
        );
    }

    if (!value) {
        return null;
    }

    if (mode === Mode.DateTimeValue || (!mode && DateTime.isDateTime(value))) {
        const timestamp = (
            <Timestamp
                value={DateTime.isDateTime(value) ? value : DateTime.now().plus(value)}
                {...TIME_SPEC}
            />
        );
        return (
            <Wrapper>
                {timestamp}
                {labelRHS && <Right>{labelRHS}</Right>}
            </Wrapper>
        );
    }
    return Duration.isDuration(value) && formatDuration(value, 'long');
};

// styles for the select component
const selectStyles: StylesConfig<DateTimeOption, boolean> = {
    control: (provided) => ({...provided, minWidth: 240, margin: 8}),
    menu: () => ({boxShadow: 'none', width: '340px'}),
    option: (provided, state) => {
        const hoverColor = 'rgba(20, 93, 191, 0.08)';
        const bgHover = state.isFocused ? hoverColor : 'transparent';
        return {
            ...provided,
            backgroundColor: state.isSelected ? hoverColor : bgHover,
            color: 'unset',
        };
    },
};

export default DateTimeSelector;

const Wrapper = styled.div`
    display: flex;
    flex: 1;
    color: var(--center-channel-color);
    font-weight: 400;
    font-size: 14px;
    line-height: 20px;
`;

const Right = styled.div`
    flex-grow: 1;
    display: flex;
    justify-content: flex-end;
`;

const InvalidLabel = styled.span`
    color: var(--error-text);
`;
