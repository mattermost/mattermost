// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {GlobeIcon, ShieldOutlineIcon, ArchiveLockOutlineIcon} from '@mattermost/compass-icons/components';

import {compassIconForName} from './compass_icon_resolver';

describe('components/channel_type_icon/compassIconForName', () => {
    it("maps 'globe' to GlobeIcon", () => {
        expect(compassIconForName('globe')).toBe(GlobeIcon);
    });

    it("maps 'shield-outline' to ShieldOutlineIcon", () => {
        expect(compassIconForName('shield-outline')).toBe(ShieldOutlineIcon);
    });

    it("maps 'archive-lock-outline' to ArchiveLockOutlineIcon", () => {
        expect(compassIconForName('archive-lock-outline')).toBe(ArchiveLockOutlineIcon);
    });

    it('returns null for an unknown/invalid glyph name', () => {
        expect(compassIconForName('not-a-real-glyph' as any)).toBeNull();
    });

    it('returns null for prototype-inherited key "constructor"', () => {
        expect(compassIconForName('constructor' as any)).toBeNull();
    });

    it('returns null for prototype-inherited key "toString"', () => {
        expect(compassIconForName('toString' as any)).toBeNull();
    });

    it('returns null for prototype-inherited key "__proto__"', () => {
        expect(compassIconForName('__proto__' as any)).toBeNull();
    });

    it('returns null for prototype-inherited key "hasOwnProperty"', () => {
        expect(compassIconForName('hasOwnProperty' as any)).toBeNull();
    });

    it.each([
        'globe',
        'lock-outline',
        'archive-outline',
        'archive-lock-outline',
        'shield-outline',
    ] as const)('returns a non-null component for production-critical icon name %s', (name) => {
        expect(compassIconForName(name)).not.toBeNull();
    });
});
