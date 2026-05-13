// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {render, screen, act} from '@testing-library/react';
import React from 'react';
import {FormattedMessage} from 'react-intl';

import IntlProvider from 'components/intl_provider/intl_provider';

import {getLanguageInfo} from 'i18n/i18n';

describe('components/IntlProvider', () => {
    const messageId = 'test.hello_world';
    const baseProps = {
        locale: 'en',
        translations: {
            'test.hello_world': 'Hello, World!',
        },
        actions: {
            loadTranslations: () => {}, // eslint-disable-line
        },
        children: (
            <FormattedMessage
                id={messageId}
                defaultMessage='Hello, World!'
            />
        ),
    };

    test('should render children when passed translation strings', () => {
        render(<IntlProvider {...baseProps}/>);

        expect(screen.getByText('Hello, World!')).toBeInTheDocument();
    });

    test('should render children when passed translation strings for a non-default locale', () => {
        const props = {
            ...baseProps,
            locale: 'fr',
            translations: {
                'test.hello_world': 'Bonjour tout le monde!',
            },
        };

        render(<IntlProvider {...props}/>);

        expect(screen.getByText('Bonjour tout le monde!')).toBeInTheDocument();
    });

    test('should render null when missing translation strings', () => {
        const props = {
            ...baseProps,
            translations: undefined,
        };

        const {container} = render(<IntlProvider {...props}/>);

        expect(container.firstChild).toBeNull();
    });

    test('on mount, should attempt to load missing translations', () => {
        const props = {
            ...baseProps,
            locale: 'fr',
            translations: undefined,
            actions: {
                loadTranslations: jest.fn(),
            },
        };

        render(<IntlProvider {...props}/>);

        expect(props.actions.loadTranslations).toHaveBeenCalledWith('fr', getLanguageInfo('fr').url);
    });

    test('on mount, should not attempt to load when given translations', () => {
        const props = {
            ...baseProps,
            locale: 'fr',
            translations: {
                'test.hello_world': 'Bonjour tout le monde!',
            },
            actions: {
                loadTranslations: jest.fn(),
            },
        };

        render(<IntlProvider {...props}/>);

        expect(props.actions.loadTranslations).not.toHaveBeenCalled();
    });

    test('on locale change, should attempt to load missing translations', () => {
        const props = {
            ...baseProps,
            actions: {
                loadTranslations: jest.fn(),
            },
        };

        const {rerender} = render(<IntlProvider {...props}/>);

        expect(props.actions.loadTranslations).not.toHaveBeenCalled();

        act(() => {
            rerender(
                <IntlProvider
                    {...props}
                    locale='fr'
                    translations={undefined}
                />,
            );
        });

        expect(props.actions.loadTranslations).toHaveBeenCalledWith('fr', getLanguageInfo('fr').url);
    });

    test('on locale change, should not attempt to load when given translations', () => {
        const props = {
            ...baseProps,
            actions: {
                loadTranslations: jest.fn(),
            },
        };

        const {rerender} = render(<IntlProvider {...props}/>);

        expect(props.actions.loadTranslations).not.toHaveBeenCalled();

        act(() => {
            rerender(
                <IntlProvider
                    {...props}
                    locale='fr'
                    translations={{
                        'test.hello_world': 'Bonjour tout le monde!',
                    }}
                />,
            );
        });

        expect(props.actions.loadTranslations).not.toHaveBeenCalled();
    });
});
