// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {memo, useCallback} from 'react';
import {FormattedMessage} from 'react-intl';
import {useDispatch} from 'react-redux';

import AtIcon from '@mattermost/compass-icons/components/at';

import {showChannelMentions} from 'actions/views/rhs';

import * as Menu from 'components/menu';

const ViewChannelMentions = () => {
    const dispatch = useDispatch();

    const handleClick = useCallback(() => {
        dispatch(showChannelMentions());
    }, [dispatch]);

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
