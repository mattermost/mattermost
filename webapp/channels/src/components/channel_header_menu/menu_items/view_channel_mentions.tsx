// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {memo, useCallback} from 'react';
import {FormattedMessage} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';

import AtIcon from '@mattermost/compass-icons/components/at';

import {getCurrentChannelNameForSearchShortcut} from 'mattermost-redux/selectors/entities/channels';

import {closeRightHandSide, showChannelMentions} from 'actions/views/rhs';
import {getRhsState, getSearchTerms} from 'selectors/rhs';

import * as Menu from 'components/menu';

import {RHSStates} from 'utils/constants';

const ViewChannelMentions = () => {
    const dispatch = useDispatch();
    const rhsState = useSelector(getRhsState);
    const searchTerms = useSelector(getSearchTerms);
    const channelName = useSelector(getCurrentChannelNameForSearchShortcut);

    // Toggle closed only when the panel already shows mentions filtered to this channel. Mentions
    // scoped to a different channel, or to no channel, still need to re-scope to this one. The
    // trailing space is what showChannelMentions appends, and keeps `in:foo` from matching `in:foo-2`.
    const isShowingThisChannelMentions =
        rhsState === RHSStates.MENTION && Boolean(channelName) && searchTerms.includes(`in:${channelName} `);

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
