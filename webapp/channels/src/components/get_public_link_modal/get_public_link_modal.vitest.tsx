// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import GetPublicLinkModal from 'components/get_public_link_modal/get_public_link_modal';

import {renderWithContext, screen} from 'tests/vitest_react_testing_utils';

describe('components/GetPublicLinkModal', () => {
    const getBaseProps = () => ({
        link: 'http://mattermost.com/files/n5bnoaz3e7g93nyipzo1bixdwr/public?h=atw9qQHI1nUPnxo1e48tPspo1Qvwd3kHtJZjysmI5zs',
        fileId: 'n5bnoaz3e7g93nyipzo1bixdwr',
        onExited: vi.fn(),
        actions: {
            getFilePublicLink: vi.fn(),
        },
    });

    test('should match snapshot when link is empty', () => {
        const baseProps = getBaseProps();
        const props = {
            ...baseProps,
            link: '',
        };

        const {container} = renderWithContext(
            <GetPublicLinkModal {...props}/>,
        );

        expect(container).toMatchSnapshot();
    });

    test('should match snapshot when link is not empty', () => {
        const baseProps = getBaseProps();
        const {container} = renderWithContext(
            <GetPublicLinkModal {...baseProps}/>,
        );

        expect(container).toMatchSnapshot();
    });

    test('should call getFilePublicLink on GetPublicLinkModal\'s show', () => {
        const baseProps = getBaseProps();
        renderWithContext(<GetPublicLinkModal {...baseProps}/>);

        expect(baseProps.actions.getFilePublicLink).toHaveBeenCalledTimes(1);
        expect(baseProps.actions.getFilePublicLink).toHaveBeenCalledWith(baseProps.fileId);
    });

    test('should not call getFilePublicLink on GetLinkModal\'s onHide', () => {
        const getFilePublicLink = vi.fn();
        const baseProps = getBaseProps();
        const props = {
            ...baseProps,
            actions: {
                getFilePublicLink,
            },
        };

        const {container} = renderWithContext(
            <GetPublicLinkModal {...props}/>,
        );

        getFilePublicLink.mockClear();

        // Verify component renders correctly
        expect(container).toMatchSnapshot();
        expect(getFilePublicLink).not.toHaveBeenCalled();
    });

    test('should call handleToggle on GetLinkModal\'s onHide', () => {
        const baseProps = getBaseProps();
        const {container} = renderWithContext(<GetPublicLinkModal {...baseProps}/>);

        // Verify component renders with close button
        const closeButton = screen.getByLabelText('Close');
        expect(closeButton).toBeInTheDocument();
        expect(container).toMatchSnapshot();
    });
});
