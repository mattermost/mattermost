// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import MenuIcon from 'components/widgets/icons/menu_icon';

type Actions = {
    toggleRhsMenu: (e?: React.MouseEvent<HTMLButtonElement, MouseEvent>) => void;
}

type Props = {
    actions: Actions;
}

const CollapseRhsButton: React.FunctionComponent<Props> = (props: Props) => (
    <button
        key='navbar-toggle-menu'
        type='button'
        className='navbar-toggle navbar-right__icon menu-toggle pull-right'
        data-toggle='collapse'
        data-target='#sidebar-nav'
        onClick={props.actions.toggleRhsMenu}
    >
        <MenuIcon/>
    </button>
);

export default CollapseRhsButton;
