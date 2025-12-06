// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import {withIntl} from 'tests/helpers/intl-test-helper';
import {render, screen} from 'tests/react_testing_utils';

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

    test('should render card with header and body', () => {
        render(
            withIntl(
                <Card {...baseProps}>
                    <Card.Header>{'Header Test'}</Card.Header>
                    <Card.Body>{'Body Test'}</Card.Body>
                </Card>,
            ),
        );

        expect(screen.getByText('Header Test')).toBeInTheDocument();
        expect(screen.getByText('Body Test')).toBeInTheDocument();
    });

    test('should render with header content and no button', () => {
        const props = {
            ...baseProps,
            expanded: true,
            className: 'console',
        };

        render(
            withIntl(
                <Card {...props}>
                    <Card.Header>
                        <TitleAndButtonCardHeader
                            {...headerProps}
                        />
                    </Card.Header>
                    <Card.Body>{'Body Test'}</Card.Body>
                </Card>,
            ),
        );

        expect(screen.getByText('Custom retention policies')).toBeInTheDocument();
        expect(screen.getByText('Customize how long specific teams and channels will keep messages.')).toBeInTheDocument();
        expect(screen.getByText('Body Test')).toBeInTheDocument();
    });

    test('should render with header content and a button', () => {
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
            onClick: jest.fn(),
        };

        render(
            withIntl(
                <Card {...props}>
                    <Card.Header>
                        <TitleAndButtonCardHeader
                            {...headerProps}
                            {...buttonProps}
                        />
                    </Card.Header>
                    <Card.Body>{'Body Test'}</Card.Body>
                </Card>,
            ),
        );

        expect(screen.getByText('Custom retention policies')).toBeInTheDocument();
        expect(screen.getByText('Customize how long specific teams and channels will keep messages.')).toBeInTheDocument();
        expect(screen.getByText('Add policy')).toBeInTheDocument();
        expect(screen.getByText('Body Test')).toBeInTheDocument();

        const button = screen.getByRole('button', {name: 'Add policy'});
        expect(button).toBeInTheDocument();
    });
});
