// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {Modal} from 'react-bootstrap';

import MenuWrapper from '../../menu_wrapper';
import Menu from '../../menu';
import SubMenuItem from '../../menu_items/submenu_item';

import * as Utils from 'utils/utils';

import './submenu_modal.scss';

type Props = {
    elements?: Array<React.ComponentProps<typeof SubMenuItem>>;
    onExited: () => void;
}

type State = {
    show: boolean;
}

export default class SubMenuModal extends React.PureComponent<Props, State> {
    public constructor(props: Props) {
        super(props);
        this.state = {
            show: true,
        };
    }

    public onHide = () => { //public because it is used on tests
        this.setState({show: false});
    }

    public render() {
        let SubMenuItems;
        if (this.props.elements) {
            SubMenuItems = this.props.elements.map((element) => {
                return (
                    <Menu.ItemSubMenu
                        key={element.id}
                        id={element.id}
                        text={element.text}
                        subMenu={element.subMenu}
                        action={element.action}
                        filter={element.filter}
                        root={false}
                    />
                );
            });
        }
        return (
            <Modal
                dialogClassName={'SubMenuModal a11y__modal mobile-sub-menu'}
                show={this.state.show}
                onHide={this.onHide}
                onExited={this.props.onExited}
                enforceFocus={false}
                id='submenuModal'
                role='dialog'
            >
                <Modal.Body
                    onClick={this.onHide}
                >
                    <MenuWrapper>
                        <Menu
                            openLeft={true}
                            ariaLabel={Utils.localizeMessage('post_info.submenu.mobile', 'mobile submenu').toLowerCase()}
                        >
                            {SubMenuItems}
                        </Menu>
                        <div/>
                    </MenuWrapper>
                </Modal.Body>
            </Modal>
        );
    }
}
