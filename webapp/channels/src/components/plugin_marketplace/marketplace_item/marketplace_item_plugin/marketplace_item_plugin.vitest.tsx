// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {PluginStatusRedux} from '@mattermost/types/plugins';

import {renderWithContext} from 'tests/vitest_react_testing_utils';

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
            it('when no installed version', () => {
                const props = {
                    ...baseProps,
                    installedVersion: '',
                };
                const {container} = renderWithContext(
                    <UpdateDetails {...props}/>,
                );

                expect(container.innerHTML).toBe('');
            });

            it('when installed version matches available version', () => {
                const props = {
                    ...baseProps,
                    installedVersion: baseProps.version,
                };
                const {container} = renderWithContext(
                    <UpdateDetails {...props}/>,
                );

                expect(container.innerHTML).toBe('');
            });

            it('when installed version is newer than available version', () => {
                const props = {
                    ...baseProps,
                    installedVersion: '0.0.3',
                };
                const {container} = renderWithContext(
                    <UpdateDetails {...props}/>,
                );

                expect(container.innerHTML).toBe('');
            });

            it('when installing', () => {
                const props = {
                    ...baseProps,
                    isInstalling: true,
                };
                const {container} = renderWithContext(
                    <UpdateDetails {...props}/>,
                );

                expect(container.innerHTML).toBe('');
            });
        });

        it('should render without release notes url', () => {
            const props = {
                ...baseProps,
                releaseNotesUrl: '',
            };

            const {container} = renderWithContext(
                <UpdateDetails {...props}/>,
            );

            expect(container).toMatchSnapshot();
        });

        it('should render with release notes url', () => {
            const initialState = {
                entities: {
                    general: {
                        config: {},
                        license: {},
                    },
                    users: {
                        currentUserId: 'currentUserId',
                    },
                },
            };
            const {container} = renderWithContext(
                <UpdateDetails {...baseProps}/>,
                initialState,
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
            it('if not installed', () => {
                const props = {
                    ...baseProps,
                    installedVersion: undefined,
                };

                const {container} = renderWithContext(
                    <UpdateConfirmationModal {...props}/>,
                );
                expect(container.innerHTML).toBe('');
            });

            it('when installed version is newer than available version', () => {
                const props = {
                    ...baseProps,
                    installedVersion: '0.0.3',
                };

                const {container} = renderWithContext(
                    <UpdateConfirmationModal {...props}/>,
                );
                expect(container.innerHTML).toBe('');
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

            // The modal should not be visible when show is false
            expect(document.querySelector('.modal.in')).not.toBeInTheDocument();
        });

        it('should render without release notes url', () => {
            const props = {
                ...baseProps,
                releaseNotesUrl: undefined,
            };

            const {container} = renderWithContext(
                <UpdateConfirmationModal {...props}/>,
            );

            expect(container).toMatchSnapshot();
        });

        it('should add extra warning for major version change', () => {
            const props = {
                ...baseProps,
                version: '1.0.0',
            };

            const {container} = renderWithContext(
                <UpdateConfirmationModal {...props}/>,
            );
            expect(container).toMatchSnapshot();
        });

        it('should add extra warning for major version change, even without release notes', () => {
            const props = {
                ...baseProps,
                version: '1.0.0',
                releaseNotesUrl: undefined,
            };

            const {container} = renderWithContext(
                <UpdateConfirmationModal {...props}/>,
            );
            expect(container).toMatchSnapshot();
        });

        it('should avoid exception on invalid semver', () => {
            const props = {
                ...baseProps,
                version: 'not-a-version',
            };

            const {container} = renderWithContext(
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
                installPlugin: vi.fn(() => {}),
                closeMarketplaceModal: vi.fn(() => {}),
            },
        };

        test('should render', () => {
            const {container} = renderWithContext(
                <MarketplaceItemPlugin {...baseProps}/>,
            );

            expect(container).toMatchSnapshot();
        });

        test('should render with no plugin description', () => {
            const props = {...baseProps};
            delete (props as any).description;

            const {container} = renderWithContext(
                <MarketplaceItemPlugin {...props}/>,
            );

            expect(container).toMatchSnapshot();
        });

        test('should render with no plugin icon', () => {
            const props = {...baseProps};
            delete (props as any).iconData;

            const {container} = renderWithContext(
                <MarketplaceItemPlugin {...props}/>,
            );

            expect(container).toMatchSnapshot();
        });

        test('should render with no homepage url', () => {
            const props = {...baseProps};
            delete (props as any).homepageUrl;

            const {container} = renderWithContext(
                <MarketplaceItemPlugin {...props}/>,
            );

            expect(container).toMatchSnapshot();
        });

        test('should render with server error', () => {
            const props = {
                ...baseProps,
                error: 'An error occurred.',
            };

            const {container} = renderWithContext(
                <MarketplaceItemPlugin {...props}/>,
            );

            expect(container).toMatchSnapshot();
        });

        test('should render with plugin status error', () => {
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

            const {container} = renderWithContext(
                <MarketplaceItemPlugin {...props}/>,
            );

            expect(container).toMatchSnapshot();
        });

        test('should render installed plugin', () => {
            const props = {
                ...baseProps,
                installedVersion: '1.0.0',
            };

            const {container} = renderWithContext(
                <MarketplaceItemPlugin {...props}/>,
            );

            expect(container).toMatchSnapshot();
        });

        test('should render with update available', () => {
            const props = {
                ...baseProps,
                installedVersion: '0.9.9',
            };

            const {container} = renderWithContext(
                <MarketplaceItemPlugin {...props}/>,
            );

            expect(container).toMatchSnapshot();
        });

        test('should render with update and release notes available', () => {
            const props = {
                ...baseProps,
                installedVersion: '0.9.9',
                releaseNotesUrl: 'http://example.com/release',
            };

            const {container} = renderWithContext(
                <MarketplaceItemPlugin {...props}/>,
            );

            expect(container).toMatchSnapshot();
        });

        test('should render with empty list of labels', () => {
            const props = {
                ...baseProps,
                labels: [],
            };

            const {container} = renderWithContext(
                <MarketplaceItemPlugin {...props}/>,
            );

            expect(container).toMatchSnapshot();
        });

        test('should render with one labels', () => {
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

            const {container} = renderWithContext(
                <MarketplaceItemPlugin {...props}/>,
            );

            expect(container).toMatchSnapshot();
        });

        test('should render with two labels', () => {
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

            const {container} = renderWithContext(
                <MarketplaceItemPlugin {...props}/>,
            );

            expect(container).toMatchSnapshot();
        });
    });
});
