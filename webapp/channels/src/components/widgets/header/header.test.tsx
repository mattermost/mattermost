// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import type {ComponentProps} from 'react';

import {render, screen} from 'tests/react_testing_utils';

import Header from './header';

describe('components/widgets/header', () => {
    const levels: Array<ComponentProps<typeof Header>['level']> = [1, 2, 3, 4, 5, 6];

    test('should render with heading, subtitle, and right addon', () => {
        const {container} = render(
            <Header
                level={1}
                heading={'Title'}
                subtitle='Subheading'
                right={(
                    <div>{'addons'}</div>
                )}
            />,
        );

        expect(screen.getByRole('heading', {level: 1, name: 'Title'})).toBeInTheDocument();
        expect(screen.getByText('Subheading')).toBeInTheDocument();
        expect(screen.getByText('addons')).toBeInTheDocument();
        expect(container.querySelector('.Header')).toBeInTheDocument();
    });

    test.each(levels)(
        'should render heading level %p',
        (level) => {
            render(
                <Header
                    level={level}
                    heading={'Title'}
                />,
            );

            if (level === 0) {
                expect(screen.queryByRole('heading')).not.toBeInTheDocument();
                expect(screen.getByText('Title')).toBeInTheDocument();
            } else {
                expect(screen.getByRole('heading', {level, name: 'Title'})).toBeInTheDocument();
            }
        },
    );

    test('should support subheadings', () => {
        render(
            <Header
                heading={<h2 className='custom-heading'>{'Test title'}</h2>}
                subtitle='Subheading'
            />,
        );

        expect(screen.getByText('Test title')).toBeInTheDocument();
        expect(screen.getByText('Subheading')).toBeInTheDocument();
        expect(screen.getByText('Subheading').tagName).toBe('P');
    });

    test('should support custom heading', () => {
        const {container} = render(
            <Header
                heading={<h2 className='custom-heading'>{'Test title'}</h2>}
            />,
        );

        const customHeading = container.querySelector('h2.custom-heading');
        expect(customHeading).toBeInTheDocument();
        expect(customHeading).toHaveTextContent('Test title');
    });
});
