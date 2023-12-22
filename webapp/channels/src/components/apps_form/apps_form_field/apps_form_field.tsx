// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {AppField, AppSelectOption} from '@mattermost/types/apps';
import type {UserAutocomplete} from '@mattermost/types/autocomplete';
import type {Channel} from '@mattermost/types/channels';

import {AppFieldTypes} from 'mattermost-redux/constants/apps';

import type AutocompleteSelector from 'components/autocomplete_selector';
import Markdown from 'components/markdown';
import ModalSuggestionList from 'components/suggestion/modal_suggestion_list';
import BoolSetting from 'components/widgets/settings/bool_setting';
import TextSetting from 'components/widgets/settings/text_setting';
import type {InputTypes} from 'components/widgets/settings/text_setting';

import AppsFormSelectField from './apps_form_select_field';

const TEXT_DEFAULT_MAX_LENGTH = 150;
const TEXTAREA_DEFAULT_MAX_LENGTH = 3000;

export interface Props {
    field: AppField;
    name: string;
    errorText?: React.ReactNode;
    teammateNameDisplay?: string;

    value: AppSelectOption | string | boolean | number | null;
    onChange: (name: string, value: any) => void;
    autoFocus?: boolean;
    listComponent?: React.ComponentProps<typeof AutocompleteSelector>['listComponent'];
    performLookup: (name: string, userInput: string) => Promise<AppSelectOption[]>;
    actions: {
        autocompleteChannels: (term: string, success: (channels: Channel[]) => void, error: () => void) => (dispatch: any, getState: any) => Promise<void>;
        autocompleteUsers: (search: string) => Promise<UserAutocomplete>;
    };
}

export default class AppsFormField extends React.PureComponent<Props> {
    static defaultProps = {
        listComponent: ModalSuggestionList,
    };

    handleSelected = (selected: AppSelectOption | AppSelectOption[]) => {
        const {name, onChange} = this.props;

        const option = selected;

        if (Array.isArray(selected)) {
            const options = selected.map((selectedItem) => ({label: selectedItem.label, value: selectedItem.value}));
            onChange(name, options);
        } else if (selected) {
            onChange(name, {label: selected.label, value: selected.value});
        } else {
            onChange(name, option);
        }
    };

    render() {
        const {
            field,
            name,
            value,
            onChange,
            errorText,
        } = this.props;

        const placeholder = field.hint || '';

        const displayName = (field.modal_label || field.label) as string;
        let displayNameContent: React.ReactNode = (field.modal_label || field.label) as string;
        displayNameContent = (
            <React.Fragment>
                {displayName}
                {!field.is_required && (
                    <span className='light'>
                        {' (optional)'}
                    </span>
                )}
            </React.Fragment>
        );

        const helpText = field.description;
        let helpTextContent: React.ReactNode = <Markdown message={helpText}/>;
        if (errorText) {
            helpTextContent = (
                <React.Fragment>
                    <Markdown message={helpText}/>
                    <div className='error-text mt-3'>
                        {errorText}
                    </div>
                </React.Fragment>
            );
        }

        switch (field.type) {
        case AppFieldTypes.TEXT: {
            const subtype = field.subtype || 'text';

            let maxLength = field.max_length;
            if (!maxLength) {
                if (subtype === 'textarea') {
                    maxLength = TEXTAREA_DEFAULT_MAX_LENGTH;
                } else {
                    maxLength = TEXT_DEFAULT_MAX_LENGTH;
                }
            }

            const textValue = value as string;
            return (
                <TextSetting
                    autoFocus={this.props.autoFocus}
                    id={name}
                    disabled={field.readonly}
                    type={subtype as InputTypes}
                    label={displayNameContent}
                    maxLength={maxLength}
                    value={textValue || ''}
                    placeholder={placeholder}
                    helpText={helpTextContent}
                    onChange={onChange}
                    resizable={false}
                />
            );
        }
        case AppFieldTypes.CHANNEL:
        case AppFieldTypes.USER:
        case AppFieldTypes.STATIC_SELECT:
        case AppFieldTypes.DYNAMIC_SELECT: {
            return (
                <AppsFormSelectField
                    {...this.props}
                    teammateNameDisplay={this.props.teammateNameDisplay}
                    field={field}
                    label={displayNameContent}
                    helpText={helpTextContent}
                    onChange={this.handleSelected}
                    value={this.props.value as AppSelectOption | null}
                />
            );
        }
        case AppFieldTypes.BOOL: {
            const boolValue = value as boolean;
            return (
                <BoolSetting
                    autoFocus={this.props.autoFocus}
                    id={name}
                    disabled={field.readonly}
                    label={displayNameContent}
                    value={boolValue || false}
                    helpText={helpTextContent}
                    placeholder={placeholder}
                    onChange={onChange}
                />
            );
        }
        case AppFieldTypes.MARKDOWN: {
            return (
                <Markdown
                    message={field.description}
                />
            );
        }
        }

        return null;
    }
}
