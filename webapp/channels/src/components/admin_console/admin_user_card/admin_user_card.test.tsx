// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {fireEvent} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import {renderWithContext, screen, waitFor} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import AdminUserCard from './admin_user_card';

describe('components/admin_console/admin_user_card/admin_user_card', () => {
    const user = TestHelper.getUserMock({
        first_name: 'Jim',
        last_name: 'Halpert',
        nickname: 'Big Tuna',
        id: '1234',
    });

    const defaultProps = {
        user,
    } as any;

    test('should match default snapshot', () => {
        const props = defaultProps;
        const {container} = renderWithContext(<AdminUserCard {...props}/>);
        screen.getByText(props.user.first_name, {exact: false});
        screen.getByText(props.user.last_name, {exact: false});
        screen.getByText(props.user.nickname, {exact: false});

        expect(container).toMatchSnapshot();
    });

    test('should match snapshot if no nickname is defined', () => {
        const props = {
            ...defaultProps,
            user: {
                ...defaultProps.user,
                nickname: null,
            },
        };
        const {container} = renderWithContext(<AdminUserCard {...props}/>);
        screen.getByText(props.user.first_name, {exact: false});
        screen.getByText(props.user.last_name, {exact: false});
        expect(screen.queryByText(defaultProps.user.nickname)).not.toBeInTheDocument();

        expect(container).toMatchSnapshot();
    });

    test('should match snapshot if no first/last name is defined', () => {
        const props = {
            ...defaultProps,
            user: {
                ...defaultProps.user,
                first_name: null,
                last_name: null,
            },
        };
        const {container} = renderWithContext(<AdminUserCard {...props}/>);
        expect(screen.queryByText(defaultProps.user.first_name)).not.toBeInTheDocument();
        expect(screen.queryByText(defaultProps.user.last_name)).not.toBeInTheDocument();
        screen.getByText(props.user.nickname, {exact: false});

        expect(container).toMatchSnapshot();
    });

    test('should match snapshot if no first/last name or nickname is defined', () => {
        const props = {
            ...defaultProps,
            user: {
                ...defaultProps.user,
                first_name: null,
                last_name: null,
                nickname: null,
            },
        };
        const {container} = renderWithContext(<AdminUserCard {...props}/>);
        expect(screen.queryByText(defaultProps.user.first_name)).not.toBeInTheDocument();
        expect(screen.queryByText(defaultProps.user.last_name)).not.toBeInTheDocument();
        expect(screen.queryByText(defaultProps.user.nickname)).not.toBeInTheDocument();
        screen.getByText(props.user.id, {exact: false});

        expect(container).toMatchSnapshot();
    });

    describe('profile picture editing', () => {
        test('should not render the edit control when no upload handler is provided', () => {
            renderWithContext(<AdminUserCard {...defaultProps}/>);

            expect(screen.queryByTestId('adminUserCardPictureButton')).not.toBeInTheDocument();
        });

        test('should call onUploadPicture with the selected file', () => {
            const onUploadPicture = jest.fn();
            renderWithContext(
                <AdminUserCard
                    {...defaultProps}
                    onUploadPicture={onUploadPicture}
                />,
            );

            const file = new File(['image-bytes'], 'avatar.png', {type: 'image/png'});
            fireEvent.change(screen.getByTestId('adminUserCardPictureInput'), {target: {files: [file]}});

            expect(onUploadPicture).toHaveBeenCalledTimes(1);
            expect(onUploadPicture).toHaveBeenCalledWith(file);
        });

        test('should not offer removal when the user has no custom picture', async () => {
            renderWithContext(
                <AdminUserCard
                    {...defaultProps}
                    onUploadPicture={jest.fn()}
                    onRemovePicture={jest.fn()}
                    canRemovePicture={false}
                />,
            );

            await userEvent.click(screen.getByTestId('adminUserCardPictureButton'));

            expect(screen.getByText('Upload Picture')).toBeInTheDocument();
            expect(screen.queryByText('Remove Picture')).not.toBeInTheDocument();
        });

        test('should call onRemovePicture when the user has a custom picture', async () => {
            const onRemovePicture = jest.fn();
            renderWithContext(
                <AdminUserCard
                    {...defaultProps}
                    onUploadPicture={jest.fn()}
                    onRemovePicture={onRemovePicture}
                    canRemovePicture={true}
                />,
            );

            await userEvent.click(screen.getByTestId('adminUserCardPictureButton'));
            await userEvent.click(await screen.findByText('Remove Picture'));

            await waitFor(() => {
                expect(onRemovePicture).toHaveBeenCalledTimes(1);
            });
        });

        test('should disable the edit control and show a spinner while uploading', () => {
            renderWithContext(
                <AdminUserCard
                    {...defaultProps}
                    onUploadPicture={jest.fn()}
                    isUploadingPicture={true}
                />,
            );

            expect(screen.getByTestId('adminUserCardPictureButton')).toBeDisabled();
            expect(screen.getByTestId('adminUserCardPictureInput')).toBeDisabled();
            expect(screen.getByTitle('Loading Icon')).toBeInTheDocument();
        });
    });
});
