// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {PublishedModalId} from '@mattermost/shared/types/global';

import {ActionTypes, ModalIdentifiers} from 'utils/constants';

import {canOpenPublishedModal, openPublishedModal} from './published_modals';

describe('openPublishedModal', () => {
    test('returns a MODAL_OPEN action carrying the id, props, and a component', () => {
        const dialogProps = {isContentProductSettings: false, activeTab: 'display'};
        const action = openPublishedModal('user_settings', dialogProps);

        expect(action.type).toBe(ActionTypes.MODAL_OPEN);
        expect(action.modalId).toBe('user_settings');
        expect(action.dialogProps).toBe(dialogProps);
        expect(typeof action.dialogType).toBe('function');
    });

    test('omits dialogProps when none are passed', () => {
        expect(openPublishedModal('leave_team').dialogProps).toBeUndefined();
    });

    test('every published id maps to its ModalIdentifiers constant and a component', () => {
        const expected: Record<PublishedModalId, string> = {
            user_settings: ModalIdentifiers.USER_SETTINGS,
            invitation: ModalIdentifiers.INVITATION,
            team_settings: ModalIdentifiers.TEAM_SETTINGS,
            team_members: ModalIdentifiers.TEAM_MEMBERS,
            leave_team: ModalIdentifiers.LEAVE_TEAM,
        };

        for (const id of Object.keys(expected) as PublishedModalId[]) {
            const action = openPublishedModal(id);
            expect(action.modalId).toBe(id);
            expect(action.modalId).toBe(expected[id]);
            expect(typeof action.dialogType).toBe('function');
        }
    });
});

describe('canOpenPublishedModal', () => {
    test('is true for every published modal id', () => {
        const ids: PublishedModalId[] = ['user_settings', 'invitation', 'team_settings', 'team_members', 'leave_team'];

        for (const id of ids) {
            expect(canOpenPublishedModal(id)).toBe(true);
        }
    });

    test('is false for ids the running web app does not publish', () => {
        expect(canOpenPublishedModal('not_a_real_modal')).toBe(false);
        expect(canOpenPublishedModal('')).toBe(false);

        // A core modal id that exists but is intentionally not in the plugin allowlist.
        expect(canOpenPublishedModal(ModalIdentifiers.CHANNEL_INVITE)).toBe(false);
    });
});
