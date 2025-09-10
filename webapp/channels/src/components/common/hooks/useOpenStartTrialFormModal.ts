// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useCallback} from 'react';
import {useDispatch} from 'react-redux';

import {openModal} from 'actions/views/modals';

import StartTrialFormModal from 'components/start_trial_form_modal';

import {ModalIdentifiers} from 'utils/constants';

export default function useOpenStartTrialFormModal() {
    const dispatch = useDispatch();
    return useCallback((onClose?: () => void) => {
        dispatch(openModal({
            modalId: ModalIdentifiers.START_TRIAL_FORM_MODAL,
            dialogType: StartTrialFormModal,
            dialogProps: {
                onClose,
            },
        }));
    }, [dispatch]);
}
