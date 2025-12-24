// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {
    getAnchorIdFromHash,
    getPageAnchorUrl,
    scrollToAnchor,
    handleAnchorHashNavigation,
} from './page_anchor';

describe('page_anchor utilities', () => {
    describe('getAnchorIdFromHash', () => {
        it('should extract anchor ID from hash with leading #', () => {
            expect(getAnchorIdFromHash('#ic-abc123')).toBe('abc123');
        });

        it('should extract anchor ID from hash without leading #', () => {
            expect(getAnchorIdFromHash('ic-abc123')).toBe('abc123');
        });

        it('should return null for non-matching hash', () => {
            expect(getAnchorIdFromHash('#other')).toBe(null);
            expect(getAnchorIdFromHash('other')).toBe(null);
            expect(getAnchorIdFromHash('#section-header')).toBe(null);
        });

        it('should return null for empty hash', () => {
            expect(getAnchorIdFromHash('')).toBe(null);
            expect(getAnchorIdFromHash('#')).toBe(null);
        });

        it('should handle UUID-style anchor IDs', () => {
            const uuid = '550e8400-e29b-41d4-a716-446655440000';
            expect(getAnchorIdFromHash(`#ic-${uuid}`)).toBe(uuid);
        });

        it('should handle simple alphanumeric IDs', () => {
            expect(getAnchorIdFromHash('#ic-xyz123abc')).toBe('xyz123abc');
        });
    });

    describe('getPageAnchorUrl', () => {
        it('should append anchor hash to page URL', () => {
            expect(getPageAnchorUrl('/team/wiki/page123', 'abc123')).toBe('/team/wiki/page123#ic-abc123');
        });

        it('should replace existing hash', () => {
            expect(getPageAnchorUrl('/team/wiki/page123#existing', 'abc123')).toBe('/team/wiki/page123#ic-abc123');
        });

        it('should handle URLs with query parameters', () => {
            expect(getPageAnchorUrl('/team/wiki/page123?foo=bar', 'abc123')).toBe('/team/wiki/page123?foo=bar#ic-abc123');
        });

        it('should handle absolute URLs', () => {
            expect(getPageAnchorUrl('https://example.com/wiki/page', 'xyz')).toBe('https://example.com/wiki/page#ic-xyz');
        });

        it('should handle UUID-style anchor IDs', () => {
            const uuid = '550e8400-e29b-41d4-a716-446655440000';
            expect(getPageAnchorUrl('/wiki/page', uuid)).toBe(`/wiki/page#ic-${uuid}`);
        });
    });

    describe('scrollToAnchor', () => {
        let mockElement: HTMLElement;
        let originalGetElementById: typeof document.getElementById;

        beforeEach(() => {
            mockElement = document.createElement('span');
            mockElement.scrollIntoView = jest.fn();
            mockElement.classList.add = jest.fn();
            mockElement.classList.remove = jest.fn();

            originalGetElementById = document.getElementById;
            document.getElementById = jest.fn();
        });

        afterEach(() => {
            document.getElementById = originalGetElementById;
            jest.useRealTimers();
        });

        it('should return false if element not found', () => {
            (document.getElementById as jest.Mock).mockReturnValue(null);
            expect(scrollToAnchor('nonexistent')).toBe(false);
        });

        it('should return true and scroll to element when found', () => {
            (document.getElementById as jest.Mock).mockReturnValue(mockElement);
            expect(scrollToAnchor('abc123')).toBe(true);
            expect(document.getElementById).toHaveBeenCalledWith('ic-abc123');
            expect(mockElement.scrollIntoView).toHaveBeenCalledWith({
                behavior: 'smooth',
                block: 'center',
            });
        });

        it('should add highlight class to element', () => {
            (document.getElementById as jest.Mock).mockReturnValue(mockElement);
            scrollToAnchor('abc123');
            expect(mockElement.classList.add).toHaveBeenCalledWith('anchor-highlighted');
        });

        it('should remove highlight class after timeout', () => {
            jest.useFakeTimers();
            (document.getElementById as jest.Mock).mockReturnValue(mockElement);
            scrollToAnchor('abc123');

            expect(mockElement.classList.remove).not.toHaveBeenCalled();

            jest.advanceTimersByTime(2000);
            expect(mockElement.classList.remove).toHaveBeenCalledWith('anchor-highlighted');
        });
    });

    describe('handleAnchorHashNavigation', () => {
        let originalLocation: Location;
        let mockElement: HTMLElement;

        beforeEach(() => {
            originalLocation = window.location;
            mockElement = document.createElement('span');
            mockElement.scrollIntoView = jest.fn();
            mockElement.classList.add = jest.fn();
            mockElement.classList.remove = jest.fn();

            Object.defineProperty(window, 'location', {
                writable: true,
                value: {hash: ''},
            });
        });

        afterEach(() => {
            Object.defineProperty(window, 'location', {
                writable: true,
                value: originalLocation,
            });
        });

        it('should return false if no hash in URL', () => {
            window.location.hash = '';
            expect(handleAnchorHashNavigation()).toBe(false);
        });

        it('should return false if hash is not an anchor hash', () => {
            window.location.hash = '#section-header';
            expect(handleAnchorHashNavigation()).toBe(false);
        });

        it('should return true and scroll when valid anchor hash exists', () => {
            window.location.hash = '#ic-abc123';
            const spy = jest.spyOn(document, 'getElementById').mockReturnValue(mockElement);

            expect(handleAnchorHashNavigation()).toBe(true);
            expect(spy).toHaveBeenCalledWith('ic-abc123');

            spy.mockRestore();
        });

        it('should return false if element not found even with valid hash', () => {
            window.location.hash = '#ic-nonexistent';
            const spy = jest.spyOn(document, 'getElementById').mockReturnValue(null);

            expect(handleAnchorHashNavigation()).toBe(false);

            spy.mockRestore();
        });
    });
});
