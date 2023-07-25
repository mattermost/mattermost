// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback} from 'react';
import * as Menu from 'components/menu';

import {MarkAsUnreadIcon} from '@mattermost/compass-icons/components';
import {FormattedMessage} from 'react-intl';
import {useDispatch} from 'react-redux';
import {openModal} from 'actions/views/modals';
import {ModalIdentifiers} from 'utils/constants';
import MarkAsReadConfirmModal from './mark_as_read_confirm_modal';

type Props = ({
    id: string;
    handleViewCategory: () => void;
    numChannels: number;
})

const MarkAsUnreadItem = ({
    id,
    handleViewCategory,
    numChannels,
}: Props) => {
    const dispatch = useDispatch();

    const onClick = useCallback(() => {
        dispatch(openModal({
            modalId: ModalIdentifiers.DELETE_CATEGORY,
            dialogType: MarkAsReadConfirmModal,
            dialogProps: {
                handleConfirm: handleViewCategory,
                numChannels,
            },
        }));
    }, [dispatch, handleViewCategory, numChannels]);

    return (
        <Menu.Item
            id={`view-${id}`}
            onClick={onClick}
            aria-haspopup={true}
            leadingElement={<MarkAsUnreadIcon size={18}/>}
            labels={(
                <FormattedMessage
                    id='sidebar_left.sidebar_category_menu.viewCategory'
                    defaultMessage='Mark category as read'
                />
            )}
        />
    );
};

export default MarkAsUnreadItem;
