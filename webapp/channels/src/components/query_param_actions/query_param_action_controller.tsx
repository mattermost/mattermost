// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useEffect} from 'react';
import {useDispatch} from 'react-redux';
import {useHistory, useLocation} from 'react-router-dom';

import {openModal} from 'actions/views/modals';

import InvitationModal from 'components/invitation_modal';

import {ModalIdentifiers} from 'utils/constants';

import type {ModalData} from 'types/actions';

interface ActionMap {
    [key: string]: ModalData<any>;
}

function QueryParamActionController() {
    const location = useLocation();
    const dispatch = useDispatch();
    const history = useHistory();

    const actionMap: ActionMap = {
        open_invitation_modal: {
            modalId: ModalIdentifiers.INVITATION,
            dialogType: InvitationModal,
        },
    };

    useEffect(() => {
        const searchParams = new URLSearchParams(location.search);
        const action = searchParams.get('action');

        if (action && actionMap[action]) {
            dispatch(openModal(actionMap[action]));

            // Delete the action after it's been invoked so that it's not locked for subsequent refreshes
            searchParams.delete('action');
            history.replace({
                search: searchParams.toString(),
            });
        }
    }, [location, actionMap]);

    return null;
}

export default QueryParamActionController;
