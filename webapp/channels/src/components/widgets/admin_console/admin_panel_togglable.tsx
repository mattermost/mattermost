// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import type {MessageDescriptor} from 'react-intl';

import AccordionToggleIcon from 'components/widgets/icons/accordion_toggle_icon';

import AdminPanel from './admin_panel';

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
    className,
    open,
    subtitle,
    title,
    children,
    id,
    onToggle,
}: Props) => {
    return (
        <AdminPanel
            className={'AdminPanelTogglable ' + className + (open ? '' : ' closed')}
            id={id}
            title={title}
            subtitle={subtitle}
            onHeaderClick={onToggle}
            button={<AccordionToggleIcon/>}
        >
            {children}
        </AdminPanel>
    );
};

AdminPanelTogglable.defaultProps = {
    className: '',
    open: true,
};

export default AdminPanelTogglable;
