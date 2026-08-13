// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {withIntl} from 'tests/helpers/intl-test-helper';
import {render, screen} from 'tests/react_testing_utils';

import TeamIcon from './team_icon';

describe('components/widgets/team-icon', () => {
    test('should render basic icon with initials', () => {
        const {container} = render(withIntl(
            <TeamIcon content='test'/>,
        ));

        expect(screen.getByTestId('teamIconInitial')).toBeInTheDocument();
        expect(screen.getByTestId('teamIconInitial')).toHaveTextContent('te');
        expect(container.querySelector('.TeamIcon')).toBeInTheDocument();
        expect(container.querySelector('.TeamIcon__sm')).toBeInTheDocument();
    });

    test('should render image icon when url provided', () => {
        const {container} = render(withIntl(
            <TeamIcon
                url='http://example.com/image.png'
                content='test'
            />,
        ));

        const image = screen.getByTestId('teamIconImage');
        expect(image).toBeInTheDocument();
        expect(image).toHaveStyle({backgroundImage: "url('http://example.com/image.png')"});
        expect(container.querySelector('.withImage')).toBeInTheDocument();
    });

    test('should render small icon with correct size class', () => {
        const {container} = render(withIntl(
            <TeamIcon
                content='test'
                size='sm'
            />,
        ));

        expect(screen.getByTestId('teamIconInitial')).toBeInTheDocument();
        expect(container.querySelector('.TeamIcon__sm')).toBeInTheDocument();
        expect(container.querySelector('.TeamIcon__initials__sm')).toBeInTheDocument();
    });

    test('should render icon with hover class when withHover is true', () => {
        const {container} = render(withIntl(
            <TeamIcon
                content='test'
                withHover={true}
            />,
        ));

        expect(screen.getByTestId('teamIconInitial')).toBeInTheDocument();
        expect(container.querySelector('.no-hover')).not.toBeInTheDocument();
        expect(container.querySelector('.TeamIcon')).not.toHaveClass('no-hover');
    });
});
