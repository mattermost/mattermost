// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import type {ComponentProps} from 'react';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import TeamPictureSection from './team_picture_section';

describe('components/team_settings/TeamPictureSection', () => {
    const baseProps: ComponentProps<typeof TeamPictureSection> = {
        team: TestHelper.getTeamMock({id: 'team_id', display_name: 'Team Display Name'}),
        teamName: 'Team Display Name',
        disabled: false,
        onFileChange: jest.fn(),
        onRemove: jest.fn(),
    };

    test('should reject an upload through the file input while disabled', async () => {
        const onFileChange = jest.fn();

        renderWithContext(
            <TeamPictureSection
                {...baseProps}
                disabled={true}
                onFileChange={onFileChange}
            />,
        );

        const input = screen.getByTestId('uploadPicture');
        expect(input).toBeDisabled();

        const file = new File(['test'], 'test.png', {type: 'image/png'});
        await userEvent.upload(input, file);

        expect(onFileChange).not.toHaveBeenCalled();
    });

    test('should not put a disabled attribute on the span wrapping the edit icon', () => {
        const {container} = renderWithContext(
            <TeamPictureSection
                {...baseProps}
                disabled={true}
            />,
        );

        expect(container.querySelector('.team-picture-section > span')).not.toHaveAttribute('disabled');
    });

    test('should accept an upload through the file input while enabled', async () => {
        const onFileChange = jest.fn();

        renderWithContext(
            <TeamPictureSection
                {...baseProps}
                onFileChange={onFileChange}
            />,
        );

        const input = screen.getByTestId('uploadPicture');
        expect(input).toBeEnabled();

        const file = new File(['test'], 'test.png', {type: 'image/png'});
        await userEvent.upload(input, file);

        expect(onFileChange).toHaveBeenCalledTimes(1);
    });
});
