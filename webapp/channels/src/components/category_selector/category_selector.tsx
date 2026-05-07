// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {useState, useMemo, useCallback} from 'react';
import {useIntl} from 'react-intl';
import {shallowEqual, useSelector} from 'react-redux';
import {components} from 'react-select';
import type {ClearIndicatorProps, GroupBase, OptionProps, Options, OptionsOrGroups} from 'react-select';
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
};

const IndicatorsContainer = (props: any) => (
    <div className='CategorySelector__indicatorsContainer'>
        <components.IndicatorsContainer {...props}/>
    </div>
);

const ClearIndicator = (props: ClearIndicatorProps<Option>) => (
    <components.ClearIndicator {...props}>
        <i className='icon icon-close-circle'/>
    </components.ClearIndicator>
);

const DropdownIndicator = () => (
    <i className='icon icon-chevron-down'/>
);

const Control = (props: any) => (
    <div className='CategorySelector__controlContainer'>
        <components.Control {...props}/>
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
const OptionComponent = (props: OptionProps<Option, false, GroupBase<Option>>) => {
    const isCreateOption = Boolean((props.data as Record<string, unknown>)[CREATABLE_NEW_OPTION_KEY]);
    const OptionIcon = isCreateOption ? FolderPlusOutlineIcon : FolderOutlineIcon;

    return (
        <div
            className={classNames('CategorySelector__option', {
                selected: props.isSelected,
                focused: props.isFocused,
            })}
        >
            <components.Option {...props}>
                <OptionIcon size={16}/>
                <span>{props.children}</span>
            </components.Option>
        </div>
    );
};

export default function CategorySelector({value, onChange, getOptions, label, placeholder, helpText, menuPortalTargetId, disabled}: CategorySelectorProps) {
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

    const portalTarget = menuPortalTargetId ? document.getElementById(menuPortalTargetId) : undefined;
    const legend = label ?? formatMessage({id: 'default_category.label', defaultMessage: 'Default category (optional)'});
    const placeholderText = placeholder ?? formatMessage({id: 'default_category.placeholder', defaultMessage: 'Choose a default category (optional)'});
    const showLegend = Boolean(focused || value);

    return (
        <div className='CategorySelector Input_container'>
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
                        components={{IndicatorsContainer, ClearIndicator, DropdownIndicator, Option: OptionComponent, Control, ValueContainer}}
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
