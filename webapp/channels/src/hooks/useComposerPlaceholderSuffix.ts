// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useIntl} from 'react-intl';
import {useSelector} from 'react-redux';

import {getComposerPlaceholderSuffix} from 'selectors/composer_placeholder_suffix';

import type {GlobalState} from 'types/store';

export function useComposerPlaceholderSuffix(
    channelId: string | null | undefined,
): string {
    const intl = useIntl();
    return useSelector((state: GlobalState) => {
        if (!channelId) {
            return '';
        }
        return getComposerPlaceholderSuffix(state, channelId, intl);
    });
}
