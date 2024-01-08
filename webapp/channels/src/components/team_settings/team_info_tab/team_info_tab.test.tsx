// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {screen} from '@testing-library/react';
import React from 'react';
import type {ComponentProps} from 'react';
import {act} from 'react-dom/test-utils';

import {renderWithContext, userEvent} from 'tests/react_testing_utils';
import Constants from 'utils/constants';
import {TestHelper} from 'utils/test_helper';

import InfoTab from './team_info_tab';

describe('components/TeamSettings', () => {
    const getTeam = jest.fn().mockResolvedValue({data: true});
    const patchTeam = jest.fn().mockReturnValue({data: true});
    const removeTeamIcon = jest.fn().mockReturnValue({data: true});
    const setTeamIcon = jest.fn().mockReturnValue({data: true});
    const baseActions = {
        getTeam,
        patchTeam,
        removeTeamIcon,
        setTeamIcon,
    };
    const defaultProps: ComponentProps<typeof InfoTab> = {
        team: TestHelper.getTeamMock({id: 'team_id', name: 'team_name', display_name: 'team_display_name', description: 'team_description'}),
        maxFileSize: 50,
        actions: baseActions,
        hasChanges: true,
        hasChangeTabError: false,
        setHasChanges: jest.fn(),
        setHasChangeTabError: jest.fn(),
        closeModal: jest.fn(),
        collapseModal: jest.fn(),
    };

    beforeEach(() => {
        global.URL.createObjectURL = jest.fn();
    });

    test('should show an error when pdf file is uploaded', () => {
        renderWithContext(<InfoTab {...defaultProps}/>);
        const file = new File(['pdf'], 'pdf.pdf', {type: 'application/pdf'});
        const input = screen.getByTestId('uploadPicture');
        userEvent.upload(input, file);

        const error = screen.getByTestId('mm-modal-generic-section-item__error');
        expect(error).toBeVisible();
        expect(error).toHaveTextContent('Only BMP, JPG or PNG images may be used for team icons');
    });

    test('should show an error when too large file is uploaded with 40mb', () => {
        renderWithContext(<InfoTab {...defaultProps}/>);
        const file = new File(['test'], 'test.png', {type: 'image/png'});
        Object.defineProperty(file, 'size', {value: defaultProps.maxFileSize + 1});
        const input = screen.getByTestId('uploadPicture');
        userEvent.upload(input, file);

        const error = screen.getByTestId('mm-modal-generic-section-item__error');
        expect(error).toBeVisible();
        expect(error).toHaveTextContent('Unable to upload team icon. File is too large.');
    });

    test('should call setTeamIcon when an image is uploaded and saved', async () => {
        renderWithContext(<InfoTab {...defaultProps}/>);
        const file = new File(['test'], 'test.png', {type: 'image/png'});
        const input = screen.getByTestId('uploadPicture');
        await act(async () => {
            userEvent.upload(input, file);
        });

        const saveButton = screen.getByTestId('mm-save-changes-panel__save-btn');
        await act(async () => {
            userEvent.click(saveButton);
        });

        expect(setTeamIcon).toHaveBeenCalledTimes(1);
        expect(setTeamIcon).toHaveBeenCalledWith(defaultProps.team?.id, file);
    });

    test('should call setTeamIcon when an image is removed', async () => {
        renderWithContext(<InfoTab {...defaultProps}/>);
        const file = new File(['test'], 'test.png', {type: 'image/png'});
        const input = screen.getByTestId('uploadPicture');
        await act(async () => {
            userEvent.upload(input, file);
        });

        const saveButton = screen.getByTestId('mm-save-changes-panel__save-btn');
        await act(async () => {
            userEvent.click(saveButton);
        });

        const removeImageButton = screen.getByTestId('removeImageButton');
        await act(async () => {
            userEvent.click(removeImageButton);
        });

        expect(removeTeamIcon).toHaveBeenCalledTimes(1);
        expect(removeTeamIcon).toHaveBeenCalledWith(defaultProps.team?.id);
    });

    test('should show an error when team name is empty', async () => {
        renderWithContext(<InfoTab {...defaultProps}/>);
        const input = screen.getByTestId('teamNameInput');
        act(() => {
            userEvent.clear(input);
        });
        const saveButton = screen.getByTestId('mm-save-changes-panel__save-btn');
        await act(async () => {
            userEvent.click(saveButton);
        });

        const error = screen.getByTestId('mm-modal-generic-section-item__error');
        expect(error).toBeVisible();
        expect(error).toHaveTextContent('This field is required');
    });

    test('should show an error when team name is too short', async () => {
        renderWithContext(<InfoTab {...defaultProps}/>);
        const input = screen.getByTestId('teamNameInput');
        await act(async () => {
            await userEvent.clear(input);
            await userEvent.type(input, 'a');
        });
        const saveButton = screen.getByTestId('mm-save-changes-panel__save-btn');
        await act(async () => {
            userEvent.click(saveButton);
        });

        const error = screen.getByTestId('mm-modal-generic-section-item__error');
        expect(error).toBeVisible();
        expect(error).toHaveTextContent(`Team Name must be ${Constants.MIN_TEAMNAME_LENGTH} or more characters up to a maximum of ${Constants.MAX_TEAMNAME_LENGTH}. You can add a longer team description.`);
    });

    test('should call patchTeam when team name is changed and clicked saved', async () => {
        renderWithContext(<InfoTab {...defaultProps}/>);
        const input = screen.getByTestId('teamNameInput');
        userEvent.clear(input);
        userEvent.type(input, 'new_team_name');
        const saveButton = screen.getByTestId('mm-save-changes-panel__save-btn');
        await act(async () => {
            userEvent.click(saveButton);
        });

        expect(patchTeam).toHaveBeenCalledTimes(1);
        expect(patchTeam).toHaveBeenCalledWith({id: defaultProps.team?.id, display_name: 'new_team_name', description: defaultProps.team?.description});
    });

    test('should call patchTeam when team description is changed and clicked saved', async () => {
        renderWithContext(<InfoTab {...defaultProps}/>);
        const input = screen.getByTestId('teamDescriptionInput');
        await act(async () => {
            await userEvent.clear(input);
            await userEvent.type(input, 'new_team_description');
        });
        const saveButton = screen.getByTestId('mm-save-changes-panel__save-btn');
        await act(async () => {
            userEvent.click(saveButton);
        });

        expect(patchTeam).toHaveBeenCalledTimes(1);
        expect(patchTeam).toHaveBeenCalledWith({id: defaultProps.team?.id, display_name: defaultProps.team?.display_name, description: 'new_team_description'});
    });

    test('should call patchTeam when team name and description are change and clicked saved', async () => {
        renderWithContext(<InfoTab {...defaultProps}/>);
        const nameInput = screen.getByTestId('teamNameInput');
        const descriptionInput = screen.getByTestId('teamDescriptionInput');
        userEvent.clear(nameInput);
        userEvent.type(nameInput, 'new_team_name');
        userEvent.clear(descriptionInput);
        userEvent.type(descriptionInput, 'new_team_description');
        const saveButton = screen.getByTestId('mm-save-changes-panel__save-btn');
        await act(async () => {
            userEvent.click(saveButton);
        });

        expect(patchTeam).toHaveBeenCalledTimes(1);
        expect(patchTeam).toHaveBeenCalledWith({id: defaultProps.team?.id, display_name: 'new_team_name', description: 'new_team_description'});
    });
});
