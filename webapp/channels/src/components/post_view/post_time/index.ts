// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ComponentProps} from 'react';
import {connect} from 'react-redux';

import {shouldUseUtcTimestamps} from 'mattermost-redux/selectors/entities/preferences';
import {getCurrentRelativeTeamUrl} from 'mattermost-redux/selectors/entities/teams';
import {getCurrentTimezoneFull} from 'mattermost-redux/selectors/entities/timezone';
import {getUserCurrentTimezone} from 'mattermost-redux/utils/timezone_utils';

import {getIsMobileView} from 'selectors/views/browser';

import {getIsoTimestampProps} from 'components/timestamp/utc_timestamp_props';

import type {GlobalState} from 'types/store';

import PostTime from './post_time';

type OwnProps = {
    teamName?: string;
    timestampProps?: ComponentProps<typeof PostTime>['timestampProps'];
}

function mapStateToProps(state: GlobalState, ownProps: OwnProps) {
    const useUtcTimestamps = shouldUseUtcTimestamps(state);
    const timeZone = getUserCurrentTimezone(getCurrentTimezoneFull(state));

    return {
        isMobileView: getIsMobileView(state),
        teamUrl: ownProps.teamName ? `/${ownProps.teamName}` : getCurrentRelativeTeamUrl(state),
        useUtcTimestamps,
        timestampProps: useUtcTimestamps ? {...ownProps.timestampProps, ...getIsoTimestampProps(timeZone)} : ownProps.timestampProps,
    };
}

export default connect(mapStateToProps)(PostTime);
