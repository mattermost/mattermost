// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {useCallback, useEffect, useRef, useState} from 'react';
import {FormattedMessage} from 'react-intl';

import type {flagPost, unflagPost} from 'actions/post_actions';

import OverlayTrigger from 'components/overlay_trigger';
import Tooltip from 'components/tooltip';
import FlagIcon from 'components/widgets/icons/flag_icon';
import FlagIconFilled from 'components/widgets/icons/flag_icon_filled';

import Constants, {Locations, A11yCustomEventTypes} from 'utils/constants';
import {t} from 'utils/i18n';
import {localizeMessage} from 'utils/utils';

export type Actions = {
    flagPost: typeof flagPost;
    unflagPost: typeof unflagPost;
}

type Props = {
    location?: keyof typeof Locations;
    postId: string;
    isFlagged: boolean;
    actions: Actions;
}

const PostFlagIcon = ({
    actions: {
        flagPost,
        unflagPost,
    },
    isFlagged,
    postId,
    location = Locations.CENTER,
}: Props) => {
    const buttonRef = useRef<HTMLButtonElement>(null);
    const [a11yActive, setA11yActive] = useState(false);

    const handlePress = useCallback((e: React.MouseEvent) => {
        e.preventDefault();

        if (isFlagged) {
            unflagPost(postId);
        } else {
            flagPost(postId);
        }
    }, [flagPost, unflagPost, postId, isFlagged]);

    useEffect(() => {
        function handleA11yActivateEvent() {
            setA11yActive(true);
        }
        function handleA11yDeactivateEvent() {
            setA11yActive(false);
        }

        if (buttonRef.current) {
            buttonRef.current.addEventListener(A11yCustomEventTypes.ACTIVATE, handleA11yActivateEvent);
            buttonRef.current.addEventListener(A11yCustomEventTypes.DEACTIVATE, handleA11yDeactivateEvent);
        }
        return () => {
            if (buttonRef.current) {
                buttonRef.current.removeEventListener(A11yCustomEventTypes.ACTIVATE, handleA11yActivateEvent);
                buttonRef.current.removeEventListener(A11yCustomEventTypes.DEACTIVATE, handleA11yDeactivateEvent);
            }
        };
    }, []);

    useEffect(() => {
        if (a11yActive && buttonRef.current) {
            buttonRef.current.dispatchEvent(new Event(A11yCustomEventTypes.UPDATE));
        }
    }, [a11yActive]);

    let flagIcon;
    if (isFlagged) {
        flagIcon = <FlagIconFilled className={classNames('icon', 'icon--small', 'icon--small-filled', {'post-menu__item--selected': isFlagged})}/>;
    } else {
        flagIcon = <FlagIcon className={classNames('icon', 'icon--small')}/>;
    }

    return (
        <OverlayTrigger
            className='hidden-xs'
            key={`flagtooltipkey${isFlagged ? 'flagged' : ''}`}
            delayShow={Constants.OVERLAY_TIME_DELAY}
            placement='top'
            overlay={
                <Tooltip
                    id='flagTooltip'
                    className='hidden-xs'
                >
                    <FormattedMessage
                        id={isFlagged ? t('flag_post.unflag') : t('flag_post.flag')}
                        defaultMessage={isFlagged ? 'Remove from Saved' : 'Save'}
                    />
                </Tooltip>
            }
        >
            <button
                ref={buttonRef}
                id={`${location}_flagIcon_${postId}`}
                aria-label={isFlagged ? localizeMessage('flag_post.unflag', 'Remove from Saved').toLowerCase() : localizeMessage('flag_post.flag', 'Save').toLowerCase()}
                className='post-menu__item'
                onClick={handlePress}
            >
                {flagIcon}
            </button>
        </OverlayTrigger>
    );
};

export default React.memo(PostFlagIcon);
