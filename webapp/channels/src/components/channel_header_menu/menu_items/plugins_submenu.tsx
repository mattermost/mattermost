// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ReactNode} from 'react';
import React, {memo} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';

import {
    AppsIcon,
    ChevronRightIcon,
} from '@mattermost/compass-icons/components';

import * as Menu from 'components/menu';

type Props = {
    pluginItems: ReactNode[];
};

const PluginsSubmenu = (props: Props) => {
    const {formatMessage} = useIntl();
    if (!props.pluginItems || !props.pluginItems.length) {
        return <></>;
    }
    return (
        <Menu.SubMenu
            id={'moreActions'}
            labels={
                <FormattedMessage
                    id='pluginsMenu.more_actions'
                    defaultMessage='More actions'
                />
            }
            leadingElement={<AppsIcon size='18px'/>}
            trailingElements={<ChevronRightIcon size={16}/>}
            menuId={'moreActions-menu'}
            menuAriaLabel={formatMessage({id: 'pluginsMenu.more_actions', defaultMessage: 'More actions'})}
        >
            {props.pluginItems}
        </Menu.SubMenu>
    );
};

export default memo(PluginsSubmenu);
