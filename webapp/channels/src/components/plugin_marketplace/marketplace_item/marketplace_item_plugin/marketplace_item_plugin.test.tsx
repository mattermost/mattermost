// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen} from 'tests/react_testing_utils';

import {UpdateDetails, UpdateConfirmationModal} from './marketplace_item_plugin';
import type {UpdateDetailsProps, UpdateConfirmationModalProps} from './marketplace_item_plugin';

describe('components/MarketplaceItemPlugin', () => {
    describe('UpdateDetails', () => {
        const baseProps: UpdateDetailsProps = {
            version: '0.0.2',
            releaseNotesUrl: 'http://example.com/release',
            installedVersion: '0.0.1',
            isInstalling: false,
            onUpdate: () => {},
        };

        describe('should render nothing', () => {
            it('when no installed version', () => {
                const props = {
                    ...baseProps,
                    installedVersion: '',
                };
                const {container} = renderWithContext(
                    <UpdateDetails {...props}/>,
                );

                expect(container).toBeEmptyDOMElement();
            });

            it('when installed version matches available version', () => {
                const props = {
                    ...baseProps,
                    installedVersion: baseProps.version,
                };
                const {container} = renderWithContext(
                    <UpdateDetails {...props}/>,
                );

                expect(container).toBeEmptyDOMElement();
            });

            it('when installed version is newer than available version', () => {
                const props = {
                    ...baseProps,
                    installedVersion: '0.0.3',
                };
                const {container} = renderWithContext(
                    <UpdateDetails {...props}/>,
                );

                expect(container).toBeEmptyDOMElement();
            });

            it('when installing', () => {
                const props = {
                    ...baseProps,
                    isInstalling: true,
                };
                const {container} = renderWithContext(
                    <UpdateDetails {...props}/>,
                );

                expect(container).toBeEmptyDOMElement();
            });
        });
    });

    describe('UpdateConfirmationModal', () => {
        const baseProps: UpdateConfirmationModalProps = {
            show: true,
            name: 'pluginName',
            version: '0.0.2',
            releaseNotesUrl: 'http://example.com/release',
            installedVersion: '0.0.1',
            onUpdate: () => {},
            onCancel: () => {},
        };

        describe('should render nothing', () => {
            it('if not installed', () => {
                const props = {
                    ...baseProps,
                };
                delete props.installedVersion;

                const {container} = renderWithContext(
                    <UpdateConfirmationModal {...props}/>,
                );
                expect(container).toBeEmptyDOMElement();
            });

            it('when installed version is newer than available version', () => {
                const props = {
                    ...baseProps,
                    installedVersion: '0.0.3',
                };

                const {container} = renderWithContext(
                    <UpdateConfirmationModal {...props}/>,
                );
                expect(container).toBeEmptyDOMElement();
            });
        });

        it('should propogate show to ConfirmModal', () => {
            const props = {
                ...baseProps,
                show: false,
            };
            renderWithContext(
                <UpdateConfirmationModal {...props}/>,
            );

            // When show is false, ConfirmModal should not display modal content
            expect(screen.queryByText('Confirm Plugin Update')).not.toBeInTheDocument();
        });
    });
});
