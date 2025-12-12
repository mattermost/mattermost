// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useState} from 'react';
import {FormattedMessage} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';

import {TourTip, useMeasurePunchouts} from '@mattermost/components';

import {savePreferences} from 'mattermost-redux/actions/preferences';
import {getCurrentUserId} from 'mattermost-redux/selectors/entities/common';

import {hasSeenBurnOnReadTourTip, BURN_ON_READ_TOUR_TIP_PREFERENCE, getBurnOnReadDurationMinutes} from 'selectors/burn_on_read';

import BurnOnReadSVG from './burn_on_read.svg';

import './burn_on_read_tour_tip.scss';

type Props = {

    // Callback when user clicks "Try it out" button to enable BoR
    onTryItOut: () => void;
}

const BurnOnReadTourTip = ({onTryItOut}: Props) => {
    const dispatch = useDispatch();
    const currentUserId = useSelector(getCurrentUserId);
    const hasSeenTip = useSelector(hasSeenBurnOnReadTourTip);
    const durationMinutes = useSelector(getBurnOnReadDurationMinutes);

    // Track whether the pulsating dot has been clicked
    const [showTourTip, setShowTourTip] = useState(false);

    // Measure the button position - targeting the button element
    const overlayPunchOut = useMeasurePunchouts(['burnOnReadButton'], []);

    // Save preference that user has seen the tour tip
    const markTourTipAsSeen = useCallback(() => {
        const preferences = [{
            user_id: currentUserId,
            category: BURN_ON_READ_TOUR_TIP_PREFERENCE,
            name: currentUserId,
            value: '1',
        }];
        dispatch(savePreferences(currentUserId, preferences));
    }, [currentUserId, dispatch]);

    // Handle pulsating dot click - show the tour tip
    const handleOpen = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setShowTourTip(true);
    }, []);

    // Handle "Dismiss" button
    const handleDismiss = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        markTourTipAsSeen();
        setShowTourTip(false);
    }, [markTourTipAsSeen]);

    // Handle "Try it out" button
    const handleTryItOut = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        markTourTipAsSeen();
        onTryItOut();
    }, [markTourTipAsSeen, onTryItOut]);

    // Don't show tour tip if already seen
    if (hasSeenTip) {
        return null;
    }

    const title = (
        <div className='BurnOnReadTourTip__title'>
            <FormattedMessage
                id='burn_on_read.tour_tip.title'
                defaultMessage='Burn-on-read messages'
            />
            <span className='BurnOnReadTourTip__badge'>
                <FormattedMessage
                    id='burn_on_read.tour_tip.badge'
                    defaultMessage='NEW'
                />
            </span>
        </div>
    );

    const screen = (
        <>
            <p>
                <FormattedMessage
                    id='burn_on_read.tour_tip.description'
                    defaultMessage='Burn-on-read messages are sent in a masked state. Recipients must click on them to reveal the actual message contents. They will be deleted automatically for each recipient {duration} minutes after being opened.'
                    values={{duration: durationMinutes}}
                />
            </p>
            <div className='BurnOnReadTourTip__demo'>
                <BurnOnReadSVG/>
            </div>
        </>
    );

    // Custom dismiss button
    const dismissBtn = (
        <FormattedMessage
            id='burn_on_read.tour_tip.dismiss'
            defaultMessage='Dismiss'
        />
    );

    // Custom "Try it out" button
    const tryItOutBtn = (
        <FormattedMessage
            id='burn_on_read.tour_tip.try_it_out'
            defaultMessage='Try it out'
        />
    );

    return (
        <TourTip
            show={showTourTip}
            screen={screen}
            title={title}
            overlayPunchOut={overlayPunchOut}
            placement='top-start'
            pulsatingDotPlacement='top-start'
            pulsatingDotTranslate={{x: 7, y: 0}}
            step={1}
            singleTip={true}
            showOptOut={false}
            interactivePunchOut={false}
            handleOpen={handleOpen}
            handleDismiss={handleDismiss}
            handlePrevious={handleDismiss}
            handleNext={handleTryItOut}
            prevBtn={dismissBtn}
            nextBtn={tryItOutBtn}
            width={352}
            tippyBlueStyle={true}
            hideBackdrop={true}
            className='BurnOnReadTourTip'
        />
    );
};

export default BurnOnReadTourTip;
