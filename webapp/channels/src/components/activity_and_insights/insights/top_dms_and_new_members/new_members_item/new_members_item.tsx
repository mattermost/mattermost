// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {memo, useCallback} from 'react';
import {useSelector} from 'react-redux';
import {FormattedMessage} from 'react-intl';
import {Link} from 'react-router-dom';

import {trackEvent} from 'actions/telemetry_actions';

import {getTeammateNameDisplaySetting} from 'mattermost-redux/selectors/entities/preferences';
import {getUser} from 'mattermost-redux/selectors/entities/users';

import {UserProfile} from '@mattermost/types/users';
import {NewMember} from '@mattermost/types/insights';
import {GlobalState} from '@mattermost/types/store';
import {Team} from '@mattermost/types/teams';

import {displayUsername} from 'mattermost-redux/utils/user_utils';

import Avatar from 'components/widgets/users/avatar';
import RenderEmoji from 'components/emoji/render_emoji';

import {imageURLForUser} from 'utils/utils';

import './../../../activity_and_insights.scss';

type Props = {
    newMember: NewMember;
    team: Team;
}

const NewMembersItem = ({newMember, team}: Props) => {
    const teammateNameDisplaySetting = useSelector(getTeammateNameDisplaySetting);
    const user = useSelector((state: GlobalState) => getUser(state, newMember.id)) as UserProfile;

    let member = newMember;
    if (user) {
        member = {
            ...member,
            username: user.username,
            first_name: user.first_name,
            last_name: user.last_name,
            nickname: user.nickname,
            last_picture_update: user.last_picture_update,
        };
    }

    const trackClick = useCallback(() => {
        trackEvent('insights', 'open_new_members_from_new_members_widget');
    }, []);

    return (
        <Link
            className='top-dms-item new-members-item'
            onClick={trackClick}
            to={`/${team.name}/messages/@${member.username}`}
        >
            <Avatar
                url={imageURLForUser(member.id, member.last_picture_update || 0)}
                size={'xl'}
            />
            <div className='dm-info'>
                <div className='dm-name'>
                    {displayUsername(member as UserProfile, teammateNameDisplaySetting)}
                </div>
                <span className='dm-role'>{member.position}</span>
                <div className='channel-message-count'>
                    <RenderEmoji
                        emojiName={'wave'}
                        size={14}
                    />
                    <div className='say-hello'>
                        <FormattedMessage
                            id='insights.newMembers.sayHello'
                            defaultMessage='Say hello'
                        />
                    </div>
                </div>
            </div>
        </Link>
    );
};

export default memo(NewMembersItem);
