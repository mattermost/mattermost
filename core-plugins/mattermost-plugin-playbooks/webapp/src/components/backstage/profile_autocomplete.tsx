// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useMemo} from 'react';
import {useIntl} from 'react-intl';
import {debounce} from 'debounce';
import AsyncSelect from 'react-select/async';

import styled from 'styled-components';
import {ActionFuncAsync} from 'mattermost-redux/types/actions';
import {UserProfile} from '@mattermost/types/users';
import {
    ControlProps,
    OptionTypeBase,
    OptionsType,
    StylesConfig,
} from 'react-select';

import Profile, {ProfileImage, ProfileName} from 'src/components/profile/profile';

export const StyledAsyncSelect = styled(AsyncSelect)`
    flex-grow: 1;
    background-color: var(--center-channel-bg);

    .profile-autocomplete__menu-list {
        border: none;
        background-color: var(--center-channel-bg);
    }

    .profile-autocomplete__input {
        color: var(--center-channel-color);
    }

    .profile-autocomplete__option--is-selected {
        background-color: rgba(var(--center-channel-color-rgb), 0.08);
    }

    .profile-autocomplete__option--is-focused {
        background-color: rgba(var(--center-channel-color-rgb), 0.16);
    }

    .profile-autocomplete__control {
        width: 100%;
        border: none;
        border-radius: 4px;
        background-color: transparent;
        box-shadow: inset 0 0 0 1px rgba(var(--center-channel-color-rgb), 0.16);
        transition: all 0.15s ease;
        transition-delay: 0s;

        &--is-focused {
            box-shadow: inset 0 0 0 2px var(--button-bg);
        }

        &::before {
            position: absolute;
            top: 8px;
            left: 16px;
            color: rgba(var(--center-channel-color-rgb), 0.56);
            content: '\f0349';
            font-family: compass-icons, mattermosticons;
            font-size: 18px;
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
        }
    }

    .profile-autocomplete__option {
        &:active {
            background-color: rgba(var(--center-channel-color-rgb), 0.08);
        }
    }
`;

interface Props {
    userIds: string[];
    onAddUser?: (userid: string) => void; // for single select
    setValues?: (values: UserProfile[]) => void; // for multi select
    searchProfiles: (term: string) => ActionFuncAsync;
    getProfiles?: () => ActionFuncAsync;
    isDisabled?: boolean;
    isMultiMode?: boolean;
    customSelectStyles?: StylesConfig<OptionTypeBase, boolean>;
    placeholder?: string;
    defaultValue?: UserProfile[]
    autoFocus?: boolean;
}

const ProfileAutocomplete = (props: Props) => {
    const {formatMessage} = useIntl();

    let onChange;

    if (props.isMultiMode) {
        // in case of multiselect we need to set full list of values
        onChange = (value: UserProfile[]) => {
            props.setValues?.(value);
        };
    } else {
        onChange = (userAdded: UserProfile) => {
            props.onAddUser?.(userAdded.id);
        };
    }

    const getOptionValue = (user: UserProfile) => {
        return user.id;
    };

    const formatOptionLabel = (option: UserProfile, context: {context: string}) => {
        // different view for selected values
        if (context.context === 'value') {
            return (
                <React.Fragment>
                    <StyledProfile userId={option.id}/>
                </React.Fragment>
            );
        }
        return (
            <React.Fragment>
                <Profile userId={option.id}/>
            </React.Fragment>
        );
    };

    const debouncedSearchProfiles = useMemo(() => debounce((term: string, callback: (options: OptionsType<UserProfile>) => void) => {
        let profiles;
        if (term.trim().length === 0) {
            profiles = props.getProfiles?.();
        } else {
            profiles = props.searchProfiles(term);
        }

        //@ts-ignore
        profiles.then(({data}) => {
            callback(data);
        }).catch(() => {
            // eslint-disable-next-line no-console
            console.error('Error searching user profiles in custom attribute settings dropdown.');
            callback([]);
        });
    }, 150), [props]);

    const usersLoader = (term: string, callback: (options: OptionsType<UserProfile>) => void) => {
        try {
            debouncedSearchProfiles(term, callback);
        } catch (error) {
            // eslint-disable-next-line no-console
            console.error(error);
            callback([]);
        }
    };

    return (
        <StyledAsyncSelect
            id={'profile-autocomplete'}
            autoFocus={props.autoFocus ?? true}
            isDisabled={props.isDisabled}
            isMulti={props.isMultiMode}
            controlShouldRenderValue={props.isMultiMode}
            cacheOptions={false}
            defaultOptions={!props.isMultiMode}
            loadOptions={usersLoader}
            defaultValue={props.defaultValue}
            filterOption={({data}: { data: UserProfile }) => !props.userIds.includes(data.id)}
            onChange={onChange}
            getOptionValue={getOptionValue}
            formatOptionLabel={formatOptionLabel}
            defaultMenuIsOpen={false}
            openMenuOnClick={true}
            isClearable={false}
            placeholder={props.placeholder ?? formatMessage({defaultMessage: 'Add People'})}
            components={{DropdownIndicator: () => null, IndicatorSeparator: () => null}}
            styles={props.customSelectStyles ?? customStyles}
            classNamePrefix='profile-autocomplete'
            {...props.isMultiMode ? {} : {value: null}}
        />
    );
};

export default ProfileAutocomplete;

const customStyles = {
    control: (provided: ControlProps<UserProfile, boolean>) => ({
        ...provided,
        minHeight: '4rem',
        paddingLeft: '3.2rem',
        fontSize: '14px',
    }),
};

const StyledProfile = styled(Profile)`
    height: 24px;

    ${ProfileImage} {
        width: 24px;
        height: 24px;
    }

    ${ProfileName} {
        font-size: 14px;
        font-weight: 600;
        line-height: 16px;
    }

`;
