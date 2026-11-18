// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {useCallback, useEffect, useRef, useState} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';

import {BookmarkIcon, BookmarkOutlineIcon} from '@mattermost/compass-icons/components';
import {Icon} from '@mattermost/compass-ui/components/icon';
import {IconButton} from '@mattermost/compass-ui/components/icon-button';
import {WithTooltip} from '@mattermost/shared/components/tooltip';

import {Locations, A11yCustomEventTypes} from 'utils/constants';

export type Actions = {
    flagPost: (postId: string) => void;
    unflagPost: (postId: string) => void;
};

type Props = {
    location?: keyof typeof Locations;
    postId: string;
    isFlagged: boolean;
    actions: Actions;
};

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

        const button = buttonRef.current;
        if (button) {
            button.addEventListener(A11yCustomEventTypes.ACTIVATE, handleA11yActivateEvent);
            button.addEventListener(A11yCustomEventTypes.DEACTIVATE, handleA11yDeactivateEvent);
        }
        return () => {
            if (button) {
                button.removeEventListener(A11yCustomEventTypes.ACTIVATE, handleA11yActivateEvent);
                button.removeEventListener(A11yCustomEventTypes.DEACTIVATE, handleA11yDeactivateEvent);
            }
        };
    }, []);

    useEffect(() => {
        if (a11yActive && buttonRef.current) {
            buttonRef.current.dispatchEvent(new Event(A11yCustomEventTypes.UPDATE));
        }
    }, [a11yActive]);

    const label = isFlagged ? intl.formatMessage({id: 'flag_post.unflag', defaultMessage: 'Remove from Saved'}) : intl.formatMessage({id: 'flag_post.flag', defaultMessage: 'Save Message'});

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
            <IconButton
                ref={buttonRef}
                id={`${location}_flagIcon_${postId}`}
                size='small'
                padding='compact'
                className={classNames('post-menu__item', {
                    'post-menu__item--active': isFlagged,
                })}
                icon={<Icon glyph={isFlagged ? <BookmarkIcon/> : <BookmarkOutlineIcon/>}/>}
                active={isFlagged}
                aria-label={label.toLowerCase()}
                onClick={handlePress}
            />
        </WithTooltip>
    );
};

export default React.memo(PostFlagIcon);
