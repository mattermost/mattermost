// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Group, GroupSource} from '@mattermost/types/groups';
import {UserProfile} from '@mattermost/types/users';
import React, {useCallback} from 'react';

import {ActionResult} from 'mattermost-redux/types/actions';

import LocalizedIcon from 'components/localized_icon';
import Avatar from 'components/widgets/users/avatar';

import {t} from 'utils/i18n';
import * as Utils from 'utils/utils';

export type Props = {
    groupId: string;
    user: UserProfile;
    group: Group;
    decrementMemberCount: () => void;
    permissionToLeaveGroup: boolean;
    actions: {
        removeUsersFromGroup: (groupId: string, userIds: string[]) => Promise<ActionResult>;
    };
}

const ViewUserGroupListItem = (props: Props) => {
    const {
        user,
        group,
        groupId,
    } = props;

    const removeUserFromGroup = useCallback(async () => {
        const {actions, decrementMemberCount} = props;

        await actions.removeUsersFromGroup(groupId, [user.id]).then((data) => {
            if (!data.error) {
                decrementMemberCount();
            }
        });
    }, [user.id, groupId, props.decrementMemberCount, props.actions.removeUsersFromGroup]);

    return (
        <div
            key={user.id}
            className='group-member-row'
        >
            <>
                <Avatar
                    username={user.username}
                    size={'sm'}
                    url={Utils.imageURLForUser(user?.id ?? '')}
                    className={'avatar-post-preview'}
                />
            </>
            <div className='group-member-name'>
                {Utils.getFullName(user)}
            </div>
            <div className='group-member-username'>
                {`@${user.username}`}
            </div>
            {
                (group.source.toLowerCase() !== GroupSource.Ldap && props.permissionToLeaveGroup) &&
                <button
                    type='button'
                    className='remove-group-member btn-icon'
                    aria-label='Close'
                    onClick={removeUserFromGroup}
                >
                    <LocalizedIcon
                        className='icon icon-trash-can-outline'
                        ariaLabel={{id: t('user_groups_modal.goBackLabel'), defaultMessage: 'Back'}}
                    />
                </button>
            }
        </div>
    );
};

export default React.memo(ViewUserGroupListItem);
