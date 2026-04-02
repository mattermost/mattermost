// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {useState, useMemo, useCallback} from 'react';
import {useIntl} from 'react-intl';
import {useSelector} from 'react-redux';
import {components} from 'react-select';
import type {ClearIndicatorProps} from 'react-select';
import CreatableSelect from 'react-select/creatable';

import {FolderOutlineIcon} from '@mattermost/compass-icons/components';
import type {GlobalState} from '@mattermost/types/store';

import {getManagedCategoryMappings} from 'mattermost-redux/selectors/entities/channel_categories';
import {getCurrentTeamId} from 'mattermost-redux/selectors/entities/teams';

import './managed_category_selector.scss';

type Option = {
    label: string;
    value: string;
};

type Props = {
    value?: string;
    onChange: (categoryName: string | undefined) => void;
    menuPortalTargetId?: string;
    disabled?: boolean;
};

const IndicatorsContainer = (props: any) => (
    <div className='ManagedCategorySelector__indicatorsContainer'>
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
    <div className='ManagedCategorySelector__controlContainer'>
        <components.Control {...props}/>
    </div>
);

const ValueContainer = ({children, ...props}: any) => (
    <components.ValueContainer {...props}>
        <div className='ManagedCategorySelector__valueContainerInner'>
            <FolderOutlineIcon
                size={16}
                className='ManagedCategorySelector__folderIcon'
            />
            {children}
        </div>
    </components.ValueContainer>
);

const OptionComponent = (props: any) => (
    <div
        className={classNames('ManagedCategorySelector__option', {
            selected: props.isSelected,
            focused: props.isFocused,
        })}
    >
        <components.Option {...props}>
            <FolderOutlineIcon size={16}/>
            <span>{props.children}</span>
        </components.Option>
    </div>
);

export default function ManagedCategorySelector({value, onChange, menuPortalTargetId, disabled}: Props) {
    const {formatMessage} = useIntl();
    const [focused, setFocused] = useState(false);

    const teamId = useSelector(getCurrentTeamId);
    const managedMappings = useSelector((state: GlobalState) => getManagedCategoryMappings(state, teamId));
    const options: Option[] = useMemo(() => {
        const uniqueNames = [...new Set(Object.values(managedMappings ?? []))];
        return uniqueNames.map((name) => ({label: name, value: name}));
    }, [managedMappings]);

    const selectedOption: Option | null = value ? {label: value, value} : null;

    const handleChange = useCallback((option: Option | null) => {
        const trimmed = option?.value?.trim();
        onChange(trimmed || undefined);
    }, [onChange]);

    const formatCreateLabel = useCallback((inputValue: string) => {
        return formatMessage(
            {id: 'managed_category.create_new', defaultMessage: 'Create new category: {name}'},
            {name: inputValue},
        );
    }, [formatMessage]);

    const isValidNewOption = useCallback((inputValue: string) => {
        return inputValue.trim().length >= 2;
    }, []);

    const onFocus = useCallback(() => {
        setFocused(true);
    }, []);

    const onBlur = useCallback(() => {
        setFocused(false);
    }, []);

    const portalTarget = menuPortalTargetId ? document.getElementById(menuPortalTargetId) : undefined;
    const legend = formatMessage({id: 'managed_category.label', defaultMessage: 'Managed category (optional)'});
    const showLegend = Boolean(focused || value);

    return (
        <div className='ManagedCategorySelector Input_container'>
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
                >
                    <CreatableSelect<Option>
                        classNamePrefix='ManagedCategory'
                        className={classNames('Input', {Input__focus: showLegend})}
                        components={{IndicatorsContainer, ClearIndicator, DropdownIndicator, Option: OptionComponent, Control, ValueContainer}}
                        isClearable={true}
                        options={options}
                        value={selectedOption}
                        onChange={handleChange}
                        formatCreateLabel={formatCreateLabel}
                        isValidNewOption={isValidNewOption}
                        placeholder={focused ? formatMessage({id: 'managed_category.placeholder_focused', defaultMessage: 'Select category or type a new one'}) : formatMessage({id: 'managed_category.placeholder', defaultMessage: 'Choose a managed category (optional)'})}
                        menuPortalTarget={portalTarget ?? undefined}
                        isDisabled={disabled}
                    />
                </div>
            </fieldset>
        </div>
    );
}
