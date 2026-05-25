// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';

import {CloseIcon} from '@mattermost/compass-icons/components';
import type {UserProfile} from '@mattermost/types/users';

import {getTeammateNameDisplaySetting} from 'mattermost-redux/selectors/entities/preferences';
import {getCurrentUserId, makeGetProfilesInChannel} from 'mattermost-redux/selectors/entities/users';
import {displayUsername, filterProfilesStartingWithTerm} from 'mattermost-redux/utils/user_utils';

import {autocompleteUsersInChannel} from 'actions/views/channel';

import Input from 'components/widgets/inputs/input/input';
import Avatar from 'components/widgets/users/avatar/avatar';

import {imageURLForUser} from 'utils/utils';

import type {GlobalState} from 'types/store';

import './user_picker.scss';

export type Props = {
    channelId: string;
    multi: boolean;
    selectedIds: string[];
    onChange: (ids: string[]) => void;
};

const AUTOCOMPLETE_DEBOUNCE_MS = 200;

export default function UserPicker({channelId, multi, selectedIds, onChange}: Props) {
    const {formatMessage} = useIntl();
    const dispatch = useDispatch();

    const getProfilesInChannel = useMemo(makeGetProfilesInChannel, []);

    const profiles = useSelector((state: GlobalState) => getProfilesInChannel(state, channelId));
    const currentUserId = useSelector(getCurrentUserId);
    const teammateNameDisplay = useSelector(getTeammateNameDisplaySetting);

    const [query, setQuery] = useState('');
    const debounceRef = useRef<number | undefined>(undefined);

    useEffect(() => {
        return () => {
            if (debounceRef.current !== undefined) {
                window.clearTimeout(debounceRef.current);
            }
        };
    }, []);

    const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const next = e.target.value;
        setQuery(next);

        if (debounceRef.current !== undefined) {
            window.clearTimeout(debounceRef.current);
        }
        const trimmed = next.trim();
        if (trimmed.length === 0) {
            return;
        }
        debounceRef.current = window.setTimeout(() => {
            dispatch(autocompleteUsersInChannel(trimmed, channelId));
        }, AUTOCOMPLETE_DEBOUNCE_MS);
    }, [channelId, dispatch]);

    const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

    const handleToggle = useCallback((userId: string) => {
        if (multi) {
            if (selectedSet.has(userId)) {
                onChange(selectedIds.filter((id) => id !== userId));
            } else {
                onChange([...selectedIds, userId]);
            }
        } else {
            onChange(selectedSet.has(userId) ? [] : [userId]);
        }
    }, [multi, onChange, selectedIds, selectedSet]);

    const filteredProfiles = useMemo(() => {
        const trimmed = query.trim();
        if (trimmed.length === 0) {
            return profiles;
        }
        return filterProfilesStartingWithTerm(profiles, trimmed);
    }, [profiles, query]);

    const selectedProfilesById = useMemo(() => {
        const map = new Map<string, UserProfile>();
        for (const profile of profiles) {
            if (selectedSet.has(profile.id)) {
                map.set(profile.id, profile);
            }
        }
        return map;
    }, [profiles, selectedSet]);

    return (
        <div className='user-picker'>
            {multi && selectedIds.length > 0 && (
                <div className='user-picker__selected-row'>
                    {selectedIds.map((id) => {
                        const profile = selectedProfilesById.get(id);
                        const label = profile ? displayUsername(profile, teammateNameDisplay) : id;
                        return (
                            <span
                                key={id}
                                className='user-picker__selected-chip'
                            >
                                {profile && (
                                    <Avatar
                                        size='xxs'
                                        username={profile.username}
                                        url={imageURLForUser(profile.id, profile.last_picture_update)}
                                    />
                                )}
                                <span className='user-picker__selected-chip-label'>{label}</span>
                                <button
                                    type='button'
                                    className='user-picker__selected-chip-remove'
                                    aria-label={formatMessage(
                                        {id: 'user_picker.remove', defaultMessage: 'Remove {name}'},
                                        {name: label},
                                    )}
                                    onClick={() => handleToggle(id)}
                                >
                                    <CloseIcon size={12}/>
                                </button>
                            </span>
                        );
                    })}
                </div>
            )}
            <div className='user-picker__search'>
                <Input
                    type='text'
                    value={query}
                    onChange={handleSearchChange}
                    placeholder={formatMessage({id: 'user_picker.search_placeholder', defaultMessage: 'Search'})}
                    useLegend={false}
                />
            </div>
            <div className='user-picker__section-header'>
                <FormattedMessage
                    id='suggestion.mention.members'
                    defaultMessage='Channel Members'
                />
            </div>
            <ul
                className='user-picker__list'
                role='listbox'
                aria-label={formatMessage({id: 'user_picker.aria_list', defaultMessage: 'Channel members'})}
            >
                {filteredProfiles.length === 0 && (
                    <li className='user-picker__empty'>
                        <FormattedMessage
                            id='user_picker.no_results'
                            defaultMessage='No matches found'
                        />
                    </li>
                )}
                {filteredProfiles.map((user) => {
                    const isSelected = selectedSet.has(user.id);
                    const isCurrent = user.id === currentUserId;
                    const name = displayUsername(user, teammateNameDisplay);
                    return (
                        <li
                            key={user.id}
                            role='option'
                            aria-selected={isSelected}
                            className={classNames('user-picker__item', {'user-picker__item--selected': isSelected})}
                            data-user-id={user.id}
                        >
                            <button
                                type='button'
                                className='user-picker__item-button'
                                onClick={() => handleToggle(user.id)}
                            >
                                <Avatar
                                    size='sm'
                                    username={user.username}
                                    url={imageURLForUser(user.id, user.last_picture_update)}
                                />
                                <span className='user-picker__item-text'>
                                    <span className='user-picker__item-name'>{name}</span>
                                    <span className='user-picker__item-username'>{'@' + user.username}</span>
                                    {isCurrent && (
                                        <span className='user-picker__item-you'>
                                            <FormattedMessage
                                                id='suggestion.user.isCurrent'
                                                defaultMessage='(you)'
                                            />
                                        </span>
                                    )}
                                </span>
                            </button>
                        </li>
                    );
                })}
            </ul>
        </div>
    );
}
