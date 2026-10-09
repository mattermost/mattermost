// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {AdminPanel as CompassAdminPanel} from '@mattermost/compass-ui/components/admin-panel';
import classNames from 'classnames';
import React from 'react';
import type {MessageDescriptor} from 'react-intl';
import {FormattedMessage} from 'react-intl';

import './admin_panel.scss';

type Props = {
    id?: string;
    className?: string;
    title: MessageDescriptor;
    subtitle: MessageDescriptor;
    subtitleValues?: Record<string, unknown>;
    button?: React.ReactNode;
    children?: React.ReactNode;
} & Omit<React.ComponentProps<typeof CompassAdminPanel>, 'title' | 'subtitle' | 'headerActions' | 'children' | 'className'>;

const AdminPanel = ({
    subtitle,
    title,
    button,
    children,
    className = '',
    id,
    subtitleValues,
    ...rest
}: Props) => (
    <CompassAdminPanel
        id={id}
        className={classNames('AdminPanel', 'clearfix', className)}
        title={<FormattedMessage {...title}/>}
        subtitle={
            <FormattedMessage
                {...subtitle}
                values={subtitleValues}
            />
        }
        headerActions={button}
        {...rest}
    >
        {children}
    </CompassAdminPanel>
);

export default AdminPanel;
