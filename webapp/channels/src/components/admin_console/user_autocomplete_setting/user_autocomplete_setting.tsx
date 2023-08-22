// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useRef} from 'react';

import {UserProfile} from '@mattermost/types/users';
import {UserAutocomplete} from '@mattermost/types/autocomplete';

import GenericUserProvider from 'components/suggestion/generic_user_provider';
import Setting from 'components/admin_console/setting';
import SuggestionBox from 'components/suggestion/suggestion_box';
import SuggestionList from 'components/suggestion/suggestion_list';

export type Props = {
    id: string;
    label: string;
    placeholder: string;
    helpText: React.ReactNode;
    value: string;
    onChange: (id: string, value: string) => void;
    disabled: boolean;
    actions: {
        autocompleteUsers: (username: string) => Promise<UserAutocomplete>;
    };
}

const UserAutocompleteSetting = ({id, label, placeholder, helpText, value, onChange, disabled, actions}: Props) => {
    const userSuggestionProvidersRef = useRef([new GenericUserProvider(actions.autocompleteUsers)]);

    const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        onChange(id, e.target.value);
    }, [onChange, id]);

    const handleUserSelected = useCallback((user: UserProfile) => {
        onChange(id, user.username);
    }, [id, onChange]);

    return (
        <Setting
            label={label}
            helpText={helpText}
            inputId={id}
        >
            <div
                className='admin-setting-user__dropdown'
            >
                <SuggestionBox
                    id={'admin_user_setting_' + id}
                    className='form-control'
                    placeholder={placeholder}
                    value={value}
                    onChange={handleChange}
                    onItemSelected={handleUserSelected}
                    listComponent={SuggestionList}
                    listPosition='bottom'
                    providers={userSuggestionProvidersRef.current}
                    disabled={disabled}
                    requiredCharacters={0}
                    openOnFocus={true}
                />
            </div>
        </Setting>
    );
};

export default UserAutocompleteSetting;
