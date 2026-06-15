// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';

import BurnOnReadScreenshotWarningModal from './burn_on_read_screenshot_warning_modal';

describe('BurnOnReadScreenshotWarningModal', () => {
    const baseProps = {
        show: true,
        onConfirm: jest.fn(),
    };

    it('should render title and body text', () => {
        renderWithContext(<BurnOnReadScreenshotWarningModal {...baseProps}/>);

        expect(screen.getByText('Screenshots Not Allowed')).toBeInTheDocument();
        expect(screen.getByText(/Taking screenshots of Burn-on-Read messages is not permitted/)).toBeInTheDocument();
    });

    it('should not render when show is false', () => {
        renderWithContext(
            <BurnOnReadScreenshotWarningModal
                {...baseProps}
                show={false}
            />,
        );

        expect(screen.queryByText('Screenshots Not Allowed')).not.toBeInTheDocument();
    });

    it('should call onConfirm when acknowledge button is clicked', async () => {
        const onConfirm = jest.fn();
        renderWithContext(
            <BurnOnReadScreenshotWarningModal
                {...baseProps}
                onConfirm={onConfirm}
            />,
        );

        await userEvent.click(screen.getByText('I Understand'));

        expect(onConfirm).toHaveBeenCalledTimes(1);
    });

    it('should not render a close button', () => {
        const {container} = renderWithContext(<BurnOnReadScreenshotWarningModal {...baseProps}/>);

        expect(container.querySelector('.close')).not.toBeInTheDocument();
    });

    it('should have static backdrop and escape disabled', () => {
        const {container} = renderWithContext(<BurnOnReadScreenshotWarningModal {...baseProps}/>);

        const backdrop = container.ownerDocument.querySelector('.BurnOnReadScreenshotWarningModal__backdrop');
        expect(backdrop).toBeInTheDocument();
    });
});
