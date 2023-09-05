// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useRef, useState} from 'react';
import {Overlay} from 'react-bootstrap';

import {Client4} from 'mattermost-redux/client';
import {displayUsername} from 'mattermost-redux/utils/user_utils';
import {UserProfile} from '@mattermost/types/users';
import {Group} from '@mattermost/types/groups';

import ProfilePopover from 'components/profile_popover';
import UserGroupPopover from 'components/user_group_popover';

import {popOverOverlayPosition, approxGroupPopOverHeight} from 'utils/position_utils';
import {isKeyPressed} from 'utils/keyboard';
import {getMentionDetails} from 'utils/post_utils';
import Constants, {A11yCustomEventTypes, A11yFocusEventDetail} from 'utils/constants';
import {getViewportSize} from 'utils/utils';

import {MAX_LIST_HEIGHT, getListHeight, VIEWPORT_SCALE_FACTOR} from 'components/user_group_popover/group_member_list/group_member_list';

const HEADER_HEIGHT_ESTIMATE = 130;

type Props = {
    currentUserId: string;
    mentionName: string;
    teammateNameDisplay: string;
    usersByUsername: Record<string, UserProfile>;
    groupsByName: Record<string, Group>;
    children?: React.ReactNode;
    channelId?: string;
    hasMention?: boolean;
    disableHighlight?: boolean;
    disableGroupHighlight?: boolean;
}

export const AtMention = (props: Props) => {
    const ref = useRef<HTMLAnchorElement>(null);

    const [show, setShow] = useState(false);
    const [groupUser, setGroupUser] = useState<UserProfile | undefined>();
    const [target, setTarget] = useState<HTMLAnchorElement | undefined>();
    const [placement, setPlacement] = useState('right');

    const showOverlay = (target?: HTMLAnchorElement, group?: Group | '') => {
        const targetBounds = ref.current?.getBoundingClientRect();

        if (targetBounds) {
            let popOverHeight: number;

            if (group) {
                popOverHeight = approxGroupPopOverHeight(
                    getListHeight(group.member_count),
                    getViewportSize().h,
                    VIEWPORT_SCALE_FACTOR,
                    HEADER_HEIGHT_ESTIMATE,
                    MAX_LIST_HEIGHT,
                );
            } else {
                popOverHeight = getViewportSize().h - 240;
            }

            const placement = popOverOverlayPosition(targetBounds, getViewportSize().h, popOverHeight);

            setTarget(target);
            setShow(!show);
            setGroupUser(undefined);
            setPlacement(placement);
        }
    };

    const handleClick = (group: Group | '') => (e: React.MouseEvent<HTMLAnchorElement>) => {
        e.preventDefault();
        showOverlay(e.target as HTMLAnchorElement, group);
    };

    const handleKeyDown = (group: Group | '') => (e: React.KeyboardEvent<HTMLAnchorElement>) => {
        if (isKeyPressed(e, Constants.KeyCodes.ENTER) || isKeyPressed(e, Constants.KeyCodes.SPACE)) {
            e.preventDefault();

            // Prevent propagation so that the message textbox isn't focused
            e.stopPropagation();
            showOverlay(e.target as HTMLAnchorElement, group);
        }
    };

    const hideOverlay = () => {
        setShow(false);
    };

    const showGroupUserOverlay = (user: UserProfile) => {
        hideOverlay();
        setGroupUser(user);
    };

    const hideGroupUserOverlay = () => {
        setGroupUser(undefined);
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

    const getPopOver = (user: UserProfile | '', group: Group | '') => {
        if (user) {
            return (
                <ProfilePopover
                    className='user-profile-popover'
                    userId={user.id}
                    src={Client4.getProfilePictureUrl(user.id, user.last_picture_update)}
                    hasMention={props.hasMention}
                    hide={hideOverlay}
                    channelId={props.channelId}
                />
            );
        }

        if (group) {
            return (
                <UserGroupPopover
                    group={group}
                    hide={hideOverlay}
                    showUserOverlay={showGroupUserOverlay}
                    returnFocus={returnFocus}
                />
            );
        }

        return '';
    };

    const [user, group] = getMentionDetails(props.mentionName, props.usersByUsername, props.groupsByName, props.disableGroupHighlight);

    if (!user && !group) {
        return <>{props.children}</>;
    }

    let suffix = '';
    let displayName = '';
    let highlightMention = false; // only for user

    if (user) {
        suffix = props.mentionName.substring(user.username.length);
        displayName = displayUsername(user, props.teammateNameDisplay);
        highlightMention = !props.disableHighlight && user.id === props.currentUserId;
    } else if (group) { // if statement needed for union
        suffix = props.mentionName.substring(group.name.length);
        displayName = group.name;
    }

    return (
        <>
            <span
                className={highlightMention ? 'mention--highlight' : undefined}
            >
                <Overlay
                    placement={placement}
                    show={show}
                    target={target}
                    rootClose={true}
                    onHide={hideOverlay}
                >
                    {getPopOver(user, group)}
                </Overlay>
                <Overlay
                    placement={placement}
                    show={groupUser !== undefined}
                    target={target}
                    onHide={hideGroupUserOverlay}
                    rootClose={true}
                >
                    {groupUser ? ( // needed for type checker
                        <ProfilePopover
                            className='user-profile-popover'
                            userId={groupUser.id}
                            src={Client4.getProfilePictureUrl(groupUser.id, groupUser.last_picture_update)}
                            channelId={props.channelId}
                            hasMention={props.hasMention}
                            hide={hideGroupUserOverlay}
                            returnFocus={returnFocus}
                        />
                    ) : ''
                    }
                </Overlay>
                <a
                    onClick={handleClick(group)}
                    onKeyDown={handleKeyDown(group)}
                    className={group ? 'group-mention-link' : 'mention-link'}
                    ref={ref}
                    aria-haspopup='dialog'
                    role='button'
                    tabIndex={0}
                >
                    {'@' + displayName}
                </a>
            </span>
            {suffix}
        </>
    );
};

export default AtMention;
