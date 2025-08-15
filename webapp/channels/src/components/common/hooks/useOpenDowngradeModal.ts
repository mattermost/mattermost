// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useCallback} from 'react';
import {useDispatch} from 'react-redux';

import {openModal} from 'actions/views/modals';

import DowngradeModal from 'components/downgrade_modal';

import {ModalIdentifiers} from 'utils/constants';

export default function useOpenDowngradeModal() {
    const dispatch = useDispatch();
    return useCallback(() => {
        dispatch(openModal({
            modalId: ModalIdentifiers.DOWNGRADE_MODAL,
            dialogType: DowngradeModal,
        }));
    }, [dispatch]);
}
