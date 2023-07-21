// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {UserProfile} from '@mattermost/types/users';
import {MutableRefObject, useEffect, useRef} from 'react';
import {useSelector} from 'react-redux';

import {getCurrentUser, isFirstAdmin, isCurrentUserSystemAdmin} from 'mattermost-redux/selectors/entities/users';
import {isModalOpen} from 'selectors/views/modals';

import {GlobalState} from 'types/store';

/**
 * Hook that alerts clicks outside of the passed ref.
 */
export function useClickOutsideRef(ref: MutableRefObject<HTMLElement | null>, handler: () => void): void {
    useEffect(() => {
        function onMouseDown(event: MouseEvent) {
            const target = event.target as any;
            if (ref.current && target instanceof Node && !ref.current.contains(target)) {
                handler();
            }
        }

        // Bind the event listener
        document.addEventListener('mousedown', onMouseDown);
        return () => {
            // Unbind the event listener on clean up
            document.removeEventListener('mousedown', onMouseDown);
        };
    }, [ref, handler]);
}

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
