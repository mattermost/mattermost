// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, fireEvent, screen} from 'tests/vitest_react_testing_utils';

import ShowFormatting from './show_formatting';

vi.mock('components/with_tooltip', () => ({
    default: ({children}: { children: React.ReactNode }) => <div>{children}</div>,
}));

describe('ShowFormatting Component', () => {
    it('should render correctly with default props', () => {
        renderWithContext(
            <ShowFormatting
                onClick={vi.fn()}
                active={false}
            />,
        );

        expect(screen.getByLabelText('Eye Icon')).toBeInTheDocument();
    });

    it('should call onClick handler when clicked', () => {
        const onClick = vi.fn();
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
                onClick={vi.fn()}
                active={true}
            />,
        );

        expect(container.querySelector('button')).toHaveClass('active');
    });
});
