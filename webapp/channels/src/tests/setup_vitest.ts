// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/// <reference types="vitest/globals" />

/* eslint-disable no-console */

import * as matchers from '@testing-library/jest-dom/matchers';
import nodeFetch from 'node-fetch';

// Use node-fetch for nock compatibility (nock doesn't intercept native fetch)
// This is needed for tests that use nock to mock HTTP requests
globalThis.fetch = nodeFetch as unknown as typeof fetch;

// Mock localforage-observable and set up global Observable before store initialization
// This must be imported first to prevent "Observable is not defined" errors
import './localforage-observable_mock_vitest';
import './mattermost-redux-store_mock_vitest';
import './performance_mock_vitest';
import './redux-persist_mock_vitest';
import './react-intl_mock_vitest';
import './react-router-dom_mock_vitest';
import './react-tippy_mock_vitest';
import './mui-styled-engine_mock_vitest';
import './react-redux_mock_vitest';

// Extend Vitest's expect with jest-dom matchers
expect.extend(matchers);

// Set timezone
// eslint-disable-next-line no-process-env
process.env.TZ = 'UTC';

// Setup window.location
global.window = Object.create(window);
Object.defineProperty(window, 'location', {
    value: {
        href: 'http://localhost:8065',
        origin: 'http://localhost:8065',
        port: '8065',
        protocol: 'http:',
        search: '',
    },
});

// Setup document commands
const supportedCommands = ['copy', 'insertText'];

Object.defineProperty(document, 'queryCommandSupported', {
    value: (cmd: string) => supportedCommands.includes(cmd),
});

Object.defineProperty(document, 'execCommand', {
    value: (cmd: string) => supportedCommands.includes(cmd),
});

document.documentElement.style.fontSize = '12px';

// Setup ResizeObserver
global.ResizeObserver = require('resize-observer-polyfill');

// Mock canvas 2D context for react-color and other components that use canvas
// This is needed because jsdom doesn't provide a real canvas implementation
HTMLCanvasElement.prototype.getContext = function(this: HTMLCanvasElement, contextId: string) {
    if (contextId === '2d') {
        return {
            fillRect: () => {},
            clearRect: () => {},
            getImageData: () => ({
                data: new Uint8ClampedArray(0),
            }),
            putImageData: () => {},
            createImageData: () => ({
                data: new Uint8ClampedArray(0),
            }),
            setTransform: () => {},
            drawImage: () => {},
            save: () => {},
            fillText: () => {},
            restore: () => {},
            beginPath: () => {},
            moveTo: () => {},
            lineTo: () => {},
            closePath: () => {},
            stroke: () => {},
            translate: () => {},
            scale: () => {},
            rotate: () => {},
            arc: () => {},
            fill: () => {},
            measureText: () => ({width: 0}),
            transform: () => {},
            rect: () => {},
            clip: () => {},
            canvas: this,
        } as unknown as CanvasRenderingContext2D;
    }
    return null;
} as typeof HTMLCanvasElement.prototype.getContext;

// Mock Path2D for pdfjs-dist compatibility in jsdom
// pdfjs-dist checks for Path2D and warns if not available
/* eslint-disable @typescript-eslint/no-unused-vars, no-useless-constructor */
class Path2DMock implements Path2D {
    constructor(_path?: string | Path2DMock) {}
    addPath(_path: Path2D, _transform?: DOMMatrix2DInit) {}
    closePath() {}
    moveTo(_x: number, _y: number) {}
    lineTo(_x: number, _y: number) {}
    bezierCurveTo(_cp1x: number, _cp1y: number, _cp2x: number, _cp2y: number, _x: number, _y: number) {}
    quadraticCurveTo(_cpx: number, _cpy: number, _x: number, _y: number) {}
    arc(_x: number, _y: number, _radius: number, _startAngle: number, _endAngle: number, _counterclockwise?: boolean) {}
    arcTo(_x1: number, _y1: number, _x2: number, _y2: number, _radius: number) {}
    ellipse(_x: number, _y: number, _radiusX: number, _radiusY: number, _rotation: number, _startAngle: number, _endAngle: number, _counterclockwise?: boolean) {}
    rect(_x: number, _y: number, _w: number, _h: number) {}
    roundRect(_x: number, _y: number, _w: number, _h: number, _radii?: number | DOMPointInit | Array<number | DOMPointInit>) {}
}
/* eslint-enable @typescript-eslint/no-unused-vars, no-useless-constructor */
global.Path2D = Path2DMock as unknown as typeof Path2D;

// Mock window.getComputedStyle to handle pseudoElt parameter
// jsdom doesn't implement getComputedStyle with pseudoElt, which SimpleBar uses
const originalGetComputedStyle = window.getComputedStyle;
window.getComputedStyle = (elt: Element, pseudoElt?: string | null) => {
    if (pseudoElt) {
        // Return a minimal CSSStyleDeclaration for pseudo elements
        return {
            getPropertyValue: () => '',
            content: '',
            width: '0px',
            height: '0px',
        } as unknown as CSSStyleDeclaration;
    }
    return originalGetComputedStyle(elt);
};

// Extend expect with custom matcher
expect.extend({
    arrayContainingExactly(received: string[], actual: string[]) {
        const pass = received.sort().join(',') === actual.sort().join(',');
        if (pass) {
            return {
                message: () =>
                    `expected ${received} to not contain the exact same values as ${actual}`,
                pass: true,
            };
        }
        return {
            message: () =>
                `expected ${received} to not contain the exact same values as ${actual}`,
            pass: false,
        };
    },
});
