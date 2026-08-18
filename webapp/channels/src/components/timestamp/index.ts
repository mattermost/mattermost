// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';

import type {UserTimezone} from '@mattermost/types/users';

import {getBool, getShowTimestampSeconds, getTimestampFormat} from 'mattermost-redux/selectors/entities/preferences';
import {getCurrentTimezoneFull} from 'mattermost-redux/selectors/entities/timezone';
import {getUserCurrentTimezone} from 'mattermost-redux/utils/timezone_utils';

import {Preferences} from 'utils/constants';

import type {GlobalState} from 'types/store';

import {getTimestampFormatProps} from './format_props';
import type {TimestampFormatProps, TimestampVariant} from './format_props';
import * as RelativeRanges from './relative_ranges';
import Timestamp from './timestamp';
import type {Props as TimestampProps} from './timestamp';

type Props = Partial<TimestampFormatProps> & {
    userTimezone?: UserTimezone;
    hour12?: TimestampProps['hour12'];
    timeZone?: TimestampProps['timeZone'];
    hourCycle?: TimestampProps['hourCycle'];

    /**
     * Opt in to the viewer's preferred timestamp format (Display Settings → Date and Time).
     * Any format prop passed explicitly still wins over the derived one.
     */
    usePreferredFormat?: boolean;

    /** Which presentation to derive when `usePreferredFormat` is set. Defaults to `metadata`. */
    variant?: TimestampVariant;
};

// connect merges stateProps over ownProps, so anything the caller set explicitly has to
// be dropped here or it would be silently overridden by the derived format.
function withoutExplicitOverrides(formatProps: TimestampFormatProps, ownProps: Props): TimestampFormatProps {
    const keys = Object.keys(formatProps);
    if (!keys.some((key) => key in ownProps)) {
        return formatProps;
    }

    const entries = Object.entries(formatProps).filter(([key]) => !(key in ownProps));

    return Object.fromEntries(entries) as TimestampFormatProps;
}

export function mapStateToProps(state: GlobalState, ownProps: Props) {
    const timeZone: TimestampProps['timeZone'] = getUserCurrentTimezone(ownProps.userTimezone ?? getCurrentTimezoneFull(state)) || undefined;
    const useMilitaryTime = getBool(state, Preferences.CATEGORY_DISPLAY_SETTINGS, Preferences.USE_MILITARY_TIME, false);
    const hourCycle: TimestampProps['hourCycle'] = ownProps.hourCycle || (useMilitaryTime ? 'h23' : 'h12');

    const props = {timeZone: ownProps.timeZone || timeZone, hourCycle};

    if (!ownProps.usePreferredFormat) {
        return props;
    }

    const formatProps = getTimestampFormatProps({
        format: getTimestampFormat(state),
        showSeconds: getShowTimestampSeconds(state),
        variant: ownProps.variant ?? 'metadata',
    });

    return {...props, ...withoutExplicitOverrides(formatProps, ownProps)};
}

export default connect(mapStateToProps)(Timestamp);

export {default as SemanticTime} from './semantic_time';
export {RelativeRanges};
export {getTimestampFormatProps};
export type {TimestampVariant};
