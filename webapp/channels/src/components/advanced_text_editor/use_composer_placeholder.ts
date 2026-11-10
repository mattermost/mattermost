// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useIntl} from 'react-intl';
import {useSelector} from 'react-redux';

import type {GlobalState} from 'types/store';

import {getComposerPlaceholder} from './composer_placeholder';

// Returns the composer placeholder after applying any plugin-registered transforms for the channel.
// Pass the host-computed placeholder; plugins may append to or replace it. The intl passed to plugin
// transforms carries plugin translations merged via registerTranslations, so plugin message ids
// resolve.
export function useComposerPlaceholder(
    channelId: string | null | undefined,
    basePlaceholder: string,
): string {
    const intl = useIntl();
    return useSelector((state: GlobalState) => getComposerPlaceholder(state, channelId, basePlaceholder, intl));
}
