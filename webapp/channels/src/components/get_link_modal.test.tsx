// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import GetLinkModal from 'components/get_link_modal';

import {renderWithIntl} from 'tests/react_testing_utils';

describe('components/GetLinkModal', () => {
    const onHide = jest.fn();
    const requiredProps = {
        show: true,
        onHide,
        onExited: jest.fn(),
        title: 'title',
        link: 'https://mattermost.com',
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('should render modal with all props set', () => {
        const helpText = 'help text';
        const props = {...requiredProps, helpText};

        renderWithIntl(<GetLinkModal {...props}/>);

        expect(screen.getByText('title')).toBeInTheDocument();
        expect(screen.getByText('help text')).toBeInTheDocument();
        expect(screen.getByText('Copy Link')).toBeInTheDocument();
        expect(screen.getByTestId('linkModalCloseButton')).toBeInTheDocument();
        
        const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
        expect(textarea).toHaveValue('https://mattermost.com');
    });

    test('should render modal without help text', () => {
        renderWithIntl(<GetLinkModal {...requiredProps}/>);

        expect(screen.getByText('title')).toBeInTheDocument();
        expect(screen.queryByText('help text')).not.toBeInTheDocument();
    });

    test('should handle close button and modal hide', () => {
        const newOnHide = jest.fn();
        const props = {...requiredProps, onHide: newOnHide};

        renderWithIntl(<GetLinkModal {...props}/>);

        userEvent.click(screen.getByTestId('linkModalCloseButton'));
        expect(newOnHide).toHaveBeenCalledTimes(1);
    });

    test('should handle copy link functionality', () => {
        const execCommandMock = jest.spyOn(document, 'execCommand').mockImplementation(() => true);

        renderWithIntl(<GetLinkModal {...requiredProps}/>);

        const textarea = screen.getByRole('textbox');
        userEvent.click(textarea);

        expect(screen.getByText('Link copied')).toBeInTheDocument();
        expect(execCommandMock).toHaveBeenCalledWith('copy');

        execCommandMock.mockRestore();
    });
});
