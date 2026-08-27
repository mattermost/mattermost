// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {PropertyField} from '@mattermost/types/properties';

import type {ResolvedChannelAttribute} from 'mattermost-redux/selectors/entities/properties';

import {
    attributeToken,
    hasAttributeTokens,
    referencedFieldNames,
    renderBannerTemplate,
    tokenSuggestions,
    withRequiredTokens,
} from './banner_template';

function attribute(name: string, displayValue: string, displayName?: string): ResolvedChannelAttribute {
    const field = {
        id: `field_${name}`,
        group_id: 'group1',
        name,
        type: 'select',
        target_id: '',
        target_type: 'system',
        object_type: 'channel',
        attrs: displayName ? {display_name: displayName} : {},
        create_at: 1,
        update_at: 1,
        delete_at: 0,
        created_by: '',
        updated_by: '',
    } as PropertyField;

    return {field, displayValue};
}

describe('renderBannerTemplate', () => {
    test('substitutes a single attribute value', () => {
        expect(renderBannerTemplate('{{classification}}', [attribute('classification', 'TOP SECRET')])).toBe('TOP SECRET');
    });

    test('substitutes several attributes and keeps the separator the author typed', () => {
        const attributes = [attribute('classification', 'TOP SECRET'), attribute('program', 'AURORA')];
        expect(renderBannerTemplate('{{classification}} · {{program}}', attributes)).toBe('TOP SECRET · AURORA');
    });

    test('preserves surrounding literal text and markdown', () => {
        expect(renderBannerTemplate('**{{classification}}** — handle with care', [attribute('classification', 'SECRET')])).
            toBe('**SECRET** — handle with care');
    });

    test('tolerates whitespace inside the braces', () => {
        expect(renderBannerTemplate('{{ classification }}', [attribute('classification', 'SECRET')])).toBe('SECRET');
    });

    test('repeats an attribute referenced twice', () => {
        expect(renderBannerTemplate('{{program}} / {{program}}', [attribute('program', 'AURORA')])).toBe('AURORA / AURORA');
    });

    // The regression that matters: everything written before this feature existed
    // is a literal, and must come back byte for byte.
    test('returns a literal with no tokens untouched', () => {
        expect(renderBannerTemplate('**TOP SECRET**', [])).toBe('**TOP SECRET**');
        expect(renderBannerTemplate('Braces { } but no tokens', [])).toBe('Braces { } but no tokens');
    });

    test('returns empty text untouched', () => {
        expect(renderBannerTemplate('', [attribute('program', 'AURORA')])).toBe('');
    });

    describe('unresolvable tokens', () => {
        test('drops a token for an attribute that has no value', () => {
            const attributes = [attribute('classification', 'SECRET'), attribute('program', '')];
            expect(renderBannerTemplate('{{classification}} · {{program}}', attributes)).toBe('SECRET');
        });

        test('drops a token for an attribute that does not exist', () => {
            expect(renderBannerTemplate('{{classification}} · {{gone}}', [attribute('classification', 'SECRET')])).toBe('SECRET');
        });

        test('does not leave a raw token on screen', () => {
            expect(renderBannerTemplate('{{gone}}', [])).toBe('');
        });

        test('cleans up a separator stranded at the front', () => {
            expect(renderBannerTemplate('{{gone}} · {{program}}', [attribute('program', 'AURORA')])).toBe('AURORA');
        });

        test('cleans up a separator stranded between two survivors', () => {
            const attributes = [attribute('a', 'ONE'), attribute('b', ''), attribute('c', 'THREE')];
            expect(renderBannerTemplate('{{a}} · {{b}} · {{c}}', attributes)).toBe('ONE · THREE');
        });
    });
});

describe('hasAttributeTokens', () => {
    test('detects a token', () => {
        expect(hasAttributeTokens('{{program}}')).toBe(true);
    });

    test('does not treat plain braces as a token', () => {
        expect(hasAttributeTokens('a { b } c')).toBe(false);
        expect(hasAttributeTokens('**SECRET**')).toBe(false);
    });

    // The pattern is a module-level regex with lastIndex state, so a repeated
    // call has to give the same answer.
    test('is repeatable', () => {
        expect(hasAttributeTokens('{{program}}')).toBe(true);
        expect(hasAttributeTokens('{{program}}')).toBe(true);
    });
});

describe('referencedFieldNames', () => {
    test('lists each referenced name once, in order', () => {
        expect(referencedFieldNames('{{b}} · {{a}} · {{b}}')).toEqual(['b', 'a']);
    });

    test('returns nothing for a literal', () => {
        expect(referencedFieldNames('**SECRET**')).toEqual([]);
    });
});

describe('attributeToken', () => {
    test('wraps a field name', () => {
        expect(attributeToken('program')).toBe('{{program}}');
    });
});

describe('tokenSuggestions', () => {
    test('offers the display name as the label and the machine name as the token', () => {
        expect(tokenSuggestions([attribute('caveat', 'NOFORN', 'Caveat / Releasability')])).toEqual([
            {name: 'caveat', label: 'Caveat / Releasability'},
        ]);
    });

    test('falls back to the machine name when there is no display name', () => {
        expect(tokenSuggestions([attribute('program', 'AURORA')])).toEqual([{name: 'program', label: 'program'}]);
    });
});

describe('withRequiredTokens', () => {
    test('seeds an empty template with every designated attribute', () => {
        expect(withRequiredTokens('', ['classification', 'program'])).toBe('{{classification}} · {{program}}');
    });

    test('leaves a template that already references them untouched', () => {
        const template = '{{program}} handle via {{classification}}';
        expect(withRequiredTokens(template, ['classification', 'program'])).toBe(template);
    });

    test('appends only the ones missing, keeping what the author wrote', () => {
        expect(withRequiredTokens('{{classification}}', ['classification', 'program'])).
            toBe('{{classification}} · {{program}}');
    });

    test('appends after literal text rather than replacing it', () => {
        expect(withRequiredTokens('Handle with care', ['program'])).toBe('Handle with care · {{program}}');
    });

    test('is a no-op when nothing is designated', () => {
        expect(withRequiredTokens('Handle with care', [])).toBe('Handle with care');
    });
});
