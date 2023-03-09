import React, {useEffect, useState} from 'react';
import {useSelector} from 'react-redux';

import ReactSelect, {ControlProps} from 'react-select';

import styled from 'styled-components';
import {ActionFunc} from 'mattermost-redux/types/actions';
import {GlobalState} from '@mattermost/types/store';
import {UserProfile} from '@mattermost/types/users';
import {getUser} from 'mattermost-redux/selectors/entities/users';

import {useIntl} from 'react-intl';

import Profile from 'src/components/profile/profile';
import ClearIndicator from 'src/components/backstage/playbook_edit/automation/clear_indicator';
import MenuList from 'src/components/backstage/playbook_edit/automation/menu_list';

interface Props {
    ownerID: string;
    onAddUser: (userid: string) => void;
    searchProfiles: (term: string) => ActionFunc;
    getProfiles: () => ActionFunc;
    isDisabled: boolean;
}

const AssignOwnerSelector = (props: Props) => {
    const {formatMessage} = useIntl();
    const [options, setOptions] = useState<UserProfile[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const ownerUser = useSelector<GlobalState, UserProfile>((state: GlobalState) => getUser(state, props.ownerID));

    // Update the options whenever the owner ID or the search term are updated
    useEffect(() => {
        const updateOptions = async (term: string) => {
            let profiles;
            if (term.trim().length === 0) {
                profiles = props.getProfiles();
            } else {
                profiles = props.searchProfiles(term);
            }

            //@ts-ignore
            profiles.then(({data}: { data: UserProfile[] }) => {
                setOptions(data.filter((user: UserProfile) => user.id !== props.ownerID));
            }).catch(() => {
                // eslint-disable-next-line no-console
                console.error('Error searching user profiles in custom attribute settings dropdown.');
            });
        };

        updateOptions(searchTerm);
    }, [props.ownerID, searchTerm]);

    const handleSelectionChange = (userAdded: UserProfile | null, {action}: {action: string}) => {
        if (action === 'clear') {
            props.onAddUser('');
        } else if (userAdded) {
            props.onAddUser(userAdded.id);
        }
    };

    return (
        <StyledReactSelect
            closeMenuOnSelect={true}
            onInputChange={setSearchTerm}
            options={options}
            filterOption={() => true}
            isDisabled={props.isDisabled}
            isMulti={false}
            value={ownerUser}
            controlShouldRenderValue={!props.isDisabled}
            onChange={handleSelectionChange}
            getOptionValue={(user: UserProfile) => user.id}
            formatOptionLabel={(user: UserProfile) => (
                <StyledProfile userId={user.id}/>
            )}
            defaultMenuIsOpen={false}
            openMenuOnClick={true}
            isClearable={true}
            placeholder={formatMessage({defaultMessage: 'Search for people'})}
            components={{ClearIndicator, DropdownIndicator: () => null, IndicatorSeparator: () => null, MenuList}}
            styles={{
                control: (provided: ControlProps<UserProfile, boolean>) => ({
                    ...provided,
                    minHeight: 34,
                }),
            }}
            classNamePrefix='assign-owner-selector'
            captureMenuScroll={false}
        />
    );
};

export default AssignOwnerSelector;

const StyledProfile = styled(Profile)`
    color: var(--center-channel-color);

    && .image {
        width: 24px;
        height: 24px;
    }
`;

const StyledReactSelect = styled(ReactSelect)`
    flex-grow: 1;
    background-color: ${(props) => (props.isDisabled ? 'rgba(var(--center-channel-bg-rgb), 0.16)' : 'var(--center-channel-bg)')};

    .assign-owner-selector__input {
        color: var(--center-channel-color);
    }

    .assign-owner-selector__menu {
        background-color: transparent;
        box-shadow: 0px 8px 24px rgba(0, 0, 0, 0.12);
    }


    .assign-owner-selector__option {
        height: 36px;
        padding: 6px 21px 6px 12px;
        display: flex;
        flex-direction: row;
        justify-content: space-between;
        align-items: center;
    }

    .assign-owner-selector__option--is-selected {
        background-color: var(--center-channel-bg);
        color: var(--center-channel-color);
    }

    .assign-owner-selector__option--is-focused {
        background-color: rgba(var(--button-bg-rgb), 0.04);
    }

    .assign-owner-selector__control {
        -webkit-transition: all 0.15s ease;
        -webkit-transition-delay: 0s;
        -moz-transition: all 0.15s ease;
        -o-transition: all 0.15s ease;
        transition: all 0.15s ease;
        transition-delay: 0s;
        background-color: transparent;
        border-radius: 4px;
        border: none;
        box-shadow: inset 0 0 0 1px rgba(var(--center-channel-color-rgb), 0.16);
        width: 100%;
        height: 4rem;
        font-size: 14px;
        padding-left: 3.2rem;
        padding-right: 16px;

        &--is-focused {
            box-shadow: inset 0 0 0px 2px var(--button-bg);
        }

        &:before {
            left: 16px;
            top: 8px;
            position: absolute;
            color: rgba(var(--center-channel-color-rgb), 0.56);
            content: '\f0349';
            font-size: 18px;
            font-family: 'compass-icons', mattermosticons;
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
        }
    }

    .assign-owner-selector__option {
        &:active {
            background-color: rgba(var(--center-channel-color-rgb), 0.08);
        }
    }

    .assign-owner-selector__group-heading {
        height: 32px;
        padding: 8px 12px 8px;
        font-size: 12px;
        font-weight: 600;
        line-height: 16px;
        color: rgba(var(--center-channel-color-rgb), 0.56);
    }
`;
