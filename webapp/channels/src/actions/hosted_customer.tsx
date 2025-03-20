// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ServerError} from '@mattermost/types/errors';

import {HostedCustomerTypes} from 'mattermost-redux/action_types';
import {Client4} from 'mattermost-redux/client';

import type {ThunkActionFunc} from 'types/store';

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

