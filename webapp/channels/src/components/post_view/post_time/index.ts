// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ComponentProps} from 'react';
import {connect} from 'react-redux';

import {getTimestampDisplayMode} from 'mattermost-redux/selectors/entities/preferences';
import {getCurrentRelativeTeamUrl} from 'mattermost-redux/selectors/entities/teams';
import {getCurrentTimezoneFull} from 'mattermost-redux/selectors/entities/timezone';
import {getUserCurrentTimezone} from 'mattermost-redux/utils/timezone_utils';

import {getTimestampDisplayProps} from 'components/timestamp/timestamp_display_props';

import {getIsMobileView} from 'selectors/views/browser';

import type {GlobalState} from 'types/store';

import PostTime from './post_time';

type OwnProps = {
    teamName?: string;
    timestampProps?: ComponentProps<typeof PostTime>['timestampProps'];
}

function mapStateToProps(state: GlobalState, ownProps: OwnProps) {
    const timestampDisplayMode = getTimestampDisplayMode(state);
    const timeZone = getUserCurrentTimezone(getCurrentTimezoneFull(state));
    const displayProps = getTimestampDisplayProps(timeZone, timestampDisplayMode);

    return {
        isMobileView: getIsMobileView(state),
        teamUrl: ownProps.teamName ? `/${ownProps.teamName}` : getCurrentRelativeTeamUrl(state),
        useAbsoluteTimestamp: Boolean(displayProps),
        timestampProps: displayProps ? {...ownProps.timestampProps, ...displayProps} : ownProps.timestampProps,
    };
}

export default connect(mapStateToProps)(PostTime);
