// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {checkDialogElementForError, checkIfErrorsMatchElements} from 'mattermost-redux/utils/integration_utils';

import TestHelper from '../../test/test_helper';

describe('integration utils', () => {
    describe('checkDialogElementForError', () => {
        it('should return null error on optional text element', () => {
            expect(checkDialogElementForError(TestHelper.getDialogElementMock({type: 'text', optional: true}), undefined)).toBe(null);
        });

        it('should return null error on optional textarea element', () => {
            expect(checkDialogElementForError(TestHelper.getDialogElementMock({type: 'textarea', optional: true}), undefined)).toBe(null);
        });

        it('should return error on required element', () => {
            expect(checkDialogElementForError(TestHelper.getDialogElementMock({type: 'text', optional: false}), undefined)!.id).toBe('interactive_dialog.error.required');
        });

        it('should return error on too short text element', () => {
            expect(checkDialogElementForError(TestHelper.getDialogElementMock({type: 'text', min_length: 5}), '123')!.id).toBe('interactive_dialog.error.too_short');
        });

        it('should return null on 0', () => {
            expect(checkDialogElementForError(TestHelper.getDialogElementMock({type: 'text', subtype: 'number'}), 0)).toBe(null);
        });

        it('should return null on good number element', () => {
            expect(checkDialogElementForError(TestHelper.getDialogElementMock({type: 'text', subtype: 'number'}), '123')).toBe(null);
        });

        it('should return error on bad number element', () => {
            expect(checkDialogElementForError(TestHelper.getDialogElementMock({type: 'text', subtype: 'number'}), 'totallyanumber')!.id).toBe('interactive_dialog.error.bad_number');
        });

        it('should return null on good email element', () => {
            expect(checkDialogElementForError(TestHelper.getDialogElementMock({type: 'text', subtype: 'email'}), 'joram@mattermost.com')).toBe(null);
        });

        it('should return error on bad email element', () => {
            expect(checkDialogElementForError(TestHelper.getDialogElementMock({type: 'text', subtype: 'email'}), 'totallyanemail')!.id).toBe('interactive_dialog.error.bad_email');
        });

        it('should return null on good url element', () => {
            expect(checkDialogElementForError(TestHelper.getDialogElementMock({type: 'text', subtype: 'url'}), 'http://mattermost.com')).toBe(null);
            expect(checkDialogElementForError(TestHelper.getDialogElementMock({type: 'text', subtype: 'url'}), 'https://mattermost.com')).toBe(null);
        });

        it('should return error on bad url element', () => {
            expect(checkDialogElementForError(TestHelper.getDialogElementMock({type: 'text', subtype: 'url'}), 'totallyawebsite')!.id).toBe('interactive_dialog.error.bad_url');
        });

        it('should return null when value is in the options', () => {
            expect(checkDialogElementForError(TestHelper.getDialogElementMock({type: 'radio', options: [{text: '', value: 'Sales'}]}), 'Sales')).toBe(null);
        });

        it('should return error when value is not in the options', () => {
            expect(checkDialogElementForError(TestHelper.getDialogElementMock({type: 'radio', options: [{text: '', value: 'Sales'}]}), 'Sale')!.id).toBe('interactive_dialog.error.invalid_option');
        });

        it('should return error when value is falsey and not on the list of options', () => {
            expect(checkDialogElementForError(TestHelper.getDialogElementMock({type: 'radio', options: [{text: '', value: false}]}), 'Sale')!.id).toBe('interactive_dialog.error.invalid_option');

            expect(checkDialogElementForError(TestHelper.getDialogElementMock({type: 'radio', options: [{text: '', value: undefined}]}), 'Sale')!.id).toBe('interactive_dialog.error.invalid_option');

            expect(checkDialogElementForError(TestHelper.getDialogElementMock({type: 'radio', options: [{text: '', value: null}]}), 'Sale')!.id).toBe('interactive_dialog.error.invalid_option');
        });
    });

    describe('checkIfErrorsMatchElements', () => {
        it('should pass as returned error matches an element', () => {
            expect(checkIfErrorsMatchElements({name1: 'some error'} as any, [TestHelper.getDialogElementMock({name: 'name1'})])).toBeTruthy();
            expect(checkIfErrorsMatchElements({name1: 'some error'} as any, [TestHelper.getDialogElementMock({name: 'name1'}), TestHelper.getDialogElementMock({name: 'name2'})])).toBeTruthy();
        });

        it('should fail as returned errors do not match an element', () => {
            expect(!checkIfErrorsMatchElements({name17: 'some error'} as any, [TestHelper.getDialogElementMock({name: 'name1'}), TestHelper.getDialogElementMock({name: 'name2'})])).toBeTruthy();
        });
    });

    describe('date and datetime validation', () => {
        it('should return null for valid date formats', () => {
            const dateElement = TestHelper.getDialogElementMock({type: 'date'});

            // Only exact storage format should be valid
            expect(checkDialogElementForError(dateElement, '2025-01-15')).toBeNull();
        });

        it('should return null for valid datetime formats', () => {
            const datetimeElement = TestHelper.getDialogElementMock({type: 'datetime'});

            // Only exact storage format should be valid
            expect(checkDialogElementForError(datetimeElement, '2025-01-15T14:30:00Z')).toBeNull();
        });

        it('should return error for invalid date formats', () => {
            const dateElement = TestHelper.getDialogElementMock({type: 'date'});

            // Invalid formats
            expect(checkDialogElementForError(dateElement, 'not-a-date')).toBeTruthy();
            expect(checkDialogElementForError(dateElement, '2025-13-01')).toBeTruthy(); // Invalid month
            expect(checkDialogElementForError(dateElement, '2025-01-32')).toBeTruthy(); // Invalid day

            // Datetime in date field should be invalid
            expect(checkDialogElementForError(dateElement, '2025-01-15T14:30Z')).toBeTruthy();
        });

        it('should return error for invalid datetime formats', () => {
            const datetimeElement = TestHelper.getDialogElementMock({type: 'datetime'});

            // Invalid formats
            expect(checkDialogElementForError(datetimeElement, 'invalid-datetime')).toBeTruthy();
            expect(checkDialogElementForError(datetimeElement, '2025-01-15')).toBeTruthy(); // Date only in datetime field

            // Wrong datetime formats (should be YYYY-MM-DDTHH:mm:ssZ)
            expect(checkDialogElementForError(datetimeElement, '2025-01-15T14:30Z')).toBeTruthy(); // Missing seconds
            expect(checkDialogElementForError(datetimeElement, '2025-01-15T14:30:00')).toBeTruthy(); // Missing timezone
            expect(checkDialogElementForError(datetimeElement, '2025-01-15T14:30')).toBeTruthy(); // Missing seconds and timezone
        });

        it('should return null for empty values', () => {
            const dateElement = TestHelper.getDialogElementMock({type: 'date', optional: true});
            const datetimeElement = TestHelper.getDialogElementMock({type: 'datetime', optional: true});

            expect(checkDialogElementForError(dateElement, '')).toBeNull();
            expect(checkDialogElementForError(datetimeElement, '')).toBeNull();
            expect(checkDialogElementForError(dateElement, null)).toBeNull();
        });

        it('should return required error for empty required fields', () => {
            const dateElement = TestHelper.getDialogElementMock({type: 'date', optional: false});
            const datetimeElement = TestHelper.getDialogElementMock({type: 'datetime', optional: false});

            const dateError = checkDialogElementForError(dateElement, '');
            const datetimeError = checkDialogElementForError(datetimeElement, null);

            expect(dateError?.id).toBe('interactive_dialog.error.required');
            expect(datetimeError?.id).toBe('interactive_dialog.error.required');
        });
    });
});
