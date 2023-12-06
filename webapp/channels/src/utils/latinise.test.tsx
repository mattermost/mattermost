// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {latinise} from 'utils/latinise';

describe('Latinise', () => {
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
