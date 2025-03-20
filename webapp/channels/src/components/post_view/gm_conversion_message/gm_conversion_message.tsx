// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useMemo, useRef} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';

import type {Post} from '@mattermost/types/posts';
import {isStringArray} from '@mattermost/types/utilities';

import {getMissingProfilesByIds} from 'mattermost-redux/actions/users';
import {makeGetProfilesByIdsAndUsernames} from 'mattermost-redux/selectors/entities/users';

import {renderUsername} from 'components/post_markdown/system_message_helpers';

import type {GlobalState} from 'types/store';

export type Props = {
    post: Post;
}
function GMConversionMessage(props: Props): JSX.Element {
    const convertedByUserId = props.post.props.convertedByUserId;
    const gmMembersDuringConversionIDs = isStringArray(props.post.props.gmMembersDuringConversionIDs) ? props.post.props.gmMembersDuringConversionIDs : [];

    const dispatch = useDispatch();
    const intl = useIntl();

    useEffect(() => {
        dispatch(getMissingProfilesByIds(gmMembersDuringConversionIDs));
    }, [props.post]);

    const getProfilesByIdsAndUsernames = useRef(makeGetProfilesByIdsAndUsernames());
    const userProfiles = useSelector(
        (state: GlobalState) => getProfilesByIdsAndUsernames.current(
            state,
            {allUserIds: gmMembersDuringConversionIDs, allUsernames: []},
        ),
    );

    const convertedByUsername = useMemo(() => {
        const convertedByUser = userProfiles.find((user) => user.id === convertedByUserId);

        if (!convertedByUser) {
            return (
                <FormattedMessage
                    id='api.channel.group_message_converted_to.someone'
                    defaultMessage='Someone'
                />
            );
        }
        return renderUsername(convertedByUser.username);
    }, [convertedByUserId, userProfiles]);

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
                convertedBy: convertedByUsername,
                gmMembers: intl.formatList(gmMembersUsernames),
            }}
        />
    );
}

export default GMConversionMessage;
