// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';

import {savePreferences} from 'mattermost-redux/actions/preferences';
import {getCurrentUserId} from 'mattermost-redux/selectors/entities/common';

import {hasSeenBurnOnReadTourTip, BURN_ON_READ_TOUR_TIP_PREFERENCE, getBurnOnReadDurationMinutes} from 'selectors/burn_on_read';

import AnchoredTourPoint from 'components/tour_point/anchored_tour_point';

import BurnOnReadSVG from './burn_on_read.svg';

import './burn_on_read_tour_tip.scss';

type Props = {

    // Enables burn-on-read for the draft.
    onTryItOut: () => void;

    // The formatting-bar burn-on-read button. The tip is not mounted while that bar is hidden.
    anchorId?: string;
};

const BurnOnReadTourTip = ({onTryItOut, anchorId = 'burnOnReadButton'}: Props) => {
    const dispatch = useDispatch();
    const intl = useIntl();
    const currentUserId = useSelector(getCurrentUserId);
    const hasSeenTip = useSelector(hasSeenBurnOnReadTourTip);
    const durationMinutes = useSelector(getBurnOnReadDurationMinutes);

    const markTourTipAsSeen = useCallback(() => {
        dispatch(savePreferences(currentUserId, [{
            user_id: currentUserId,
            category: BURN_ON_READ_TOUR_TIP_PREFERENCE,
            name: currentUserId,
            value: '1',
        }]));
    }, [currentUserId, dispatch]);

    const handleTryItOut = useCallback(() => {
        markTourTipAsSeen();
        onTryItOut();
    }, [markTourTipAsSeen, onTryItOut]);

    if (hasSeenTip) {
        return null;
    }

    const title = (
        <span className='BurnOnReadTourTip__title'>
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
        </span>
    );

    return (
        <AnchoredTourPoint
            anchorId={anchorId}
            aim='center'
            testId='burn-on-read-tour'
            className='BurnOnReadTourTip'
            title={title}
            media={<BurnOnReadSVG/>}
            closeLabel={intl.formatMessage({id: 'burn_on_read.tour_tip.dismiss', defaultMessage: 'Dismiss'})}
            onClose={markTourTipAsSeen}
            primaryAction={{
                label: (
                    <FormattedMessage
                        id='burn_on_read.tour_tip.try_it_out'
                        defaultMessage='Try it out'
                    />
                ),
                onClick: handleTryItOut,
            }}
        >
            <FormattedMessage
                id='burn_on_read.tour_tip.description'
                defaultMessage='Burn-on-read messages are sent in a masked state. Recipients must click on them to reveal the actual message contents. They will be deleted automatically for each recipient {duration} minutes after being opened.'
                values={{duration: durationMinutes}}
            />
        </AnchoredTourPoint>
    );
};

export default BurnOnReadTourTip;
