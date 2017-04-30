// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import {latinise} from 'utils/latinise.jsx';

describe('Latinise', () => {
    describe('handleNames', () => {
        test('should return ascii version of Dév Spé', () => {
            expect(latinise('Dév Spé')).
                toEqual('Dev Spe');
        });

        test('should not replace any characters', () => {
            expect(latinise('ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz1234567890')).
                toEqual('ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz1234567890');
        });

        test('should replace characters with diacritics with ascii equivalents', () => {
            expect(latinise('àáâãäåæçèéêëìíîïñòóôõöœùúûüýÿ')).
                toEqual('aaaaaaaeceeeeiiiinooooooeuuuuyy');
        });
    });
});
