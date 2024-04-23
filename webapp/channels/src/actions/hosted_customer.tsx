// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ServerError} from '@mattermost/types/errors';

import {HostedCustomerTypes} from 'mattermost-redux/action_types';
import {bindClientFunc} from 'mattermost-redux/actions/helpers';
import {Client4} from 'mattermost-redux/client';
import type {ThunkActionFunc} from 'mattermost-redux/types/actions';

export function getSelfHostedProducts(): ThunkActionFunc<Promise<boolean | ServerError>> {
    return async (dispatch) => {
        try {
            dispatch({
                type: HostedCustomerTypes.SELF_HOSTED_PRODUCTS_REQUEST,
            });
            const result = await Client4.getSelfHostedProducts();
            if (result) {
                dispatch({
                    type: HostedCustomerTypes.RECEIVED_SELF_HOSTED_PRODUCTS,
                    data: result,
                });
            }
        } catch (error) {
            dispatch({
                type: HostedCustomerTypes.SELF_HOSTED_PRODUCTS_FAILED,
            });
            return error;
        }
        return true;
    };
}

export function submitTrueUpReview() {
    return bindClientFunc({
        clientFunc: Client4.submitTrueUpReview,
        onSuccess: [HostedCustomerTypes.RECEIVED_TRUE_UP_REVIEW_BUNDLE],
        onFailure: HostedCustomerTypes.TRUE_UP_REVIEW_PROFILE_FAILED,
        onRequest: HostedCustomerTypes.TRUE_UP_REVIEW_PROFILE_REQUEST,
    });
}

export function getTrueUpReviewStatus() {
    return bindClientFunc({
        clientFunc: Client4.getTrueUpReviewStatus,
        onSuccess: [HostedCustomerTypes.RECEIVED_TRUE_UP_REVIEW_STATUS],
        onFailure: HostedCustomerTypes.TRUE_UP_REVIEW_STATUS_FAILED,
        onRequest: HostedCustomerTypes.TRUE_UP_REVIEW_STATUS_REQUEST,
    });
}
