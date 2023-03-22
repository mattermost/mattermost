// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {CSSProperties} from 'react';
import classNames from 'classnames';

import {isMobile} from 'utils/utils';

import SubMenuItem from './menu_items/submenu_item';

import MenuHeader from './menu_header';
import MenuGroup from './menu_group';
import MenuItemAction from './menu_items/menu_item_action';
import MenuItemExternalLink from './menu_items/menu_item_external_link';
import MenuItemLink from './menu_items/menu_item_link';
import MenuCloudTrial from './menu_items/menu_cloud_trial';
import MenuStartTrial from './menu_items/menu_start_trial';
import MenuItemToggleModalRedux from './menu_items/menu_item_toggle_modal_redux';
import MenuItemCloudLimit from './menu_items/menu_item_cloud_limit';

import './menu.scss';

type Props = {
    children?: React.ReactNode;
    openLeft?: boolean;
    openUp?: boolean;
    id?: string;
    ariaLabel: string;
    customStyles?: CSSProperties;
    className?: string;
    listId?: string;
}

export default class Menu extends React.PureComponent<Props> {
    public static Header = MenuHeader
    public static Group = MenuGroup
    public static ItemAction = MenuItemAction
    public static ItemExternalLink = MenuItemExternalLink
    public static ItemLink = MenuItemLink
    public static ItemToggleModalRedux = MenuItemToggleModalRedux
    public static ItemSubMenu = SubMenuItem
    public static CloudTrial = MenuCloudTrial
    public static StartTrial = MenuStartTrial
    public static ItemCloudLimit = MenuItemCloudLimit

    public node: React.RefObject<HTMLUListElement>; //Public because it is used by tests
    private observer: MutationObserver;

    public constructor(props: Props) {
        super(props);
        this.node = React.createRef();
        this.observer = new MutationObserver(this.hideUnneededDividers);
    }

    public hideUnneededDividers = () => { //Public because it is used by tests
        if (this.node.current === null) {
            return;
        }

        this.observer.disconnect();
        const children = Object.values(this.node.current.children).slice(0, this.node.current.children.length) as HTMLElement[];

        // Hiding dividers at beginning and duplicated ones
        let prevWasDivider = false;
        let isAtBeginning = true;
        for (const child of children) {
            if (child.classList.contains('menu-divider') || child.classList.contains('mobile-menu-divider')) {
                child.style.display = 'block';
                if (isAtBeginning || prevWasDivider) {
                    child.style.display = 'none';
                }
                prevWasDivider = true;
            } else {
                isAtBeginning = false;
                prevWasDivider = false;
            }
        }
        children.reverse();

        // Hiding trailing dividers
        for (const child of children) {
            if (child.classList.contains('menu-divider') || child.classList.contains('mobile-menu-divider')) {
                child.style.display = 'none';
            } else {
                break;
            }
        }
        this.observer.observe(this.node.current, {attributes: true, childList: true, subtree: true});
    }

    public componentDidMount() {
        this.hideUnneededDividers();
    }

    public componentDidUpdate() {
        this.hideUnneededDividers();
    }

    public componentWillUnmount() {
        this.observer.disconnect();
    }

    // Used from DotMenu component to know in which direction show the menu
    public rect() {
        if (this.node && this.node.current) {
            return this.node.current.getBoundingClientRect();
        }
        return null;
    }

    handleMenuClick = (e: React.MouseEvent) => {
        if (e.target === this.node.current) {
            e.preventDefault();
            e.stopPropagation();
        }
    }

    public render() {
        const {children, openUp, openLeft, id, listId, ariaLabel, customStyles} = this.props;
        let styles: CSSProperties = {};
        if (customStyles) {
            styles = customStyles;
        } else {
            if (openLeft) {
                styles.left = 'inherit';
                styles.right = 0;
            }
            if (openUp && !isMobile()) {
                styles.bottom = '100%';
                styles.top = 'auto';
            }
        }

        return (
            <div
                aria-label={ariaLabel}
                className='a11y__popup Menu'
                id={id}
                role='menu'
            >
                <ul
                    id={listId}
                    ref={this.node}
                    style={styles}
                    className={classNames('Menu__content dropdown-menu', this.props.className)}
                    onClick={this.handleMenuClick}
                >
                    {children}
                </ul>
            </div>
        );
    }
}
