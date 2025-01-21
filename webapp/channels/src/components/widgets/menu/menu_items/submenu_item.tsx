// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React from 'react';
import type {CSSProperties} from 'react';
import {injectIntl} from 'react-intl';
import type {WrappedComponentProps} from 'react-intl';

import {showMobileSubMenuModal} from 'actions/global_actions';

import Constants from 'utils/constants';
import * as Keyboard from 'utils/keyboard';

import type {Menu} from 'types/store/plugins';

import {isMobile as isMobileViewHack} from '../is_mobile_view_hack';

import './menu_item.scss';

// Requires an object conforming to a submenu structure passed to registerPostDropdownSubMenuAction
// of the form:
// {
//     "id": "A",
//     "parentMenuId": null,
//     "text": "A text",
//     "subMenu": [
//         {
//             "id": "B",
//             "parentMenuId": "A",
//             "text": "B text"
//             "subMenu": [],
//             "action": () => {},
//             "filter": () => {},
//         }
//     ],
//     "action": () => {},
//     "filter": () => {},
// }
// Submenus can contain Submenus as well

export type Props = WrappedComponentProps & {
    id?: string;
    postId?: string;
    text: React.ReactNode;
    selectedValueText?: React.ReactNode;
    renderSelected?: boolean;
    subMenu?: Menu[];
    subMenuClass?: string;
    icon?: React.ReactNode;
    action?: (id: string) => void;
    filter?: (id: string) => boolean;
    ariaLabel?: string;
    root?: boolean;
    show?: boolean;
    direction?: 'left' | 'right';
    openUp?: boolean;
    styleSelectableItem?: boolean;
    extraText?: string| JSX.Element;
    rightDecorator?: React.ReactNode;
    isHeader?: boolean;
    tabIndex?: number;
}

type State = {
    show: boolean;
}

/**
 * @deprecated Use the "webapp/channels/src/components/menu" instead.
 */
export class SubMenuItem extends React.PureComponent<Props, State> {
    private node: React.RefObject<HTMLLIElement>;

    public static defaultProps = {
        show: true,
        direction: 'left' as const,
        subMenuClass: 'pl-4',
        renderSelected: true,
    };

    public constructor(props: Props) {
        super(props);
        this.node = React.createRef();

        this.state = {
            show: false,
        };
    }

    show = () => {
        this.setState({show: true});
    };

    hide = () => {
        this.setState({show: false});
    };

    private onClick = (event: React.SyntheticEvent<HTMLElement>| React.BaseSyntheticEvent<HTMLElement>) => {
        event.preventDefault();
        const {id, postId, subMenu, action, root, isHeader} = this.props;
        const isMobile = isMobileViewHack();
        if (isHeader) {
            event.stopPropagation();
            return;
        }
        if (isMobile) {
            if (subMenu && subMenu.length) { // if contains a submenu, call openModal with it
                if (!root) { //required to close only the original menu
                    event.stopPropagation();
                }
                showMobileSubMenuModal(subMenu);
            } else if (action) { // leaf node in the tree handles action only
                action(postId || '');
            }
        } else {
            const shouldCallAction =
                (event.type === 'keydown' && event.currentTarget.id === id) ||
                event.target.parentElement.id === id;
            if (shouldCallAction && action) {
                action(postId || '');
            }
        }
    };

    handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
        if (Keyboard.isKeyPressed(event, Constants.KeyCodes.ENTER)) {
            if (this.props.action) {
                this.onClick(event);
            } else {
                this.show();
            }
        }

        if (Keyboard.isKeyPressed(event, Constants.KeyCodes.RIGHT)) {
            if (this.props.direction === 'right') {
                this.show();
            } else {
                this.hide();
            }
        }

        if (Keyboard.isKeyPressed(event, Constants.KeyCodes.LEFT)) {
            if (this.props.direction === 'left') {
                this.show();
            } else {
                this.hide();
            }
        }
    };

    public render() {
        const {id, postId, text, selectedValueText, subMenu, icon, filter, ariaLabel, direction, styleSelectableItem, extraText, renderSelected, rightDecorator, tabIndex, intl} = this.props;
        const isMobile = isMobileViewHack();

        if (filter && !filter(id || '')) {
            return ('');
        }

        let textProp = text;
        if (icon) {
            textProp = (
                <>
                    <span className={classNames(['icon', {'sorting-menu-icon': styleSelectableItem}])}>{icon}</span>
                    {textProp}
                </>
            );
        }

        const hasSubmenu = subMenu && subMenu.length;
        const subMenuStyle: CSSProperties = {
            visibility: (this.state.show && hasSubmenu && !isMobile ? 'visible' : 'hidden') as 'visible' | 'hidden',
            top: this.node && this.node.current ? String(this.node.current.offsetTop) + 'px' : 'unset',
        };

        const menuOffset = '100%';
        if (direction === 'left') {
            subMenuStyle.right = menuOffset;
        } else {
            subMenuStyle.left = menuOffset;
        }

        let subMenuContent: React.ReactNode = '';

        if (!isMobile) {
            subMenuContent = (
                <ul
                    className={classNames(['a11y__popup Menu dropdown-menu SubMenu', {styleSelectableItem}])}
                    style={subMenuStyle}
                    id={`${id}_submenu`}
                >
                    {hasSubmenu ? subMenu!.map((s) => {
                        const hasDivider = s.id === 'ChannelMenu-moveToDivider';
                        let aria = ariaLabel;
                        if (s.action) {
                            aria = s.text === selectedValueText ? s.text + ' ' + intl.formatMessage({id: 'sidebar.menu.item.selected', defaultMessage: 'selected'}) : s.text + ' ' + intl.formatMessage({id: 'sidebar.menu.item.notSelected', defaultMessage: 'not selected'});
                        }
                        return (
                            <span
                                className={classNames(['SubMenuItemContainer', {hasDivider}])}
                                key={s.id}
                                tabIndex={s.id.includes('Divider') ? 1 : 0}
                            >
                                <SubMenuItem
                                    id={s.id}
                                    postId={postId}
                                    text={s.text}
                                    selectedValueText={s.selectedValueText}
                                    icon={s.icon}
                                    subMenu={s.subMenu}
                                    action={s.action}
                                    filter={s.filter}
                                    ariaLabel={aria}
                                    root={false}
                                    direction={s.direction}
                                    isHeader={s.isHeader}
                                    tabIndex={1}
                                    intl={this.props.intl}
                                />
                                {s.text === selectedValueText && <span className='sorting-menu-checkbox'>
                                    <i className='icon-check'/>
                                </span>}
                            </span>
                        );
                    }) : ''}
                </ul>
            );
        }

        return (
            <li
                className={classNames(['SubMenuItem MenuItem', {styleSelectableItem}])}
                role='menuitem'
                id={id + '_menuitem'}
                ref={this.node}
                onClick={this.onClick}
                {...(Boolean(hasSubmenu) && {'aria-haspopup': 'menu', 'aria-controls': id + '_submenu', 'aria-expanded': this.state.show})}
            >
                <div
                    className={classNames([{styleSelectableItemDiv: styleSelectableItem}])}
                    id={id}
                    aria-label={ariaLabel}
                    onMouseEnter={this.show}
                    role='button'
                    onMouseLeave={this.hide}
                    tabIndex={tabIndex ?? 0}
                    onKeyDown={this.handleKeyDown}
                >
                    <div className={icon ? 'grid' : 'flex'}>
                        {textProp}{rightDecorator}
                        {renderSelected && <span className='selected'>{selectedValueText}</span>}
                        {id !== 'ChannelMenu-moveToDivider' &&
                            <span
                                id={'channelHeaderDropdownIconRight_' + id}
                                className={classNames([`fa fa-angle-right SubMenu__icon-right${hasSubmenu ? '' : '-empty'}`, {mobile: isMobile}])}
                                aria-label={intl.formatMessage({id: 'post_info.submenu.icon', defaultMessage: 'submenu icon'}).toLowerCase()}
                            />
                        }
                    </div>
                    {extraText && <span className='MenuItem__help-text'>{extraText}</span>}
                    {subMenuContent}
                </div>
            </li>
        );
    }
}

export default injectIntl(SubMenuItem);
