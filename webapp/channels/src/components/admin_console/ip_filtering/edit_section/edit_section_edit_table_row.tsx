// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useIntl} from 'react-intl';

import {
    PencilOutlineIcon,
    TrashCanOutlineIcon,
} from '@mattermost/compass-icons/components';
import type {AllowedIPRange} from '@mattermost/types/config';

import OverlayTrigger from 'components/overlay_trigger';
import Tooltip from 'components/tooltip';

type EditTableRowProps = {
    allowedIPRange: AllowedIPRange;
    index: number;
    handleRowMouseEnter: (index: number) => void;
    handleRowMouseLeave: () => void;
    setEditFilter: (filter: AllowedIPRange) => void;
    handleConfirmDeleteFilter: (filter: AllowedIPRange) => void;
    hoveredRow: number | null;
};

const EditTableRow = ({
    allowedIPRange,
    index,
    handleRowMouseEnter,
    handleRowMouseLeave,
    setEditFilter,
    handleConfirmDeleteFilter,
    hoveredRow,
}: EditTableRowProps) => {
    const {formatMessage} = useIntl();
    const editTooltip = <Tooltip id='edit-tooltip'>{formatMessage({id: 'admin.ip_filtering.edit', defaultMessage: 'Edit'})}</Tooltip>;
    const deleteTooltip = <Tooltip id='delete-tooltip'>{formatMessage({id: 'admin.ip_filtering.delete', defaultMessage: 'Delete'})}</Tooltip>;
    return (
        <div
            className='Row'
            onMouseEnter={() => handleRowMouseEnter(index)}
            onMouseLeave={handleRowMouseLeave}
        >
            <div className='FilterName'>{allowedIPRange.description}</div>
            <div className='IpAddressRange'>{allowedIPRange.cidr_block}</div>
            <div className='Actions'>
                {hoveredRow === index && (
                    <>
                        <OverlayTrigger
                            placement='top'
                            overlay={editTooltip}
                        >
                            <div
                                className='edit'
                                aria-label='Edit'
                                role='button'
                                onClick={() => setEditFilter(allowedIPRange)}
                            >
                                <PencilOutlineIcon size={20}/>
                            </div>
                        </OverlayTrigger>
                        <OverlayTrigger
                            placement='top'
                            overlay={deleteTooltip}
                        >
                            <div
                                className='delete'
                                aria-label='Delete'
                                role='button'
                                onClick={() => handleConfirmDeleteFilter(allowedIPRange)}
                            >
                                <TrashCanOutlineIcon
                                    size={20}
                                    color='red'
                                />
                            </div>
                        </OverlayTrigger>
                    </>
                )}
            </div>
        </div>
    );
};

export default EditTableRow;
