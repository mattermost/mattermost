// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {useIntl, FormattedMessage, defineMessage} from 'react-intl';
import {useSelector} from 'react-redux';

import {GenericModal} from '@mattermost/components';
import type {UserProfile} from '@mattermost/types/users';

import {Client4} from 'mattermost-redux/client';
import {getTeammateNameDisplaySetting} from 'mattermost-redux/selectors/entities/preferences';
import {getUserStatuses} from 'mattermost-redux/selectors/entities/users';
import {displayUsername, filterProfilesStartingWithTerm} from 'mattermost-redux/utils/user_utils';

import MultiSelect from 'components/multiselect/multiselect';
import type {Value} from 'components/multiselect/multiselect';
import ProfilePicture from 'components/profile_picture';
import BotTag from 'components/widgets/tag/bot_tag';

import type {GlobalState} from 'types/store';

type UserProfileValue = Value & UserProfile;

export interface Props {
    threadId: string;
    channelId: string;
    existingFollowerIds: string[];
    onAddFollowers: (userIds: string[]) => Promise<void>;
    onExited: () => void;
}

const USERS_PER_PAGE = 50;
const MAX_USERS = 25;

export default function ThreadInviteModal({
    threadId,
    channelId,
    existingFollowerIds,
    onAddFollowers,
    onExited,
}: Props) {
    const intl = useIntl();

    const [selectedUsers, setSelectedUsers] = useState<UserProfileValue[]>([]);
    const [term, setTerm] = useState('');
    const [show, setShow] = useState(true);
    const [saving, setSaving] = useState(false);
    const [loadingUsers, setLoadingUsers] = useState(true);
    const [channelMembers, setChannelMembers] = useState<UserProfile[]>([]);
    const [inviteError, setInviteError] = useState<string | undefined>(undefined);

    const searchTimeoutId = useRef<number>(0);
    const selectedItemRef = useRef<HTMLDivElement>(null);

    const teammateNameDisplaySetting = useSelector(getTeammateNameDisplaySetting);
    const userStatuses = useSelector(getUserStatuses);

    // Fetch channel members on mount
    useEffect(() => {
        if (channelId) {
            setLoadingUsers(true);
            Client4.getProfilesInChannel(channelId, 0, USERS_PER_PAGE, '', {active: true}).then((users) => {
                setChannelMembers(users);
                setLoadingUsers(false);
            }).catch(() => {
                setChannelMembers([]);
                setLoadingUsers(false);
            });
        }
    }, [channelId]);

    // Filter out existing followers and deleted users
    const existingFollowerSet = useMemo(() => new Set(existingFollowerIds), [existingFollowerIds]);

    const getOptions = useCallback((): UserProfileValue[] => {
        const filteredUsers = filterProfilesStartingWithTerm(channelMembers, term);
        return filteredUsers.
            filter((user) => user.delete_at === 0 && !existingFollowerSet.has(user.id)).
            slice(0, MAX_USERS).
            map((user) => ({
                ...user,
                label: displayUsername(user, teammateNameDisplaySetting),
                value: user.id,
            }));
    }, [channelMembers, term, existingFollowerSet, teammateNameDisplaySetting]);

    const options = useMemo(() => getOptions(), [getOptions]);

    const onHide = useCallback(() => {
        setShow(false);
    }, []);

    const handleDelete = useCallback((values: UserProfileValue[]) => {
        setSelectedUsers(values);
    }, []);

    const addValue = useCallback((value: UserProfileValue) => {
        setSelectedUsers((prev) => {
            if (prev.findIndex((p) => p.id === value.id) === -1) {
                return [...prev, value];
            }
            return prev;
        });
    }, []);

    const handleSubmit = useCallback(async () => {
        if (selectedUsers.length === 0) {
            return;
        }

        setSaving(true);
        setInviteError(undefined);

        try {
            await onAddFollowers(selectedUsers.map((u) => u.id));
            onHide();
        } catch (error: any) {
            setInviteError(error.message || 'Failed to add followers');
            setSaving(false);
        }
    }, [selectedUsers, onAddFollowers, onHide]);

    const search = useCallback((searchTerm: string) => {
        clearTimeout(searchTimeoutId.current);
        setTerm(searchTerm.trim());
    }, []);

    const renderAriaLabel = useCallback((option: UserProfileValue): string => {
        return option.username || '';
    }, []);

    const renderOption = useCallback((
        option: UserProfileValue,
        isSelected: boolean,
        onAdd: (option: UserProfileValue) => void,
        onMouseMove: (option: UserProfileValue) => void,
    ) => {
        const rowSelected = isSelected ? 'more-modal__row--selected' : '';
        const displayName = displayUsername(option, teammateNameDisplaySetting);

        return (
            <div
                key={option.id}
                ref={isSelected ? selectedItemRef : undefined}
                className={'more-modal__row clickable ' + rowSelected}
                onClick={() => onAdd(option)}
                onMouseMove={() => onMouseMove(option)}
            >
                <ProfilePicture
                    src={Client4.getProfilePictureUrl(option.id, option.last_picture_update)}
                    status={userStatuses[option.id]}
                    size='md'
                    username={option.username}
                />
                <div className='more-modal__details'>
                    <div className='more-modal__name'>
                        <span>
                            {displayName}
                            {option.is_bot && <BotTag/>}
                            {displayName === option.username ? null : (
                                <span className='ml-2 light'>
                                    {'@'}{option.username}
                                </span>
                            )}
                        </span>
                    </div>
                </div>
                <div className='more-modal__actions'>
                    <button
                        className='more-modal__actions--round'
                        aria-label='Add user to thread followers'
                    >
                        <i className='icon icon-plus'/>
                    </button>
                </div>
            </div>
        );
    }, [teammateNameDisplaySetting, userStatuses]);

    useEffect(() => {
        return () => {
            clearTimeout(searchTimeoutId.current);
        };
    }, []);

    const buttonSubmitText = defineMessage({id: 'thread_invite.add', defaultMessage: 'Add'});
    const buttonSubmitLoadingText = defineMessage({id: 'thread_invite.adding', defaultMessage: 'Adding...'});

    return (
        <GenericModal
            id='threadInviteModal'
            className='channel-invite'
            show={show}
            onHide={onHide}
            onExited={onExited}
            modalHeaderText={
                <FormattedMessage
                    id='thread_invite.title'
                    defaultMessage='Add people to follow this thread'
                />
            }
            compassDesign={true}
            bodyOverflowVisible={true}
        >
            <div className='channel-invite__wrapper'>
                {inviteError && <label className='has-error control-label'>{inviteError}</label>}
                <div className='channel-invite__content'>
                    <MultiSelect
                        key='addUsersToThreadKey'
                        options={options}
                        optionRenderer={renderOption}
                        intl={intl}
                        selectedItemRef={selectedItemRef}
                        values={selectedUsers}
                        ariaLabelRenderer={renderAriaLabel}
                        saveButtonPosition='bottom'
                        perPage={USERS_PER_PAGE}
                        handleInput={search}
                        handleDelete={handleDelete}
                        handleAdd={addValue}
                        handleSubmit={handleSubmit}
                        handleCancel={onHide}
                        buttonSubmitText={buttonSubmitText}
                        buttonSubmitLoadingText={buttonSubmitLoadingText}
                        saving={saving}
                        loading={loadingUsers}
                        placeholderText={defineMessage({id: 'thread_invite.placeholder', defaultMessage: 'Search for people'})}
                        valueWithImage={true}
                        backButtonText={defineMessage({id: 'multiselect.cancel', defaultMessage: 'Cancel'})}
                        backButtonClick={onHide}
                        backButtonClass='btn-tertiary tertiary-button'
                    />
                </div>
            </div>
        </GenericModal>
    );
}
