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
});
