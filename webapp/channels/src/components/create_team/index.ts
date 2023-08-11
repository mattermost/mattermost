// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';

import {compose} from 'redux';

import {getCurrentChannel} from 'mattermost-redux/selectors/entities/channels';
import {getCloudSubscription as selectCloudSubscription} from 'mattermost-redux/selectors/entities/cloud';
import {getConfig, getLicense} from 'mattermost-redux/selectors/entities/general';
import {getCurrentTeam} from 'mattermost-redux/selectors/entities/teams';

import withUseGetUsageDelta from 'components/common/hocs/cloud/with_use_get_usage_deltas';

import {isCloudLicense} from 'utils/license_utils';

import type {GlobalState} from 'types/store';

import CreateTeam from './create_team';
import type {Props} from './create_team';

function mapStateToProps(state: GlobalState) {
    const config = getConfig(state);
    const currentChannel = getCurrentChannel(state);
    const currentTeam = getCurrentTeam(state);

    const customDescriptionText = config.CustomDescriptionText;
    const siteName = config.SiteName;

    const subscription = selectCloudSubscription(state);
    const license = getLicense(state);

    const isCloud = isCloudLicense(license);
    const isFreeTrial = subscription?.is_free_trial === 'true';

    return {
        currentChannel,
        currentTeam,
        customDescriptionText,
        siteName,
        isCloud,
        isFreeTrial,
    };
}

export default compose(
    connect(mapStateToProps),
    withUseGetUsageDelta,
)(CreateTeam) as React.FunctionComponent<Props>;
