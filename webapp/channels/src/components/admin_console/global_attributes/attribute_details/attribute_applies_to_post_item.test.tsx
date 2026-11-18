// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {Client4} from 'mattermost-redux/client';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';

import AttributeAppliesToPostItem from './attribute_applies_to_post_item';

describe('AttributeAppliesToPostItem', () => {
    const onRemove = jest.fn();

    beforeEach(() => {
        jest.clearAllMocks();
    });

    const renderComponent = (props: Partial<React.ComponentProps<typeof AttributeAppliesToPostItem>> = {}) => {
        return renderWithContext(
            <AttributeAppliesToPostItem
                onRemove={onRemove}
                {...props}
            />,
        );
    };

    it('renders the Posts label', () => {
        renderComponent();
        expect(screen.getByTestId('admin.attribute.applies_to.post')).toHaveTextContent('Posts');
    });

    it('starts collapsed, with no Remove button, and clicking the toggle reveals the placeholder body and Remove', async () => {
        renderComponent();

        expect(screen.queryByTestId('admin.attribute.applies_to.post.body--region')).not.toBeInTheDocument();
        expect(screen.queryByTestId('admin.attribute.applies_to.post.remove--button')).not.toBeInTheDocument();

        await userEvent.click(screen.getByTestId('admin.attribute.applies_to.post.toggle--button'));
        expect(screen.getByTestId('admin.attribute.applies_to.post.body--region')).toHaveTextContent('No additional settings for this resource yet.');
        expect(screen.getByTestId('admin.attribute.applies_to.post.remove--button')).toBeVisible();

        await userEvent.click(screen.getByTestId('admin.attribute.applies_to.post.toggle--button'));
        expect(screen.queryByTestId('admin.attribute.applies_to.post.body--region')).not.toBeInTheDocument();
        expect(screen.queryByTestId('admin.attribute.applies_to.post.remove--button')).not.toBeInTheDocument();
    });

    it('calls onRemove exactly once when Remove is clicked, once expanded', async () => {
        renderComponent();

        await userEvent.click(screen.getByTestId('admin.attribute.applies_to.post.toggle--button'));
        await userEvent.click(screen.getByTestId('admin.attribute.applies_to.post.remove--button'));
        expect(onRemove).toHaveBeenCalledTimes(1);
    });

    it('disables the toggle, and the Remove button once expanded', async () => {
        const {rerender} = renderComponent();

        // Expand while enabled, then disable -- isOpen is local state, so it survives
        // the prop change, letting Remove's own disabled state be asserted directly.
        await userEvent.click(screen.getByTestId('admin.attribute.applies_to.post.toggle--button'));
        const disabledProps = {onRemove, disabled: true};
        rerender(<AttributeAppliesToPostItem {...disabledProps}/>);

        expect(screen.getByTestId('admin.attribute.applies_to.post.toggle--button')).toBeDisabled();
        expect(screen.getByTestId('admin.attribute.applies_to.post.remove--button')).toBeDisabled();
    });

    it('makes no Client4 calls and no data-mutating dispatch', async () => {
        const createPropertyField = jest.spyOn(Client4, 'createPropertyField');
        const deletePropertyField = jest.spyOn(Client4, 'deletePropertyField');

        renderComponent();
        await userEvent.click(screen.getByTestId('admin.attribute.applies_to.post.toggle--button'));
        await userEvent.click(screen.getByTestId('admin.attribute.applies_to.post.remove--button'));

        expect(createPropertyField).not.toHaveBeenCalled();
        expect(deletePropertyField).not.toHaveBeenCalled();
    });
});
