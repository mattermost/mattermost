// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useEffect} from 'react';

import {getBrowserTimezone} from 'utils/timezone';

// Timezone update frequency in milliseconds (30 minutes)
const TIMEZONE_UPDATE_INTERVAL = 30 * 60 * 1000;

type Props = {
    autoUpdateTimezone: (timezone: string) => void;
};

const TimezoneManager = ({autoUpdateTimezone}: Props): null => {
    const updateTimezone = () => {
        autoUpdateTimezone(getBrowserTimezone());
    };
    
    useEffect(() => {
        // Initial timezone update on mount
        updateTimezone();

        // Setup events that trigger timezone checks
        window.addEventListener('focus', updateTimezone);

        // Set up interval to periodically check timezone
        const intervalId = window.setInterval(updateTimezone, TIMEZONE_UPDATE_INTERVAL);

        // Cleanup
        return () => {
            window.removeEventListener('focus', updateTimezone);
            clearInterval(intervalId);
        };
    }, []);

    return null;
};

export default TimezoneManager;
