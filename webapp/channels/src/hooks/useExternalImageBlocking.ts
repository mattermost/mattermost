// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallowEqual, useSelector} from 'react-redux';

import {getExternalImageBlockingConfig} from 'selectors/general';
import type {ExternalImageBlockingConfig} from 'selectors/general';

export function useExternalImageBlocking(): ExternalImageBlockingConfig {
    return useSelector(getExternalImageBlockingConfig, shallowEqual);
}
