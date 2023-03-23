// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import AccordionToggleIcon from 'components/widgets/icons/accordion_toggle_icon';

import AdminPanel from './admin_panel';

type Props = {
    children?: React.ReactNode;
    className: string;
    id?: string;
    open: boolean;
    titleId: string;
    titleDefault: string;
    subtitleId: string;
    subtitleDefault: string;
    onToggle?: React.EventHandler<React.MouseEvent>;
    isDisabled?: boolean;
};

const AdminPanelTogglable: React.FC<Props> = (props: Props) => {
    return (
        <AdminPanel
            className={'AdminPanelTogglable ' + props.className + (props.open ? '' : ' closed')}
            id={props.id}
            titleId={props.titleId}
            titleDefault={props.titleDefault}
            subtitleId={props.subtitleId}
            subtitleDefault={props.subtitleDefault}
            onHeaderClick={props.onToggle}
            button={<AccordionToggleIcon/>}
        >
            {props.children}
        </AdminPanel>
    );
};

AdminPanelTogglable.defaultProps = {
    className: '',
    open: true,
};

export default AdminPanelTogglable;
