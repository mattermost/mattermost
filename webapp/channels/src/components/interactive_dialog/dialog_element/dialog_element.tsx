// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {FormattedMessage} from 'react-intl';

import MenuActionProvider from 'components/suggestion/menu_action_provider';
import GenericUserProvider from 'components/suggestion/generic_user_provider';
import GenericChannelProvider from 'components/suggestion/generic_channel_provider';

import TextSetting, {InputTypes} from 'components/widgets/settings/text_setting';
import AutocompleteSelector from 'components/autocomplete_selector';
import ModalSuggestionList from 'components/suggestion/modal_suggestion_list';
import BoolSetting from 'components/widgets/settings/bool_setting';
import RadioSetting from 'components/widgets/settings/radio_setting';
import {Channel} from '@mattermost/types/channels';
import Provider from 'components/suggestion/provider';
import {UserAutocomplete} from '@mattermost/types/autocomplete';
import {ServerError} from '@mattermost/types/errors';
import {ActionResult} from 'mattermost-redux/types/actions';

const TEXT_DEFAULT_MAX_LENGTH = 150;
const TEXTAREA_DEFAULT_MAX_LENGTH = 3000;

export type Props = {
    displayName: string;
    name: string;
    type: string;
    subtype?: string;
    placeholder?: string;
    helpText?: string;
    errorText?: React.ReactNode;
    maxLength?: number;
    dataSource?: string;
    optional?: boolean;
    options?: Array<{
        text: string;
        value: string;
    }>;
    value?: string | boolean;
    onChange: (name: string, selected: string) => void;
    autoFocus?: boolean;
    actions: {
        autocompleteChannels: (term: string, success: (channels: Channel[]) => void, error?: (err: ServerError) => void) => (ActionResult | Promise<ActionResult | ActionResult[]>);
        autocompleteUsers: (search: string) => Promise<UserAutocomplete>;
    };
}

type State = {
    value: string;
}

type Selected = {
    id: string;
    username: string;
    display_name: string;
    value: string;
    text: string;
}

export default class DialogElement extends React.PureComponent<Props, State> {
    private providers: Provider[];

    constructor(props: Props) {
        super(props);

        let defaultText = '';
        this.providers = [];
        if (props.type === 'select') {
            if (props.dataSource === 'users') {
                this.providers = [new GenericUserProvider(props.actions.autocompleteUsers)];
            } else if (props.dataSource === 'channels') {
                this.providers = [new GenericChannelProvider(props.actions.autocompleteChannels)];
            } else if (props.options) {
                this.providers = [new MenuActionProvider(props.options)];
            }

            if (props.value && props.options) {
                const defaultOption = props.options.find(
                    (option) => option.value === props.value,
                );
                defaultText = defaultOption ? defaultOption.text : '';
            }
        }

        this.state = {
            value: defaultText,
        };
    }

    private handleSelected = (selected: Selected) => {
        const {name, dataSource} = this.props;

        if (dataSource === 'users') {
            this.props.onChange(name, selected.id);
            this.setState({value: selected.username});
        } else if (dataSource === 'channels') {
            this.props.onChange(name, selected.id);
            this.setState({value: selected.display_name});
        } else {
            this.props.onChange(name, selected.value);
            this.setState({value: selected.text});
        }
    };

    public render(): JSX.Element | null {
        const {
            name,
            subtype,
            displayName,
            value,
            placeholder,
            onChange,
            helpText,
            errorText,
            optional,
            options,
            type,
        } = this.props;

        let {maxLength} = this.props;

        let displayNameContent: React.ReactNode = displayName;
        if (optional) {
            displayNameContent = (
                <React.Fragment>
                    {displayName + ' '}
                    <span className='font-weight--normal light'>
                        <FormattedMessage
                            id='interactive_dialog.element.optional'
                            defaultMessage='(optional)'
                        />
                    </span>
                </React.Fragment>
            );
        } else {
            displayNameContent = (
                <React.Fragment>
                    {displayName}
                    <span className='error-text'>{' *'}</span>
                </React.Fragment>
            );
        }

        let helpTextContent: React.ReactNode = helpText;
        if (errorText) {
            helpTextContent = (
                <React.Fragment>
                    {helpText}
                    <div className='error-text mt-3'>
                        {errorText}
                    </div>
                </React.Fragment>
            );
        }

        if (type === 'text' || type === 'textarea') {
            if (type === 'text') {
                maxLength = maxLength || TEXT_DEFAULT_MAX_LENGTH;
            } else {
                maxLength = maxLength || TEXTAREA_DEFAULT_MAX_LENGTH;
            }

            const textValue = value as string;
            return (
                <TextSetting
                    autoFocus={this.props.autoFocus}
                    id={name}
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
        } else if (type === 'select') {
            return (
                <AutocompleteSelector
                    id={name}
                    providers={this.providers}
                    onSelected={this.handleSelected}
                    label={displayNameContent}
                    helpText={helpTextContent}
                    placeholder={placeholder}
                    value={this.state.value}
                    listComponent={ModalSuggestionList}
                    listPosition='bottom'
                />
            );
        } else if (type === 'bool') {
            const boolValue = value as boolean;
            return (
                <BoolSetting
                    autoFocus={this.props.autoFocus}
                    id={name}
                    label={displayNameContent}
                    value={boolValue || false}
                    helpText={helpTextContent}
                    placeholder={placeholder}
                    onChange={onChange}
                />
            );
        } else if (type === 'radio') {
            const textValue = value as string;
            return (
                <RadioSetting
                    id={name}
                    label={displayNameContent}
                    helpText={helpTextContent}
                    options={options}
                    value={textValue}
                    onChange={onChange}
                />
            );
        }

        return null;
    }
}
