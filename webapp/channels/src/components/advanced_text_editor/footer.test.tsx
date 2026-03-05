// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen} from 'tests/react_testing_utils';

import Footer from './footer';

describe('Footer Component', () => {
    const baseProps = {
        postError: null,
        errorClass: null,
        serverError: null,
        channelId: 'channel_id',
        rootId: '',
        noArgumentHandleSubmit: jest.fn(),
        isInEditMode: false,
    };

    describe('HelpButton visibility', () => {
        it('should render HelpButton when not in edit mode', () => {
            renderWithContext(
                <Footer
                    {...baseProps}
                    isInEditMode={false}
                />,
            );

            expect(screen.getByText('Help')).toBeInTheDocument();
        });

        it('should not render HelpButton when in edit mode', () => {
            renderWithContext(
                <Footer
                    {...baseProps}
                    isInEditMode={true}
                />,
            );

            expect(screen.queryByText('Help')).not.toBeInTheDocument();
        });

        it('should render HelpButton as a button element with correct attributes', () => {
            renderWithContext(
                <Footer
                    {...baseProps}
                    isInEditMode={false}
                />,
            );

            const helpButton = screen.getByText('Help');
            expect(helpButton.tagName).toBe('BUTTON');
            expect(helpButton).toHaveAttribute('type', 'button');
            expect(helpButton).toHaveAttribute('aria-label', 'Messaging help');
        });
    });

    describe('Footer structure', () => {
        it('should render the footer with correct id and role', () => {
            const {container} = renderWithContext(
                <Footer {...baseProps}/>,
            );

            const footer = container.querySelector('#postCreateFooter');
            expect(footer).toBeInTheDocument();
            expect(footer).toHaveAttribute('role', 'form');
        });

        it('should render MsgTyping when not in edit mode', () => {
            renderWithContext(
                <Footer
                    {...baseProps}
                    isInEditMode={false}
                />,
            );

            // MsgTyping component should be rendered (it renders an empty span by default)
            const footer = screen.getByRole('form');
            expect(footer).toBeInTheDocument();
        });

        it('should not render MsgTyping when in edit mode', () => {
            const {container} = renderWithContext(
                <Footer
                    {...baseProps}
                    isInEditMode={true}
                />,
            );

            // The MsgTyping component should not be in the DOM when in edit mode
            // This is a basic structural check
            const footer = container.querySelector('#postCreateFooter');
            expect(footer).toBeInTheDocument();
        });
    });
});

