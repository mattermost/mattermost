// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React from 'react';
import type {IntlShape} from 'react-intl';
import {FormattedMessage, injectIntl} from 'react-intl';

import type {AppBinding} from '@mattermost/types/apps';
import type {Post} from '@mattermost/types/posts';

import {AppCallResponseTypes} from 'mattermost-redux/constants/apps';
import Permissions from 'mattermost-redux/constants/permissions';
import type {ActionResult} from 'mattermost-redux/types/actions';

import SystemPermissionGate from 'components/permissions_gates/system_permission_gate';
import type {OpenedFromType} from 'components/plugin_marketplace/marketplace_modal';
import MarketplaceModal from 'components/plugin_marketplace/marketplace_modal';
import Menu from 'components/widgets/menu/menu';
import MenuWrapper from 'components/widgets/menu/menu_wrapper';
import WithTooltip from 'components/with_tooltip';

import Pluggable from 'plugins/pluggable';
import {createCallContext} from 'utils/apps';
import {Constants, Locations, ModalIdentifiers} from 'utils/constants';
import * as PostUtils from 'utils/post_utils';

import type {ModalData} from 'types/actions';
import type {HandleBindingClick, OpenAppsModal, PostEphemeralCallResponseForPost} from 'types/apps';
import type {PostDropdownMenuAction, PostDropdownMenuItemComponent} from 'types/store/plugins';

import {ActionsMenuIcon} from './actions_menu_icon';

import './actions_menu.scss';

const MENU_BOTTOM_MARGIN = 80;

export const PLUGGABLE_COMPONENT = 'PostDropdownMenuItem';
export type Props = {
    appBindings: AppBinding[] | null;
    appsEnabled: boolean;
    handleDropdownOpened?: (open: boolean) => void;
    intl: IntlShape;
    isMenuOpen?: boolean;
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

        /**
         * Function to post the ephemeral message for a call response
         */
        postEphemeralCallResponseForPost: PostEphemeralCallResponseForPost;

        /**
         * Function to handle clicking of any post-menu bindings
         */
        handleBindingClick: HandleBindingClick;

        /**
         * Function to open the Apps modal with a form
         */
        openAppsModal: OpenAppsModal;

        /**
         * Function to get the post menu bindings for this post.
         */
        fetchBindings: (channelId: string, teamId: string) => Promise<ActionResult<AppBinding[]>>;

    }; // TechDebt: Made non-mandatory while converting to typescript
}

type State = {
    openUp: boolean;
    appBindings?: AppBinding[];
}

export class ActionMenuClass extends React.PureComponent<Props, State> {
    public static defaultProps: Partial<Props> = {
        appBindings: [],
        location: Locations.CENTER,
        pluginMenuItems: [],
    };
    private buttonRef: React.RefObject<HTMLButtonElement>;

    constructor(props: Props) {
        super(props);

        this.state = {
            openUp: false,
        };

        this.buttonRef = React.createRef<HTMLButtonElement>();
    }

    componentDidUpdate(prevProps: Props) {
        if (this.props.isMenuOpen && !prevProps.isMenuOpen) {
            this.fetchBindings();
        }
    }

    static getDerivedStateFromProps(props: Props) {
        const state: Partial<State> = {};
        if (props.appBindings) {
            state.appBindings = props.appBindings;
        }
        return state;
    }

    fetchBindings = () => {
        if (this.props.appsEnabled && !this.state.appBindings) {
            this.props.actions.fetchBindings(this.props.post.channel_id, this.props.teamId).then(({data}) => {
                this.setState({appBindings: data});
            });
        }
    };

    handleOpenMarketplace = (): void => {
        const openedFrom: OpenedFromType = 'actions_menu';
        const openMarketplaceData = {
            modalId: ModalIdentifiers.PLUGIN_MARKETPLACE,
            dialogType: MarketplaceModal,
            dialogProps: {openedFrom},
        };
        this.props.actions.openModal(openMarketplaceData);
    };

    onClickAppBinding = async (binding: AppBinding) => {
        const {post, intl} = this.props;

        const context = createCallContext(
            binding.app_id,
            binding.location,
            this.props.post.channel_id,
            this.props.teamId,
            this.props.post.id,
            this.props.post.root_id,
        );

        const res = await this.props.actions.handleBindingClick(binding, context, intl);

        if (res.error) {
            const errorResponse = res.error;
            const errorMessage = errorResponse.text || intl.formatMessage({
                id: 'apps.error.unknown',
                defaultMessage: 'Unknown error occurred.',
            });
            this.props.actions.postEphemeralCallResponseForPost(errorResponse, errorMessage, post);
            return;
        }

        const callResp = res.data!;
        switch (callResp.type) {
        case AppCallResponseTypes.OK:
            if (callResp.text) {
                this.props.actions.postEphemeralCallResponseForPost(callResp, callResp.text, post);
            }
            break;
        case AppCallResponseTypes.NAVIGATE:
            break;
        case AppCallResponseTypes.FORM:
            if (callResp.form) {
                this.props.actions.openAppsModal(callResp.form, context);
            }
            break;
        default: {
            const errorMessage = intl.formatMessage({
                id: 'apps.error.responses.unknown_type',
                defaultMessage: 'App response type not supported. Response type: {type}.',
            }, {
                type: callResp.type,
            });
            this.props.actions.postEphemeralCallResponseForPost(callResp, errorMessage, post);
        }
        }
    };

    visitMarketplaceTip(): React.ReactElement {
        return (
            <SystemPermissionGate
                permissions={[Permissions.MANAGE_SYSTEM]}
                key='visit-marketplace-permissions'
            >
                <div className='visit-marketplace-text' >
                    <p>
                        <FormattedMessage
                            id='post_info.actions.noActions.first_line'
                            defaultMessage='No Actions currently'
                        />
                    </p>
                    <p>
                        <FormattedMessage
                            id='post_info.actions.noActions.second_line'
                            defaultMessage='configured for this server'
                        />
                    </p>
                </div>
                <div className='visit-marketplace' >
                    <button
                        id='marketPlaceButton'
                        className='btn btn-primary visit-marketplace-button'
                        onClick={this.handleOpenMarketplace}
                    >
                        <ActionsMenuIcon name='icon-view-grid-plus-outline visit-marketplace-button-icon'/>
                        <span className='visit-marketplace-button-text'>
                            <FormattedMessage
                                id='post_info.actions.visitMarketplace'
                                defaultMessage='Visit the Marketplace'
                            />
                        </span>
                    </button>
                </div>
            </SystemPermissionGate>
        );
    }

    renderDivider = (suffix: string): React.ReactNode => {
        return (
            <li
                id={`divider_post_${this.props.post.id}_${suffix}`}
                className='MenuItem__divider'
                role='menuitem'
            />
        );
    };

    handleDropdownOpened = (open: boolean) => {
        this.props.handleDropdownOpened?.(open);

        if (!open) {
            return;
        }

        const buttonRect = this.buttonRef.current?.getBoundingClientRect();
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
            }) || [];

        let appBindings = [] as JSX.Element[];
        if (this.props.appsEnabled && this.state.appBindings) {
            appBindings = this.state.appBindings.map((item) => {
                let icon: JSX.Element | undefined;
                if (item.icon) {
                    icon = (
                        <img
                            key={item.app_id + 'app_icon'}
                            src={item.icon}
                        />);
                }

                return (
                    <Menu.ItemAction
                        text={item.label}
                        key={item.app_id + item.location}
                        onClick={() => this.onClickAppBinding(item)}
                        icon={icon}
                    />
                );
            });
        }

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

        let menuItems;
        const hasApps = Boolean(appBindings.length);
        const hasPluggables = Boolean(this.props.pluginMenuItemComponents?.length);
        const hasPluginItems = Boolean(pluginItems?.length);

        const hasPluginMenuItems = hasPluginItems || hasApps || hasPluggables;
        if (!this.props.canOpenMarketplace && !hasPluginMenuItems) {
            return null;
        }

        if (hasPluginMenuItems) {
            const pluggable = (
                <Pluggable
                    postId={this.props.post.id}
                    pluggableName={PLUGGABLE_COMPONENT}
                    key={this.props.post.id + 'pluggable'}
                />);

            menuItems = [
                pluginItems,
                appBindings,
                pluggable,
                marketPlace,
            ];
        } else {
            menuItems = [this.visitMarketplaceTip()];
            if (!this.props.isSysAdmin) {
                return null;
            }
        }

        return (
            <MenuWrapper
                open={this.props.isMenuOpen}
                onToggle={this.handleDropdownOpened}
            >
                <WithTooltip
                    title={
                        <FormattedMessage
                            id='post_info.tooltip.actions'
                            defaultMessage='Message actions'
                        />
                    }
                >
                    <button
                        key='more-actions-button'
                        ref={this.buttonRef}
                        id={`${this.props.location}_actions_button_${this.props.post.id}`}
                        aria-label={formatMessage({id: 'post_info.actions.tooltip.actions', defaultMessage: 'Actions'}).toLowerCase()}
                        className={classNames('post-menu__item', {
                            'post-menu__item--active': this.props.isMenuOpen,
                        })}
                        type='button'
                        aria-expanded='false'
                    >
                        <i className={'icon icon-apps'}/>
                    </button>
                </WithTooltip>
                <Menu
                    id={`${this.props.location}_actions_dropdown_${this.props.post.id}`}
                    openLeft={true}
                    openUp={this.state.openUp}
                    ariaLabel={formatMessage({id: 'post_info.menuAriaLabel', defaultMessage: 'Post extra options'})}
                    key={`${this.props.location}_actions_dropdown_${this.props.post.id}`}
                >
                    {menuItems}
                </Menu>
            </MenuWrapper >
        );
    }
}

export default injectIntl(ActionMenuClass);
