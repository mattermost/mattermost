// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useIntl} from 'react-intl';
import {useSelector} from 'react-redux';

import {trackEvent} from 'actions/telemetry_actions.jsx';
import {getExpandSeatsLink} from 'selectors/cloud';

type UseExpandOverageUsersCheckArgs = {
    isWarningState: boolean;
    banner: 'global banner' | 'invite modal';
}

export const useExpandOverageUsersCheck = ({
    isWarningState,
    banner,
}: UseExpandOverageUsersCheckArgs) => {
    const {formatMessage} = useIntl();
    const expandableLink = useSelector(getExpandSeatsLink);

    const cta = formatMessage({
        id: 'licensingPage.overageUsersBanner.cta',
        defaultMessage: 'Contact Sales',
    });

    const trackEventFn = (cta: 'Contact Sales' | 'Self Serve') => {
        trackEvent('insights', isWarningState ? 'click_true_up_warning' : 'click_true_up_error', {
            cta,
            banner,
        });
    };

    return {
        cta,
        expandableLink,
        trackEventFn,
    };
};
