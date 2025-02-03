// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {useCallback, useEffect, useRef, useState} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';

import FlagIcon from 'components/widgets/icons/flag_icon';
import FlagIconFilled from 'components/widgets/icons/flag_icon_filled';
import WithTooltip from 'components/with_tooltip';

import {Locations, A11yCustomEventTypes} from 'utils/constants';

export type Actions = {
    flagPost: (postId: string) => void;
    unflagPost: (postId: string) => void;
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
    const intl = useIntl();

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
        <WithTooltip
            key={`flagtooltipkey${isFlagged ? 'flagged' : ''}`}
            title={
                isFlagged ? (
                    <FormattedMessage
                        id='flag_post.unflag'
                        defaultMessage='Remove from Saved'
                    />
                ) : (
                    <FormattedMessage
                        id='flag_post.flag'
                        defaultMessage='Save Message'
                    />
                )
            }
        >
            <button
                ref={buttonRef}
                id={`${location}_flagIcon_${postId}`}
                aria-label={isFlagged ? intl.formatMessage({id: 'flag_post.unflag', defaultMessage: 'Remove from Saved'}).toLowerCase() : intl.formatMessage({id: 'flag_post.flag', defaultMessage: 'Save'}).toLowerCase()}
                className='post-menu__item'
                onClick={handlePress}
            >
                {flagIcon}
            </button>
        </WithTooltip>
    );
};

export default React.memo(PostFlagIcon);
