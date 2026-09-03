// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// pdfjs-dist 4.x ships ESM-only builds that use import.meta.url, which Jest's
// CommonJS runtime cannot parse. This mock replaces all pdfjs-dist imports in
// tests so that components which transitively depend on pdf_preview.tsx compile
// without requiring the native pdfjs binary pipeline.
//
// This is intentional: running real pdfjs in jsdom would require mocking canvas,
// workers, and CMap fetches anyway — the mock is the right level of abstraction
// for unit tests. For pdf_preview.tsx component tests, extend this mock as needed.

export const GlobalWorkerOptions = {workerSrc: ''};

export const getDocument = jest.fn(() => ({
    promise: Promise.resolve({
        numPages: 1,
        getPage: jest.fn(() =>
            Promise.resolve({
                getViewport: jest.fn(() => ({width: 100, height: 100, scale: 1})),
                render: jest.fn(() => ({promise: Promise.resolve(), cancel: jest.fn()})),
                cleanup: jest.fn(),
            }),
        ),
        destroy: jest.fn(),
    }),
    destroy: jest.fn(),
}));

export const version = '4.10.38';
