// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useEffect} from 'react';
import {useDispatch, useSelector} from 'react-redux';

import {checkCWSAvailability} from 'mattermost-redux/actions/general';
import {getCWSAvailability} from 'mattermost-redux/selectors/entities/general';

export enum CSWAvailabilityCheckTypes {
    Available = 'available',
    Unavailable = 'unavailable',
    Pending = 'pending',
    NotApplicable = 'not_applicable',
}

export default function useCWSAvailabilityCheck(): CSWAvailabilityCheckTypes {
    const dispatch = useDispatch();
    const cwsAvailability = useSelector(getCWSAvailability);

    useEffect(() => {
        // Only check if we haven't checked yet (pending state)
        if (cwsAvailability === 'pending') {
            dispatch(checkCWSAvailability());
        }
    }, [dispatch, cwsAvailability]);

    // Convert the string to the enum value
    switch (cwsAvailability) {
    case 'available':
        return CSWAvailabilityCheckTypes.Available;
    case 'unavailable':
        return CSWAvailabilityCheckTypes.Unavailable;
    case 'not_applicable':
        return CSWAvailabilityCheckTypes.NotApplicable;
    case 'pending':
    default:
        return CSWAvailabilityCheckTypes.Pending;
    }
}
