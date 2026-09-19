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

    test('re-enabling animation after expanded goes false while disabled does not leave a stale expanded class', () => {
        const {container, rerender} = renderWithContext(
            <Card expanded={true}>
                <Card.Header>{'Header Test'}</Card.Header>
                <Card.Body>{'Body Test'}</Card.Body>
            </Card>,
        );

        // Enter the disabled-animation path while still expanded, then
        // collapse while animation is disabled -- local state must track
        // this, not just the initial disabled-path render.
        rerender(
            <Card
                expanded={true}
                disableExpandAnimation={true}
            >
                <Card.Header>{'Header Test'}</Card.Header>
                <Card.Body>{'Body Test'}</Card.Body>
            </Card>,
        );
        rerender(
            <Card
                expanded={false}
                disableExpandAnimation={true}
            >
                <Card.Header>{'Header Test'}</Card.Header>
                <Card.Body>{'Body Test'}</Card.Body>
            </Card>,
        );

        // Re-enable animation -- without syncing local state while disabled,
        // this would render with a stale 'expanded' class left over from the
        // very first render.
        rerender(
            <Card expanded={false}>
                <Card.Header>{'Header Test'}</Card.Header>
                <Card.Body>{'Body Test'}</Card.Body>
            </Card>,
        );

        const body = container.querySelector('.Card__body');
        expect(body).not.toHaveClass('expanded');
    });

    test('a real transitionend event clears expanding immediately', () => {
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
