// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {memo} from 'react';
import {useIntl} from 'react-intl';
import {useSelector, useDispatch} from 'react-redux';

import type {AppBinding} from '@mattermost/types/apps';
import type {Channel} from '@mattermost/types/channels';

import {AppCallResponseTypes, AppBindingLocations} from 'mattermost-redux/constants/apps';
import {makeAppBindingsSelector} from 'mattermost-redux/selectors/entities/apps';
import {getMyCurrentChannelMembership} from 'mattermost-redux/selectors/entities/channels';

import {handleBindingClick, openAppsModal, postEphemeralCallResponseForChannel} from 'actions/apps';
import {getChannelMobileHeaderPluginButtons} from 'selectors/plugins';

import * as Menu from 'components/menu';

import {createCallContext} from 'utils/apps';

import type {MobileChannelHeaderButtonAction} from 'types/store/plugins';

type Props = {
    channel: Channel;
    isDropdown: boolean;
}

const MobileChannelHeaderPlugins = (props: Props): JSX.Element => {
    const mobileComponents = useSelector(getChannelMobileHeaderPluginButtons);
    const channelMember = useSelector(getMyCurrentChannelMembership);
    const getChannelHeaderBindings = useSelector(makeAppBindingsSelector(AppBindingLocations.CHANNEL_HEADER_ICON));
    const intl = useIntl();
    const dispatch = useDispatch();

    const createAppButton = (binding: AppBinding) => {
        const handleAppButtonClick = () => fireAppAction(binding);

        if (props.isDropdown) {
            return (
                <Menu.Item
                    key={'mobileChannelHeaderItem' + binding.app_id + binding.location}
                    onClick={handleAppButtonClick}
                    labels={<span>{binding.label}</span>}
                />
            );
        }
        return (
            <li className='flex-parent--center'>
                <button
                    id={`${binding.app_id}_${binding.location}`}
                    className='navbar-toggle navbar-right__icon'
                    onClick={handleAppButtonClick}
                >
                    <span className='icon navbar-plugin-button'>
                        <img
                            alt=''
                            src={binding.icon}
                            width='16'
                            height='16'
                        />
                    </span>
                </button>
            </li>
        );
    };

    const createButton = (plug: MobileChannelHeaderButtonAction) => {
        const handlePluginButtonClick = () => fireAction(plug);

        if (props.isDropdown) {
            return (
                <Menu.Item
                    key={'mobileChannelHeaderItem' + plug.id}
                    id={'mobileChannelHeaderItem' + plug.id}
                    onClick={handlePluginButtonClick}
                    labels={<span>{plug.dropdownText}</span>}
                />
            );
        }

        return (
            <li className='flex-parent--center'>
                <button
                    className='navbar-toggle navbar-right__icon'
                    onClick={handlePluginButtonClick}
                >
                    <span className='icon navbar-plugin-button'>
                        {plug.icon}
                    </span>
                </button>
            </li>
        );
    };

    const createList = (plugs: MobileChannelHeaderButtonAction[]) => {
        return plugs.map(createButton);
    };

    const createAppList = (bindings: AppBinding[]) => {
        return bindings.map(createAppButton);
    };

    const fireAction = (plug: MobileChannelHeaderButtonAction) => {
        return plug.action?.(props.channel, channelMember);
    };

    const fireAppAction = async (binding: AppBinding) => {
        const {channel} = props;
        const context = createCallContext(
            binding.app_id,
            binding.location,
            channel.id,
            channel.team_id,
        );

        const handleAppResponse = (callResp: any, errorResponse?: any) => {
            if (errorResponse) {
                const errorMessage = errorResponse.text || intl.formatMessage({
                    id: 'apps.error.unknown',
                    defaultMessage: 'Unknown error occurred.',
                });
                dispatch(postEphemeralCallResponseForChannel(errorResponse, errorMessage, channel.id));
                return;
            }

            switch (callResp.type) {
            case AppCallResponseTypes.OK:
                if (callResp.text) {
                    dispatch(postEphemeralCallResponseForChannel(callResp, callResp.text, channel.id));
                }
                break;
            case AppCallResponseTypes.NAVIGATE:
                break;
            case AppCallResponseTypes.FORM:
                if (callResp.form) {
                    dispatch(openAppsModal(callResp.form, context));
                }
                break;
            default: {
                const errorMessage = intl.formatMessage({
                    id: 'apps.error.responses.unknown_type',
                    defaultMessage: 'App response type not supported. Response type: {type}.',
                }, {
                    type: callResp.type,
                });
                dispatch(postEphemeralCallResponseForChannel(callResp, errorMessage, channel.id));
            }
            }
        };

        const res = await dispatch(handleBindingClick(binding, context, intl));
        if (res.error) {
            handleAppResponse(null, res.error);
            return;
        }
        handleAppResponse(res.data!);
    };

    const components = mobileComponents || [];
    const bindings = getChannelHeaderBindings || [];

    if (components.length === 0 && bindings.length === 0) {
        return <></>;
    } else if (components.length === 1 && bindings.length === 0) {
        return createButton(components[0]);
    } else if (components.length === 0 && bindings.length === 1) {
        return createAppButton(bindings[0]);
    }

    if (!props.isDropdown) {
        return <></>;
    }

    const plugItems = createList(components);
    const appItems = createAppList(bindings);
    return (
        <>
            <Menu.Separator/>
            {appItems}
            {plugItems}
        </>

    );
};

// Exported for tests
export {MobileChannelHeaderPlugins as RawMobileChannelHeaderPlug};

export default memo(MobileChannelHeaderPlugins);
