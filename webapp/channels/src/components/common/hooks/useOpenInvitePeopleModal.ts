// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useDispatch} from 'react-redux';

import {trackEvent} from 'actions/telemetry_actions';
import {openModal} from 'actions/views/modals';
import {ModalIdentifiers} from 'utils/constants';
import InvitationModal from 'components/invitation_modal';

export default function useOpenInvitePeopleModal() {
    const dispatch = useDispatch();
    return () => {
        trackEvent('invite_people', 'click_open_invite_people_modal');
        dispatch(openModal({
            modalId: ModalIdentifiers.INVITATION,
            dialogType: InvitationModal,
        }));
    };
}
