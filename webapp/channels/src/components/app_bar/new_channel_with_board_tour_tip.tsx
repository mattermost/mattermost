// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useState} from 'react';
import {FormattedMessage} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';
import type {Placement} from 'tippy.js';

import {TourTip, useMeasurePunchouts} from '@mattermost/components';

import {setNewChannelWithBoardPreference} from 'mattermost-redux/actions/boards';
import {Preferences} from 'mattermost-redux/constants';

import {showNewChannelWithBoardPulsatingDot} from 'selectors/plugins';

type Props = {
    pulsatingDotPlacement?: Omit<Placement, 'auto'| 'auto-end'>;
    pulsatingDotTranslate?: {x: number; y: number};
}

const NewChannelWithBoardTourTip = ({
    pulsatingDotPlacement = 'left',
    pulsatingDotTranslate,
}: Props): JSX.Element | null => {
    const dispatch = useDispatch();
    const showTip = useSelector(showNewChannelWithBoardPulsatingDot);

    const title = (
        <FormattedMessage
            id='newChannelWithBoard.tutorialTip.title'
            defaultMessage='Access linked boards from the App Bar'
        />
    );

    const screen = (
        <FormattedMessage
            id='newChannelWithBoard.tutorialTip.description'
            defaultMessage='The board you just created can be quickly accessed by clicking on the Boards icon in the App bar. You can view the boards that are linked to this channel in the right-hand sidebar and open one in full view.'
        />
    );

    const [tipOpened, setTipOpened] = useState(showTip);

    const handleDismiss = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        setTipOpened(false);
        dispatch(setNewChannelWithBoardPreference({[Preferences.NEW_CHANNEL_WITH_BOARD_TOUR_SHOWED]: true}));
    }, []);

    const handleOpen = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();

        if (tipOpened) {
            dispatch(setNewChannelWithBoardPreference({[Preferences.NEW_CHANNEL_WITH_BOARD_TOUR_SHOWED]: true}));
            setTipOpened(false);
        } else {
            setTipOpened(true);
        }
    }, []);

    const overlayPunchOut = useMeasurePunchouts(['app-bar-icon-focalboard'], [], {y: -2, height: 4, x: 0, width: 0});

    if (!showTip) {
        return null;
    }

    return (
        <TourTip
            show={true}
            screen={screen}
            title={title}
            overlayPunchOut={overlayPunchOut}
            placement='right-start'
            pulsatingDotPlacement={pulsatingDotPlacement}
            step={1}
            singleTip={true}
            showOptOut={false}
            interactivePunchOut={true}
            handleDismiss={handleDismiss}
            handleOpen={handleOpen}
            handlePrevious={handleDismiss}
            offset={[-30, 5]}
            pulsatingDotTranslate={pulsatingDotTranslate}
        />
    );
};

export default NewChannelWithBoardTourTip;
