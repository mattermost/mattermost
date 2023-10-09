// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import 'components/convert_gm_to_channel_modal/warning_text_section/warning_text_section.scss';

const NoCommonTeamsError = (): JSX.Element => {
    return (
        <div className='warning-section error'>
            <i className='fa fa-exclamation-circle'/>
            <div className='warning-text'>
                <div className='warning-header'>
                    <FormattedMessage
                        id='sidebar_left.sidebar_channel_modal.no_common_teams_error.heading'
                        defaultMessage='Unable to convert to a channel because group members are part of different teams'
                    />
                </div>
                <div className='warning-body'>
                    <FormattedMessage
                        id='sidebar_left.sidebar_channel_modal.no_common_teams_error.body'
                        defaultMessage='Group Message cannot be converted to a channel because members are not a part of the same team. Add all members to a single team to convert this group message to a channel in that team.'
                    />
                </div>
            </div>
        </div>
    );
};

export default NoCommonTeamsError;
