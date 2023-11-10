// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {GetStateFunc, DispatchFunc} from 'mattermost-redux/types/actions';

import Menu from 'components/widgets/menu/menu';

import {localizeMessage} from 'utils/utils';

type Props = {
    show?: boolean;
    channel: any;
    hasPinnedPosts: boolean;
    actions: {
        closeRightHandSide: () => (dispatch: DispatchFunc, getState: GetStateFunc) => void;
        showPinnedPosts: (id: any) => void;
    };
}

const ViewPinnedPosts = ({
    channel,
    hasPinnedPosts,
    actions: {
        closeRightHandSide,
        showPinnedPosts,
    },
    show,
}: Props) => {
    const handleClick = (e: React.MouseEvent) => {
        e.preventDefault();

        if (hasPinnedPosts) {
            closeRightHandSide();
        } else {
            showPinnedPosts(channel.id);
        }
    };

    return (
        <Menu.ItemAction
            show={show}
            onClick={handleClick}
            text={localizeMessage('navbar.viewPinnedPosts', 'View Pinned Posts')}
        />
    );
};

export default React.memo(ViewPinnedPosts);
