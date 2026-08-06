// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/* eslint-disable react/no-multi-comp */

import React from 'react';
import {Dropdown} from 'react-bootstrap';
import {FormattedMessage, injectIntl} from 'react-intl';
import type {IntlShape} from 'react-intl';
import {RootCloseWrapper} from 'react-overlays';

import {WithTooltip} from '@mattermost/shared/components/tooltip';
import type {Channel, ChannelMembership} from '@mattermost/types/channels';

import HeaderIconWrapper from 'components/channel_header/components/header_icon_wrapper';
import PluginChannelHeaderIcon from 'components/widgets/icons/plugin_channel_header_icon';

import {Constants} from 'utils/constants';

import type {ChannelHeaderButtonAction, PluggableText} from 'types/store/plugins';

type CustomMenuProps = {
    open?: boolean;
    children?: React.ReactNode;
    onClose: () => void;
    rootCloseEvent?: 'click' | 'mousedown';

    //  A bsRole prop is required by React Bootstrap's Dropdown
    // eslint-disable-next-line react/no-unused-prop-types
    bsRole: string;
};

export const maxComponentsBeforeDropdown = 15;

class CustomMenu extends React.PureComponent<CustomMenuProps> {
    handleRootClose = () => {
        this.props.onClose();
    };

    render() {
        const {
            open,
            rootCloseEvent,
            children,
        } = this.props;

        return (
            <RootCloseWrapper
                disabled={!open}
                onRootClose={this.handleRootClose}
                event={rootCloseEvent}
            >
                <ul
                    role='menu'
                    className='dropdown-menu channel-header_plugin-dropdown'
                >
                    {children}
                </ul>
            </RootCloseWrapper>
        );
    }
}

type CustomToggleProps = {
    children?: React.ReactNode;
    dropdownOpen?: boolean;
    onClick?: (e: React.MouseEvent) => void;

    //  A bsRole prop is required by React Bootstrap's Dropdown
    // eslint-disable-next-line react/no-unused-prop-types
    bsRole: string;
};

class CustomToggle extends React.PureComponent<CustomToggleProps> {
    handleClick = (e: React.MouseEvent) => {
        if (this.props.onClick) {
            this.props.onClick(e);
        }
    };

    render() {
        const {children} = this.props;

        let activeClass = '';
        if (this.props.dropdownOpen) {
            activeClass = ' channel-header__icon--active';
        }

        return (
            <button
                id='pluginChannelHeaderButtonDropdown'
                className={'channel-header__icon channel-header__icon--wide ' + activeClass}
                type='button'
                onClick={this.handleClick}
            >
                {children}
            </button>
        );
    }
}

type ChannelHeaderPlugProps = {
    intl: IntlShape;
    components: ChannelHeaderButtonAction[];
    channel: Channel;
    channelMember?: ChannelMembership;
    sidebarOpen: boolean;
    shouldShowAppBar: boolean;
};

type ChannelHeaderPlugState = {
    dropdownOpen: boolean;
};

class ChannelHeaderPlug extends React.PureComponent<ChannelHeaderPlugProps, ChannelHeaderPlugState> {
    public static defaultProps: Partial<ChannelHeaderPlugProps> = {
        components: [],
    };

    private disableButtonsClosingRHS = false;

    constructor(props: ChannelHeaderPlugProps) {
        super(props);
        this.state = {
            dropdownOpen: false,
        };
    }

    componentDidUpdate(prevProps: ChannelHeaderPlugProps) {
        if (prevProps.sidebarOpen && !this.props.sidebarOpen) {
            this.disableButtonsClosingRHS = true;

            setTimeout(() => {
                this.disableButtonsClosingRHS = false;
            }, Constants.CHANNEL_HEADER_BUTTON_DISABLE_TIMEOUT);
        }
    }

    toggleDropdown = (dropdownOpen: boolean) => {
        this.setState({dropdownOpen});
    };

    onClose = () => {
        this.toggleDropdown(false);
    };

    fireAction = (action: (channel: Channel, channelMember?: ChannelMembership) => void) => {
        if (this.disableButtonsClosingRHS) {
            return;
        }

        action(this.props.channel, this.props.channelMember);
    };

    fireActionAndClose = (action: (channel: Channel, channelMember?: ChannelMembership) => void) => {
        action(this.props.channel, this.props.channelMember);
        this.onClose();
    };

    createComponentButton = (plug: ChannelHeaderButtonAction) => {
        // These values are supposed to be strings based on PluginComponent, but some plugins pass non-strings,
        // so do some hacky stuff to try to convert it back to a string. DO NOT USE THIS ELSEWHERE!
        function tooltipToAriaLabelHack(intl: IntlShape, stringOrElement: PluggableText) {
            if (typeof stringOrElement === 'string') {
                // This is the case that we hope for
                return stringOrElement;
            }

            if (!stringOrElement) {
                return '';
            }

            if (typeof stringOrElement === 'object' && 'type' in stringOrElement && stringOrElement.type === FormattedMessage) {
                // This is a FormattedMessage, so extract the props to translate the text manually
                return intl.formatMessage(
                    {
                        id: stringOrElement.props.id,
                        defaultMessage: stringOrElement.props.defaultMessage,
                    },
                    stringOrElement.props.value,
                );
            }

            return '';
        }

        let ariaLabel;
        if (plug.tooltipText) {
            ariaLabel = tooltipToAriaLabelHack(this.props.intl, plug.tooltipText);
        } else if (plug.dropdownText) {
            ariaLabel = tooltipToAriaLabelHack(this.props.intl, plug.dropdownText);
        }

        // TODO: Remove this any and make sure the types are properly
        // handled.
        const tooltipText: any = plug.tooltipText ?? plug.dropdownText ?? '';

        return (
            <HeaderIconWrapper
                key={'channelHeaderButton' + plug.id}
                buttonClass='channel-header__icon'
                onClick={() => this.fireAction(plug.action!)}
                buttonId={plug.id + 'ChannelHeaderButton'}
                tooltip={tooltipText}
                ariaLabelOverride={ariaLabel}
                pluginId={plug.pluginId}
            >
                {plug.icon}
            </HeaderIconWrapper>
        );
    };

    createDropdown = (plugs: ChannelHeaderButtonAction[]) => {
        const items = plugs.filter((plug) => plug.action).map((plug) => {
            return (
                <li
                    key={'channelHeaderPlug' + plug.id}
                >
                    <a
                        href='#'
                        className='d-flex align-items-center'
                        onClick={() => this.fireActionAndClose(plug.action!)}
                    >
                        <span className='d-flex align-items-center overflow--ellipsis'>{plug.icon}</span>
                        <span>{plug.dropdownText}</span>
                    </a>
                </li>
            );
        });

        return (
            <div className='flex-child'>
                <Dropdown
                    id='channelHeaderPlugDropdown'
                    onToggle={this.toggleDropdown}
                    open={this.state.dropdownOpen}
                >
                    <CustomToggle
                        bsRole='toggle'
                        dropdownOpen={this.state.dropdownOpen}
                    >
                        <WithTooltip
                            title={
                                <FormattedMessage
                                    id='generic_icons.plugins'
                                    defaultMessage='Plugins'
                                />
                            }
                        >
                            <>
                                <PluginChannelHeaderIcon
                                    id='pluginChannelHeaderIcon'
                                    className='icon icon--standard icon__pluginChannelHeader'
                                    aria-hidden='true'
                                />
                                <span
                                    id='pluginCount'
                                    className='icon__text'
                                >
                                    {items.length}
                                </span>
                            </>
                        </WithTooltip>
                    </CustomToggle>
                    <CustomMenu
                        bsRole='menu'
                        open={this.state.dropdownOpen}
                        onClose={this.onClose}
                    >
                        {items}
                    </CustomMenu>
                </Dropdown>
            </div>
        );
    };

    render() {
        const components = this.props.components || [];
        if (this.props.shouldShowAppBar || components.length === 0) {
            return null;
        } else if (components.length <= maxComponentsBeforeDropdown) {
            return components.filter((plug) => plug.icon && plug.action).map(this.createComponentButton);
        }

        return this.createDropdown(components);
    }
}

export default injectIntl(ChannelHeaderPlug);
/* eslint-enable react/no-multi-comp */
