// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {useState, useMemo, useCallback} from 'react';
import {useIntl} from 'react-intl';
import {shallowEqual, useSelector} from 'react-redux';
import {components} from 'react-select';
import type {ClearIndicatorProps, GroupBase, InputProps, OptionProps, Options, OptionsOrGroups} from 'react-select';
import CreatableSelect from 'react-select/creatable';

import {FolderOutlineIcon, FolderPlusOutlineIcon} from '@mattermost/compass-icons/components';
import type {GlobalState} from '@mattermost/types/store';

import {getCurrentTeamId} from 'mattermost-redux/selectors/entities/teams';

import './category_selector.scss';

type Option = {
    label: string;
    value: string;
};

export type CategorySelectorProps = {
    value?: string;
    onChange: (categoryName: string | undefined) => void;
    getOptions: (state: GlobalState, teamId: string) => string[];
    label?: string;
    placeholder?: string;
    helpText?: string;
    menuPortalTargetId?: string;
    disabled?: boolean;

    /** The selector's testid; its parts render `<testIdScope>.control--button`, `<testIdScope>.input--combobox`, `<testIdScope>.clear--button`, `<testIdScope>.create--option` and `<testIdScope>.option:<index>--option`. */
    testIdScope?: string;
};

const IndicatorsContainer = (props: any) => (
    <div className='CategorySelector__indicatorsContainer'>
        <components.IndicatorsContainer {...props}/>
    </div>
);

const ClearIndicator = (props: ClearIndicatorProps<Option> & {testIdScope?: string}) => {
    const {testIdScope, ...indicatorProps} = props;

    // react-select's clear control is a div that acts on mouse down, not a button
    const innerProps = {...indicatorProps.innerProps, 'data-testid': testIdScope ? `${testIdScope}.clear--button` : undefined} as typeof indicatorProps.innerProps;
    return (
        <components.ClearIndicator
            {...indicatorProps}
            innerProps={innerProps}
        >
            <i className='icon icon-close-circle'/>
        </components.ClearIndicator>
    );
};

const DropdownIndicator = () => (
    <i className='icon icon-chevron-down'/>
);

const makeControl = (controlTestId?: string) => (props: any) => (
    <div className='CategorySelector__controlContainer'>
        <components.Control
            {...props}
            innerProps={{...props.innerProps, 'data-testid': controlTestId}}
        />
    </div>
);

const ValueContainer = ({children, ...props}: any) => (
    <components.ValueContainer {...props}>
        <div className='CategorySelector__valueContainerInner'>
            <FolderOutlineIcon
                size={16}
                className='CategorySelector__folderIcon'
            />
            {children}
        </div>
    </components.ValueContainer>
);

const CREATABLE_NEW_OPTION_KEY = '__isNew__';
const OptionComponent = (props: OptionProps<Option, false, GroupBase<Option>> & {testIdScope?: string; index: number}) => {
    const {testIdScope, index, ...optionProps} = props;
    const isCreateOption = Boolean((props.data as Record<string, unknown>)[CREATABLE_NEW_OPTION_KEY]);
    const OptionIcon = isCreateOption ? FolderPlusOutlineIcon : FolderOutlineIcon;
    let optionTestId;
    if (testIdScope) {
        optionTestId = isCreateOption ? `${testIdScope}.create--option` : `${testIdScope}.option:${index}--option`;
    }
    const innerProps = {...optionProps.innerProps, 'data-testid': optionTestId} as typeof optionProps.innerProps;

    return (
        <div
            className={classNames('CategorySelector__option', {
                selected: props.isSelected,
                focused: props.isFocused,
            })}
        >
            <components.Option
                {...optionProps}
                innerProps={innerProps}
            >
                <OptionIcon size={16}/>
                <span>{props.children}</span>
            </components.Option>
        </div>
    );
};

export default function CategorySelector({value, onChange, getOptions, label, placeholder, helpText, menuPortalTargetId, disabled, testIdScope}: CategorySelectorProps) {
    const {formatMessage} = useIntl();
    const [focused, setFocused] = useState(false);

    const teamId = useSelector(getCurrentTeamId);
    const selectOptionNames = useCallback(
        (state: GlobalState) => getOptions(state, teamId ?? ''),
        [getOptions, teamId],
    );
    const optionNames = useSelector(selectOptionNames, shallowEqual);
    const options: Option[] = useMemo(() => {
        return optionNames.map((name) => ({label: name, value: name}));
    }, [optionNames]);

    const selectedOption: Option | null = value ? {label: value, value} : null;

    const handleChange = useCallback((option: Option | null) => {
        const trimmed = option?.value?.trim();
        onChange(trimmed || undefined);
    }, [onChange]);

    const formatCreateLabel = useCallback((inputValue: string) => {
        return (
            <>
                <span className='CategorySelector__createLabelPrefix'>
                    {formatMessage({id: 'default_category.create_new_prefix', defaultMessage: 'Create new category: '})}
                </span>
                <span>{inputValue}</span>
            </>
        );
    }, [formatMessage]);

    const isValidNewOption = useCallback((inputValue: string, _value: Options<Option>, selectOptions: OptionsOrGroups<Option, GroupBase<Option>>) => {
        const trimmed = inputValue.trim();
        return trimmed.length >= 2 && !selectOptions.some((o) => 'value' in o && o.value.trim() === trimmed);
    }, []);

    const onFocus = useCallback(() => {
        setFocused(true);
    }, []);

    const onBlur = useCallback(() => {
        setFocused(false);
    }, []);

    const onKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.stopPropagation();
        }
    }, []);

    // the testids go in through the parts' props (react-select's own parts render the elements); the parts depend on
    // the scope only, so they keep their identity (and their focus) while the options change
    const selectComponents = useMemo(() => ({
        IndicatorsContainer,
        ClearIndicator: (props: ClearIndicatorProps<Option>) => (
            <ClearIndicator
                {...props}
                testIdScope={testIdScope}
            />
        ),
        DropdownIndicator,
        Control: makeControl(testIdScope ? `${testIdScope}.control--button` : undefined),
        ValueContainer,
        Option: (props: OptionProps<Option, false, GroupBase<Option>>) => (
            <OptionComponent
                {...props}
                testIdScope={testIdScope}
                index={(props.options as Option[]).findIndex((option) => option.value === props.data.value)}
            />
        ),
        Input: (props: InputProps<Option, false, GroupBase<Option>>) => (
            <components.Input
                {...props}
                data-testid={testIdScope ? `${testIdScope}.input--combobox` : undefined}
            />
        ),
    }), [testIdScope]);

    const portalTarget = menuPortalTargetId ? document.getElementById(menuPortalTargetId) : undefined;
    const legend = label ?? formatMessage({id: 'default_category.label', defaultMessage: 'Default category (optional)'});
    const placeholderText = placeholder ?? formatMessage({id: 'default_category.placeholder', defaultMessage: 'Choose a default category (optional)'});
    const showLegend = Boolean(focused || value);

    return (
        <div
            className='CategorySelector Input_container'
            data-testid={testIdScope}
        >
            <fieldset
                className={classNames('Input_fieldset', {
                    Input_fieldset___legend: showLegend,
                })}
            >
                <legend className={classNames('Input_legend', {Input_legend___focus: showLegend})}>
                    {showLegend ? legend : null}
                </legend>
                <div
                    className='Input_wrapper'
                    role='presentation'
                    onFocus={onFocus}
                    onBlur={onBlur}
                    onKeyDown={onKeyDown}
                >
                    <CreatableSelect<Option>
                        classNamePrefix='CategorySelector'
                        className={classNames('Input', {Input__focus: showLegend})}
                        components={selectComponents}
                        isClearable={true}
                        options={options}
                        value={selectedOption}
                        onChange={handleChange}
                        formatCreateLabel={formatCreateLabel}
                        isValidNewOption={isValidNewOption}
                        placeholder={focused ? formatMessage({id: 'default_category.placeholder_focused', defaultMessage: 'Select category or type a new one'}) : placeholderText}
                        menuPortalTarget={portalTarget ?? undefined}
                        isDisabled={disabled}
                    />
                </div>
            </fieldset>
            {helpText && (
                <div className='Input___customMessage Input___info'>
                    <span>{helpText}</span>
                </div>
            )}
        </div>
    );
}
