// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useMemo, useState} from 'react';
import {Modal} from 'react-bootstrap';
import {useIntl} from 'react-intl';

import Menu from '../../menu';
import type SubMenuItem from '../../menu_items/submenu_item';
import MenuWrapper from '../../menu_wrapper';

import './submenu_modal.scss';

type Props = {
    elements?: Array<React.ComponentProps<typeof SubMenuItem>>;
    onExited: () => void;
}

const SubMenuModal = ({
    elements,
    onExited,
}: Props) => {
    const [show, setShow] = useState(true);
    const intl = useIntl();

    const onHide = useCallback(() => {
        setShow(false);
    }, []);

    const subMenuItems = useMemo(() => {
        if (!elements) {
            return undefined;
        }
        return elements.map(
            (element) => (
                <Menu.ItemSubMenu
                    key={element.id}
                    id={element.id}
                    text={element.text}
                    subMenu={element.subMenu}
                    action={element.action}
                    filter={element.filter}
                    root={false}
                />),
        );
    }, [elements]);

    return (
        <Modal
            dialogClassName={'SubMenuModal a11y__modal mobile-sub-menu'}
            show={show}
            onHide={onHide}
            onExited={onExited}
            enforceFocus={false}
            id='submenuModal'
            role='dialog'
        >
            <Modal.Body
                data-testid={'SubMenuModalBody'}
                onClick={onHide}
            >
                <MenuWrapper>
                    <Menu
                        openLeft={true}
                        ariaLabel={intl.formatMessage({id: 'post_info.submenu.mobile', defaultMessage: 'mobile submenu'})}
                    >
                        {subMenuItems}
                    </Menu>
                    <div/>
                </MenuWrapper>
            </Modal.Body>
        </Modal>
    );
};

export default React.memo(SubMenuModal);
