// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import IPFilteringEarthSvg from 'components/common/svg_images_components/ip_filtering_earth_svg';

type NoFiltersPanelProps = {
    setShowAddModal: (show: boolean) => void;
};

const NoFiltersPanel = ({setShowAddModal}: NoFiltersPanelProps) => (
    <div className='NoFilters'>
        <div>
            <IPFilteringEarthSvg
                width={149}
                height={140}
            />
        </div>
        <div className='Title'>
            <FormattedMessage
                id='admin.ip_filtering.no_filters'
                defaultMessage='No IP filtering rules added'
            />
        </div>
        <div className='Subtitle'>
            <FormattedMessage
                id='admin.ip_filtering.any_ip_can_access_add_filter'
                defaultMessage='Any IP can access your workspace. To limit access to selected IP Addresses, <add>Add a filter</add>'
                values={{
                    add: (msg) => (
                        <div
                            onClick={() => setShowAddModal(true)}
                            className='Button'
                        >
                            {msg}
                        </div>
                    ),
                }}
            />
        </div>
    </div>
);

export default NoFiltersPanel;
