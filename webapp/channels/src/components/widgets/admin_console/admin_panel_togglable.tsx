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
    className = '',
    open = true,
    subtitle,
    title,
    children,
    id,
    onToggle,
}: Props) => {
    // The content is rendered in two divs: an outer one that uses CSS grid to trick the browser into animating height
    // and an inner one to prevent the content from overflowing the grid.
    return (
        <AdminPanel
            className={'AdminPanelTogglable ' + className + (open ? '' : ' closed')}
            id={id}
            title={title}
            subtitle={subtitle}
            onHeaderClick={onToggle}
            button={<AccordionToggleIcon/>}
        >
            <div className='AdminPanelTogglableContent'>
                <div className='AdminPanelTogglableContentInner'>
                    {children}
                </div>
            </div>
        </AdminPanel>
    );
};

export default AdminPanelTogglable;
