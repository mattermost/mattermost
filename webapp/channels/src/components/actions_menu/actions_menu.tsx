// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import type {IntlShape} from 'react-intl';
import {injectIntl} from 'react-intl';

import type {Post} from '@mattermost/types/posts';

import MarketplaceModal from 'components/plugin_marketplace/marketplace_modal';
import Menu from 'components/widgets/menu/menu';
import MenuWrapper from 'components/widgets/menu/menu_wrapper';

import Pluggable from 'plugins/pluggable';
import {Constants, Locations, ModalIdentifiers} from 'utils/constants';
import * as PostUtils from 'utils/post_utils';

import type {ModalData} from 'types/actions';
import type {PostDropdownMenuAction, PostDropdownMenuItemComponent} from 'types/store/plugins';

import ActionsMenuButton from './actions_menu_button';
import ActionsMenuEmptyPopover from './actions_menu_empty_popover';
import {ActionsMenuIcon} from './actions_menu_icon';

import './actions_menu.scss';

const MENU_BOTTOM_MARGIN = 80;

export const PLUGGABLE_COMPONENT = 'PostDropdownMenuItem';
export type Props = {
    handleDropdownOpened: (open: boolean) => void;
    intl: IntlShape;
    isMenuOpen: boolean;
    isSysAdmin: boolean;
    location?: 'CENTER' | 'RHS_ROOT' | 'RHS_COMMENT' | 'SEARCH' | string;
    pluginMenuItems?: PostDropdownMenuAction[];
    post: Post;
    teamId: string;
    canOpenMarketplace: boolean;

    /**
     * Components for overriding provided by plugins
     */
    pluginMenuItemComponents: PostDropdownMenuItemComponent[];

    actions: {

        /**
         * Function to open a modal
         */
        openModal: <P>(modalData: ModalData<P>) => void;
    }; // TechDebt: Made non-mandatory while converting to typescript
};

type State = {
    openUp: boolean;
};

export class ActionMenuClass extends React.PureComponent<Props, State> {
    public static defaultProps: Partial<Props> = {
        location: Locations.CENTER,
        pluginMenuItems: [],
    };
    private buttonElement: HTMLButtonElement | null = null;

    constructor(props: Props) {
        super(props);

        this.state = {
            openUp: false,
        };
    }

    private buttonRef = (element: HTMLButtonElement | null) => {
        this.buttonElement = element;
    };

    handleOpenMarketplace = (): void => {
        this.closeDropdown();

        // Wait for the menu to close to avoid clashing between the menu's focus trap and the modal's
        requestAnimationFrame(() => {
            const openMarketplaceData = {
                modalId: ModalIdentifiers.PLUGIN_MARKETPLACE,
                dialogType: MarketplaceModal,
            };
            this.props.actions.openModal(openMarketplaceData);
        });
    };

    renderDivider = (suffix: string): React.ReactNode => {
        return (
            <li
                id={`divider_post_${this.props.post.id}_${suffix}`}
                className='MenuItem__divider'
                role='menuitem'
            />
        );
    };

    openDropdown = () => {
        this.props.handleDropdownOpened(true);
    };

    closeDropdown = () => {
        this.props.handleDropdownOpened(false);
    };

    handleDropdownOpened = (open: boolean) => {
        this.props.handleDropdownOpened(open);

        if (!open) {
            return;
        }

        const buttonRect = this.buttonElement?.getBoundingClientRect();
        let y;
        if (typeof buttonRect?.y === 'undefined') {
            y = typeof buttonRect?.top == 'undefined' ? 0 : buttonRect?.top;
        } else {
            y = buttonRect?.y;
        }
        const windowHeight = window.innerHeight;

        const totalSpace = windowHeight - MENU_BOTTOM_MARGIN;
        const spaceOnTop = y - Constants.CHANNEL_HEADER_HEIGHT;
        const spaceOnBottom = (totalSpace - (spaceOnTop + Constants.POST_AREA_HEIGHT));

        this.setState({
            openUp: (spaceOnTop > spaceOnBottom),
        });
    };

    render(): React.ReactNode {
        const isSystemMessage = PostUtils.isSystemMessage(this.props.post);
        if (isSystemMessage) {
            return null;
        }

        const pluginItems = this.props.pluginMenuItems?.
            filter((item) => {
                return item.filter ? item.filter(this.props.post.id) : item;
            }).
            map((item) => {
                if (item.subMenu) {
                    return (
                        <Menu.ItemSubMenu
                            key={item.id + '_pluginmenuitem'}
                            id={item.id}
                            postId={this.props.post.id}
                            text={item.text}
                            subMenu={item.subMenu}
                            action={item.action}
                            root={true}
                        />
                    );
                }
                return (
                    <Menu.ItemAction
                        key={item.id + '_pluginmenuitem'}
                        text={item.text}
                        onClick={() => {
                            if (item.action) {
                                item.action(this.props.post.id);
                            }
                        }}
                    />
                );
            });

        const {formatMessage} = this.props.intl;

        let marketPlace = null;
        if (this.props.canOpenMarketplace) {
            marketPlace = (
                <React.Fragment key={'marketplace'}>
                    {this.renderDivider('marketplace')}
                    <Menu.ItemAction
                        id={`marketplace_icon_${this.props.post.id}`}
                        key={`marketplace_${this.props.post.id}`}
                        show={true}
                        text={formatMessage({id: 'post_info.marketplace', defaultMessage: 'App Marketplace'})}
                        icon={<ActionsMenuIcon name='icon-view-grid-plus-outline'/>}
                        onClick={this.handleOpenMarketplace}
                    />
                </React.Fragment>
            );
        }

        const hasPluggables = Boolean(this.props.pluginMenuItemComponents?.length);
        const hasPluginItems = Boolean(pluginItems?.length);

        const hasPluginMenuItems = hasPluginItems || hasPluggables;
        if (!this.props.canOpenMarketplace && !hasPluginMenuItems) {
            return null;
        }

        const buttonId = `${this.props.location}_actions_button_${this.props.post.id}`;
        const popupId = `${this.props.location}_actions_dropdown_${this.props.post.id}`;

        if (hasPluginMenuItems) {
            const pluggable = (
                <Pluggable
                    postId={this.props.post.id}
                    pluggableName={PLUGGABLE_COMPONENT}
                    key={this.props.post.id + 'pluggable'}
                />
            );

            const menuItems = [
                pluginItems,
                pluggable,
                marketPlace,
            ];

            return (
                <MenuWrapper
                    open={this.props.isMenuOpen}
                    onToggle={this.handleDropdownOpened}
                >
                    <ActionsMenuButton
                        ref={this.buttonRef}
                        buttonId={buttonId}
                        popupId={popupId}
                        isMenuOpen={this.props.isMenuOpen}
                    />
                    <Menu
                        listId={popupId}
                        openLeft={true}
                        openUp={this.state.openUp}
                        ariaLabel={formatMessage({id: 'post_info.menuAriaLabel', defaultMessage: 'Post extra options'})}
                    >
                        {menuItems}
                    </Menu>
                </MenuWrapper>
            );
        } else if (this.props.isSysAdmin) {
            return (
                <>

                    <ActionsMenuButton
                        ref={this.buttonRef}
                        buttonId={buttonId}
                        onClick={this.openDropdown}
                        popupId={popupId}
                        isMenuOpen={this.props.isMenuOpen}
                    />
                    <ActionsMenuEmptyPopover
                        anchorElement={this.buttonElement}
                        onOpenMarketplace={this.handleOpenMarketplace}
                        onToggle={this.props.handleDropdownOpened}
                        isOpen={this.props.isMenuOpen}
                    />
                </>
            );
        }

        return null;
    }
}

export default injectIntl(ActionMenuClass);
