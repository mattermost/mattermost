// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {DeepPartial} from '@mattermost/types/utilities';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';
import {PagePropsKeys} from 'utils/constants';

import type {GlobalState} from 'types/store';

import TranslationIndicator from './translation_indicator';

describe('components/wiki_view/wiki_page_header/TranslationIndicator', () => {
    const mockPageId = 'page-123';
    const mockTranslatedPageId = 'translated-page-456';
    const mockSourcePageId = 'source-page-789';

    const defaultProps = {
        pageId: mockPageId,
        onNavigateToPage: jest.fn(),
    };

    const getInitialState = (overrides?: {
        pageProps?: Record<string, unknown>;
        sourcePageProps?: Record<string, unknown>;
    }): DeepPartial<GlobalState> => ({
        entities: {
            posts: {
                posts: {
                    [mockPageId]: {
                        id: mockPageId,
                        type: 'page',
                        props: overrides?.pageProps || {},
                    },
                    ...(overrides?.sourcePageProps ? {
                        [mockSourcePageId]: {
                            id: mockSourcePageId,
                            type: 'page',
                            props: overrides.sourcePageProps,
                        },
                    } : {}),
                },
            },
        },
    });

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should not render when page has no translations and is not a translation', () => {
        const {container} = renderWithContext(
            <TranslationIndicator {...defaultProps}/>,
            getInitialState(),
        );

        expect(container.querySelector('.translation-indicator')).toBeNull();
    });

    it('should render when page has translations available', () => {
        const pageProps = {
            [PagePropsKeys.TRANSLATIONS]: [
                {page_id: mockTranslatedPageId, language_code: 'es'},
            ],
        };

        renderWithContext(
            <TranslationIndicator {...defaultProps}/>,
            getInitialState({pageProps}),
        );

        expect(screen.getByTestId('translation-indicator-trigger')).toBeInTheDocument();
    });

    it('should render when page is a translation', () => {
        const pageProps = {
            [PagePropsKeys.TRANSLATED_FROM]: mockSourcePageId,
            [PagePropsKeys.TRANSLATION_LANGUAGE]: 'es',
        };

        renderWithContext(
            <TranslationIndicator {...defaultProps}/>,
            getInitialState({pageProps}),
        );

        expect(screen.getByTestId('translation-indicator-trigger')).toBeInTheDocument();
        expect(screen.getByText('Español')).toBeInTheDocument();
    });

    it('should show translation count for source pages', () => {
        const pageProps = {
            [PagePropsKeys.TRANSLATIONS]: [
                {page_id: 'page-1', language_code: 'es'},
                {page_id: 'page-2', language_code: 'fr'},
            ],
        };

        renderWithContext(
            <TranslationIndicator {...defaultProps}/>,
            getInitialState({pageProps}),
        );

        expect(screen.getByText('2')).toBeInTheDocument();
    });

    it('should open dropdown when trigger is clicked', async () => {
        const pageProps = {
            [PagePropsKeys.TRANSLATIONS]: [
                {page_id: mockTranslatedPageId, language_code: 'es'},
            ],
        };

        renderWithContext(
            <TranslationIndicator {...defaultProps}/>,
            getInitialState({pageProps}),
        );

        await userEvent.click(screen.getByTestId('translation-indicator-trigger'));

        expect(screen.getByText('Available in')).toBeInTheDocument();
        expect(screen.getByTestId('translation-indicator-es')).toBeInTheDocument();
    });

    it('should show source page link when page is a translation', async () => {
        const pageProps = {
            [PagePropsKeys.TRANSLATED_FROM]: mockSourcePageId,
            [PagePropsKeys.TRANSLATION_LANGUAGE]: 'es',
        };
        const sourcePageProps = {
            title: 'Original Page Title',
        };

        renderWithContext(
            <TranslationIndicator {...defaultProps}/>,
            getInitialState({pageProps, sourcePageProps}),
        );

        await userEvent.click(screen.getByTestId('translation-indicator-trigger'));

        expect(screen.getByText('Translated from')).toBeInTheDocument();
        expect(screen.getByTestId('translation-indicator-source')).toBeInTheDocument();
        expect(screen.getByText('Original Page Title')).toBeInTheDocument();
    });

    it('should call onNavigateToPage when translation is clicked', async () => {
        const onNavigateToPage = jest.fn();
        const pageProps = {
            [PagePropsKeys.TRANSLATIONS]: [
                {page_id: mockTranslatedPageId, language_code: 'es'},
            ],
        };

        renderWithContext(
            <TranslationIndicator
                {...defaultProps}
                onNavigateToPage={onNavigateToPage}
            />,
            getInitialState({pageProps}),
        );

        await userEvent.click(screen.getByTestId('translation-indicator-trigger'));
        await userEvent.click(screen.getByTestId('translation-indicator-es'));

        expect(onNavigateToPage).toHaveBeenCalledWith(mockTranslatedPageId);
    });

    it('should call onNavigateToPage when source page is clicked', async () => {
        const onNavigateToPage = jest.fn();
        const pageProps = {
            [PagePropsKeys.TRANSLATED_FROM]: mockSourcePageId,
            [PagePropsKeys.TRANSLATION_LANGUAGE]: 'es',
        };

        renderWithContext(
            <TranslationIndicator
                {...defaultProps}
                onNavigateToPage={onNavigateToPage}
            />,
            getInitialState({pageProps}),
        );

        await userEvent.click(screen.getByTestId('translation-indicator-trigger'));
        await userEvent.click(screen.getByTestId('translation-indicator-source'));

        expect(onNavigateToPage).toHaveBeenCalledWith(mockSourcePageId);
    });

    it('should show language native names for known languages', async () => {
        const pageProps = {
            [PagePropsKeys.TRANSLATIONS]: [
                {page_id: 'page-1', language_code: 'es'},
                {page_id: 'page-2', language_code: 'fr'},
                {page_id: 'page-3', language_code: 'de'},
            ],
        };

        renderWithContext(
            <TranslationIndicator {...defaultProps}/>,
            getInitialState({pageProps}),
        );

        await userEvent.click(screen.getByTestId('translation-indicator-trigger'));

        expect(screen.getByText('Español')).toBeInTheDocument();
        expect(screen.getByText('Français')).toBeInTheDocument();
        expect(screen.getByText('Deutsch')).toBeInTheDocument();
    });

    it('should fall back to language code for unknown languages', async () => {
        const pageProps = {
            [PagePropsKeys.TRANSLATIONS]: [
                {page_id: 'page-1', language_code: 'xx-unknown'},
            ],
        };

        renderWithContext(
            <TranslationIndicator {...defaultProps}/>,
            getInitialState({pageProps}),
        );

        await userEvent.click(screen.getByTestId('translation-indicator-trigger'));

        expect(screen.getByText('xx-unknown')).toBeInTheDocument();
    });
});
