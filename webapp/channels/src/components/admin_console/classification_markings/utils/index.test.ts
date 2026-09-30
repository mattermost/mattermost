// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {PropertyField} from '@mattermost/types/properties';

import {Client4} from 'mattermost-redux/client';

import {listLiveFields} from './index';

function makeField(overrides: Partial<PropertyField> = {}): PropertyField {
    return {
        id: 'field-1',
        name: 'field_name',
        type: 'rank',
        group_id: 'accesscontrolgroupuuid001',
        object_type: 'user',
        target_id: '',
        target_type: 'system',
        create_at: 1700000000000,
        update_at: 0,
        delete_at: 0,
        created_by: '',
        updated_by: '',
        attrs: {},
        ...overrides,
    } as PropertyField;
}

describe('classification_markings/utils', () => {
    const getPropertyFields = jest.spyOn(Client4, 'getPropertyFields');

    beforeEach(() => {
        getPropertyFields.mockReset();
    });

    describe('listLiveFields', () => {
        it('asks for the object type in the access_control group scoped to system fields, with no cursor on the first page', async () => {
            getPropertyFields.mockResolvedValueOnce([]);

            await expect(listLiveFields('user')).resolves.toEqual([]);

            expect(getPropertyFields).toHaveBeenCalledTimes(1);
            expect(getPropertyFields).toHaveBeenCalledWith(
                'access_control',
                'user',
                'system',
                '',
                {cursorId: undefined, cursorCreateAt: undefined},
            );
        });

        it("carries the previous page's last field forward as the cursor until a page comes back empty", async () => {
            getPropertyFields.
                mockResolvedValueOnce([
                    makeField({id: 'u1', create_at: 1}),
                    makeField({id: 'u2', create_at: 2}),
                ]).
                mockResolvedValueOnce([makeField({id: 'u3', create_at: 3})]).
                mockResolvedValueOnce([]);

            const fields = await listLiveFields('user');

            expect(fields.map((field) => field.id)).toEqual(['u1', 'u2', 'u3']);
            expect(getPropertyFields.mock.calls.map((call) => call[4])).toEqual([
                {cursorId: undefined, cursorCreateAt: undefined},
                {cursorId: 'u2', cursorCreateAt: 2},
                {cursorId: 'u3', cursorCreateAt: 3},
            ]);
        });

        it('asks for another page after a short one, since only an empty page ends the paging', async () => {
            // A page shorter than the requested size is the usual sign that it was
            // the last one, but this loop does not read it that way -- so a field
            // sitting behind a short page is still reached. The caller depends on
            // that: it is looking for a name it does not own, which any page could
            // hold.
            getPropertyFields.
                mockResolvedValueOnce([makeField({id: 'u1', create_at: 1})]).
                mockResolvedValueOnce([makeField({id: 'behind-a-short-page', create_at: 2})]).
                mockResolvedValueOnce([]);

            const fields = await listLiveFields('user');

            expect(fields.map((field) => field.id)).toEqual(['u1', 'behind-a-short-page']);
            expect(getPropertyFields).toHaveBeenCalledTimes(3);
        });

        it('drops soft-deleted fields but still pages past them', async () => {
            getPropertyFields.
                mockResolvedValueOnce([
                    makeField({id: 'live', create_at: 1}),
                    makeField({id: 'tombstone', create_at: 2, delete_at: 1700000000001}),
                ]).
                mockResolvedValueOnce([]);

            const fields = await listLiveFields('user');

            // * The name a deleted field held is free, so it is not something a
            // caller can collide with.
            expect(fields.map((field) => field.id)).toEqual(['live']);

            // * It still advances the cursor: skipping it there would re-request
            // the page it sat on, forever.
            expect(getPropertyFields.mock.calls[1][4]).toEqual({cursorId: 'tombstone', cursorCreateAt: 2});
        });

        it('stops at the 500-field cap rather than paging forever when the server never returns an empty page', async () => {
            const page = Array.from({length: 200}, (_, index) => makeField({id: `u${index}`, create_at: index + 1}));
            getPropertyFields.mockResolvedValue(page);

            const fields = await listLiveFields('user');

            // The cap is checked before each request rather than against what has
            // already been fetched, so the page that crosses it is still fetched in
            // full: 200, 400, then 600.
            expect(getPropertyFields).toHaveBeenCalledTimes(3);
            expect(fields).toHaveLength(600);
        });
    });
});
