// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {ActionTypes} from 'utils/constants';

export function setEncryptionKeyError(error: string) {
    return {
        type: ActionTypes.ENCRYPTION_KEY_ERROR,
        error,
    };
}

export function clearEncryptionKeyError() {
    return {
        type: ActionTypes.ENCRYPTION_KEY_ERROR_CLEAR,
    };
}
