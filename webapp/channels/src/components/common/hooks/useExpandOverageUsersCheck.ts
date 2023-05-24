// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useEffect, useMemo} from 'react';
import {useIntl} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';

import {GlobalState} from 'types/store';

import {trackEvent} from 'actions/telemetry_actions.jsx';
import {getExpandSeatsLink} from 'selectors/cloud';
import {getLicenseSelfServeStatus} from 'mattermost-redux/actions/cloud';

import {LicenseSelfServeStatusReducer} from '@mattermost/types/cloud';

type UseExpandOverageUsersCheckArgs = {
    isWarningState: boolean;
    shouldRequest: boolean;
    licenseId?: string;
    banner: 'global banner' | 'invite modal';
    canSelfHostedExpand: boolean;
}

export const useExpandOverageUsersCheck = ({
    shouldRequest,
    isWarningState,
    licenseId,
    banner,
    canSelfHostedExpand,
}: UseExpandOverageUsersCheckArgs) => {
    const {formatMessage} = useIntl();
    const dispatch = useDispatch();
    const {getRequestState, is_expandable: isExpandable}: LicenseSelfServeStatusReducer = useSelector((state: GlobalState) => state.entities.cloud.subscriptionStats || {is_expandable: false, getRequestState: 'IDLE'});
    const expandableLink = useSelector(getExpandSeatsLink);

    const cta = useMemo(() => {
        if (isExpandable && !canSelfHostedExpand) {
            return formatMessage({
                id: 'licensingPage.overageUsersBanner.ctaExpandSeats',
                defaultMessage: 'Purchase additional seats',
            });
        } else if (isExpandable && canSelfHostedExpand) {
            return formatMessage({
                id: 'licensingPage.overageUsersBanner.ctaUpdateSeats',
                defaultMessage: 'Update seat count',
            });
        }
        return formatMessage({
            id: 'licensingPage.overageUsersBanner.cta',
            defaultMessage: 'Contact Sales',
        });
    }, [isExpandable]);

    const trackEventFn = (cta: 'Contact Sales' | 'Self Serve') => {
        trackEvent('insights', isWarningState ? 'click_true_up_warning' : 'click_true_up_error', {
            cta,
            banner,
        });
    };

    useEffect(() => {
        if (shouldRequest && licenseId && getRequestState === 'IDLE') {
            dispatch(getLicenseSelfServeStatus());
        }
    }, [dispatch, getRequestState, licenseId, shouldRequest]);

    return {
        cta,
        expandableLink,
        trackEventFn,
        getRequestState,
        isExpandable,
    };
};
