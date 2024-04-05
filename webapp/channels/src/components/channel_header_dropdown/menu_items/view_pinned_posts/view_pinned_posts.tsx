// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, memo} from 'react';
import type {MouseEvent} from 'react';
import {useIntl} from 'react-intl';

import Menu from 'components/widgets/menu/menu';

type Props = {
    show?: boolean;
    channel: any;
    hasPinnedPosts: boolean;
    actions: {
        closeRightHandSide: () => void;
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
    const intl = useIntl();
    const handleClick = useCallback((e: MouseEvent) => {
        e.preventDefault();

        if (hasPinnedPosts) {
            closeRightHandSide();
        } else {
            showPinnedPosts(channel.id);
        }
    }, [channel.id, closeRightHandSide, showPinnedPosts, hasPinnedPosts]);

    return (
        <Menu.ItemAction
            show={show}
            onClick={handleClick}
            text={intl.formatMessage({id: 'navbar.viewPinnedPosts', defaultMessage: 'View Pinned Posts'})}
        />
    );
};

export default memo(ViewPinnedPosts);
