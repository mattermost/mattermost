// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ComponentProps} from 'react';
import React from 'react';

import {renderWithContext, screen} from 'tests/react_testing_utils';

import AdminSettings from './admin_settings';

function getProps(): ComponentProps<typeof AdminSettings> {
    return {
        doSubmit: jest.fn(),
        renderSettings: () => <>{'Some settings'}</>,
        renderTitle: () => <>{'Some title'}</>,
        saveNeeded: false,
        saving: false,
        isDisabled: false,
        serverError: undefined,
    };
}

describe('AdminSettings', () => {
    it('should match snapshot', () => {
        const props = getProps();
        const {container} = renderWithContext(<AdminSettings {...props}/>);
        expect(container).toMatchSnapshot();
    });

    it('save button should be disabled if there is no save needed', () => {
        const props = getProps();
        props.saveNeeded = false;
        const {rerender} = renderWithContext(<AdminSettings {...props}/>);

        expect(screen.getByTestId('saveSetting')).toBeDisabled();

        props.saveNeeded = true;

        rerender(<AdminSettings {...props}/>);

        expect(screen.getByTestId('saveSetting')).not.toBeDisabled();
    });

    it('save button should be disabled if the component is disabled', () => {
        const props = getProps();
        props.saveNeeded = true;
        props.isDisabled = true;
        const {rerender} = renderWithContext(<AdminSettings {...props}/>);

        expect(screen.getByTestId('saveSetting')).toBeDisabled();

        props.isDisabled = false;

        rerender(<AdminSettings {...props}/>);

        expect(screen.getByTestId('saveSetting')).not.toBeDisabled();
    });

    it('should call doSubmit when the save button is pressed', () => {
        const props = getProps();
        props.saveNeeded = true;

        const {rerender} = renderWithContext(<AdminSettings {...props}/>);

        expect(props.doSubmit).not.toHaveBeenCalled();
        screen.getByTestId('saveSetting').click();
        expect(props.doSubmit).toHaveBeenCalled();

        props.doSubmit = jest.fn();
        rerender(<AdminSettings {...props}/>);

        expect(props.doSubmit).not.toHaveBeenCalled();
        screen.getByTestId('saveSetting').click();
        expect(props.doSubmit).toHaveBeenCalled();
    });

    it('show saving message while saving', () => {
        const props = getProps();
        props.saving = true;
        const {rerender} = renderWithContext(<AdminSettings {...props}/>);

        expect(screen.getByText('Saving Config...')).toBeInTheDocument();

        props.saving = false;

        rerender(<AdminSettings {...props}/>);

        expect(screen.queryByText('Saving Config...')).not.toBeInTheDocument();
    });

    it('should render the specified title and settings', () => {
        const titleTestId = 'some test id for the title';
        const settingsTestId = 'some test id for the settings';
        const props = getProps();
        props.renderTitle = () => <span data-testid={titleTestId}>{'hello world'}</span>;
        props.renderSettings = () => <span data-testid={settingsTestId}>{'hello world'}</span>;

        renderWithContext(<AdminSettings {...props}/>);

        expect(screen.getByTestId(titleTestId)).toBeInTheDocument();
        expect(screen.getByTestId(settingsTestId)).toBeInTheDocument();
    });

    it('should show the error message', () => {
        const serverError = 'some error';
        const props = getProps();
        props.serverError = serverError;
        const {rerender} = renderWithContext(<AdminSettings {...props}/>);

        expect(screen.getByText(serverError)).toBeInTheDocument();

        props.serverError = undefined;
        rerender(<AdminSettings {...props}/>);

        expect(screen.queryByText(serverError)).not.toBeInTheDocument();
    });
});
