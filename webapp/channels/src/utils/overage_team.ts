// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {OverActiveUserLimits} from './constants';

type CalculateOverageUsersActivatedArgs = {
    seatsPurchased: number;
    activeUsers: number;
}

export const calculateOverageUserActivated = ({activeUsers, seatsPurchased}: CalculateOverageUsersActivatedArgs) => {
    const minimumOverSeats = Math.ceil(seatsPurchased * OverActiveUserLimits.MIN) + seatsPurchased;
    const maximumOverSeats = Math.ceil(seatsPurchased * OverActiveUserLimits.MAX) + seatsPurchased;
    const isBetween5PercerntAnd10PercentPurchasedSeats = minimumOverSeats <= activeUsers && activeUsers < maximumOverSeats;
    const isOver10PercerntPurchasedSeats = maximumOverSeats <= activeUsers;

    return {
        minimumOverSeats,
        maximumOverSeats,
        isBetween5PercerntAnd10PercentPurchasedSeats,
        isOver10PercerntPurchasedSeats,
    };
};
