// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {useRef, useMemo, memo, useEffect} from 'react';

import {Client4} from 'mattermost-redux/client';
import {displayUsername} from 'mattermost-redux/utils/user_utils';

import {useRemoteClusters} from 'components/admin_console/secure_connections/utils';
import ProfilePopover from 'components/profile_popover';
import UserGroupPopover from 'components/user_group_popover';

import type {A11yFocusEventDetail} from 'utils/constants';
import {A11yCustomEventTypes} from 'utils/constants';
import {getUserOrGroupFromMentionName} from 'utils/post_utils';

import type {PropsFromRedux} from './index';

type OwnProps = {
    mentionName: string;
    children?: React.ReactNode;
    channelId?: string;
    disableHighlight?: boolean;
    disableGroupHighlight?: boolean;
    fetchMissingUsers?: boolean;
}

type Props = OwnProps & PropsFromRedux;

const AtMention = (props: Props) => {
    const ref = useRef<HTMLAnchorElement>(null);
    const [remoteClusters] = useRemoteClusters();

    const [user, group] = useMemo(
        () => {
            // Debug logging for remote mention issues
            if (props.mentionName.includes(':')) {
                console.log('AtMention processing:', props.mentionName);
                console.log('RemoteClusters from hook:', remoteClusters);
            }
            
            return getUserOrGroupFromMentionName(
                props.mentionName,
                props.usersByUsername,
                props.groupsByName,
                props.disableGroupHighlight,
                undefined,
                remoteClusters,
            );
        },
        [props.mentionName, props.usersByUsername, props.groupsByName, props.disableGroupHighlight, remoteClusters],
    );

    useEffect(() => {
        if (!user && !group && props.fetchMissingUsers) {
            props.getMissingMentionedUsers(props.mentionName);
        }
    }, [props.mentionName]);

    const returnFocus = () => {
        document.dispatchEvent(new CustomEvent<A11yFocusEventDetail>(
            A11yCustomEventTypes.FOCUS, {
                detail: {
                    target: ref.current,
                    keyboardOnly: true,
                },
            },
        ));
    };

    if (user) {
        const userMentionNameSuffix = props.mentionName.substring(user.username.length);
        const userDisplayName = displayUsername(user, props.teammateNameDisplay);
        const highlightMention = !props.disableHighlight && user.id === props.currentUserId;

        return (
            <>
                <ProfilePopover
                    triggerComponentClass={classNames('style--none', {'mention--highlight': highlightMention})}
                    userId={user.id}
                    src={Client4.getProfilePictureUrl(user.id, user.last_picture_update)}
                    channelId={props.channelId}
                    returnFocus={returnFocus}
                    triggerComponentAs='button'
                >
                    <span
                        ref={ref}
                        className='mention-link'
                    >
                        {'@' + userDisplayName}
                    </span>
                </ProfilePopover>
                {userMentionNameSuffix}
            </>
        );
    } else if (group) {
        const groupMentionNameSuffix = props.mentionName.substring(group.name.length);
        const groupDisplayName = group.name;

        return (
            <>
                <UserGroupPopover
                    group={group}
                    returnFocus={returnFocus}
                >
                    <a
                        ref={ref}
                        className='group-mention-link'
                        role='button'
                        tabIndex={0}
                    >
                        {'@' + groupDisplayName}
                    </a>
                </UserGroupPopover>
                {groupMentionNameSuffix}
            </>
        );
    }

    return <>{props.children}</>;
};

export default memo(AtMention);
