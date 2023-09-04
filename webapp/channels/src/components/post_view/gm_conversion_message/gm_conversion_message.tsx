// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect} from 'react';
import {Post} from '@mattermost/types/posts';
import {renderUsername} from 'components/post_markdown/system_message_helpers';
import {FormattedMessage, useIntl} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';
import {getMissingProfilesByIds} from 'mattermost-redux/actions/users';
import {makeGetProfilesByIdsAndUsernames} from 'mattermost-redux/selectors/entities/users';
import {GlobalState} from 'types/store';

export type Props = {
    post: Post;
}
function GMConversionMessage(props: Props): JSX.Element {
    const convertedByUserId = props.post.props.convertedByUserId;
    const gmMembersDuringConversionIDs = props.post.props.gmMembersDuringConversionIDs as string[];

    const dispatch = useDispatch();
    const intl = useIntl();

    useEffect(() => {
        dispatch(getMissingProfilesByIds(gmMembersDuringConversionIDs));
    }, [props.post]);

    const userProfiles = useSelector(
        (state: GlobalState) => makeGetProfilesByIdsAndUsernames()(
            state,
            {allUserIds: gmMembersDuringConversionIDs, allUsernames: []},
        ),
    );

    const convertedByUserUsername = userProfiles.find((user) => user.id === convertedByUserId)!.username;
    const gmMembersUsernames = userProfiles.map((user) => renderUsername(user.username));

    if (!convertedByUserId || !gmMembersDuringConversionIDs || gmMembersDuringConversionIDs.length === 0) {
        return (
            <span>{props.post.message}</span>
        );
    }

    return (
        <FormattedMessage
            id='api.channel.group_message_converted_to.private_channel'
            defaultMessage='{convertedBy} created this channel from a group message with {gmMembers}.'
            values={{
                convertedBy: renderUsername(convertedByUserUsername),
                gmMembers: intl.formatList(gmMembersUsernames),
            }}
        />
    );
}

export default GMConversionMessage;
