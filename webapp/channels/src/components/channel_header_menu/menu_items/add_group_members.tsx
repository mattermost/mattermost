// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';
import {useDispatch} from 'react-redux';

import {AccountMultipleOutlineIcon} from '@mattermost/compass-icons/components';

import {openModal} from 'actions/views/modals';

import * as Menu from 'components/menu';
import MoreDirectChannels from 'components/more_direct_channels';

import {ModalIdentifiers} from 'utils/constants';

const AddGroupMembers = (): JSX.Element => {
    const dispatch = useDispatch();

    const handleAddGroupMembers = () => {
        dispatch(
            openModal({
                modalId: ModalIdentifiers.CREATE_DM_CHANNEL,
                dialogType: MoreDirectChannels,
                dialogProps: {isExistingChannel: true, focusOriginElement: 'channelHeaderDropdownButton'},
            }),
        );
    };

    return (
        <Menu.Item
            id='channelAddMembers'
            leadingElement={<AccountMultipleOutlineIcon size='18px'/>}
            onClick={handleAddGroupMembers}
            labels={
                <FormattedMessage
                    id='navbar.addMembers'
                    defaultMessage='Add Members'
                />
            }
        />
    );
};

export default React.memo(AddGroupMembers);
