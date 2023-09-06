// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useEffect} from 'react';
import {useSelector} from 'react-redux';
import {FormattedMessage} from 'react-intl';

import {Group} from '@mattermost/types/groups';
import {AccountMultipleOutlineIcon, ChevronRightIcon} from '@mattermost/compass-icons/components';
import {getUser, makeDisplayNameGetter, makeGetProfilesByIdsAndUsernames} from 'mattermost-redux/selectors/entities/users';
import {GlobalState} from '@mattermost/types/store';
import {UserProfile} from '@mattermost/types/users';
import {Value} from 'components/multiselect/multiselect';
import SimpleTooltip from 'components/widgets/simple_tooltip';

import Constants from 'utils/constants';

type UserProfileValue = Value & UserProfile;
type GroupValue = Value & Group;

export type Props = {
    group: GroupValue;
    isSelected: boolean;
    rowSelected: string;
    selectedItemRef: React.RefObject<HTMLDivElement>;
    onMouseMove: (group: GroupValue) => void;
    addUserProfile: (profile: UserProfileValue) => void;
}

const displayNameGetter = makeDisplayNameGetter();

const GroupOption = (props: Props) => {
    const {
        group,
        isSelected,
        rowSelected,
        selectedItemRef,
        onMouseMove,
        addUserProfile,
    } = props;

    const getProfilesByIdsAndUsernames = makeGetProfilesByIdsAndUsernames();

    const profiles = useSelector((state: GlobalState) => getProfilesByIdsAndUsernames(state, {allUserIds: group.member_ids || [], allUsernames: []}) as UserProfileValue[]);
    const overflowNames = useSelector((state: GlobalState) => {
        if (group?.member_ids) {
            return group?.member_ids.map((userId) => displayNameGetter(state, true)(getUser(state, userId))).join(', ');
        }
        return '';
    });

    const onAdd = useCallback(() => {
        for (const profile of profiles) {
            addUserProfile(profile);
        }
    }, [addUserProfile, profiles]);

    const onKeyDown = useCallback((e: KeyboardEvent) => {
        if (e.key === Constants.KeyCodes.ENTER[0] && isSelected) {
            e.stopPropagation();
            onAdd();
        }
    }, [isSelected, onAdd]);

    useEffect(() => {
        // Bind the event listener
        document.addEventListener('keydown', onKeyDown, true);
        return () => {
            // Unbind the event listener on clean up
            document.removeEventListener('keydown', onKeyDown, true);
        };
    }, [isSelected, onKeyDown]);

    return (
        <div
            key={group.id}
            ref={isSelected ? selectedItemRef : undefined}
            className={'more-modal__row clickable ' + rowSelected}
            onClick={onAdd}
            onMouseMove={() => onMouseMove(group)}
        >
            <span
                className='more-modal__group-image'
            >
                <AccountMultipleOutlineIcon
                    size={16}
                    color={'rgba(var(--center-channel-color-rgb), 0.56)'}
                />
            </span>
            <div className='more-modal__details'>
                <div className='more-modal__name'>
                    <span className='group-display-name'>
                        {group.display_name}
                    </span>
                    <span
                        className='ml-2 light group-name'
                    >
                        {'@'}{group.name}
                    </span>
                    <SimpleTooltip
                        id={'usernames-overflow'}
                        content={overflowNames}
                    >
                        <span
                            className='add-group-members'
                        >
                            <FormattedMessage
                                id='multiselect.addGroupMembers'
                                defaultMessage='Add {number} people'
                                values={{
                                    number: group.member_count,
                                }}
                            />
                            <ChevronRightIcon
                                size={20}
                                color={'var(--link-color)'}
                            />
                        </span>
                    </SimpleTooltip>
                </div>
            </div>
        </div>
    );
};

export default React.memo(GroupOption);
