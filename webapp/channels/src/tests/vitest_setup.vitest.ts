// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

describe('Vitest Setup Verification', () => {
    it('should run a basic test', () => {
        expect(1 + 1).toBe(2);
    });

    it('should have global expect extended with jest-dom matchers', () => {
        const div = document.createElement('div');
        div.textContent = 'Hello';
        document.body.appendChild(div);
        expect(div).toHaveTextContent('Hello');
        document.body.removeChild(div);
    });

    it('should have window.location set correctly', () => {
        expect(window.location.href).toBe('http://localhost:8065');
        expect(window.location.origin).toBe('http://localhost:8065');
    });

    it('should have ResizeObserver available', () => {
        expect(global.ResizeObserver).toBeDefined();
    });
});
