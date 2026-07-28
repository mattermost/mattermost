// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {act} from '@testing-library/react';
import React from 'react';
import {FormattedMessage} from 'react-intl';

import {renderWithContext} from 'tests/react_testing_utils';

import Card from './card';
import TitleAndButtonCardHeader from './title_and_button_card_header/title_and_button_card_header';

describe('components/card/card', () => {
    const baseProps = {
        expanded: false,
    };

    const headerProps = {
        title:
    <FormattedMessage
        id='admin.data_retention.customPolicies.title'
        defaultMessage='Custom retention policies'
    />,
        subtitle:
    <FormattedMessage
        id='admin.data_retention.customPolicies.subTitle'
        defaultMessage='Customize how long specific teams and channels will keep messages.'
    />,
        body:
    <div>
        {'Hello!'}
    </div>,
    };

    test('should match snapshot', () => {
        const {container} = renderWithContext(
            <Card {...baseProps}>
                <Card.Header>{'Header Test'}</Card.Header>
                <Card.Body>{'Body Test'}</Card.Body>
            </Card>,
        );

        expect(container).toMatchSnapshot();
    });

    test('should match snapshot when expanded', () => {
        const props = {
            ...baseProps,
            expanded: true,
        };

        const {container} = renderWithContext(
            <Card {...props}>
                <Card.Header>{'Header Test'}</Card.Header>
                <Card.Body>{'Body Test'}</Card.Body>
            </Card>,
        );

        expect(container).toMatchSnapshot();
    });

    test('should match snapshot when using header content and no button', () => {
        const props = {
            ...baseProps,
            expanded: true,
            className: 'console',
        };

        const {container} = renderWithContext(
            <Card {...props}>
                <Card.Header>
                    <TitleAndButtonCardHeader
                        {...headerProps}
                    />
                </Card.Header>
                <Card.Body>{'Body Test'}</Card.Body>
            </Card>,
        );

        expect(container).toMatchSnapshot();
    });

    test('disableExpandAnimation renders Card__body as expanded with no expanding class or inline height', () => {
        const props = {
            expanded: true,
            disableExpandAnimation: true,
        };

        const {container} = renderWithContext(
            <Card {...props}>
                <Card.Header>{'Header Test'}</Card.Header>
                <Card.Body>{'Body Test'}</Card.Body>
            </Card>,
        );

        const body = container.querySelector('.Card__body');
        expect(body).toHaveClass('expanded');
        expect(body).not.toHaveClass('expanding');
        expect(body).not.toHaveAttribute('style');
    });

    test('the fallback timer clears expanding when transitionend never fires (e.g. .console cards, which disable the CSS transition outright)', () => {
        jest.useFakeTimers();

        const props = {
            expanded: true,
            className: 'console',
        };

        const {container} = renderWithContext(
            <Card {...props}>
                <Card.Header>{'Header Test'}</Card.Header>
                <Card.Body>{'Body Test'}</Card.Body>
            </Card>,
        );

        const body = container.querySelector('.Card__body');
        expect(body).toHaveClass('expanding');

        act(() => {
            jest.advanceTimersByTime(350);
        });

        expect(body).not.toHaveClass('expanding');
        expect(body).toHaveClass('expanded');

        jest.useRealTimers();
    });

    test('a real transitionend event clears expanding immediately and cancels the pending fallback', () => {
        jest.useFakeTimers();
        const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');

        const props = {
            expanded: true,
        };

        const {container} = renderWithContext(
            <Card {...props}>
                <Card.Header>{'Header Test'}</Card.Header>
                <Card.Body>{'Body Test'}</Card.Body>
            </Card>,
        );

        const body = container.querySelector('.Card__body') as HTMLElement;
        expect(body).toHaveClass('expanding');

        act(() => {
            body.dispatchEvent(new Event('transitionend', {bubbles: true}));
        });

        expect(body).not.toHaveClass('expanding');
        expect(clearTimeoutSpy).toHaveBeenCalled();

        // Advancing past the fallback duration afterward must not throw --
        // the pending timeout was already cancelled by the real transitionend.
        act(() => {
            jest.advanceTimersByTime(500);
        });

        clearTimeoutSpy.mockRestore();
        jest.useRealTimers();
    });

    test('should match snapshot when using header content and a button', () => {
        const props = {
            ...baseProps,
            expanded: true,
            className: 'console',
        };

        const buttonProps = {
            buttonText:
    <FormattedMessage
        id='admin.data_retention.customPolicies.addPolicy'
        defaultMessage='Add policy'
    />,
            onClick:
                () => {},
        };

        const {container} = renderWithContext(
            <Card {...props}>
                <Card.Header>
                    <TitleAndButtonCardHeader
                        {...headerProps}
                        {...buttonProps}
                    />
                </Card.Header>
                <Card.Body>{'Body Test'}</Card.Body>
            </Card>,
        );

        expect(container).toMatchSnapshot();
    });
});
