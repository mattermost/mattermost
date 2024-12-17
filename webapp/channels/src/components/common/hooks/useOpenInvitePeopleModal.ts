// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useCallback} from 'react';
import {useDispatch} from 'react-redux';

import {trackEvent} from 'actions/telemetry_actions';
import {openModal} from 'actions/views/modals';

import InvitationModal from 'components/invitation_modal';

import {ModalIdentifiers} from 'utils/constants';

export default function useOpenInvitePeopleModal() {
    const dispatch = useDispatch();
    return useCallback(() => {
        trackEvent('invite_people', 'click_open_invite_people_modal');
        dispatch(openModal({
            modalId: ModalIdentifiers.INVITATION,
            dialogType: InvitationModal,
        }));
    }, [dispatch]);
}
