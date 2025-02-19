// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useEffect, useRef} from 'react';
import {useSelector} from 'react-redux';

import type {UserProfile} from '@mattermost/types/users';

import {getCurrentUser, isFirstAdmin, isCurrentUserSystemAdmin} from 'mattermost-redux/selectors/entities/users';

import {isModalOpen} from 'selectors/views/modals';

import type {GlobalState} from 'types/store';

export const useFirstAdminUser = (): boolean => {
    return useSelector(isFirstAdmin);
};

export const useIsCurrentUserSystemAdmin = (): boolean => {
    return useSelector(isCurrentUserSystemAdmin);
};

export const useIsLoggedIn = (): boolean => {
    return Boolean(useSelector<GlobalState, UserProfile>(getCurrentUser));
};

/**
 * Hook that returns the current open state of the specified modal
 * - returns both the direct boolean for regular use and a ref that contains the boolean for usage in a callback
 */
export const useIsModalOpen = (modalIdentifier: string): [boolean, React.RefObject<boolean>] => {
    const modalOpenState = useSelector((state: GlobalState) => isModalOpen(state, modalIdentifier));
    const modalOpenStateRef = useRef(modalOpenState);

    useEffect(() => {
        modalOpenStateRef.current = modalOpenState;
    }, [modalOpenState]);

    return [modalOpenState, modalOpenStateRef];
};
