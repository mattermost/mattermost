// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import ReactSelect from 'react-select';
import AsyncSelect from 'react-select/async';

import type {AppField, AppSelectOption} from '@mattermost/types/apps';
import type {UserAutocomplete} from '@mattermost/types/autocomplete';
import type {Channel} from '@mattermost/types/channels';

import {AppFieldTypes} from 'mattermost-redux/constants/apps';
import {displayUsername} from 'mattermost-redux/utils/user_utils';

import {imageURLForUser} from 'utils/utils';

import {SelectChannelOption} from './select_channel_option';
import {SelectUserOption} from './select_user_option';

export type Props = {
    field: AppField;
    label: React.ReactNode;
    helpText: React.ReactNode;
    value: AppSelectOption | null;
    onChange: (value: AppSelectOption) => void;
    performLookup: (name: string, userInput: string) => Promise<AppSelectOption[]>;
    teammateNameDisplay?: string;
    actions: {
        autocompleteChannels: (term: string, success: (channels: Channel[]) => void, error: () => void) => (dispatch: any, getState: any) => Promise<void>;
        autocompleteUsers: (search: string) => Promise<UserAutocomplete>;
    };
};

export type State = {
    refreshNonce: string;
    field: AppField;
}

const reactStyles = {
    menuPortal: (provided: React.CSSProperties) => ({
        ...provided,
        zIndex: 9999,
    }),
};

const commonComponents = {
    MultiValueLabel: (props: {data: {label: string}}) => (
        <div className='react-select__padded-component'>
            {props.data.label}
        </div>
    ),
};

const commonProps = {
    isClearable: true,
    openMenuOnFocus: false,
    classNamePrefix: 'react-select-auto react-select',
    menuPortalTarget: document.body,
    styles: reactStyles,
};

export default class AppsFormSelectField extends React.PureComponent<Props, State> {
    constructor(props: Props) {
        super(props);

        this.state = {
            field: props.field,
            refreshNonce: Math.random().toString(),
        };
    }
    static getDerivedStateFromProps(nextProps: Props, prevState: State) {
        if (nextProps.field !== prevState.field) {
            return {
                field: nextProps.field,
                refreshNonce: Math.random().toString(),
            };
        }

        return null;
    }

    onChange = (selectedOption: AppSelectOption) => {
        this.props.onChange(selectedOption);
    };

    loadDynamicOptions = async (userInput: string): Promise<AppSelectOption[]> => {
        return this.props.performLookup(this.props.field.name, userInput);
    };

    loadDynamicUserOptions = async (userInput: string): Promise<AppSelectOption[]> => {
        const usersSearchResults: UserAutocomplete = await this.props.actions.autocompleteUsers(userInput.toLowerCase());

        return usersSearchResults.users.filter((user) => !user.is_bot).map((user) => {
            const label = this.props.teammateNameDisplay ? displayUsername(user, this.props.teammateNameDisplay) : user.username;

            return {...user, label, value: user.id, icon_data: imageURLForUser(user.id)};
        });
    };

    loadDynamicChannelOptions = async (userInput: string): Promise<AppSelectOption[]> => {
        let channelsSearchResults: Channel[] = [];

        await this.props.actions.autocompleteChannels(userInput.toLowerCase(), (data) => {
            channelsSearchResults = data;
        }, () => {});

        return channelsSearchResults.map((channel) => ({...channel, label: channel.display_name, value: channel.id}));
    };

    renderDynamicSelect() {
        const {field} = this.props;
        const placeholder = field.hint || '';
        const value = this.props.value;

        return (
            <div className={'react-select'}>
                <AsyncSelect
                    id={`MultiInput_${field.name}`}
                    loadOptions={this.loadDynamicOptions}
                    defaultOptions={true}
                    isMulti={field.multiselect || false}
                    placeholder={placeholder}
                    value={value}
                    onChange={this.onChange as any} // types are not working correctly for multiselect
                    isDisabled={field.readonly}
                    components={commonComponents}
                    {...commonProps}
                />
            </div>
        );
    }

    renderUserSelect() {
        const {hint, name, multiselect, readonly} = this.props.field;
        const placeholder = hint || '';
        const value = this.props.value;

        return (
            <div className={'react-select'}>
                <AsyncSelect
                    id={`MultiInput_${name}`}
                    loadOptions={this.loadDynamicUserOptions}
                    defaultOptions={true}
                    isMulti={multiselect || false}
                    placeholder={placeholder}
                    value={value}
                    onChange={this.onChange as any} // types are not working correctly for multiselect
                    isDisabled={readonly}
                    components={{...commonComponents, Option: SelectUserOption}}
                    {...commonProps}
                />
            </div>
        );
    }

    renderChannelSelect() {
        const {hint, name, multiselect, readonly} = this.props.field;
        const placeholder = hint || '';
        const value = this.props.value;

        return (
            <div className={'react-select'}>
                <AsyncSelect
                    id={`MultiInput_${name}`}
                    loadOptions={this.loadDynamicChannelOptions}
                    defaultOptions={true}
                    isMulti={multiselect || false}
                    placeholder={placeholder}
                    value={value}
                    onChange={this.onChange as any} // types are not working correctly for multiselect
                    isDisabled={readonly}
                    components={{...commonComponents, Option: SelectChannelOption}}
                    {...commonProps}
                />
            </div>
        );
    }

    renderStaticSelect() {
        const {field} = this.props;

        const placeholder = field.hint || '';

        const options = field.options;
        const value = this.props.value;

        return (
            <div className={'react-select'}>
                <ReactSelect
                    id={`MultiInput_${field.name}`}
                    options={options}
                    isMulti={field.multiselect || false}
                    placeholder={placeholder}
                    value={value}
                    onChange={this.onChange as any} // types are not working correctly for multiselect
                    isDisabled={field.readonly}
                    components={commonComponents}
                    {...commonProps}
                />
            </div>
        );
    }

    getAppFieldRenderer(type: string) {
        switch (type) {
        case AppFieldTypes.DYNAMIC_SELECT:
            return this.renderDynamicSelect();
        case AppFieldTypes.STATIC_SELECT:
            return this.renderStaticSelect();
        case AppFieldTypes.USER:
            return this.renderUserSelect();
        case AppFieldTypes.CHANNEL:
            return this.renderChannelSelect();
        default:
            return undefined;
        }
    }

    render() {
        const {field, label, helpText} = this.props;

        const selectComponent = this.getAppFieldRenderer(field.type);

        return (
            <div
                className='form-group'
            >
                {label && (
                    <label>
                        {label}
                    </label>
                )}
                <React.Fragment key={this.state.refreshNonce}>
                    {selectComponent}
                    <div className='help-text'>
                        {helpText}
                    </div>
                </React.Fragment>
            </div>
        );
    }
}
