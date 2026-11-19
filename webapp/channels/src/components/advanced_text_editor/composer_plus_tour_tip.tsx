// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useState} from 'react';
import {FormattedMessage} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';

import {TourTip, useMeasurePunchouts} from '@mattermost/components';

import {savePreferences} from 'mattermost-redux/actions/preferences';
import {getCurrentUserId} from 'mattermost-redux/selectors/entities/common';
import {getInt} from 'mattermost-redux/selectors/entities/preferences';

import type {GlobalState} from 'types/store';

export const COMPOSER_PLUS_TOUR_TIP_PREFERENCE = 'composer_plus_tour_tip';

export function hasSeenComposerPlusTourTip(state: GlobalState): boolean {
    const currentUserId = getCurrentUserId(state);
    return getInt(state, COMPOSER_PLUS_TOUR_TIP_PREFERENCE, currentUserId, 0) === 1;
}

const title = (
    <FormattedMessage
        id='textbox.plus_tour.title'
        defaultMessage='Message options moved here'
    />
);

const closedBarScreen = (
    <FormattedMessage
        id='textbox.plus_tour.description'
        defaultMessage='Attach files, add an emoji, set a priority, and open formatting from this button. Skills and AI rewrite show up here when they are available.'
    />
);

const openBarScreen = (
    <FormattedMessage
        id='textbox.plus_tour.description_formatting_open'
        defaultMessage='Attach files from this button. Emoji and message priority are in the formatting bar. Skills and AI rewrite show up here when they are available.'
    />
);

const nextBtn = (
    <FormattedMessage
        id='tutorial_tip.got_it'
        defaultMessage='Got it'
    />
);

type Props = {
    formattingBarOpen: boolean;
};

const ComposerPlusTourTip = ({formattingBarOpen}: Props) => {
    const dispatch = useDispatch();
    const currentUserId = useSelector(getCurrentUserId);
    const [showTourTip, setShowTourTip] = useState(false);
    const overlayPunchOut = useMeasurePunchouts(['agentComposerMenuButton'], []);

    const markSeen = useCallback(() => {
        dispatch(savePreferences(currentUserId, [{
            user_id: currentUserId,
            category: COMPOSER_PLUS_TOUR_TIP_PREFERENCE,
            name: currentUserId,
            value: '1',
        }]));
    }, [currentUserId, dispatch]);

    const handleOpen = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setShowTourTip(true);
    }, []);

    const handleDismiss = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        markSeen();
        setShowTourTip(false);
    }, [markSeen]);

    return (
        <TourTip
            show={showTourTip}
            title={title}
            screen={formattingBarOpen ? openBarScreen : closedBarScreen}
            overlayPunchOut={overlayPunchOut}
            placement='top-start'
            pulsatingDotPlacement='top-end'

            // The 14px hit target sits on the + corner. The visible dot is 12px
            // and flush to that box's top-right, so half of 12 centers it there.
            pulsatingDotTranslate={{x: 6, y: -6}}
            step={0}
            singleTip={true}
            showOptOut={false}
            interactivePunchOut={true}
            hideBackdrop={true}
            tippyBlueStyle={true}
            handleOpen={handleOpen}
            handleDismiss={handleDismiss}
            handleNext={handleDismiss}
            nextBtn={nextBtn}
            width={320}
        />
    );
};

export default ComposerPlusTourTip;
