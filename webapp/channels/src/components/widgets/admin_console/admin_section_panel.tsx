// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React from 'react';
import type {MessageDescriptor} from 'react-intl';

import {LicenseSkuBadge} from 'components/widgets/badges';

import AdminPanel from './admin_panel';

import './admin_section_panel.scss';

type Props = {
    title?: string | MessageDescriptor;
    description?: string | MessageDescriptor;
    licenseSku?: string;
    children: React.ReactNode;
    'data-testid'?: string;
};

function asMessageDescriptor(value: string | MessageDescriptor): MessageDescriptor {
    if (typeof value === 'string') {
        return {id: value, defaultMessage: value};
    }

    return value;
}

const AdminSectionPanel: React.FC<Props> = ({
    title,
    description,
    licenseSku,
    children,
    'data-testid': dataTestId,
}) => {
    // Schema sections without a title/description still need a body wrapper for layout
    // and test hooks; Compass AdminPanel requires a title so skip the panel chrome.
    if (!title && !description && !licenseSku) {
        return (
            <div
                className='AdminSectionPanel'
                data-testid={dataTestId}
            >
                <div data-testid='admin-section-panel-body'>
                    {children}
                </div>
            </div>
        );
    }

    const titleDescriptor = title ? asMessageDescriptor(title) : undefined;
    const descriptionDescriptor = description ? asMessageDescriptor(description) : undefined;

    return (
        <AdminPanel
            className={classNames('AdminSectionPanel')}
            title={titleDescriptor ?? descriptionDescriptor ?? {
                id: 'admin.section_panel.untitled',
                defaultMessage: 'Settings',
            }}
            subtitle={titleDescriptor ? descriptionDescriptor : undefined}
            button={licenseSku ? <LicenseSkuBadge sku={licenseSku}/> : undefined}
            data-testid={dataTestId}
        >
            <div data-testid='admin-section-panel-body'>
                {children}
            </div>
        </AdminPanel>
    );
};

export default AdminSectionPanel;
