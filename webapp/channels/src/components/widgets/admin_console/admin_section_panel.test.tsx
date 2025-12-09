// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {defineMessage} from 'react-intl';

import {renderWithContext, screen} from 'tests/react_testing_utils';
import {LicenseSkus} from 'utils/constants';

import AdminSectionPanel from './admin_section_panel';

describe('components/widgets/admin_console/AdminSectionPanel', () => {
    test('renders with title and description as string', () => {
        renderWithContext(
            <AdminSectionPanel
                title='Test Section'
                description='Test description'
            >
                <div>{'Content'}</div>
            </AdminSectionPanel>,
        );

        expect(screen.getByText('Test Section')).toBeInTheDocument();
        expect(screen.getByText('Test description')).toBeInTheDocument();
        expect(screen.getByText('Content')).toBeInTheDocument();
    });

    test('renders with description as MessageDescriptor', () => {
        const description = defineMessage({
            id: 'test.description',
            defaultMessage: 'Formatted description',
        });

        renderWithContext(
            <AdminSectionPanel
                title='Test Section'
                description={description}
            >
                <div>{'Content'}</div>
            </AdminSectionPanel>,
        );

        expect(screen.getByText('Test Section')).toBeInTheDocument();
        expect(screen.getByText('Formatted description')).toBeInTheDocument();
    });

    test('renders with license SKU badge', () => {
        renderWithContext(
            <AdminSectionPanel
                title='Premium Feature'
                licenseSku={LicenseSkus.EnterpriseAdvanced}
            >
                <div>{'Content'}</div>
            </AdminSectionPanel>,
        );

        expect(screen.getByText('Premium Feature')).toBeInTheDocument();
        expect(screen.getByText('Enterprise Advanced')).toBeInTheDocument();
    });

    test('renders without header when no title or description', () => {
        const {container} = renderWithContext(
            <AdminSectionPanel>
                <div>{'Content'}</div>
            </AdminSectionPanel>,
        );

        expect(container.querySelector('.AdminSectionPanel__header')).not.toBeInTheDocument();
        expect(screen.getByText('Content')).toBeInTheDocument();
    });

    test('renders with title only', () => {
        renderWithContext(
            <AdminSectionPanel title='Test Section'>
                <div>{'Content'}</div>
            </AdminSectionPanel>,
        );

        expect(screen.getByText('Test Section')).toBeInTheDocument();
        expect(screen.getByText('Content')).toBeInTheDocument();
    });

    test('renders with description only', () => {
        renderWithContext(
            <AdminSectionPanel description='Test description'>
                <div>{'Content'}</div>
            </AdminSectionPanel>,
        );

        expect(screen.getByText('Test description')).toBeInTheDocument();
        expect(screen.getByText('Content')).toBeInTheDocument();
    });

    test('renders all props together', () => {
        renderWithContext(
            <AdminSectionPanel
                title='Premium Feature'
                description='This is a premium feature'
                licenseSku={LicenseSkus.Professional}
            >
                <div>{'Content'}</div>
            </AdminSectionPanel>,
        );

        expect(screen.getByText('Premium Feature')).toBeInTheDocument();
        expect(screen.getByText('This is a premium feature')).toBeInTheDocument();
        expect(screen.getByText('Professional')).toBeInTheDocument();
        expect(screen.getByText('Content')).toBeInTheDocument();
    });
});

