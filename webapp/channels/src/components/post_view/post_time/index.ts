// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import type {ComponentProps} from 'react';

import {shouldUseUtcTimestamps} from 'mattermost-redux/selectors/entities/preferences';
import {getCurrentRelativeTeamUrl} from 'mattermost-redux/selectors/entities/teams';

import {UTC_TIMESTAMP_PROPS} from 'components/timestamp/utc_timestamp_props';
import {getIsMobileView} from 'selectors/views/browser';

import type {GlobalState} from 'types/store';

import PostTime from './post_time';

type OwnProps = {
    teamName?: string;
    timestampProps?: ComponentProps<typeof PostTime>['timestampProps'];
}

function mapStateToProps(state: GlobalState, ownProps: OwnProps) {
    const useUtcTimestamps = shouldUseUtcTimestamps(state);

    return {
        isMobileView: getIsMobileView(state),
        teamUrl: ownProps.teamName ? `/${ownProps.teamName}` : getCurrentRelativeTeamUrl(state),
        useUtcTimestamps,
        timestampProps: useUtcTimestamps ? {...ownProps.timestampProps, ...UTC_TIMESTAMP_PROPS} : ownProps.timestampProps,
    };
}

export default connect(mapStateToProps)(PostTime);
