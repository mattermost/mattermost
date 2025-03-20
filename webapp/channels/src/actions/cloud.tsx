// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ServerError} from '@mattermost/types/errors';

import {CloudTypes} from 'mattermost-redux/action_types';
import {getCloudCustomer, getCloudProducts, getCloudSubscription, getInvoices} from 'mattermost-redux/actions/cloud';
import {Client4} from 'mattermost-redux/client';
import {getCloudErrors} from 'mattermost-redux/selectors/entities/cloud';

import {trackEvent} from 'actions/telemetry_actions.jsx';

import type {ActionFunc, ThunkActionFunc} from 'types/store';

export function getInstallation() {
    return async () => {
        try {
            const installation = await Client4.getInstallation();
            return {data: installation};
        } catch (e: any) {
            return {error: e.message};
        }
    };
}

export function validateBusinessEmail(email = '') {
    trackEvent('api', 'api_validate_business_email');
    return async () => {
        try {
            const res = await Client4.validateBusinessEmail(email);
            return res.data.is_valid;
        } catch (error) {
            return false;
        }
    };
}

export function validateWorkspaceBusinessEmail() {
    trackEvent('api', 'api_validate_workspace_business_email');
    return async () => {
        try {
            const res = await Client4.validateWorkspaceBusinessEmail();
            return res.data.is_valid;
        } catch (error) {
            return false;
        }
    };
}

export function getCloudLimits(): ThunkActionFunc<Promise<boolean | ServerError>> {
    return async (dispatch) => {
        try {
            dispatch({
                type: CloudTypes.CLOUD_LIMITS_REQUEST,
            });
            const result = await Client4.getCloudLimits();
            if (result) {
                dispatch({
                    type: CloudTypes.RECEIVED_CLOUD_LIMITS,
                    data: result,
                });
            }
        } catch (error) {
            dispatch({
                type: CloudTypes.CLOUD_LIMITS_FAILED,
            });
            return error;
        }
        return true;
    };
}

export function getMessagesUsage(): ThunkActionFunc<Promise<boolean | ServerError>> {
    return async (dispatch) => {
        try {
            const result = await Client4.getPostsUsage();
            if (result) {
                dispatch({
                    type: CloudTypes.RECEIVED_MESSAGES_USAGE,
                    data: result.count,
                });
            }
        } catch (error) {
            return error;
        }
        return true;
    };
}

export function getFilesUsage(): ThunkActionFunc<Promise<boolean | ServerError>> {
    return async (dispatch) => {
        try {
            const result = await Client4.getFilesUsage();

            if (result) {
                // match limit notation in bits
                const inBits = result.bytes * 8;
                dispatch({
                    type: CloudTypes.RECEIVED_FILES_USAGE,
                    data: inBits,
                });
            }
        } catch (error) {
            return error;
        }
        return {data: true};
    };
}

export function getTeamsUsage(): ThunkActionFunc<Promise<boolean | ServerError>> {
    return async (dispatch) => {
        try {
            const result = await Client4.getTeamsUsage();
            if (result) {
                dispatch({
                    type: CloudTypes.RECEIVED_TEAMS_USAGE,
                    data: {active: result.active, cloudArchived: result.cloud_archived},
                });
            }
        } catch (error) {
            return error;
        }
        return {data: false};
    };
}

export function retryFailedCloudFetches(): ActionFunc<boolean> {
    return (dispatch, getState) => {
        const errors = getCloudErrors(getState());
        if (Object.keys(errors).length === 0) {
            return {data: true};
        }

        if (errors.subscription) {
            dispatch(getCloudSubscription());
        }

        if (errors.products) {
            dispatch(getCloudProducts());
        }

        if (errors.customer) {
            dispatch(getCloudCustomer());
        }

        if (errors.invoices) {
            dispatch(getInvoices());
        }

        if (errors.limits) {
            dispatch(getCloudLimits());
        }

        return {data: true};
    };
}
