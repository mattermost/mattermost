// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import {renderWithIntl} from 'tests/react_testing_utils';

import GetPublicLinkModal from './get_public_link_modal';

describe('components/GetPublicLinkModal', () => {
    const baseProps = {
        link: 'http://mattermost.com/files/n5bnoaz3e7g93nyipzo1bixdwr/public?h=atw9qQHI1nUPnxo1e48tPspo1Qvwd3kHtJZjysmI5zs',
        fileId: 'n5bnoaz3e7g93nyipzo1bixdwr',
        onExited: jest.fn(),
        actions: {
            getFilePublicLink: jest.fn(),
        },
    };

    test('should render modal with empty link', () => {
        const props = {
            ...baseProps,
            link: '',
        };

        renderWithIntl(<GetPublicLinkModal {...props}/>);

        expect(screen.getByText('Copy Public Link')).toBeInTheDocument();
        expect(screen.getByText('The link below allows anyone to see this file without being registered on this server.')).toBeInTheDocument();
        expect(screen.getByRole('textbox')).toHaveValue('');
    });

    test('should render modal with link', () => {
        renderWithIntl(<GetPublicLinkModal {...baseProps}/>);

        expect(screen.getByText('Copy Public Link')).toBeInTheDocument();
        expect(screen.getByRole('textbox')).toHaveValue(baseProps.link);
    });

    test('should call getFilePublicLink on mount', () => {
        renderWithIntl(<GetPublicLinkModal {...baseProps}/>);

        expect(baseProps.actions.getFilePublicLink).toHaveBeenCalledTimes(1);
        expect(baseProps.actions.getFilePublicLink).toHaveBeenCalledWith(baseProps.fileId);
    });

    test('should not call getFilePublicLink on close', async () => {
        renderWithIntl(<GetPublicLinkModal {...baseProps}/>);

        baseProps.actions.getFilePublicLink.mockClear();
        
        await userEvent.click(screen.getByRole('button', {name: 'Close'}));
        
        expect(baseProps.actions.getFilePublicLink).not.toHaveBeenCalled();
    });

    test('should hide modal on close', async () => {
        renderWithIntl(<GetPublicLinkModal {...baseProps}/>);

        await userEvent.click(screen.getByRole('button', {name: 'Close'}));

        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
});
