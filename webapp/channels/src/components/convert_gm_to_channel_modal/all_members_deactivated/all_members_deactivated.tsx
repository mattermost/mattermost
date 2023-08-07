// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import 'components/convert_gm_to_channel_modal/warning_text_section/warning_text_section.scss';

const AllMembersDeactivated = (): JSX.Element => {
    return (
        <div className='warning-section error'>
            <i className='fa fa-exclamation-circle'/>
            <div className='warning-text'>
                <div className='warning-header'>
                    <FormattedMessage
                        id='sidebar_left.sidebar_channel_modal.all_users_deactivated_error'
                        defaultMessage='Unable to convert to a channel because all other group members are deactivated'
                    />
                </div>
            </div>
        </div>
    );
};

export default AllMembersDeactivated;
