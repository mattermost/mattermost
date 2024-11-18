// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';
import {useDispatch} from 'react-redux';

import {openModal} from 'actions/views/modals';

import * as Menu from 'components/menu';
import MoreDirectChannels from 'components/more_direct_channels';

import {ModalIdentifiers} from 'utils/constants';

type Props = {
    isArchived: boolean;
    isGroupConstrained: boolean;
}

const AddGroupMembers = ({isArchived, isGroupConstrained}: Props): JSX.Element => {
    const dispatch = useDispatch();
    if (isArchived || isGroupConstrained) {
        return <></>;
    }

    return (
        <Menu.Item
            id='channelAddMembers'
            onClick={() => {
                dispatch(
                    openModal({
                        modalId: ModalIdentifiers.CREATE_DM_CHANNEL,
                        dialogType: MoreDirectChannels,
                        dialogProps: {isExistingChannel: true},
                    }),
                );
            }}
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
