// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {
    generateCustomSvgId,
    getCustomSvgs,
    saveCustomSvgs,
    addCustomSvg,
    updateCustomSvg,
    deleteCustomSvg,
    getCustomSvgById,
    getCustomSvgByName,
    validateSvg,
    sanitizeSvg,
    normalizeSvgColors,
    extractSvgViewBox,
    extractSvgInnerContent,
    normalizeSvgViewBox,
    encodeSvgToBase64,
    decodeSvgFromBase64,
    formatCustomSvgValue,
    parseCustomSvgValue,
    getCustomSvgsFromServer,
    addCustomSvgToServer,
    updateCustomSvgOnServer,
    deleteCustomSvgFromServer,
    type CustomSvg,
} from './custom_svgs';

// Mock the Client4 module
jest.mock('mattermost-redux/client', () => ({
    Client4: {
        getCustomChannelIcons: jest.fn(),
        getCustomChannelIcon: jest.fn(),
        createCustomChannelIcon: jest.fn(),
        updateCustomChannelIcon: jest.fn(),
        deleteCustomChannelIcon: jest.fn(),
    },
}));

const {Client4} = require('mattermost-redux/client');

describe('Custom SVG Management', () => {
    const userId = 'test-user-id';

    beforeEach(() => {
        localStorage.clear();
        jest.clearAllMocks();
    });

    afterEach(() => {
        localStorage.clear();
    });

    describe('generateCustomSvgId', () => {
        test('generates unique ID starting with custom_', () => {
            const id = generateCustomSvgId();
            expect(id.startsWith('custom_')).toBe(true);
        });

        test('generates different IDs each time', () => {
            const id1 = generateCustomSvgId();
            const id2 = generateCustomSvgId();
            expect(id1).not.toBe(id2);
        });
    });

    describe('getCustomSvgs / saveCustomSvgs', () => {
        test('returns empty array when no SVGs stored', () => {
            const svgs = getCustomSvgs(userId);
            expect(svgs).toEqual([]);
        });

        test('saves and retrieves SVGs', () => {
            const testSvgs: CustomSvg[] = [
                {id: 'svg1', name: 'Icon 1', svg: 'svg-data-1', normalizeColor: true, createdAt: 1000},
                {id: 'svg2', name: 'Icon 2', svg: 'svg-data-2', normalizeColor: false, createdAt: 2000},
            ];

            saveCustomSvgs(userId, testSvgs);
            const retrieved = getCustomSvgs(userId);

            expect(retrieved).toEqual(testSvgs);
        });

        test('different users have different storage', () => {
            saveCustomSvgs('user1', [{id: 'a', name: 'A', svg: 'x', normalizeColor: true, createdAt: 1}]);
            saveCustomSvgs('user2', [{id: 'b', name: 'B', svg: 'y', normalizeColor: false, createdAt: 2}]);

            expect(getCustomSvgs('user1')[0].id).toBe('a');
            expect(getCustomSvgs('user2')[0].id).toBe('b');
        });

        test('handles corrupted localStorage gracefully', () => {
            localStorage.setItem('mattermost_custom_svgs_test-user', 'not valid json');
            expect(getCustomSvgs('test-user')).toEqual([]);
        });
    });

    describe('addCustomSvg', () => {
        test('adds new SVG with generated ID and timestamp', () => {
            const result = addCustomSvg(userId, {
                name: 'New Icon',
                svg: '<svg>...</svg>',
                normalizeColor: true,
            });

            expect(result.id).toBeDefined();
            expect(result.id.startsWith('custom_')).toBe(true);
            expect(result.name).toBe('New Icon');
            expect(result.createdAt).toBeGreaterThan(0);

            // Verify it's stored
            const svgs = getCustomSvgs(userId);
            expect(svgs.length).toBe(1);
            expect(svgs[0].id).toBe(result.id);
        });

        test('appends to existing SVGs', () => {
            addCustomSvg(userId, {name: 'First', svg: 'a', normalizeColor: true});
            addCustomSvg(userId, {name: 'Second', svg: 'b', normalizeColor: false});

            const svgs = getCustomSvgs(userId);
            expect(svgs.length).toBe(2);
        });
    });

    describe('updateCustomSvg', () => {
        test('updates existing SVG', () => {
            const original = addCustomSvg(userId, {name: 'Original', svg: 'old', normalizeColor: false});

            const updated = updateCustomSvg(userId, original.id, {name: 'Updated', normalizeColor: true});

            expect(updated?.name).toBe('Updated');
            expect(updated?.normalizeColor).toBe(true);
            expect(updated?.svg).toBe('old'); // Unchanged field
        });

        test('returns undefined for non-existent ID', () => {
            const result = updateCustomSvg(userId, 'non-existent', {name: 'Test'});
            expect(result).toBeUndefined();
        });
    });

    describe('deleteCustomSvg', () => {
        test('deletes existing SVG', () => {
            const svg = addCustomSvg(userId, {name: 'To Delete', svg: 'x', normalizeColor: true});

            const result = deleteCustomSvg(userId, svg.id);

            expect(result).toBe(true);
            expect(getCustomSvgs(userId).length).toBe(0);
        });

        test('returns false for non-existent ID', () => {
            const result = deleteCustomSvg(userId, 'non-existent');
            expect(result).toBe(false);
        });
    });

    describe('getCustomSvgById', () => {
        test('finds SVG by ID', () => {
            const svg1 = addCustomSvg(userId, {name: 'One', svg: 'a', normalizeColor: true});
            addCustomSvg(userId, {name: 'Two', svg: 'b', normalizeColor: false});

            const found = getCustomSvgById(userId, svg1.id);
            expect(found?.name).toBe('One');
        });

        test('returns undefined for non-existent ID', () => {
            expect(getCustomSvgById(userId, 'missing')).toBeUndefined();
        });
    });

    describe('getCustomSvgByName', () => {
        test('finds SVG by name (case-insensitive)', () => {
            addCustomSvg(userId, {name: 'MyIcon', svg: 'data', normalizeColor: true});

            expect(getCustomSvgByName(userId, 'MyIcon')?.name).toBe('MyIcon');
            expect(getCustomSvgByName(userId, 'myicon')?.name).toBe('MyIcon');
            expect(getCustomSvgByName(userId, 'MYICON')?.name).toBe('MyIcon');
        });

        test('returns undefined for non-existent name', () => {
            expect(getCustomSvgByName(userId, 'Missing')).toBeUndefined();
        });
    });

    describe('validateSvg', () => {
        test('accepts valid SVG', () => {
            const result = validateSvg('<svg viewBox="0 0 24 24"><path d="M0 0"/></svg>');
            expect(result.valid).toBe(true);
            expect(result.error).toBeUndefined();
        });

        test('accepts self-closing SVG', () => {
            const result = validateSvg('<svg viewBox="0 0 24 24"/>');
            expect(result.valid).toBe(true);
        });

        test('rejects content without SVG tag', () => {
            const result = validateSvg('<div>Not an SVG</div>');
            expect(result.valid).toBe(false);
            expect(result.error).toContain('<svg');
        });

        test('rejects unclosed SVG tag', () => {
            const result = validateSvg('<svg viewBox="0 0 24 24"><path d="M0 0"');
            expect(result.valid).toBe(false);
            expect(result.error).toContain('closed');
        });

        test('rejects SVG with script tags', () => {
            const result = validateSvg('<svg><script>alert("xss")</script></svg>');
            expect(result.valid).toBe(false);
            expect(result.error).toContain('script');
        });

        test('rejects SVG with event handlers', () => {
            const result = validateSvg('<svg onload="alert(1)"><path/></svg>');
            expect(result.valid).toBe(false);
            expect(result.error).toContain('event handlers');
        });

        test('rejects SVG with javascript: URLs', () => {
            const result = validateSvg('<svg><a href="javascript:alert(1)"><path/></a></svg>');
            expect(result.valid).toBe(false);
            expect(result.error).toContain('javascript');
        });
    });

    describe('sanitizeSvg', () => {
        test('removes script tags', () => {
            const input = '<svg><script>alert("bad")</script><path d="M0 0"/></svg>';
            const sanitized = sanitizeSvg(input);
            expect(sanitized).not.toContain('<script');
            expect(sanitized).toContain('<path');
        });

        test('removes event handlers', () => {
            const input = '<svg onclick="bad()" onload="evil()"><path d="M0 0"/></svg>';
            const sanitized = sanitizeSvg(input);
            expect(sanitized).not.toContain('onclick');
            expect(sanitized).not.toContain('onload');
        });

        test('removes javascript: URLs', () => {
            const input = '<svg><a href="javascript:alert(1)"><path/></a></svg>';
            const sanitized = sanitizeSvg(input);
            expect(sanitized).not.toContain('javascript:');
        });

        test('preserves valid content', () => {
            const input = '<svg viewBox="0 0 24 24"><path d="M12 0L24 12"/></svg>';
            const sanitized = sanitizeSvg(input);
            expect(sanitized).toBe(input);
        });
    });

    describe('normalizeSvgColors', () => {
        test('converts fill colors to currentColor', () => {
            const input = '<svg><path fill="#ff0000"/></svg>';
            const result = normalizeSvgColors(input);
            expect(result).toContain('fill="currentColor"');
            expect(result).not.toContain('#ff0000');
        });

        test('converts stroke colors to currentColor', () => {
            const input = '<svg><path stroke="blue"/></svg>';
            const result = normalizeSvgColors(input);
            expect(result).toContain('stroke="currentColor"');
        });

        test('preserves fill="none"', () => {
            const input = '<svg><path fill="none" stroke="#000"/></svg>';
            const result = normalizeSvgColors(input);
            expect(result).toContain('fill="none"');
        });

        test('preserves stroke="transparent"', () => {
            const input = '<svg><path stroke="transparent"/></svg>';
            const result = normalizeSvgColors(input);
            expect(result).toContain('stroke="transparent"');
        });

        test('handles inline styles', () => {
            const input = '<svg><path style="fill: red; stroke: blue"/></svg>';
            const result = normalizeSvgColors(input);
            expect(result).toContain('fill: currentColor');
            expect(result).toContain('stroke: currentColor');
        });
    });

    describe('extractSvgViewBox', () => {
        test('extracts viewBox dimensions', () => {
            const result = extractSvgViewBox('<svg viewBox="0 0 24 24"><path/></svg>');
            expect(result).toEqual({x: 0, y: 0, width: 24, height: 24});
        });

        test('handles viewBox with offset', () => {
            const result = extractSvgViewBox('<svg viewBox="-10 -5 100 50"><path/></svg>');
            expect(result).toEqual({x: -10, y: -5, width: 100, height: 50});
        });

        test('falls back to width/height attributes', () => {
            const result = extractSvgViewBox('<svg width="32" height="32"><path/></svg>');
            expect(result).toEqual({x: 0, y: 0, width: 32, height: 32});
        });

        test('returns null when no dimensions found', () => {
            const result = extractSvgViewBox('<svg><path/></svg>');
            expect(result).toBeNull();
        });
    });

    describe('extractSvgInnerContent', () => {
        test('extracts content inside SVG tags', () => {
            const result = extractSvgInnerContent('<svg viewBox="0 0 24 24"><path d="M0 0"/><circle r="5"/></svg>');
            expect(result).toBe('<path d="M0 0"/><circle r="5"/>');
        });

        test('handles SVG with attributes', () => {
            const result = extractSvgInnerContent('<svg class="icon" fill="none"><rect/></svg>');
            expect(result).toBe('<rect/>');
        });

        test('returns empty string for invalid SVG', () => {
            const result = extractSvgInnerContent('<div>not svg</div>');
            expect(result).toBe('');
        });
    });

    describe('normalizeSvgViewBox', () => {
        test('normalizes to 24x24 viewBox', () => {
            const input = '<svg viewBox="0 0 48 48"><path d="M0 0"/></svg>';
            const result = normalizeSvgViewBox(input);
            expect(result).toContain('viewBox="0 0 24 24"');
        });

        test('centers content horizontally', () => {
            const result = normalizeSvgViewBox('<svg viewBox="0 0 10 20"><path/></svg>');
            expect(result).toContain('viewBox="0 0 24 24"');
            expect(result).toContain('transform=');
        });

        test('adds preserveAspectRatio', () => {
            const result = normalizeSvgViewBox('<svg viewBox="0 0 24 24"><path/></svg>');
            expect(result).toContain('preserveAspectRatio="xMidYMid meet"');
        });
    });

    describe('encodeSvgToBase64 / decodeSvgFromBase64', () => {
        test('encodes SVG to base64', () => {
            const svg = '<svg viewBox="0 0 24 24"><path d="M0 0"/></svg>';
            const encoded = encodeSvgToBase64(svg);
            expect(typeof encoded).toBe('string');
            expect(encoded.length).toBeGreaterThan(0);
        });

        test('decodes base64 to SVG', () => {
            const original = '<svg viewBox="0 0 24 24"><path d="M0 0"/></svg>';
            const encoded = encodeSvgToBase64(original);
            const decoded = decodeSvgFromBase64(encoded);
            expect(decoded).toBe(original);
        });

        test('handles unicode characters', () => {
            const svg = '<svg><text>你好 😀</text></svg>';
            const encoded = encodeSvgToBase64(svg);
            const decoded = decodeSvgFromBase64(encoded);
            expect(decoded).toBe(svg);
        });

        test('decodes returns empty string for invalid base64', () => {
            expect(decodeSvgFromBase64('not valid base64!!!')).toBe('');
        });
    });

    describe('formatCustomSvgValue / parseCustomSvgValue', () => {
        test('formats custom SVG value', () => {
            expect(formatCustomSvgValue('my-icon-id')).toBe('customsvg:my-icon-id');
        });

        test('parses custom SVG value', () => {
            expect(parseCustomSvgValue('customsvg:my-icon-id')).toBe('my-icon-id');
        });

        test('returns null for non-customsvg values', () => {
            expect(parseCustomSvgValue('mdi:home')).toBeNull();
            expect(parseCustomSvgValue('lucide:star')).toBeNull();
            expect(parseCustomSvgValue('something else')).toBeNull();
        });
    });

    describe('Server API functions', () => {
        describe('getCustomSvgsFromServer', () => {
            test('fetches and converts server icons', async () => {
                Client4.getCustomChannelIcons.mockResolvedValue([
                    {id: 'server-1', name: 'Icon 1', svg: 'data1', normalize_color: true, create_at: 1000},
                    {id: 'server-2', name: 'Icon 2', svg: 'data2', normalize_color: false, create_at: 2000},
                ]);

                const result = await getCustomSvgsFromServer();

                expect(result.length).toBe(2);
                expect(result[0]).toEqual({
                    id: 'server-1',
                    name: 'Icon 1',
                    svg: 'data1',
                    normalizeColor: true,
                    createdAt: 1000,
                });
            });

            test('returns empty array on error', async () => {
                const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
                Client4.getCustomChannelIcons.mockRejectedValue(new Error('Network error'));
                const result = await getCustomSvgsFromServer();
                expect(result).toEqual([]);
                expect(consoleSpy).toHaveBeenCalled();
                consoleSpy.mockRestore();
            });
        });

        describe('addCustomSvgToServer', () => {
            test('creates icon on server', async () => {
                Client4.createCustomChannelIcon.mockResolvedValue({
                    id: 'new-id',
                    name: 'New Icon',
                    svg: 'svg-data',
                    normalize_color: true,
                    create_at: 12345,
                });

                const result = await addCustomSvgToServer({
                    name: 'New Icon',
                    svg: 'svg-data',
                    normalizeColor: true,
                });

                expect(Client4.createCustomChannelIcon).toHaveBeenCalledWith({
                    name: 'New Icon',
                    svg: 'svg-data',
                    normalize_color: true,
                });
                expect(result.id).toBe('new-id');
            });
        });

        describe('updateCustomSvgOnServer', () => {
            test('updates icon on server', async () => {
                Client4.updateCustomChannelIcon.mockResolvedValue({
                    id: 'icon-id',
                    name: 'Updated Name',
                    svg: 'updated-svg',
                    normalize_color: false,
                    create_at: 1000,
                });

                const result = await updateCustomSvgOnServer('icon-id', {
                    name: 'Updated Name',
                    svg: 'updated-svg',
                });

                expect(Client4.updateCustomChannelIcon).toHaveBeenCalledWith('icon-id', {
                    name: 'Updated Name',
                    svg: 'updated-svg',
                    normalize_color: undefined,
                });
                expect(result.name).toBe('Updated Name');
            });
        });

        describe('deleteCustomSvgFromServer', () => {
            test('deletes icon on server', async () => {
                Client4.deleteCustomChannelIcon.mockResolvedValue({});

                const result = await deleteCustomSvgFromServer('icon-id');

                expect(Client4.deleteCustomChannelIcon).toHaveBeenCalledWith('icon-id');
                expect(result).toBe(true);
            });

            test('returns false on error', async () => {
                Client4.deleteCustomChannelIcon.mockRejectedValue(new Error('Not found'));

                const result = await deleteCustomSvgFromServer('missing-id');
                expect(result).toBe(false);
            });
        });
    });
});
