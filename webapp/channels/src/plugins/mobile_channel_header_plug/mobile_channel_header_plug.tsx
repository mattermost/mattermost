// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {injectIntl} from 'react-intl';

import {AppCallResponseTypes} from 'mattermost-redux/constants/apps';

import {createCallContext} from 'utils/apps';

import type {AppBinding} from '@mattermost/types/apps';
import type {Channel, ChannelMembership} from '@mattermost/types/channels';
import type {Theme} from 'mattermost-redux/selectors/entities/preferences';
import type {IntlShape} from 'react-intl';
import type {HandleBindingClick, OpenAppsModal, PostEphemeralCallResponseForChannel} from 'types/apps';
import type {PluginComponent} from 'types/store/plugins';

type Props = {

    /*
     * Components or actions to add as channel header buttons
     */
    components?: PluginComponent[];

    /*
     * Set to true if the plug is in the dropdown
     */
    isDropdown: boolean;
    channel: Channel;
    channelMember?: ChannelMembership;

    /*
     * Logged in user's theme
     */
    theme: Theme;
    appBindings: AppBinding[];
    appsEnabled: boolean;
    intl: IntlShape;
    actions: {
        handleBindingClick: HandleBindingClick;
        postEphemeralCallResponseForChannel: PostEphemeralCallResponseForChannel;
        openAppsModal: OpenAppsModal;
    };
}

class MobileChannelHeaderPlug extends React.PureComponent<Props> {
    createAppButton = (binding: AppBinding) => {
        const onClick = () => this.fireAppAction(binding);

        if (this.props.isDropdown) {
            return (
                <li
                    key={'mobileChannelHeaderItem' + binding.app_id + binding.location}
                    role='presentation'
                    className='MenuItem'
                >
                    <a
                        role='menuitem'
                        href='#'
                        onClick={onClick}
                    >
                        {binding.label}
                    </a>
                </li>
            );
        }

        return (
            <li className='flex-parent--center'>
                <button
                    id={`${binding.app_id}_${binding.location}`}
                    className='navbar-toggle navbar-right__icon'
                    onClick={onClick}
                >
                    <span className='icon navbar-plugin-button'>
                        <img
                            src={binding.icon}
                            width='16'
                            height='16'
                        />
                    </span>
                </button>
            </li>
        );
    };
    createButton = (plug: PluginComponent) => {
        const onClick = () => this.fireAction(plug);

        if (this.props.isDropdown) {
            return (
                <li
                    key={'mobileChannelHeaderItem' + plug.id}
                    role='presentation'
                    className='MenuItem'
                >
                    <a
                        role='menuitem'
                        href='#'
                        onClick={onClick}
                    >
                        {plug.dropdownText}
                    </a>
                </li>
            );
        }

        return (
            <li className='flex-parent--center'>
                <button
                    className='navbar-toggle navbar-right__icon'
                    onClick={onClick}
                >
                    <span className='icon navbar-plugin-button'>
                        {plug.icon}
                    </span>
                </button>
            </li>
        );
    };

    createList(plugs: PluginComponent[]) {
        return plugs.map(this.createButton);
    }

    createAppList(bindings: AppBinding[]) {
        return bindings.map(this.createAppButton);
    }

    fireAction(plug: PluginComponent) {
        return plug.action?.(this.props.channel, this.props.channelMember);
    }

    fireAppAction = async (binding: AppBinding) => {
        const {channel, intl} = this.props;
        const context = createCallContext(
            binding.app_id,
            binding.location,
            channel.id,
            channel.team_id,
        );

        const res = await this.props.actions.handleBindingClick(binding, context, intl);

        if (res.error) {
            const errorResponse = res.error;
            const errorMessage = errorResponse.text || intl.formatMessage({
                id: 'apps.error.unknown',
                defaultMessage: 'Unknown error occurred.',
            });
            this.props.actions.postEphemeralCallResponseForChannel(errorResponse, errorMessage, channel.id);
            return;
        }

        const callResp = res.data!;
        switch (callResp.type) {
        case AppCallResponseTypes.OK:
            if (callResp.text) {
                this.props.actions.postEphemeralCallResponseForChannel(callResp, callResp.text, channel.id);
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
            const errorMessage = this.props.intl.formatMessage({
                id: 'apps.error.responses.unknown_type',
                defaultMessage: 'App response type not supported. Response type: {type}.',
            }, {
                type: callResp.type,
            });
            this.props.actions.postEphemeralCallResponseForChannel(callResp, errorMessage, channel.id);
        }
        }
    };

    render() {
        const components = this.props.components || [];
        const bindings = this.props.appBindings || [];

        if (components.length === 0 && bindings.length === 0) {
            return null;
        } else if (components.length === 1 && bindings.length === 0) {
            return this.createButton(components[0]);
        } else if (components.length === 0 && bindings.length === 1) {
            return this.createAppButton(bindings[0]);
        }

        if (!this.props.isDropdown) {
            return null;
        }

        const plugItems = this.createList(components);
        const appItems = this.createAppList(bindings);
        return (<>
            {plugItems}
            {appItems}
        </>);
    }
}

// Exported for tests
export {MobileChannelHeaderPlug as RawMobileChannelHeaderPlug};

export default injectIntl(MobileChannelHeaderPlug);
