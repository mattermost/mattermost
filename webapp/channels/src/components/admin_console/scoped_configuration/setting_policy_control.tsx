// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useMemo, useState, type JSX} from 'react';
import {FormattedMessage} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';

import {Button} from '@mattermost/compass-ui/components/button';
import type {AccessControlPolicy} from '@mattermost/types/access_control';

import {getSystemSettingPolicyOrder, searchSystemSettingPolicies} from 'mattermost-redux/actions/access_control';
import Permissions from 'mattermost-redux/constants/permissions';
import {getSystemSettingPolicyOrder as selectSystemSettingPolicyOrder} from 'mattermost-redux/selectors/entities/access_control';
import {getConfig as getAdminConfig} from 'mattermost-redux/selectors/entities/admin';
import {getConfig as getClientConfig, getLicense, isSystemSettingPoliciesEnabled} from 'mattermost-redux/selectors/entities/general';
import {haveISystemPermission} from 'mattermost-redux/selectors/entities/roles';

import BlockableLink from 'components/admin_console/blockable_link';

import {LicenseSkus, getLicenseTier} from 'utils/constants';

import type {GlobalState} from 'types/store';

import {
    SCOPED_CONFIGURATION_EDIT_ROUTE,
    SCOPED_CONFIGURATION_LIST_ROUTE,
    getScopedConfigurationPrefillRoute,
    sortPoliciesByOrder,
} from './settings';

import './setting_policy_control.scss';

type Props = {
    settingKey: string;
};

const POLICY_SEARCH_LIMIT = 100;

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
    const order = useSelector(selectSystemSettingPolicyOrder);

    const [policies, setPolicies] = useState<AccessControlPolicy[]>([]);
    const [loaded, setLoaded] = useState(false);

    useEffect(() => {
        if (!isAvailable) {
            setPolicies([]);
            setLoaded(false);
            return undefined;
        }

        let cancelled = false;
        setLoaded(false);
        Promise.all([
            dispatch(searchSystemSettingPolicies('', '', POLICY_SEARCH_LIMIT, [settingKey])),
            dispatch(getSystemSettingPolicyOrder()),
        ]).then(([result]) => {
            if (cancelled) {
                return;
            }
            setPolicies(result?.data?.policies ?? []);
            setLoaded(true);
        }).catch(() => {
            if (!cancelled) {
                setPolicies([]);
                setLoaded(true);
            }
        });

        return () => {
            cancelled = true;
        };
    }, [dispatch, isAvailable, settingKey]);

    const orderedPolicies = useMemo(() => sortPoliciesByOrder(policies, order), [policies, order]);

    if (!isAvailable || !loaded) {
        return null;
    }

    if (orderedPolicies.length > 0) {
        return (
            <div
                className='SettingPolicyControl SettingPolicyControl--list'
                data-testid={`setting-policy-control-${settingKey}`}
            >
                <span className='SettingPolicyControl__heading'>
                    <FormattedMessage
                        id='admin.scoped_configuration.setting_control.policies_heading'
                        defaultMessage='Policies affecting this setting, in priority order:'
                    />
                </span>
                <ol className='SettingPolicyControl__policies'>
                    {orderedPolicies.map((policy) => (
                        <li key={policy.id}>
                            <BlockableLink to={`${SCOPED_CONFIGURATION_EDIT_ROUTE}/${policy.id}`}>
                                {policy.name}
                            </BlockableLink>
                        </li>
                    ))}
                </ol>
                <div className='SettingPolicyControl__actions'>
                    <Button
                        asChild={true}
                        emphasis='tertiary'
                        size='small'
                    >
                        <BlockableLink to={getScopedConfigurationPrefillRoute(settingKey)}>
                            <FormattedMessage
                                id='admin.scoped_configuration.setting_control.add_policy'
                                defaultMessage='Add policy'
                            />
                        </BlockableLink>
                    </Button>
                    {orderedPolicies.length > 1 && (
                        <Button
                            asChild={true}
                            emphasis='tertiary'
                            size='small'
                        >
                            <BlockableLink to={SCOPED_CONFIGURATION_LIST_ROUTE}>
                                <FormattedMessage
                                    id='admin.scoped_configuration.setting_control.change_priority'
                                    defaultMessage='Change priority'
                                />
                            </BlockableLink>
                        </Button>
                    )}
                </div>
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
