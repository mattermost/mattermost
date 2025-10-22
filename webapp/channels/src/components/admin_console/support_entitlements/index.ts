// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import type {Dispatch} from 'redux';

import {getLicenseConfig} from 'mattermost-redux/actions/general';
import {getConfig, getLicense} from 'mattermost-redux/selectors/entities/general';

import type {GlobalState} from 'types/store';

import SupportEntitlements from './support_entitlements';

function mapStateToProps(state: GlobalState) {
    const config = getConfig(state);
    const license = getLicense(state);
    const enterpriseReady = config.BuildEnterpriseReady === 'true';

    // Build packet contents list (same logic as commercial support modal)
    const packetContents = [
        {id: 'basic.contents', label: 'Basic contents', selected: true, mandatory: true},
        {id: 'basic.server.logs', label: 'Server logs', selected: true, mandatory: false},
    ];

    // Add plugin support packets
    if (state.entities.admin.plugins) {
        for (const [key, value] of Object.entries(state.entities.admin.plugins)) {
            if (value.active && value.props !== undefined && value.props.support_packet !== undefined) {
                packetContents.push({
                    id: key,
                    label: value.props.support_packet,
                    selected: false,
                    mandatory: false,
                });
            }
        }
    }

    return {
        license,
        enterpriseReady,
        packetContents,
    };
}

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators({
            getLicenseConfig,
        }, dispatch),
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(SupportEntitlements);
