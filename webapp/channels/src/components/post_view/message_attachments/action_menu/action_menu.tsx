// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {Channel} from '@mattermost/types/channels';
import type {UserProfile} from '@mattermost/types/users';

import AutocompleteSelector from 'components/autocomplete_selector';
import type {Option, Selected} from 'components/autocomplete_selector';
import PostContext from 'components/post_view/post_context';
import GenericChannelProvider from 'components/suggestion/generic_channel_provider';
import GenericUserProvider from 'components/suggestion/generic_user_provider';
import MenuActionProvider from 'components/suggestion/menu_action_provider';

import type {OwnProps, PropsFromRedux} from './index';

type Provider = GenericUserProvider | GenericChannelProvider | MenuActionProvider;

export type Props = OwnProps & PropsFromRedux;

type State = {
    selected?: Selected;
    value: string;
};

export default class ActionMenu extends React.PureComponent<Props, State> {
    private providers: Provider[];

    constructor(props: Props) {
        super(props);

        const action = props.action;
        this.providers = [];
        if (action) {
            if (action.data_source === 'users') {
                this.providers = [new GenericUserProvider(props.autocompleteUsers)];
            } else if (action.data_source === 'channels') {
                this.providers = [new GenericChannelProvider(props.autocompleteChannels)];
            } else if (action.options) {
                this.providers = [new MenuActionProvider(action.options)];
            }
        }

        let selected;
        let value = '';

        if (action.default_option && action.options) {
            selected = action.options.find((option) => option.value === action.default_option);
            value = selected ? selected.text : '';
        }

        this.state = {
            selected,
            value,
        };
    }

    static getDerivedStateFromProps(props: Props, state: State) {
        if (props.selected && props.selected !== state.selected) {
            const selected = props.selected as Option;
            return {
                value: selected.text,
                selected: props.selected,
            };
        }

        return null;
    }

    handleSelected = (selected: Selected) => {
        if (!selected) {
            return;
        }

        const {action} = this.props;

        let value = '';
        let text = '';
        if (action.data_source === 'users') {
            const user = selected as UserProfile;
            text = user.username;
            value = user.id;
        } else if (action.data_source === 'channels') {
            const channel = selected as Channel;
            text = channel.display_name;
            value = channel.id;
        } else {
            const option = selected as Option;
            text = option.text;
            value = option.value;
        }

        this.props.selectAttachmentMenuAction(
            this.props.postId, this.props.action.id || '', this.props.action.cookie || '', this.props.action?.data_source, text, value);

        this.setState({value: text});
    };

    render() {
        const {action, disabled} = this.props;

        return (
            <PostContext.Consumer>
                {({handlePopupOpened}) => (
                    <AutocompleteSelector
                        providers={this.providers}
                        onSelected={this.handleSelected}
                        placeholder={action.name}
                        inputClassName='post-attachment-dropdown'
                        value={this.state.value}
                        toggleFocus={handlePopupOpened}
                        disabled={disabled}
                    />
                )}
            </PostContext.Consumer>
        );
    }
}
