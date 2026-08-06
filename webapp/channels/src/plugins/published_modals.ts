// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {PublishedModalId, PublishedModalIdCandidate, PublishedModalProps} from '@mattermost/shared/types/global';

import {openModal} from 'actions/views/modals';

import type {ModalData} from 'types/actions';

// Own chunk (off the bootstrap bundle) + a Suspense boundary that ModalController lacks.
function lazyModal<P extends object>(loader: () => Promise<{default: React.ComponentType<P>}>): React.FunctionComponent<P> {
    // React.lazy adds an optional ref that a free generic P can't satisfy; narrow back to P.
    const LazyComponent = React.lazy(loader) as unknown as React.ComponentType<P>;

    const Wrapped = (props: P) => {
        return React.createElement(React.Suspense, {fallback: null}, React.createElement(LazyComponent, props));
    };

    return Wrapped;
}

function withFixedProps<P extends object, F extends Partial<P>>(Component: React.ComponentType<P>, fixed: F): React.FunctionComponent<Omit<P, keyof F>> {
    const Wrapped = (props: Omit<P, keyof F>) => React.createElement(Component, {...fixed, ...props} as unknown as P);

    return Wrapped;
}

// Curated allowlist, not an escape hatch for rendering arbitrary core components.
const publishedModals = {
    user_settings: lazyModal(() => import('components/user_settings/modal')),
    invitation: lazyModal(() => import('components/invitation_modal')),

    // team_settings reads its own visibility from isOpen, which ModalController
    // doesn't supply; pin it true rather than leak it to plugins.
    team_settings: withFixedProps(lazyModal(() => import('components/team_settings_modal')), {isOpen: true}),
    team_members: lazyModal(() => import('components/team_members_modal')),
    leave_team: lazyModal(() => import('components/leave_team_modal')),
} satisfies Record<PublishedModalId, React.ComponentType<any>>;

// Fails the build here if a modal's real props drift from the published contract,
// instead of silently breaking plugins.
type ContractHonored<T extends {[K in PublishedModalId]: ModalData<React.ComponentProps<(typeof publishedModals)[K]>>['dialogProps']}> = T;

// eslint-disable-next-line @typescript-eslint/no-unused-vars
type AssertPublishedModalContract = ContractHonored<PublishedModalProps>;

export function openPublishedModal<K extends PublishedModalId>(modalId: K, dialogProps?: PublishedModalProps[K]) {
    // TS can't correlate the indexed component with its props here, so cast the lookup.
    return openModal({modalId, dialogType: publishedModals[modalId] as React.ComponentType<any>, dialogProps});
}

const publishedModalIds = new Set<string>(Object.keys(publishedModals));

// Feature detection for plugins: is this modal id actually published by the running
// web app? Narrows to PublishedModalId so a checked id can be passed to openPublishedModal.
export function canOpenPublishedModal(modalId: PublishedModalIdCandidate): modalId is PublishedModalId {
    return publishedModalIds.has(modalId);
}
