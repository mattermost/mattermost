// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React from 'react';

import {makeAsyncPluggableComponent} from 'components/async_load';

import webSocketClient from 'client/web_websocket_client';

import type {ProductComponent} from 'types/store/plugins';

const Pluggable = makeAsyncPluggableComponent();

type Props = {
    product: ProductComponent;
};

export default function ProductPluggable({product}: Props) {
    const pluggable = (
        <Pluggable
            pluggableName={'Product'}
            subComponentName={'mainComponent'}
            pluggableId={product.id}
            webSocketClient={webSocketClient}
            css={product.wrapped ? undefined : {gridArea: 'center'}}
        />
    );

    if (product.wrapped) {
        return (
            <div className={classNames(['product-wrapper', {wide: !product.showTeamSidebar}])}>
                {pluggable}
            </div>
        );
    }

    return pluggable;
}
