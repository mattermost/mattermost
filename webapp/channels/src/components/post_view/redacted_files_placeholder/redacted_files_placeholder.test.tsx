// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen} from 'tests/react_testing_utils';

import RedactedFilesPlaceholder from './index';

describe('RedactedFilesPlaceholder', () => {
    it('should render title "Files not available"', async () => {
        await renderWithContext(
            <RedactedFilesPlaceholder count={1}/>,
        );

        const placeholder = screen.getByTestId('redactedFilesPlaceholder');
        expect(placeholder).toBeInTheDocument();
        expect(placeholder).toHaveTextContent(/Files not available/);
    });

    it('should render subtitle about attribute restriction', async () => {
        await renderWithContext(
            <RedactedFilesPlaceholder count={1}/>,
        );

        expect(screen.getByTestId('redactedFilesPlaceholder')).toHaveTextContent(
            /Access to files is restricted based on attributes/,
        );
    });

    it('should render normal (non-compact) layout by default', async () => {
        const {container} = await renderWithContext(
            <RedactedFilesPlaceholder count={2}/>,
        );

        expect(container.querySelector('.post-image__columns')).toBeInTheDocument();
        expect(container.querySelector('.post-image__column--redacted')).toBeInTheDocument();
        expect(container.querySelector('.post-image__column--redacted-compact')).not.toBeInTheDocument();
    });

    it('should render compact layout when compactDisplay is true', async () => {
        const {container} = await renderWithContext(
            <RedactedFilesPlaceholder
                count={2}
                compactDisplay={true}
            />,
        );

        expect(container.querySelector('.post-image__column--redacted-compact')).toBeInTheDocument();
        expect(container.querySelector('.post-image__columns')).not.toBeInTheDocument();
    });

    it('should render file icon', async () => {
        const {container} = await renderWithContext(
            <RedactedFilesPlaceholder count={1}/>,
        );

        expect(container.querySelector('svg')).toBeInTheDocument();
    });

    it('should render file icon in compact mode', async () => {
        const {container} = await renderWithContext(
            <RedactedFilesPlaceholder
                count={1}
                compactDisplay={true}
            />,
        );

        expect(container.querySelector('svg')).toBeInTheDocument();
    });

    it('should render with compactDisplay=false same as default', async () => {
        const {container} = await renderWithContext(
            <RedactedFilesPlaceholder
                count={2}
                compactDisplay={false}
            />,
        );

        expect(container.querySelector('.post-image__columns')).toBeInTheDocument();
        expect(container.querySelector('.post-image__column--redacted-compact')).not.toBeInTheDocument();
    });
});
