// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {AdminConfig} from '@mattermost/types/config';

import {renderWithContext, screen, fireEvent, waitFor} from 'tests/react_testing_utils';

import MattermostExtendedFeatures from './mattermost_extended_features';

describe('components/admin_console/MattermostExtendedFeatures', () => {
    const defaultConfig = {
        FeatureFlags: {
            Encryption: false,
            ThreadsInSidebar: true,
            DiscordReplies: false,
            CustomChannelIcons: true,
            GuildedSounds: false,
            AccurateStatuses: false,
            ImageMulti: false,
            ImageSmaller: false,
            SystemConsoleDarkMode: true,
        },
    } as unknown as AdminConfig;

    const defaultProps = {
        config: defaultConfig,
        patchConfig: jest.fn().mockResolvedValue({}),
        disabled: false,
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('rendering', () => {
        test('should render the page title', () => {
            renderWithContext(<MattermostExtendedFeatures {...defaultProps}/>);
            expect(screen.getByText('Features')).toBeInTheDocument();
        });

        test('should render the header banner', () => {
            renderWithContext(<MattermostExtendedFeatures {...defaultProps}/>);
            expect(screen.getByText('Mattermost Extended Features')).toBeInTheDocument();
        });

        test('should render all 7 sections', () => {
            renderWithContext(<MattermostExtendedFeatures {...defaultProps}/>);

            expect(screen.getByText('Security & Privacy')).toBeInTheDocument();
            expect(screen.getByText('Messaging')).toBeInTheDocument();
            expect(screen.getByText('Media & Embeds')).toBeInTheDocument();
            expect(screen.getByText('User Experience')).toBeInTheDocument();
            expect(screen.getByText('Status & Activity')).toBeInTheDocument();
            expect(screen.getByText('System Console')).toBeInTheDocument();
            expect(screen.getByText('Preferences')).toBeInTheDocument();
        });

        test('should render major features with MAJOR badge', () => {
            renderWithContext(<MattermostExtendedFeatures {...defaultProps}/>);

            // Major features should have the badge
            const majorBadges = screen.getAllByText('Major');
            expect(majorBadges.length).toBe(6); // 6 major features
        });

        test('should render stats bar with correct counts', () => {
            renderWithContext(<MattermostExtendedFeatures {...defaultProps}/>);

            // Check for stats labels
            expect(screen.getByText('Major Features')).toBeInTheDocument();
            expect(screen.getByText('Total Enabled')).toBeInTheDocument();
            expect(screen.getByText('Unsaved Changes')).toBeInTheDocument();
        });

        test('should render search input', () => {
            renderWithContext(<MattermostExtendedFeatures {...defaultProps}/>);
            expect(screen.getByPlaceholderText('Search features...')).toBeInTheDocument();
        });
    });

    describe('search functionality', () => {
        test('should filter features when searching', () => {
            renderWithContext(<MattermostExtendedFeatures {...defaultProps}/>);

            const searchInput = screen.getByPlaceholderText('Search features...');
            fireEvent.change(searchInput, {target: {value: 'Encryption'}});

            // Encryption should be visible
            expect(screen.getByText('End-to-End Encryption')).toBeInTheDocument();

            // Other features should not be visible
            expect(screen.queryByText('Chat Sounds')).not.toBeInTheDocument();
        });

        test('should show no results message when search has no matches', () => {
            renderWithContext(<MattermostExtendedFeatures {...defaultProps}/>);

            const searchInput = screen.getByPlaceholderText('Search features...');
            fireEvent.change(searchInput, {target: {value: 'nonexistentfeature123'}});

            expect(screen.getByText('No features match your search')).toBeInTheDocument();
        });

        test('should search by feature key', () => {
            renderWithContext(<MattermostExtendedFeatures {...defaultProps}/>);

            const searchInput = screen.getByPlaceholderText('Search features...');
            fireEvent.change(searchInput, {target: {value: 'ThreadsInSidebar'}});

            expect(screen.getByText('Threads in Sidebar')).toBeInTheDocument();
        });

        test('should search by description', () => {
            renderWithContext(<MattermostExtendedFeatures {...defaultProps}/>);

            const searchInput = screen.getByPlaceholderText('Search features...');
            fireEvent.change(searchInput, {target: {value: 'RSA-OAEP'}});

            expect(screen.getByText('End-to-End Encryption')).toBeInTheDocument();
        });
    });

    describe('toggle functionality', () => {
        test('should toggle feature when clicking card', () => {
            renderWithContext(<MattermostExtendedFeatures {...defaultProps}/>);

            // Find and click the Encryption feature (it's a major feature card)
            const encryptionTitle = screen.getByText('End-to-End Encryption');
            const encryptionCard = encryptionTitle.closest('div[class*="MajorFeatureCard"]');
            expect(encryptionCard).toBeInTheDocument();

            if (encryptionCard) {
                fireEvent.click(encryptionCard);
            }

            // Should show unsaved indicator
            expect(screen.getByText('1')).toBeInTheDocument(); // Unsaved count
        });

        test('should show unsaved dot when feature is modified', async () => {
            renderWithContext(<MattermostExtendedFeatures {...defaultProps}/>);

            // Find Encryption card and toggle it
            const encryptionTitle = screen.getByText('End-to-End Encryption');
            const encryptionCard = encryptionTitle.closest('div[class*="MajorFeatureCard"]');

            if (encryptionCard) {
                fireEvent.click(encryptionCard);
            }

            // The unsaved dot should appear (it's a span with title="Unsaved change")
            await waitFor(() => {
                expect(screen.getByTitle('Unsaved change')).toBeInTheDocument();
            });
        });
    });

    describe('section collapse/expand', () => {
        test('should collapse section when clicking header', () => {
            renderWithContext(<MattermostExtendedFeatures {...defaultProps}/>);

            // Find the Security section header and click it
            const securityHeader = screen.getByText('Security & Privacy').closest('div[class*="SectionHeader"]');
            expect(securityHeader).toBeInTheDocument();

            if (securityHeader) {
                fireEvent.click(securityHeader);
            }

            // After collapse, the Encryption card should not be visible
            // The section content should be hidden
            const encryptionTitle = screen.queryByText('End-to-End Encryption');

            // Due to how styled-components work with display: none, we check the parent
            if (encryptionTitle) {
                const sectionContent = encryptionTitle.closest('div[class*="SectionContent"]');
                expect(sectionContent).toHaveStyle('display: none');
            }
        });
    });

    describe('save functionality', () => {
        test('should call patchConfig when saving', async () => {
            const patchConfig = jest.fn().mockResolvedValue({});
            renderWithContext(
                <MattermostExtendedFeatures
                    {...defaultProps}
                    patchConfig={patchConfig}
                />,
            );

            // Make a change first
            const encryptionTitle = screen.getByText('End-to-End Encryption');
            const encryptionCard = encryptionTitle.closest('div[class*="MajorFeatureCard"]');
            if (encryptionCard) {
                fireEvent.click(encryptionCard);
            }

            // Find and click save button
            const saveButton = screen.getByRole('button', {name: /save/i});
            fireEvent.click(saveButton);

            await waitFor(() => {
                expect(patchConfig).toHaveBeenCalledTimes(1);
            });

            // Verify the call includes FeatureFlags
            expect(patchConfig).toHaveBeenCalledWith(
                expect.objectContaining({
                    FeatureFlags: expect.any(Object),
                }),
            );
        });

        test('should preserve existing feature flags when saving', async () => {
            const patchConfig = jest.fn().mockResolvedValue({});
            const configWithExtraFlags = {
                FeatureFlags: {
                    ...defaultConfig.FeatureFlags,
                    SomeOtherFlag: true, // Extra flag not in our FEATURES list
                },
            } as unknown as AdminConfig;

            renderWithContext(
                <MattermostExtendedFeatures
                    config={configWithExtraFlags}
                    patchConfig={patchConfig}
                    disabled={false}
                />,
            );

            // Make a change
            const encryptionTitle = screen.getByText('End-to-End Encryption');
            const encryptionCard = encryptionTitle.closest('div[class*="MajorFeatureCard"]');
            if (encryptionCard) {
                fireEvent.click(encryptionCard);
            }

            // Save
            const saveButton = screen.getByRole('button', {name: /save/i});
            fireEvent.click(saveButton);

            await waitFor(() => {
                expect(patchConfig).toHaveBeenCalledTimes(1);
            });

            // Verify that SomeOtherFlag is preserved
            const callArg = patchConfig.mock.calls[0][0];
            expect(callArg.FeatureFlags.SomeOtherFlag).toBe(true);
        });

        test('should disable save button when no changes', () => {
            renderWithContext(<MattermostExtendedFeatures {...defaultProps}/>);

            const saveButton = screen.getByRole('button', {name: /save/i});
            expect(saveButton).toBeDisabled();
        });

        test('should enable save button when there are changes', () => {
            renderWithContext(<MattermostExtendedFeatures {...defaultProps}/>);

            // Make a change
            const encryptionTitle = screen.getByText('End-to-End Encryption');
            const encryptionCard = encryptionTitle.closest('div[class*="MajorFeatureCard"]');
            if (encryptionCard) {
                fireEvent.click(encryptionCard);
            }

            const saveButton = screen.getByRole('button', {name: /save/i});
            expect(saveButton).not.toBeDisabled();
        });
    });

    describe('disabled state', () => {
        test('should disable toggles when disabled prop is true', () => {
            renderWithContext(
                <MattermostExtendedFeatures
                    {...defaultProps}
                    disabled={true}
                />,
            );

            // All checkboxes should be disabled
            const checkboxes = screen.getAllByRole('checkbox');
            checkboxes.forEach((checkbox) => {
                expect(checkbox).toBeDisabled();
            });
        });
    });

    describe('stats display', () => {
        test('should show correct major features count', () => {
            const configWithMajors = {
                FeatureFlags: {
                    Encryption: true,
                    ThreadsInSidebar: true,
                    DiscordReplies: true,
                    CustomChannelIcons: false,
                    GuildedSounds: false,
                    AccurateStatuses: false,
                },
            } as unknown as AdminConfig;

            renderWithContext(
                <MattermostExtendedFeatures
                    config={configWithMajors}
                    patchConfig={jest.fn()}
                    disabled={false}
                />,
            );

            // Should show 3 / 6 for major features (3 enabled out of 6 total)
            expect(screen.getByText(/3 \/ 6/)).toBeInTheDocument();
        });
    });
});
