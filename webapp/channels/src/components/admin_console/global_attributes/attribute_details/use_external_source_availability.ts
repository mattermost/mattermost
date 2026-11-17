// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useMemo} from 'react';
import {useSelector} from 'react-redux';

import {getConfig as getAdminConfig} from 'mattermost-redux/selectors/entities/admin';
import {getLicense} from 'mattermost-redux/selectors/entities/general';

import type {GlobalState} from 'types/store';

import type {ExternalSource} from './external_source';

import {it} from '../../admin_definition_helpers';

// Why a source cannot be linked to at the moment.
export type ExternalSourceUnavailableReason = 'flag_off' | 'unlicensed' | 'not_enabled';

// The sources an admin cannot link an attribute to right now, and why. Mirrors
// the server, which syncs OpenID Connect claims only with the
// OpenIdAttributeSync flag on, a license including OpenID Connect, and OpenID
// Connect sign-in enabled. AD/LDAP and SAML are always offered: a link made
// before they are set up waits for them.
export default function useExternalSourceAvailability(): Partial<Record<ExternalSource, ExternalSourceUnavailableReason>> {
    const openid = useSelector((state: GlobalState): ExternalSourceUnavailableReason | undefined => {
        const config = getAdminConfig(state);
        if (!it.configIsTrue('FeatureFlags', 'OpenIdAttributeSync')(config)) {
            return 'flag_off';
        }
        if (!it.licensedForFeature('OpenId')(config, state, getLicense(state))) {
            return 'unlicensed';
        }
        if (!it.configIsTrue('OpenIdSettings', 'Enable')(config)) {
            return 'not_enabled';
        }
        return undefined;
    });

    return useMemo(() => (openid ? {openid} : {}), [openid]);
}
