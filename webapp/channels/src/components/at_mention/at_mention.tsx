// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {useRef, useState, useMemo, type ComponentProps} from 'react';
import {Overlay} from 'react-bootstrap';

import type {Group} from '@mattermost/types/groups';
import type {UserProfile} from '@mattermost/types/users';

import {Client4} from 'mattermost-redux/client';
import {displayUsername} from 'mattermost-redux/utils/user_utils';

import ProfilePopover from 'components/profile_popover';
import UserGroupPopover from 'components/user_group_popover';
import {MAX_LIST_HEIGHT, getListHeight, VIEWPORT_SCALE_FACTOR} from 'components/user_group_popover/group_member_list/group_member_list';

import type {A11yFocusEventDetail} from 'utils/constants';
import Constants, {A11yCustomEventTypes} from 'utils/constants';
import {isKeyPressed} from 'utils/keyboard';
import {popOverOverlayPosition, approxGroupPopOverHeight} from 'utils/position_utils';
import {getUserOrGroupFromMentionName} from 'utils/post_utils';
import {getViewportSize} from 'utils/utils';

const HEADER_HEIGHT_ESTIMATE = 130;

type Props = {
    currentUserId: string;
    mentionName: string;
    teammateNameDisplay: string;
    usersByUsername: Record<string, UserProfile>;
    groupsByName: Record<string, Group>;
    children?: React.ReactNode;
    channelId?: string;
    disableHighlight?: boolean;
    disableGroupHighlight?: boolean;
}

export const AtMention = (props: Props) => {
    const ref = useRef<HTMLAnchorElement>(null);

    const [user, group] = useMemo(
        () => getUserOrGroupFromMentionName(props.mentionName, props.usersByUsername, props.groupsByName, props.disableGroupHighlight),
        [props.mentionName, props.usersByUsername, props.groupsByName, props.disableGroupHighlight],
    );

    const [showGroupPopover, setShowGroupPopover] = useState(false);
    const [targetOfGroupPopover, setTargetOfGroupPopover] = useState<HTMLAnchorElement | undefined>();
    const [placementOfGroupPopover, setPlacementOfGroupPopover] = useState<ComponentProps<typeof Overlay>['placement']>('right');

    const openGroupPopover = (target?: HTMLAnchorElement) => {
        if (!group) {
            return;
        }

        const targetBounds = ref.current?.getBoundingClientRect();
        if (targetBounds) {
            const popOverHeight = approxGroupPopOverHeight(
                getListHeight(group.member_count),
                getViewportSize().h,
                VIEWPORT_SCALE_FACTOR,
                HEADER_HEIGHT_ESTIMATE,
                MAX_LIST_HEIGHT,
            );
            const placementOfGroupPopover = popOverOverlayPosition(targetBounds, getViewportSize().h, popOverHeight);
            setPlacementOfGroupPopover(placementOfGroupPopover);

            setTargetOfGroupPopover(target);
            setShowGroupPopover(!showGroupPopover);
        }
    };

    const hideGroupPopover = () => {
        setShowGroupPopover(false);
    };

    const handleGroupMentionClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
        e.preventDefault();
        openGroupPopover(e.target as HTMLAnchorElement);
    };

    const handleGroupMentionKeyDown = (e: React.KeyboardEvent<HTMLAnchorElement>) => {
        if (isKeyPressed(e, Constants.KeyCodes.ENTER) || isKeyPressed(e, Constants.KeyCodes.SPACE)) {
            e.preventDefault();

            // Prevent propagation so that the message textbox isn't focused
            e.stopPropagation();

            openGroupPopover(e.target as HTMLAnchorElement);
        }
    };

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

    if (!user && !group) {
        return null;
    }

    if (user) {
        const userMentionNameSuffix = props.mentionName.substring(user.username.length);
        const userDisplayName = displayUsername(user, props.teammateNameDisplay);
        const highlightMention = !props.disableHighlight && user.id === props.currentUserId;

        return (
            <>
                <ProfilePopover
                    triggerComponentClass={classNames({'mention--highlight': highlightMention})}
                    userId={user.id}
                    src={Client4.getProfilePictureUrl(user.id, user.last_picture_update)}
                    channelId={props.channelId}
                    returnFocus={returnFocus}
                >
                    <a
                        ref={ref}
                        className='mention-link'
                        role='button'
                        tabIndex={0}
                    >
                        {'@' + userDisplayName}
                    </a>
                </ProfilePopover>
                {userMentionNameSuffix}
            </>
        );
    } else if (group) {
        const groupMentionNameSuffix = props.mentionName.substring(group.name.length);
        const groupDisplayName = group.name;

        return (
            <>
                <span>
                    <Overlay
                        placement={placementOfGroupPopover}
                        show={showGroupPopover}
                        target={targetOfGroupPopover}
                        onHide={hideGroupPopover}
                    >
                        <UserGroupPopover
                            group={group}
                            hide={hideGroupPopover}
                            returnFocus={returnFocus}
                        />
                    </Overlay>
                    <a
                        ref={ref}
                        onClick={handleGroupMentionClick}
                        onKeyDown={handleGroupMentionKeyDown}
                        className='group-mention-link'
                        aria-haspopup='dialog'
                        role='button'
                        tabIndex={0}
                    >
                        {'@' + groupDisplayName}
                    </a>
                </span>
                {groupMentionNameSuffix}
            </>
        );
    }

    return <>{props.children}</>;
};

export default React.memo(AtMention);
