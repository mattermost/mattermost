// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useState, type JSX} from 'react';
import {FormattedMessage} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';

import {Button} from '@mattermost/compass-ui/components/button';
import type {AccessControlPolicy} from '@mattermost/types/access_control';

import {searchSystemSettingPolicies} from 'mattermost-redux/actions/access_control';
import Permissions from 'mattermost-redux/constants/permissions';
import {getConfig as getAdminConfig} from 'mattermost-redux/selectors/entities/admin';
import {getConfig as getClientConfig, getLicense, isSystemSettingPoliciesEnabled} from 'mattermost-redux/selectors/entities/general';
import {haveISystemPermission} from 'mattermost-redux/selectors/entities/roles';

import BlockableLink from 'components/admin_console/blockable_link';

import {LicenseSkus, getLicenseTier} from 'utils/constants';

import type {GlobalState} from 'types/store';

import {SCOPED_CONFIGURATION_EDIT_ROUTE, getScopedConfigurationPrefillRoute} from './settings';

import './setting_policy_control.scss';

type Props = {
    settingKey: string;
};

export default function SettingPolicyControl({settingKey}: Props): JSX.Element | null {
    const dispatch = useDispatch();

    const isAvailable = useSelector((state: GlobalState) => {
        const license = getLicense(state);
        const isEnterpriseAdvanced = license?.IsLicensed === 'true' &&
            getLicenseTier(license.SkuShortName) >= getLicenseTier(LicenseSkus.EnterpriseAdvanced);
        if (!isEnterpriseAdvanced) {
            return false;
        }

        const adminConfig = getAdminConfig(state);
        const clientConfig = getClientConfig(state);
        const abacEnabled = adminConfig?.AccessControlSettings?.EnableAttributeBasedAccessControl ??
            (clientConfig?.EnableAttributeBasedAccessControl === 'true');
        const flagEnabled = adminConfig?.FeatureFlags?.SystemSettingPolicies ??
            isSystemSettingPoliciesEnabled(state);
        if (!abacEnabled || !flagEnabled) {
            return false;
        }

        return haveISystemPermission(state, {permission: Permissions.MANAGE_SYSTEM});
    });

    const [attachedPolicy, setAttachedPolicy] = useState<AccessControlPolicy | null>(null);
    const [loaded, setLoaded] = useState(false);

    useEffect(() => {
        if (!isAvailable) {
            setAttachedPolicy(null);
            setLoaded(false);
            return undefined;
        }

        let cancelled = false;
        setLoaded(false);
        dispatch(searchSystemSettingPolicies('', '', 1, [settingKey])).then((result) => {
            if (cancelled) {
                return;
            }
            const first = result?.data?.policies?.[0] ?? null;
            setAttachedPolicy(first);
            setLoaded(true);
        }).catch(() => {
            if (!cancelled) {
                setAttachedPolicy(null);
                setLoaded(true);
            }
        });

        return () => {
            cancelled = true;
        };
    }, [dispatch, isAvailable, settingKey]);

    if (!isAvailable || !loaded) {
        return null;
    }

    if (attachedPolicy) {
        return (
            <div
                className='SettingPolicyControl'
                data-testid={`setting-policy-control-${settingKey}`}
            >
                <Button
                    asChild={true}
                    emphasis='tertiary'
                    size='small'
                >
                    <BlockableLink to={`${SCOPED_CONFIGURATION_EDIT_ROUTE}/${attachedPolicy.id}`}>
                        <FormattedMessage
                            id='admin.scoped_configuration.setting_control.view_existing'
                            defaultMessage='View existing policy'
                        />
                    </BlockableLink>
                </Button>
                <span className='SettingPolicyControl__policy-name'>
                    <FormattedMessage
                        id='admin.scoped_configuration.setting_control.policy_name'
                        defaultMessage='Policy: {name}'
                        values={{name: attachedPolicy.name}}
                    />
                </span>
            </div>
        );
    }

    return (
        <div
            className='SettingPolicyControl'
            data-testid={`setting-policy-control-${settingKey}`}
        >
            <Button
                asChild={true}
                emphasis='tertiary'
                size='small'
            >
                <BlockableLink to={getScopedConfigurationPrefillRoute(settingKey)}>
                    <FormattedMessage
                        id='admin.scoped_configuration.setting_control.configure'
                        defaultMessage='Configure with a policy'
                    />
                </BlockableLink>
            </Button>
        </div>
    );
}
