// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useRef} from 'react';
import type {ChangeEvent} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';

import {CameraOutlineIcon} from '@mattermost/compass-icons/components';
import type {UserProfile} from '@mattermost/types/users';

import {Client4} from 'mattermost-redux/client';

import * as Menu from 'components/menu';
import ProfilePicture from 'components/profile_picture';
import LoadingSpinner from 'components/widgets/loading/loading_spinner';

import {Constants} from 'utils/constants';

import './admin_user_card.scss';

export type Props = {
    user?: UserProfile;
    isLoading?: boolean;
    body?: React.ReactNode;
    footer?: React.ReactNode;
    onUploadPicture?: (file: File) => void;
    onRemovePicture?: () => void;
    canRemovePicture?: boolean;
    isUploadingPicture?: boolean;
};

const AdminUserCard = ({isLoading = false, ...props}: Props) => {
    const {formatMessage} = useIntl();
    const fileInput = useRef<HTMLInputElement>(null);

    const canEditPicture = Boolean(props.user && props.onUploadPicture);

    const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            props.onUploadPicture?.(file);
        }

        // Reset so selecting the same file again still fires onChange.
        e.target.value = '';
    };

    if (!props.user || isLoading) {
        return (
            <div className='AdminUserCard'>
                <div className='AdminUserCard__header'>
                    <div className='AdminUserCard__header-main'>
                        <div className='AdminUserCard__header-start'>
                            <ProfilePicture
                                src=''
                                size='xxl'
                                wrapperClass='admin-user-card'
                            />
                        </div>
                    </div>
                </div>
                <div className='noUserBody'>
                    {isLoading && <LoadingSpinner testId='admin.user.card.loading_spinner'/>}
                    {!isLoading &&
                        <FormattedMessage
                            id='admin.userManagement.userDetail.notFound'
                            defaultMessage='User not found'
                        />
                    }
                </div>

            </div>
        );
    }

    const displayName = [props.user.first_name, props.user.last_name].filter(Boolean).join(' ');

    return (
        <div
            className='AdminUserCard'
            data-testid='admin.user.card'
        >
            <header
                className='AdminUserCard__header'
                data-testid='admin.user.card.header'
            >
                <div className='AdminUserCard__header-main'>
                    <div className='AdminUserCard__header-start'>
                        <div className='AdminUserCard__picture'>
                            <ProfilePicture
                                src={Client4.getProfilePictureUrl(props.user.id, props.user.last_picture_update)}
                                size='xxl'
                                wrapperClass='admin-user-card'
                                userId={props.user.id}
                            />
                            {canEditPicture && (
                                <>
                                    <input
                                        ref={fileInput}
                                        type='file'
                                        className='AdminUserCard__picture-input'
                                        accept={Constants.ACCEPT_STATIC_IMAGE}
                                        onChange={handleFileChange}
                                        disabled={props.isUploadingPicture}
                                        data-testid='admin.user.card.picture_input'
                                        aria-hidden={true}
                                        tabIndex={-1}
                                    />
                                    <Menu.Container
                                        menuButton={{
                                            id: 'adminUserCardPictureButton',
                                            class: 'AdminUserCard__picture-edit',
                                            dataTestId: 'admin.user.card.picture--button',
                                            disabled: props.isUploadingPicture,
                                            'aria-label': formatMessage({
                                                id: 'admin.userManagement.userDetail.picture.edit',
                                                defaultMessage: 'Edit profile picture',
                                            }),
                                            children: props.isUploadingPicture ? (
                                                <LoadingSpinner
                                                    legacy={true}
                                                    testId='admin.user.card.picture.loading_spinner'
                                                />
                                            ) : <CameraOutlineIcon size={14}/>,
                                        }}
                                        menu={{
                                            id: 'adminUserCardPictureMenu',
                                            'aria-label': formatMessage({
                                                id: 'admin.userManagement.userDetail.picture.menu',
                                                defaultMessage: 'Profile picture options',
                                            }),
                                        }}
                                    >
                                        <Menu.Item
                                            id='adminUserCardUploadPicture'
                                            data-testid='admin.user.card.picture_menu.upload--menuitem'
                                            onClick={() => fileInput.current?.click()}
                                            labels={
                                                <FormattedMessage
                                                    id='admin.userManagement.userDetail.picture.upload'
                                                    defaultMessage='Upload Picture'
                                                />
                                            }
                                        />
                                        {props.canRemovePicture && (
                                            <Menu.Item
                                                id='adminUserCardRemovePicture'
                                                data-testid='admin.user.card.picture_menu.remove--menuitem'
                                                isDestructive={true}
                                                onClick={props.onRemovePicture}
                                                labels={
                                                    <FormattedMessage
                                                        id='admin.userManagement.userDetail.picture.remove'
                                                        defaultMessage='Remove Picture'
                                                    />
                                                }
                                            />
                                        )}
                                    </Menu.Container>
                                </>
                            )}
                        </div>
                        <div className='AdminUserCard__title-stack'>
                            <h2
                                className='AdminUserCard__user-info'
                                data-testid='admin.user.card.info'
                            >
                                {displayName || props.user.nickname || props.user.username}
                            </h2>
                            <p
                                className='AdminUserCard__user-id'
                                data-testid='admin.user.card.user_id--text'
                            >
                                {displayName && props.user.nickname && (
                                    <>
                                        <span
                                            className='AdminUserCard__user-nickname'
                                            data-testid='admin.user.card.nickname--text'
                                        >
                                            {props.user.nickname}
                                        </span>
                                        {' · '}
                                    </>
                                )}
                                <FormattedMessage
                                    id='admin.userManagement.userDetail.userId'
                                    defaultMessage='User ID: {userId}'
                                    values={{
                                        userId: props.user.id,
                                    }}
                                />
                            </p>
                        </div>
                    </div>
                </div>
            </header>
            <div
                className='AdminUserCard__body'
                data-testid='admin.user.card.body'
            >
                {props.body}
            </div>
            <div
                className='AdminUserCard__footer'
                data-testid='admin.user.card.footer'
            >
                {props.footer}
            </div>
        </div>);
};

export default AdminUserCard;
