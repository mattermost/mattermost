// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen} from 'tests/react_testing_utils';

import RedactedFilesPlaceholder from './index';

describe('RedactedFilesPlaceholder', () => {
    it('should render placeholder with singular message for count=1', () => {
        renderWithContext(
            <RedactedFilesPlaceholder count={1}/>,
        );

        const placeholder = screen.getByTestId('redactedFilesPlaceholder');
        expect(placeholder).toBeInTheDocument();
        expect(placeholder).toHaveTextContent(/1 file is restricted/);
    });

    it('should render placeholder with plural message for count=3', () => {
        renderWithContext(
            <RedactedFilesPlaceholder count={3}/>,
        );

        const placeholder = screen.getByTestId('redactedFilesPlaceholder');
        expect(placeholder).toBeInTheDocument();
        expect(placeholder).toHaveTextContent(/3 files are restricted/);
    });

    it('should render normal (non-compact) layout by default', () => {
        const {container} = renderWithContext(
            <RedactedFilesPlaceholder count={2}/>,
        );

        // Normal layout has outer wrapper with post-image__columns
        const outerWrapper = container.querySelector('.post-image__columns');
        expect(outerWrapper).toBeInTheDocument();

        const column = container.querySelector('.post-image__column--redacted');
        expect(column).toBeInTheDocument();

        // Should NOT have compact class
        const compactColumn = container.querySelector('.post-image__column--redacted-compact');
        expect(compactColumn).not.toBeInTheDocument();
    });

    it('should render compact layout when compactDisplay is true', () => {
        const {container} = renderWithContext(
            <RedactedFilesPlaceholder
                count={2}
                compactDisplay={true}
            />,
        );

        const compactColumn = container.querySelector('.post-image__column--redacted-compact');
        expect(compactColumn).toBeInTheDocument();

        // Should NOT have outer post-image__columns wrapper
        const outerWrapper = container.querySelector('.post-image__columns');
        expect(outerWrapper).not.toBeInTheDocument();
    });

    it('should render lock icon', () => {
        const {container} = renderWithContext(
            <RedactedFilesPlaceholder count={1}/>,
        );

        const svg = container.querySelector('svg');
        expect(svg).toBeInTheDocument();
    });

    it('should render lock icon in compact mode', () => {
        const {container} = renderWithContext(
            <RedactedFilesPlaceholder
                count={1}
                compactDisplay={true}
            />,
        );

        const svg = container.querySelector('svg');
        expect(svg).toBeInTheDocument();
    });

    it('should render with compactDisplay=false same as default', () => {
        const {container} = renderWithContext(
            <RedactedFilesPlaceholder
                count={2}
                compactDisplay={false}
            />,
        );

        const outerWrapper = container.querySelector('.post-image__columns');
        expect(outerWrapper).toBeInTheDocument();

        const compactColumn = container.querySelector('.post-image__column--redacted-compact');
        expect(compactColumn).not.toBeInTheDocument();
    });
});
