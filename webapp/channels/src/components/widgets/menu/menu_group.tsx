// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import './menu_group.scss';

type Props = {
    divider?: React.ReactNode;
    children?: React.ReactNode;
}

/**
 * @deprecated Use the "webapp/channels/src/components/menu" instead.
 */
export default class MenuGroup extends React.PureComponent<Props> {
    handleDividerClick = (e: React.MouseEvent): void => {
        e.preventDefault();
        e.stopPropagation();
    };

    public render() {
        const {children} = this.props;

        const divider = this.props.divider || (
            <li
                className='MenuGroup menu-divider'
                onClick={this.handleDividerClick}
            />
        );

        return (
            <React.Fragment>
                {divider}
                {children}
            </React.Fragment>
        );
    }
}
