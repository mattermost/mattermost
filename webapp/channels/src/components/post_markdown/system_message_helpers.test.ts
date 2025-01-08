// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {AddMemberProps} from './system_message_helpers';
import {isAddMemberProps} from './system_message_helpers';

describe('isAddMemberProps', () => {
    it('with empty lists', () => {
        const prop: AddMemberProps = {
            post_id: '',
            not_in_channel_user_ids: [],
            not_in_channel_usernames: [],
            not_in_groups_usernames: [],
        };

        expect(isAddMemberProps(prop)).toBe(true);
    });

    it('with values in lists', () => {
        const prop: AddMemberProps = {
            post_id: '',
            not_in_channel_user_ids: ['hello', 'world'],
            not_in_channel_usernames: ['hello', 'world'],
            not_in_groups_usernames: ['hello', 'world'],
        };

        expect(isAddMemberProps(prop)).toBe(true);
    });

    it('all values are required', () => {
        const baseProp: AddMemberProps = {
            post_id: '',
            not_in_channel_user_ids: [],
            not_in_channel_usernames: [],
            not_in_groups_usernames: [],
        };

        expect(isAddMemberProps(baseProp)).toBe(true);

        for (const key of Object.keys(baseProp)) {
            const wrongProp: Partial<AddMemberProps> = {...baseProp};
            delete wrongProp[key as keyof AddMemberProps];
            expect(isAddMemberProps(wrongProp)).toBe(false);
        }
    });

    it('common false cases', () => {
        expect(isAddMemberProps('')).toBe(false);
        expect(isAddMemberProps(undefined)).toBe(false);
        expect(isAddMemberProps(true)).toBe(false);
        expect(isAddMemberProps(1)).toBe(false);
        expect(isAddMemberProps([])).toBe(false);
    });
});
