// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {memo, useCallback} from 'react';
import {FormattedMessage} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';

import AtIcon from '@mattermost/compass-icons/components/at';

import {getCurrentChannelNameForSearchShortcut} from 'mattermost-redux/selectors/entities/channels';
import {getCurrentTeamId} from 'mattermost-redux/selectors/entities/teams';

import {closeRightHandSide, showChannelMentions} from 'actions/views/rhs';
import {getExplicitSearchTeam, getRhsState, getSearchTerms} from 'selectors/rhs';

import * as Menu from 'components/menu';

import {RHSStates} from 'utils/constants';

const ViewChannelMentions = () => {
    const dispatch = useDispatch();
    const rhsState = useSelector(getRhsState);
    const searchTerms = useSelector(getSearchTerms);
    const searchTeam = useSelector(getExplicitSearchTeam);
    const currentTeamId = useSelector(getCurrentTeamId);
    const channelName = useSelector(getCurrentChannelNameForSearchShortcut);

    // Toggle closed only when the panel already shows mentions filtered to this channel. A channel
    // name is unique within a team but not across them, so the scoped team has to match as well:
    // the same name on another team is a different channel and still needs to re-scope. Mentions
    // scoped to another channel, or not scoped at all, re-scope rather than closing. The filter is
    // matched as a whole term so that `in:foo` isn't satisfied by `in:foo-2`.
    const isShowingThisChannelMentions =
        rhsState === RHSStates.MENTION &&
        Boolean(channelName) &&
        searchTeam === currentTeamId &&
        searchTerms.split(' ').includes(`in:${channelName}`);

    const handleClick = useCallback(() => {
        if (isShowingThisChannelMentions) {
            dispatch(closeRightHandSide());
        } else {
            dispatch(showChannelMentions());
        }
    }, [dispatch, isShowingThisChannelMentions]);

    return (
        <Menu.Item
            id='channelViewMentions'
            leadingElement={<AtIcon size='18px'/>}
            onClick={handleClick}
            labels={
                <FormattedMessage
                    id='navbar.viewChannelMentions'
                    defaultMessage='Recent Mentions in this Channel'
                />
            }
        />
    );
};

export default memo(ViewChannelMentions);
