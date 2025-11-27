// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {describe, test, expect} from 'vitest';

import {renderWithIntl} from 'tests/vitest_react_testing_utils';

import Card from './card';
import TitleAndButtonCardHeader from './title_and_button_card_header/title_and_button_card_header';

describe('components/card/card', () => {
    const baseProps = {
        expanded: false,
    };

    const headerProps = {
        title: 'Custom retention policies',
        subtitle: 'Customize how long specific teams and channels will keep messages.',
        body: <div>{'Hello!'}</div>,
    };

    test('should match snapshot', () => {
        const {container} = renderWithIntl(
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

        const {container} = renderWithIntl(
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

        const {container} = renderWithIntl(
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

    test('should match snapshot when using header content and a button', () => {
        const props = {
            ...baseProps,
            expanded: true,
            className: 'console',
        };

        const buttonProps = {
            buttonText: 'Add policy',
            onClick: () => {},
        };

        const {container} = renderWithIntl(
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
