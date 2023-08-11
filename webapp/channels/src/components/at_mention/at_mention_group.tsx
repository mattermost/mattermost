// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useRef, useState} from 'react';
import {Overlay} from 'react-bootstrap';

import {Client4} from 'mattermost-redux/client';

import ProfilePopover from 'components/profile_popover';
import UserGroupPopover from 'components/user_group_popover';
import {MAX_LIST_HEIGHT, getListHeight, VIEWPORT_SCALE_FACTOR} from 'components/user_group_popover/group_member_list/group_member_list';

import Constants, {A11yCustomEventTypes} from 'utils/constants';
import {isKeyPressed} from 'utils/keyboard';
import {popOverOverlayPosition} from 'utils/position_utils';
import {getViewportSize} from 'utils/utils';

import type {Group} from '@mattermost/types/groups';
import type {UserProfile} from '@mattermost/types/users';
import type {A11yFocusEventDetail} from 'utils/constants';

const HEADER_HEIGHT_ESTIMATE = 130;

type Props = {

    /**
     * The group corresponding to this mention
     */
    group: Group;

    channelId?: string;
    hasMention?: boolean;
}

const AtMentionGroup = (props: Props) => {
    const {
        group,
        channelId,
        hasMention,
    } = props;

    const ref = useRef<HTMLAnchorElement>(null);

    const [show, setShow] = useState(false);
    const [showUser, setShowUser] = useState<UserProfile | undefined>();
    const [target, setTarget] = useState<HTMLAnchorElement | undefined>();

    // We need a valid placement here to prevent console errors.
    // It will not be used when the overlay is showing.
    const [placement, setPlacement] = useState('top');

    const showOverlay = (target?: HTMLAnchorElement) => {
        const targetBounds = ref.current?.getBoundingClientRect();

        if (targetBounds) {
            const approximatePopoverHeight = Math.min(
                (getViewportSize().h * VIEWPORT_SCALE_FACTOR) + HEADER_HEIGHT_ESTIMATE,
                getListHeight(group.member_count) + HEADER_HEIGHT_ESTIMATE,
                MAX_LIST_HEIGHT,
            );
            const placement = popOverOverlayPosition(targetBounds, window.innerHeight, approximatePopoverHeight);
            setTarget(target);
            setShow(!show);
            setShowUser(undefined);
            setPlacement(placement);
        }
    };

    const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
        e.preventDefault();
        showOverlay(e.target as HTMLAnchorElement);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLAnchorElement>) => {
        if (isKeyPressed(e, Constants.KeyCodes.ENTER) || isKeyPressed(e, Constants.KeyCodes.SPACE)) {
            e.preventDefault();

            // Prevent propagation so that the message textbox isn't focused
            e.stopPropagation();
            showOverlay(e.target as HTMLAnchorElement);
        }
    };

    const hideOverlay = () => {
        setShow(false);
    };

    const showUserOverlay = (user: UserProfile) => {
        hideOverlay();
        setShowUser(user);
    };

    const hideUserOverlay = () => {
        setShowUser(undefined);
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

    return (
        <>
            <Overlay
                placement={placement}
                show={show}
                target={target}
                rootClose={true}
                onHide={hideOverlay}
            >
                <UserGroupPopover
                    group={group}
                    hide={hideOverlay}
                    showUserOverlay={showUserOverlay}
                    returnFocus={returnFocus}
                />
            </Overlay>
            <Overlay
                placement={placement}
                show={showUser !== undefined}
                target={target}
                onHide={hideUserOverlay}
                rootClose={true}
            >
                {showUser ? (
                    <ProfilePopover
                        className='user-profile-popover'
                        userId={showUser.id}
                        src={Client4.getProfilePictureUrl(showUser.id, showUser.last_picture_update)}
                        channelId={channelId}
                        hasMention={hasMention}
                        hide={hideUserOverlay}
                        returnFocus={returnFocus}
                    />
                ) : <span/>
                }
            </Overlay>
            <a
                onClick={handleClick}
                onKeyDown={handleKeyDown}
                className='group-mention-link'
                ref={ref}
                aria-haspopup='dialog'
                role='button'
                tabIndex={0}
            >
                {'@' + group.name}
            </a>
        </>
    );
};

export default React.memo(AtMentionGroup);
