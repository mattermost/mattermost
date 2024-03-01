// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect} from 'react';
import {useDispatch} from 'react-redux';

import {selectLhsItem} from 'actions/views/lhs';

import Pluggable from 'plugins/pluggable';

import {LhsItemType} from 'types/store/lhs';

type NeedsChannelSidebarPluggableProps = {
    id: string;
}

const NeedsChannelSidebarPluggable = ({id}: NeedsChannelSidebarPluggableProps) => {
    const dispatch = useDispatch();

    useEffect(() => {
        dispatch(selectLhsItem(LhsItemType.Page, id));
    }, [id]);

    return (
        <Pluggable
            pluggableName={'NeedsChannelSidebarComponent'}
            pluggableId={id}
            css={{gridArea: 'center'}}
        />
    );
};

export default NeedsChannelSidebarPluggable;
