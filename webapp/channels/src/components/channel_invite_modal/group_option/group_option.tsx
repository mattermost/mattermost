// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback} from 'react';
import {useDispatch, useSelector} from 'react-redux';
import {FormattedMessage} from 'react-intl';

import {Group} from '@mattermost/types/groups';
import {AccountMultipleOutlineIcon} from '@mattermost/compass-icons/components';
import {getProfileSetNotInCurrentTeam, makeGetProfilesByIdsAndUsernames} from 'mattermost-redux/selectors/entities/users';
import {GlobalState} from '@mattermost/types/store';
import { UserProfile } from '@mattermost/types/users';
import { Value } from 'components/multiselect/multiselect';
import Avatars from 'components/widgets/users/avatars';

type UserProfileValue = Value & UserProfile;
type GroupValue = Value & Group;

export type Props = {
    group: GroupValue;
    isSelected: boolean;
    rowSelected: string;
    selectedItemRef: React.RefObject<HTMLDivElement>;
    onMouseMove: (group: GroupValue) => void;
    addUserProfile: (profile: UserProfileValue[]) => void;
}

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
    const profilesNotInCurrentTeam = useSelector(getProfileSetNotInCurrentTeam)

    const onAdd = useCallback(() => {
        addUserProfile(profiles);
    }, [addUserProfile, profiles]);

    return (
        <div
            key={group.id}
            ref={isSelected ? selectedItemRef : undefined}
            className={'more-modal__row clickable ' + rowSelected}
            onClick={onAdd}
            onMouseMove={() => onMouseMove(group)}
        >
            <span 
                style={{
                    width: '32px',
                    minWidth: '32px',
                    height: '32px',
                    background: 'rgba(var(--center-channel-color-rgb), 0.08)',
                    display: 'flex',
                    borderRadius: '30px',
                }}
            >
                <span
                    style={{
                        margin: '8px auto',
                        display: 'block',
                        alignSelf: 'center',
                    }}
                >
                    <AccountMultipleOutlineIcon
                        size={16}
                        color={'rgba(var(--center-channel-color-rgb), 0.56)'}
                    />
                </span>
            </span>
            <div className='more-modal__details'>
                <div className='more-modal__name'>
                    <span className='group-display-name'>
                        {group.display_name}
                    </span>
                    <span
                        className='ml-2 light'
                        style={{
                            fontSize: '12px',
                            lineHeight: '20px',
                        }}
                    >
                        {'@'}{group.name}
                    </span>
                    <span
                        style={{
                            minWidth: '110px',
                            color: 'var(--link-color)',
                            display: 'flex',
                            marginLeft: 'auto',
                            lineHeight: '20px',
                        }}
                        className='add-group-members'
                    >
                        {/* <FormattedMessage
                            id='multiselect.addGroupMembers'
                            defaultMessage='Add {number} people'
                            values={{
                                number: group.member_count,
                            }}
                        /> */}
                        {group.member_ids && 
                            <Avatars
                                userIds={group.member_ids}
                                size='xs'
                                disableProfileOverlay={true}
                            />
                        }
                    </span>
                </div>
            </div>
        </div>
    );
};

export default React.memo(GroupOption);
