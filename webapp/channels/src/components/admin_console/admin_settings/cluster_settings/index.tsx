// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback} from 'react';
import {FormattedMessage} from 'react-intl';
import {useSelector} from 'react-redux';

import type {GlobalState} from '@mattermost/types/store';

import {getLicense} from 'mattermost-redux/selectors/entities/general';

import ClusterName from './cluster_name';
import ConfigLoadedFromCluster from './config_loaded_from_cluster';
import {FIELD_IDS} from './constants';
import Enable from './enable';
import EnableExperimentalGossipEncryption from './enable_experimental_gossip_encryption';
import EnableGossipCompression from './enable_gossip_compression';
import GossipPort from './gossip_port';
import {messages} from './messages';
import OverrideHostname from './override_hostname';
import UseIPAddress from './use_ip_address';
import Warning from './warning';

import ClusterTableContainer from '../../cluster_table_container';
import SettingsGroup from '../../settings_group';
import AdminSetting from '../admin_settings';
import {useAdminSettingState} from '../hooks';
import type {GetConfigFromStateFunction, GetStateFromConfigFunction} from '../types';
import {parseIntNonZero} from '../utils';

export {searchableStrings} from './messages';

const getConfigFromState: GetConfigFromStateFunction = (state) => {
    return {
        ClusterSettings: {
            Enable: state[FIELD_IDS.ENABLE],
            ClusterName: state[FIELD_IDS.CLUSTER_NAME],
            OverrideHostname: state[FIELD_IDS.OVERRIDE_HOSTNAME],
            UseIPAddress: state[FIELD_IDS.USE_IP_ADDRESS],
            EnableExperimentalGossipEncryption: state[FIELD_IDS.ENABLE_EXPERIMENTAL_GOSSIP_ENCRYPTION],
            EnableGossipCompression: state[FIELD_IDS.ENABLE_GOSSIP_COMPRESSION],
            GossipPort: parseIntNonZero(state[FIELD_IDS.GOSSIP_PORT], 8074),
        },
    };
};

const getStateFromConfig: GetStateFromConfigFunction = (config) => {
    return {
        [FIELD_IDS.ENABLE]: config.ClusterSettings.Enable,
        [FIELD_IDS.CLUSTER_NAME]: config.ClusterSettings.ClusterName,
        [FIELD_IDS.OVERRIDE_HOSTNAME]: config.ClusterSettings.OverrideHostname,
        [FIELD_IDS.USE_IP_ADDRESS]: config.ClusterSettings.UseIPAddress,
        [FIELD_IDS.ENABLE_EXPERIMENTAL_GOSSIP_ENCRYPTION]: config.ClusterSettings.EnableExperimentalGossipEncryption,
        [FIELD_IDS.ENABLE_GOSSIP_COMPRESSION]: config.ClusterSettings.EnableGossipCompression,
        [FIELD_IDS.GOSSIP_PORT]: config.ClusterSettings.GossipPort,
        [FIELD_IDS.SHOW_WARNING]: false,
    };
};

function renderTitle() {
    return (<FormattedMessage {...messages.cluster}/>);
}

type Props = {
    isDisabled?: boolean;
}

const ClusterSettings = ({
    isDisabled,
}: Props) => {
    const licenseEnabled = useSelector((state: GlobalState) => {
        const license = getLicense(state);
        return license.IsLicensed === 'true' && license.Cluster === 'true';
    });

    const {
        doSubmit,
        handleChange,
        saveNeeded,
        saving,
        serverError,
        settingValues,
    } = useAdminSettingState(getConfigFromState, getStateFromConfig);

    const overrideHandleChange = useCallback((id: string, value: unknown) => {
        handleChange(FIELD_IDS.SHOW_WARNING, true);
        handleChange(id, value);
    }, [handleChange]);

    const renderSettings = useCallback(() => {
        if (!licenseEnabled) {
            return null;
        }

        return (
            <SettingsGroup>
                <ConfigLoadedFromCluster/>
                {settingValues[FIELD_IDS.ENABLE] && <ClusterTableContainer/>}
                <div className='banner'>
                    <FormattedMessage {...messages.noteDescription}/>
                </div>
                <Warning showWarning={settingValues[FIELD_IDS.SHOW_WARNING]}/>
                <Enable
                    onChange={overrideHandleChange}
                    value={settingValues[FIELD_IDS.ENABLE]}
                    isDisabled={isDisabled}
                />
                <ClusterName
                    onChange={overrideHandleChange}
                    value={settingValues[FIELD_IDS.CLUSTER_NAME]}
                    isDisabled={isDisabled}
                />
                <OverrideHostname
                    onChange={overrideHandleChange}
                    value={settingValues[FIELD_IDS.OVERRIDE_HOSTNAME]}
                    isDisabled={isDisabled}
                />
                <UseIPAddress
                    onChange={overrideHandleChange}
                    value={settingValues[FIELD_IDS.USE_IP_ADDRESS]}
                    isDisabled={isDisabled}
                />
                <EnableExperimentalGossipEncryption
                    onChange={overrideHandleChange}
                    value={settingValues[FIELD_IDS.ENABLE_EXPERIMENTAL_GOSSIP_ENCRYPTION]}
                    isDisabled={isDisabled}
                />
                <EnableGossipCompression
                    onChange={overrideHandleChange}
                    value={settingValues[FIELD_IDS.ENABLE_GOSSIP_COMPRESSION]}
                    isDisabled={isDisabled}
                />
                <GossipPort
                    onChange={overrideHandleChange}
                    value={settingValues[FIELD_IDS.GOSSIP_PORT]}
                    isDisabled={isDisabled}
                />
            </SettingsGroup>
        );
    }, [isDisabled, licenseEnabled, overrideHandleChange, settingValues]);

    return (
        <AdminSetting
            doSubmit={doSubmit}
            renderSettings={renderSettings}
            renderTitle={renderTitle}
            saveNeeded={saveNeeded}
            saving={saving}
            isDisabled={isDisabled}
            serverError={serverError}
        />
    );
};

export default ClusterSettings;
