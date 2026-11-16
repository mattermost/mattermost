// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState} from 'react';
import {FormattedMessage, defineMessages, useIntl} from 'react-intl';

import {Button} from '@mattermost/shared/components/button';
import type {AllowedIPRange} from '@mattermost/types/config';

import AdminPanel from 'components/widgets/admin_console/admin_panel';

import EditTableRow from './edit_section_edit_table_row';
import IPNotInRangeErrorPanel from './edit_section_ip_not_in_range_panel';
import NoFiltersPanel from './edit_section_no_filters_panel';

import './edit_sections.scss';

const messages = defineMessages({
    title: {id: 'admin.ip_filtering.allowed_ip_addresses', defaultMessage: 'Allowed IP Addresses'},
});

type EditSectionProps = {
    ipFilters: AllowedIPRange[] | null;
    currentUsersIP: string | null;
    currentIPIsInRange: boolean;
    setShowAddModal: (show: boolean) => void;
    setEditFilter: (filter: AllowedIPRange) => void;
    handleConfirmDeleteFilter: (filter: AllowedIPRange) => void;
};

const EditSection = ({
    ipFilters,
    currentUsersIP,
    setShowAddModal,
    setEditFilter,
    handleConfirmDeleteFilter,
    currentIPIsInRange,
}: EditSectionProps) => {
    const {formatMessage} = useIntl();
    const [hoveredRow, setHoveredRow] = useState<number | null>(null);
    return (
        <AdminPanel
            id='ip_filtering_edit'
            className='EditSection'
            title={messages.title}
            button={
                <Button
                    emphasis='primary'
                    onClick={() => setShowAddModal(true)}
                    type='button'
                >
                    <FormattedMessage
                        id='admin.ip_filtering.add_filter'
                        defaultMessage='Add Filter'
                    />
                </Button>
            }
        >
            <div className='EditSection__description'>
                <p>
                    <FormattedMessage
                        id='admin.ip_filtering.edit_section_description_line_1'
                        defaultMessage='Create rules to allow access to the workspace for specified IP addresses only.'
                    />
                </p>
                <p>
                    <FormattedMessage
                        id='admin.ip_filtering.edit_section_description_line_2'
                        defaultMessage='<strong>NOTE:</strong> If no rules are added, all IP addresses will be allowed.'
                        values={{
                            strong: (msg) => <strong>{msg}</strong>,
                        }}
                    />
                </p>
            </div>
            {!currentIPIsInRange && (
                <IPNotInRangeErrorPanel
                    setShowAddModal={setShowAddModal}
                    currentUsersIP={currentUsersIP}
                />
            )}
            {Boolean(ipFilters?.length) && (
                <div className='TableSectionContent'>
                    <div className='Table'>
                        <div className='HeaderRow'>
                            <div className='FilterName'>
                                {formatMessage({
                                    id: 'admin.ip_filtering.filter_name',
                                    defaultMessage: 'Filter Name',
                                })}
                            </div>
                            <div className='IpAddressRange'>
                                {formatMessage({
                                    id: 'admin.ip_filtering.ip_address_range',
                                    defaultMessage: 'IP Address Range',
                                })}
                            </div>
                        </div>
                        {ipFilters?.map((allowedIPRange, index) => (
                            <EditTableRow
                                key={allowedIPRange.cidr_block}
                                allowedIPRange={allowedIPRange}
                                index={index}
                                handleRowMouseEnter={(index) => setHoveredRow(index)}
                                handleRowMouseLeave={() => setHoveredRow(null)}
                                setEditFilter={setEditFilter}
                                handleConfirmDeleteFilter={handleConfirmDeleteFilter}
                                hoveredRow={hoveredRow}
                            />
                        ))}
                    </div>
                </div>
            )}
            {ipFilters?.length === 0 && <NoFiltersPanel setShowAddModal={setShowAddModal}/>}
        </AdminPanel>
    );
};

export default EditSection;
