// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {createIntl} from 'react-intl';

import type {PropertyField} from '@mattermost/types/properties';

import {findNameConflict, nameConflictText} from './name_conflict';

const {formatMessage} = createIntl({locale: 'en', messages: {}, defaultLocale: 'en'});

function makeField(field: Partial<PropertyField>): PropertyField {
    return {
        id: 'field-id',
        group_id: 'group-id',
        name: 'field',
        type: 'text',
        target_id: '',
        target_type: 'system',
        object_type: 'user',
        create_at: 1,
        update_at: 1,
        delete_at: 0,
        created_by: 'admin-id',
        updated_by: 'admin-id',
        ...field,
    };
}

describe('global_attributes/name_conflict', () => {
    describe('findNameConflict', () => {
        it('matches ignoring case in both directions', () => {
            const lower = makeField({id: 'u1', name: 'clearance'});
            expect(findNameConflict('Clearance', [lower], [])?.field).toBe(lower);

            const upper = makeField({id: 'u2', name: 'Clearance'});
            expect(findNameConflict('clearance', [upper], [])?.field).toBe(upper);
        });

        it('never treats a soft-deleted field as a conflict', () => {
            expect(findNameConflict('clearance', [
                makeField({id: 'u1', name: 'clearance', delete_at: 123}),
            ], [])).toBeUndefined();
        });

        it('excludes the field whose id is templateId, since an attribute never conflicts with itself', () => {
            expect(findNameConflict('clearance', [
                makeField({id: 'template-id', name: 'clearance'}),
            ], [], 'template-id')).toBeUndefined();
        });

        it("excludes a field linked to templateId, since a template's own child is not a conflict", () => {
            expect(findNameConflict('clearance', [
                makeField({id: 'u1', name: 'clearance', linked_field_id: 'template-id'}),
            ], [], 'template-id')).toBeUndefined();
        });

        it('excludes nothing when no templateId is passed, as on the create form', () => {
            const own = makeField({id: 'template-id', name: 'clearance'});

            expect(findNameConflict('clearance', [own], [])?.field).toBe(own);
        });

        it('returns no conflict for a name nothing shares', () => {
            expect(findNameConflict('clearance', [
                makeField({id: 'u1', name: 'department'}),
            ], [])).toBeUndefined();
        });

        it("resolves ownerTemplate from the conflicting field's linked_field_id", () => {
            const owner = makeField({id: 'markings-template', object_type: 'template', name: 'classification'});

            const conflict = findNameConflict('clearance', [
                makeField({id: 'u1', name: 'clearance', linked_field_id: 'markings-template'}),
            ], [
                makeField({id: 'other-template', object_type: 'template', name: 'department'}),
                owner,
            ]);

            expect(conflict?.ownerTemplate).toBe(owner);
        });

        it('leaves ownerTemplate undefined for a standalone user field', () => {
            const conflict = findNameConflict('clearance', [
                makeField({id: 'u1', name: 'clearance'}),
            ], [
                makeField({id: 'markings-template', object_type: 'template', name: 'classification'}),
            ]);

            expect(conflict?.field.id).toBe('u1');
            expect(conflict?.ownerTemplate).toBeUndefined();
        });

        it('leaves ownerTemplate undefined when no supplied template matches linked_field_id', () => {
            const conflict = findNameConflict('clearance', [
                makeField({id: 'u1', name: 'clearance', linked_field_id: 'missing-template'}),
            ], [
                makeField({id: 'markings-template', object_type: 'template', name: 'classification'}),
            ]);

            expect(conflict?.field.id).toBe('u1');
            expect(conflict?.ownerTemplate).toBeUndefined();
        });

        it('sets exact only for a byte-for-byte name match, not a case-only difference', () => {
            const field = makeField({id: 'u1', name: 'clearance'});

            expect(findNameConflict('clearance', [field], [])?.exact).toBe(true);
            expect(findNameConflict('Clearance', [field], [])?.exact).toBe(false);
        });
    });

    describe('nameConflictText', () => {
        it('names the owning template by its display name when it has one', () => {
            const text = nameConflictText({
                field: makeField({id: 'u1', name: 'clearance'}),
                ownerTemplate: makeField({id: 't1', object_type: 'template', name: 'markings', attrs: {display_name: 'Classification Markings'}}),
                exact: true,
            }, formatMessage);

            expect(text).toContain('clearance');
            expect(text).toContain('Classification Markings');
            expect(text).not.toContain('markings');
        });

        it("falls back to the owning template's name when it has no display name", () => {
            const text = nameConflictText({
                field: makeField({id: 'u1', name: 'clearance'}),
                ownerTemplate: makeField({id: 't1', object_type: 'template', name: 'markings'}),
                exact: true,
            }, formatMessage);

            expect(text).toContain('clearance');
            expect(text).toContain('markings');
        });

        it('uses the standalone wording when the conflicting field has no owner', () => {
            const text = nameConflictText({
                field: makeField({id: 'u1', name: 'clearance'}),
                exact: true,
            }, formatMessage);

            expect(text).toContain('standalone user attribute named "clearance"');
            expect(text).not.toContain('linked to');
        });
    });
});
