// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import renderer from 'react-test-renderer';

import {DropdownMenuItem} from './dot_menu';

jest.mock('src/utils', () => ({
    useUniqueId: () => 'test-id',
}));

jest.mock('src/components/widgets/tooltip', () => ({
    __esModule: true,
    default: ({children}: {children: React.ReactNode}) => <>{children}</>,
}));

/* eslint-disable formatjs/no-literal-string-in-jsx */

describe('DropdownMenuItem', () => {
    it('should render correctly', () => {
        const onClick = jest.fn();
        const component = renderer.create(
            <DropdownMenuItem onClick={onClick}>
                {'Test Item'}
            </DropdownMenuItem>,
        );
        const tree = component.toJSON();

        expect(tree).toBeTruthy();
    });

    it('should call onClick and preventDefault when clicked', () => {
        const onClick = jest.fn();
        const component = renderer.create(
            <DropdownMenuItem onClick={onClick}>
                {'Test Item'}
            </DropdownMenuItem>,
        );
        const tree = component.toJSON();

        // Verify the anchor has href="#"
        expect(tree).not.toBeNull();
        if (tree && !Array.isArray(tree)) {
            expect(tree.props.href).toBe('#');

            // Simulate click with mock event
            const mockEvent = {
                preventDefault: jest.fn(),
            };
            tree.props.onClick(mockEvent);

            // Verify preventDefault was called to avoid hash navigation
            expect(mockEvent.preventDefault).toHaveBeenCalled();
            expect(onClick).toHaveBeenCalledTimes(1);
        }
    });

    it('should render disabled state without click handler', () => {
        const onClick = jest.fn();
        const component = renderer.create(
            <DropdownMenuItem
                onClick={onClick}
                disabled={true}
                disabledAltText='Disabled tooltip'
            >
                {'Disabled Item'}
            </DropdownMenuItem>,
        );
        const tree = component.toJSON();

        expect(tree).toBeTruthy();

        // Disabled item renders as div without onClick
        if (tree && !Array.isArray(tree)) {
            expect(tree.props.onClick).toBeUndefined();
        }
    });
});
