// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {AnchorHTMLAttributes} from 'react';

import {convertPropsToReactStandard} from './index';

describe('convertPropsToReactStandard', () => {
    test('converts class to className', () => {
        const inputProps = {class: 'button-class'} as AnchorHTMLAttributes<HTMLAnchorElement>;
        const expected = {className: 'button-class'};

        expect(convertPropsToReactStandard(inputProps)).toEqual(expected);
    });

    test('converts for to htmlFor', () => {
        const inputProps = {for: 'input-id'} as AnchorHTMLAttributes<HTMLAnchorElement>;
        const expected = {htmlFor: 'input-id'};

        expect(convertPropsToReactStandard(inputProps)).toEqual(expected);
    });

    test('converts tabindex to tabIndex', () => {
        const inputProps = {tabindex: '0'} as AnchorHTMLAttributes<HTMLAnchorElement>;
        const expected = {tabIndex: '0'};

        expect(convertPropsToReactStandard(inputProps)).toEqual(expected);
    });

    test('converts readonly to readOnly', () => {
        const inputProps = {readonly: true} as AnchorHTMLAttributes<HTMLAnchorElement>;
        const expected = {readOnly: true};

        expect(convertPropsToReactStandard(inputProps)).toEqual(expected);
    });

    test('keeps other properties unchanged', () => {
        const inputProps = {id: 'unique-id', type: 'text'} as AnchorHTMLAttributes<HTMLAnchorElement>;
        const expected = {id: 'unique-id', type: 'text'};

        expect(convertPropsToReactStandard(inputProps)).toEqual(expected);
    });

    test('handles multiple conversions and keeps other properties', () => {
        const inputProps = {
            class: 'button-class',
            for: 'input-id',
            tabindex: '0',
            readonly: true,
            id: 'unique-id',
        };
        const expected = {
            className: 'button-class',
            htmlFor: 'input-id',
            tabIndex: '0',
            readOnly: true,
            id: 'unique-id',
        };
        expect(convertPropsToReactStandard(inputProps)).toEqual(expected);
    });
});
