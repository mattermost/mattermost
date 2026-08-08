// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {memo} from 'react';
import {useSelector} from 'react-redux';

import type {Channel} from '@mattermost/types/channels';

import {getMyCurrentChannelMembership} from 'mattermost-redux/selectors/entities/channels';

import {getChannelMobileHeaderPluginButtons} from 'selectors/plugins';

import * as Menu from 'components/menu';

import type {MobileChannelHeaderButtonAction} from 'types/store/plugins';

type Props = {
    channel: Channel;
    isDropdown: boolean;
};

const MobileChannelHeaderPlugins = (props: Props): JSX.Element => {
    const mobileComponents = useSelector(getChannelMobileHeaderPluginButtons);
    const channelMember = useSelector(getMyCurrentChannelMembership);

    const createButton = (plug: MobileChannelHeaderButtonAction) => {
        const handlePluginButtonClick = () => fireAction(plug);

        if (props.isDropdown) {
            return (
                <Menu.Item
                    key={'mobileChannelHeaderItem' + plug.id}
                    id={'mobileChannelHeaderItem' + plug.id}
                    onClick={handlePluginButtonClick}
                    labels={<span>{plug.dropdownText}</span>}
                    leadingElement={plug.icon}
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

    const fireAction = (plug: MobileChannelHeaderButtonAction) => {
        return plug.action?.(props.channel, channelMember);
    };

    const components = mobileComponents || [];

    if (components.length === 0) {
        return <></>;
    } else if (components.length === 1) {
        return createButton(components[0]);
    }

    if (!props.isDropdown) {
        return <></>;
    }

    const plugItems = createList(components);
    return (
        <>
            <Menu.Separator/>
            {plugItems}
        </>

    );
};

// Exported for tests
export {MobileChannelHeaderPlugins as RawMobileChannelHeaderPlug};

export default memo(MobileChannelHeaderPlugins);
