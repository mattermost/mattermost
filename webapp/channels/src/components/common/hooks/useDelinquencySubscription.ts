// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import useGetSubscription from './useGetSubscription';

export const useDelinquencySubscription = () => {
    const subscription = useGetSubscription();

    const isDelinquencySubscription = (): boolean => {
        if (!subscription) {
            return false;
        }

        if (!subscription.delinquent_since) {
            return false;
        }

        return true;
    };

    const isDelinquencySubscriptionHigherThan90Days = (): boolean => {
        if (!isDelinquencySubscription()) {
            return false;
        }

        if (!subscription) {
            return false;
        }

        const delinquencyDate = new Date((subscription.delinquent_since || 0) * 1000);

        const oneDay = 24 * 60 * 60 * 1000; // hours*minutes*seconds*milliseconds
        const today = new Date();
        const diffDays = Math.round(
            Math.abs((today.valueOf() - delinquencyDate.valueOf()) / oneDay),
        );

        return diffDays > 90;
    };

    return {isDelinquencySubscription, isDelinquencySubscriptionHigherThan90Days, subscription};
};
