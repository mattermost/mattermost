// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import IntlProvider from 'components/intl_provider/intl_provider';

import {getLanguageInfo} from 'i18n/i18n';
import {renderWithContext, screen} from 'tests/vitest_react_testing_utils';

describe('components/IntlProvider', () => {
    const messageId = 'about.buildnumber';
    const baseProps = {
        locale: 'en',
        translations: {
            'about.buildnumber': 'Build Number:',
        },
        actions: {
            loadTranslations: () => {}, // eslint-disable-line
        },
        children: (
            <FormattedMessage
                id={messageId}
                defaultMessage='Build Number:'
            />
        ),
    };

    test('should render children when passed translation strings', () => {
        const {container} = renderWithContext(<IntlProvider {...baseProps}/>);
        expect(container).toMatchSnapshot();
    });

    test('should render children when passed translation strings for a non-default locale', () => {
        const props = {
            ...baseProps,
            locale: 'fr',
            translations: {
                'about.buildnumber': 'Numéro de build :',
            },
        };

        const {container} = renderWithContext(<IntlProvider {...props}/>);
        expect(container).toMatchSnapshot();
    });

    test('should render null when missing translation strings', () => {
        const props = {
            ...baseProps,
            translations: undefined,
        };

        renderWithContext(<IntlProvider {...props}/>);

        // When translations are missing, the component renders null so FormattedMessage won't be present
        expect(screen.queryByText('Build Number:')).not.toBeInTheDocument();
    });

    test('on mount, should attempt to load missing translations', () => {
        const loadTranslations = vi.fn();
        const props = {
            ...baseProps,
            locale: 'fr',
            translations: undefined,
            actions: {
                loadTranslations,
            },
        };

        renderWithContext(<IntlProvider {...props}/>);

        expect(loadTranslations).toHaveBeenCalledWith('fr', getLanguageInfo('fr').url);
    });

    test('on mount, should not attempt to load when given translations', () => {
        const loadTranslations = vi.fn();
        const props = {
            ...baseProps,
            locale: 'fr',
            translations: {
                'about.buildnumber': 'Numéro de build :',
            },
            actions: {
                loadTranslations,
            },
        };

        renderWithContext(<IntlProvider {...props}/>);

        expect(loadTranslations).not.toHaveBeenCalled();
    });

    test('on locale change, should attempt to load missing translations', () => {
        const loadTranslations = vi.fn();
        const props = {
            ...baseProps,
            actions: {
                loadTranslations,
            },
        };

        const {rerender} = renderWithContext(<IntlProvider {...props}/>);

        expect(loadTranslations).not.toHaveBeenCalled();

        // Rerender with new locale and no translations
        rerender(
            <IntlProvider
                {...props}
                locale='fr'
                translations={undefined}
            />,
        );

        expect(loadTranslations).toHaveBeenCalledWith('fr', getLanguageInfo('fr').url);
    });

    test('on locale change, should not attempt to load when given translations', () => {
        const loadTranslations = vi.fn();
        const props = {
            ...baseProps,
            actions: {
                loadTranslations,
            },
        };

        const {rerender} = renderWithContext(<IntlProvider {...props}/>);

        expect(loadTranslations).not.toHaveBeenCalled();

        // Rerender with new locale but with translations
        rerender(
            <IntlProvider
                {...props}
                locale='fr'
                translations={{
                    'about.buildnumber': 'Numéro de build :',
                }}
            />,
        );

        expect(loadTranslations).not.toHaveBeenCalled();
    });
});
