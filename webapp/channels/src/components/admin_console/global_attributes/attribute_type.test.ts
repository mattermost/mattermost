// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {LinkVariantIcon, MenuVariantIcon, PoundIcon} from '@mattermost/compass-icons/components';

import {
    ATTRIBUTE_TYPE_DESCRIPTOR,
    getAttributeTypeDescriptor,
    getTypeLabelForField,
    toServerFieldType,
    toValueType,
} from './attribute_type';

describe('attribute_type', () => {
    describe('getAttributeTypeDescriptor', () => {
        it('returns the text descriptor for a plain text field, including a missing value_type', () => {
            expect(getAttributeTypeDescriptor({type: 'text'}).id).toBe('text');
            expect(getAttributeTypeDescriptor({type: 'text', attrs: {}}).id).toBe('text');
        });

        it('matches phone, url, and email by attrs.value_type on a text field', () => {
            expect(getAttributeTypeDescriptor({type: 'text', attrs: {value_type: 'phone'}}).id).toBe('phone');
            expect(getAttributeTypeDescriptor({type: 'text', attrs: {value_type: 'url'}}).id).toBe('url');
            expect(getAttributeTypeDescriptor({type: 'text', attrs: {value_type: 'email'}}).id).toBe('email');
        });

        it('does not treat a leftover value_type on a select field as phone', () => {
            expect(getAttributeTypeDescriptor({type: 'select', attrs: {value_type: 'phone'}}).id).toBe('select');
        });

        it('falls back to the plain text descriptor for an unrecognized value_type', () => {
            expect(getAttributeTypeDescriptor({type: 'text', attrs: {value_type: 'not-a-type'}}).id).toBe('text');
        });
    });

    describe('getTypeLabelForField', () => {
        it('returns Phone/URL for text subtypes and Other for an unknown FieldType', () => {
            expect(getTypeLabelForField({type: 'text', attrs: {value_type: 'phone'}})).toBe(ATTRIBUTE_TYPE_DESCRIPTOR.phone.label);
            expect(getTypeLabelForField({type: 'text', attrs: {value_type: 'url'}})).toBe(ATTRIBUTE_TYPE_DESCRIPTOR.url.label);
            expect(getTypeLabelForField({type: 'date'}).defaultMessage).toBe('Other');
        });
    });

    describe('toServerFieldType / toValueType', () => {
        it('maps phone and url onto text plus the matching value_type', () => {
            expect(toServerFieldType('phone')).toBe('text');
            expect(toValueType('phone')).toBe('phone');
            expect(toServerFieldType('url')).toBe('text');
            expect(toValueType('url')).toBe('url');
            expect(toServerFieldType('select')).toBe('select');
            expect(toValueType('select')).toBe('');
        });
    });

    it('uses the same icons as CPA for phone and url', () => {
        expect(ATTRIBUTE_TYPE_DESCRIPTOR.phone.icon).toBe(PoundIcon);
        expect(ATTRIBUTE_TYPE_DESCRIPTOR.url.icon).toBe(LinkVariantIcon);
        expect(ATTRIBUTE_TYPE_DESCRIPTOR.text.icon).toBe(MenuVariantIcon);
        expect(ATTRIBUTE_TYPE_DESCRIPTOR.email.hidden).toBe(true);
    });
});
