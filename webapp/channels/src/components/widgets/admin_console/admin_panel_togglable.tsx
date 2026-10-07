// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {AdminPanel as CompassAdminPanel} from '@mattermost/compass-ui/components/admin-panel';
import classNames from 'classnames';
import React from 'react';
import type {MessageDescriptor} from 'react-intl';
import {FormattedMessage, useIntl} from 'react-intl';

type Props = {
    children?: React.ReactNode;
    className: string;
    id?: string;
    open: boolean;
    title: MessageDescriptor;
    subtitle: MessageDescriptor;
    onToggle?: React.EventHandler<React.MouseEvent>;
};

const AdminPanelTogglable = ({
    className = '',
    open = true,
    subtitle,
    title,
    children,
    id,
    onToggle,
}: Props) => {
    const intl = useIntl();

    const handleExpandedStateChange = () => {
        onToggle?.({} as React.MouseEvent);
    };

    return (
        <CompassAdminPanel
            id={id}
            className={classNames(
                'AdminPanel',
                'clearfix',
                'AdminPanelTogglable',
                className,
                {closed: !open},
            )}
            title={<FormattedMessage {...title}/>}
            subtitle={<FormattedMessage {...subtitle}/>}
            expandable={true}
            expandedState={open ? 'expanded' : 'collapsed'}
            onExpandedStateChange={handleExpandedStateChange}
            expandLabel={intl.formatMessage({
                id: 'admin.panel.expand',
                defaultMessage: 'Expand section',
            })}
            collapseLabel={intl.formatMessage({
                id: 'admin.panel.collapse',
                defaultMessage: 'Collapse section',
            })}
        >
            {children}
        </CompassAdminPanel>
    );
};

export default AdminPanelTogglable;
