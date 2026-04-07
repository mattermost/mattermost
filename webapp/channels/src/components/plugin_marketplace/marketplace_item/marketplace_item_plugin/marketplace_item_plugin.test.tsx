// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {PluginStatusRedux} from '@mattermost/types/plugins';

import {renderWithContext, screen} from 'tests/react_testing_utils';

import MarketplaceItemPlugin, {UpdateDetails, UpdateConfirmationModal} from './marketplace_item_plugin';
import type {UpdateDetailsProps, UpdateConfirmationModalProps, MarketplaceItemPluginProps} from './marketplace_item_plugin';

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
            it('when no installed version', async () => {
                const props = {
                    ...baseProps,
                    installedVersion: '',
                };
                const {container} = await renderWithContext(
                    <UpdateDetails {...props}/>,
                );

                expect(container).toBeEmptyDOMElement();
            });

            it('when installed version matches available version', async () => {
                const props = {
                    ...baseProps,
                    installedVersion: baseProps.version,
                };
                const {container} = await renderWithContext(
                    <UpdateDetails {...props}/>,
                );

                expect(container).toBeEmptyDOMElement();
            });

            it('when installed version is newer than available version', async () => {
                const props = {
                    ...baseProps,
                    installedVersion: '0.0.3',
                };
                const {container} = await renderWithContext(
                    <UpdateDetails {...props}/>,
                );

                expect(container).toBeEmptyDOMElement();
            });

            it('when installing', async () => {
                const props = {
                    ...baseProps,
                    isInstalling: true,
                };
                const {container} = await renderWithContext(
                    <UpdateDetails {...props}/>,
                );

                expect(container).toBeEmptyDOMElement();
            });
        });

        it('should render without release notes url', async () => {
            const props = {
                ...baseProps,
                releaseNotesUrl: '',
            };

            const {container} = await renderWithContext(
                <UpdateDetails {...props}/>,
            );

            expect(container).toMatchSnapshot();
        });

        it('should render with release notes url', async () => {
            const {container} = await renderWithContext(
                <UpdateDetails {...baseProps}/>,
            );

            expect(container).toMatchSnapshot();
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
            it('if not installed', async () => {
                const props = {
                    ...baseProps,
                };
                delete props.installedVersion;

                const {container} = await renderWithContext(
                    <UpdateConfirmationModal {...props}/>,
                );
                expect(container).toBeEmptyDOMElement();
            });

            it('when installed version is newer than available version', async () => {
                const props = {
                    ...baseProps,
                    installedVersion: '0.0.3',
                };

                const {container} = await renderWithContext(
                    <UpdateConfirmationModal {...props}/>,
                );
                expect(container).toBeEmptyDOMElement();
            });
        });

        it('should propogate show to ConfirmModal', async () => {
            const props = {
                ...baseProps,
                show: false,
            };
            await renderWithContext(
                <UpdateConfirmationModal {...props}/>,
            );

            // When show is false, ConfirmModal should not display modal content
            expect(screen.queryByText('Confirm Plugin Update')).not.toBeInTheDocument();
        });

        it('should render without release notes url', async () => {
            const props = {
                ...baseProps,
            };
            delete props.releaseNotesUrl;

            const {container} = await renderWithContext(
                <UpdateConfirmationModal {...props}/>,
            );

            expect(container).toMatchSnapshot();
        });

        it('should add extra warning for major version change', async () => {
            const props = {
                ...baseProps,
                version: '1.0.0',
            };

            const {container} = await renderWithContext(
                <UpdateConfirmationModal {...props}/>,
            );
            expect(container).toMatchSnapshot();
        });

        it('should add extra warning for major version change, even without release notes', async () => {
            const props = {
                ...baseProps,
                version: '1.0.0',
            };
            delete props.releaseNotesUrl;

            const {container} = await renderWithContext(
                <UpdateConfirmationModal {...props}/>,
            );
            expect(container).toMatchSnapshot();
        });

        it('should avoid exception on invalid semver', async () => {
            const props = {
                ...baseProps,
                version: 'not-a-version',
            };

            const {container} = await renderWithContext(
                <UpdateConfirmationModal {...props}/>,
            );
            expect(container).toMatchSnapshot();
        });
    });

    describe('MarketplaceItem', () => {
        const baseProps: MarketplaceItemPluginProps = {
            id: 'id',
            name: 'name',
            description: 'test plugin',
            version: '1.0.0',
            homepageUrl: 'http://example.com',
            installedVersion: '',
            iconData: 'icon',
            installing: false,
            isDefaultMarketplace: true,
            actions: {
                installPlugin: jest.fn(() => {}),
                closeMarketplaceModal: jest.fn(() => {}),
            },
        };

        test('should render', async () => {
            const {container} = await renderWithContext(
                <MarketplaceItemPlugin {...baseProps}/>,
            );

            expect(container).toMatchSnapshot();
        });

        test('should render with no plugin description', async () => {
            const props = {...baseProps};
            delete props.description;

            const {container} = await renderWithContext(
                <MarketplaceItemPlugin {...props}/>,
            );

            expect(container).toMatchSnapshot();
        });

        test('should render with no plugin icon', async () => {
            const props = {...baseProps};
            delete props.iconData;

            const {container} = await renderWithContext(
                <MarketplaceItemPlugin {...props}/>,
            );

            expect(container).toMatchSnapshot();
        });

        test('should render with no homepage url', async () => {
            const props = {...baseProps};
            delete props.homepageUrl;

            const {container} = await renderWithContext(
                <MarketplaceItemPlugin {...props}/>,
            );

            expect(container).toMatchSnapshot();
        });

        test('should render with server error', async () => {
            const props = {
                ...baseProps,
                error: 'An error occurred.',
            };

            const {container} = await renderWithContext(
                <MarketplaceItemPlugin {...props}/>,
            );

            expect(container).toMatchSnapshot();
        });

        test('should render with plugin status error', async () => {
            const pluginStatus: PluginStatusRedux = {
                active: true,
                description: '',
                id: baseProps.id,
                instances: [],
                name: baseProps.name,
                state: 0,
                version: '',
                error: 'plugin status error',
            };

            const props = {
                ...baseProps,
                pluginStatus,
            };

            const {container} = await renderWithContext(
                <MarketplaceItemPlugin {...props}/>,
            );

            expect(container).toMatchSnapshot();
        });

        test('should render installed plugin', async () => {
            const props = {
                ...baseProps,
                installedVersion: '1.0.0',
            };

            const {container} = await renderWithContext(
                <MarketplaceItemPlugin {...props}/>,
            );

            expect(container).toMatchSnapshot();
        });

        test('should render with update available', async () => {
            const props = {
                ...baseProps,
                installedVersion: '0.9.9',
            };

            const {container} = await renderWithContext(
                <MarketplaceItemPlugin {...props}/>,
            );

            expect(container).toMatchSnapshot();
        });

        test('should render with update and release notes available', async () => {
            const props = {
                ...baseProps,
                installedVersion: '0.9.9',
                releaseNotesUrl: 'http://example.com/release',
            };

            const {container} = await renderWithContext(
                <MarketplaceItemPlugin {...props}/>,
            );

            expect(container).toMatchSnapshot();
        });

        test('should render with empty list of labels', async () => {
            const props = {
                ...baseProps,
                labels: [],
            };

            const {container} = await renderWithContext(
                <MarketplaceItemPlugin {...props}/>,
            );

            expect(container).toMatchSnapshot();
        });

        test('should render with one labels', async () => {
            // Suppress known React ref warning from WithTooltip wrapping Tag (function component)
            const spy = jest.spyOn(console, 'error').mockImplementation(() => {});

            const props = {
                ...baseProps,
                labels: [
                    {
                        name: 'someName',
                        description: 'some description',
                        url: 'http://example.com/info',
                    },
                ],
            };

            const {container} = await renderWithContext(
                <MarketplaceItemPlugin {...props}/>,
            );

            spy.mockRestore();

            expect(container).toMatchSnapshot();
        });

        test('should render with two labels', async () => {
            const props = {
                ...baseProps,
                labels: [
                    {
                        name: 'someName',
                        description: 'some description',
                        url: 'http://example.com/info',
                    }, {
                        name: 'someName2',
                        description: 'some description2',
                        url: 'http://example.com/info2',
                    },
                ],
            };

            const {container} = await renderWithContext(
                <MarketplaceItemPlugin {...props}/>,
            );

            expect(container).toMatchSnapshot();
        });
    });
});
