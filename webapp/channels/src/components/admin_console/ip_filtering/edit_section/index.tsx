// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState} from 'react';
import {useIntl} from 'react-intl';

import type {AllowedIPRange} from '@mattermost/types/config';

import EditTableRow from './edit_section_edit_table_row';
import EditSectionHeader from './edit_section_header';
import NoFiltersPanel from './edit_section_no_filters_panel';

import './edit_sections.scss';

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
        <div className='EditSection'>
            <EditSectionHeader
                setShowAddModal={setShowAddModal}
                currentIPIsInRange={currentIPIsInRange}
                currentUsersIP={currentUsersIP}
            />
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
        </div>
    );
};

export default EditSection;
