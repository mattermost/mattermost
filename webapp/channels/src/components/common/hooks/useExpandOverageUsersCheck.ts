// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useCallback} from 'react';
import {defineMessage} from 'react-intl';
import {useSelector} from 'react-redux';

import {trackEvent} from 'actions/telemetry_actions.jsx';
import {getExpandSeatsLink} from 'selectors/cloud';

type UseExpandOverageUsersCheckArgs = {
    isWarningState: boolean;
    banner: 'global banner' | 'invite modal';
}

const cta = defineMessage({
    id: 'licensingPage.overageUsersBanner.cta',
    defaultMessage: 'Contact Sales',
});

export const useExpandOverageUsersCheck = ({
    isWarningState,
    banner,
}: UseExpandOverageUsersCheckArgs) => {
    const expandableLink = useSelector(getExpandSeatsLink);

    const trackEventFn = useCallback((cta: 'Contact Sales' | 'Self Serve') => {
        trackEvent('insights', isWarningState ? 'click_true_up_warning' : 'click_true_up_error', {
            cta,
            banner,
        });
    }, [banner, isWarningState]);

    return {
        cta,
        expandableLink,
        trackEventFn,
    };
};
