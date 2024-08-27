// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, fireEvent, screen} from 'tests/react_testing_utils';

import ShowFormatting from './show_formatting';

jest.mock('components/with_tooltip', () => {
    return ({children}: { children: React.ReactNode }) => <div>{children}</div>;
});

describe('ShowFormatting Component', () => {
    it('should render correctly with default props', () => {
        renderWithContext(
            <ShowFormatting
                onClick={jest.fn()}
                active={false}
            />,
        );

        expect(screen.getByLabelText('Eye Icon')).toBeInTheDocument();
    });

    it('should call onClick handler when clicked', () => {
        const onClick = jest.fn();
        renderWithContext(
            <ShowFormatting
                onClick={onClick}
                active={false}
            />,
        );

        fireEvent.click(screen.getByLabelText('Eye Icon'));
        expect(onClick).toHaveBeenCalledTimes(1);
    });

    it('should apply the active class when active prop is true', () => {
        const {container} = renderWithContext(
            <ShowFormatting
                onClick={jest.fn()}
                active={true}
            />,
        );

        expect(container.querySelector('button')).toHaveClass('active');
    });
});
