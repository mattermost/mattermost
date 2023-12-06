// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import {AlertOutlineIcon} from '@mattermost/compass-icons/components';

type IPNotInRangeErrorPanelProps = {
    currentUsersIP: string | null;
    setShowAddModal: (show: boolean) => void;
};

const IPNotInRangeErrorPanel = ({
    currentUsersIP,
    setShowAddModal,
}: IPNotInRangeErrorPanelProps) => (
    <div className='NotInRangeErrorPanel'>
        <div className='Icon'>
            <AlertOutlineIcon size={20}/>
        </div>
        <div className='Content'>
            <div className='Title'>
                <FormattedMessage
                    id='admin.ip_filtering.your_current_ip_is_not_in_allowed_rules'
                    defaultMessage='Your IP address {ip} is not included in your allowed IP address rules.'
                    values={{ip: currentUsersIP}}
                />
            </div>
            <div className='Body'>
                <FormattedMessage
                    id='admin.ip_filtering.include_your_ip'
                    defaultMessage='Include your IP address in at least one of the rules below to continue.'
                />
                <div
                    className='Button'
                    onClick={() => setShowAddModal(true)}
                >
                    <FormattedMessage
                        id='admin.ip_filtering.add_your_ip'
                        defaultMessage='Add your IP address'
                    />
                </div>
            </div>
        </div>
    </div>
);

export default IPNotInRangeErrorPanel;
