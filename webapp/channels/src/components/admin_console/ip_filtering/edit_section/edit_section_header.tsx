// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import IPNotInRangeErrorPanel from './edit_section_ip_not_in_range_panel';

type EditSectionHeaderProps = {
    setShowAddModal: (show: boolean) => void;
    currentIPIsInRange: boolean;
    currentUsersIP: string | null;
};

const EditSectionHeader = ({
    setShowAddModal,
    currentIPIsInRange,
    currentUsersIP,
}: EditSectionHeaderProps) => (
    <div className='AllowedIPAddressesSection'>
        <div className='SectionHeaderContent'>
            <div className='HeaderContent'>
                <div className='TitleSubtitle'>
                    <div className='Title'>
                        <FormattedMessage
                            id='admin.ip_filtering.allowed_ip_addresses'
                            defaultMessage='Allowed IP Addresses'
                        />
                    </div>
                    <div className='Subtitle'>
                        <FormattedMessage
                            id='admin.ip_filtering.edit_section_description_line_1'
                            defaultMessage='Create rules to allow access to the workspace for specified IP addresses only.'
                        />
                    </div>
                    <div className='Subtitle'>
                        <FormattedMessage
                            id='admin.ip_filtering.edit_section_description_line_2'
                            defaultMessage='<strong>NOTE:</strong> If no rules are added, all IP addresses will be allowed.'
                            values={{
                                strong: (msg) => <strong>{msg}</strong>,
                            }}
                        />
                    </div>
                </div>
                <div className='AddIPFilterButton'>
                    <button
                        className='Button'
                        onClick={() => {
                            setShowAddModal(true);
                        }}
                        type='button'
                    >
                        <FormattedMessage
                            id='admin.ip_filtering.add_filter'
                            defaultMessage='Add Filter'
                        />
                    </button>
                </div>
            </div>
            {
                !currentIPIsInRange &&
                    <IPNotInRangeErrorPanel
                        setShowAddModal={setShowAddModal}
                        currentUsersIP={currentUsersIP}
                    />
            }
        </div>
    </div>
);

export default EditSectionHeader;
