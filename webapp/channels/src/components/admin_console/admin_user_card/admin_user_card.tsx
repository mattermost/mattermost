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

type BulletProps = {
    user: UserProfile;
};

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
                    <ProfilePicture
                        src=''
                        size='xxl'
                        wrapperClass='admin-user-card'
                    />
                </div>
                <div className='noUserBody'>
                    {isLoading && <LoadingSpinner/>}
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

    return (
        <div
            className='AdminUserCard'
            data-testid='adminUserCard'
        >
            <div
                className='AdminUserCard__header'
                data-testid='adminUserCard-header'
            >
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
                                data-testid='adminUserCardPictureInput'
                                aria-hidden={true}
                                tabIndex={-1}
                            />
                            <Menu.Container
                                menuButton={{
                                    id: 'adminUserCardPictureButton',
                                    class: 'AdminUserCard__picture-edit',
                                    dataTestId: 'adminUserCardPictureButton',
                                    disabled: props.isUploadingPicture,
                                    'aria-label': formatMessage({
                                        id: 'admin.userManagement.userDetail.picture.edit',
                                        defaultMessage: 'Edit profile picture',
                                    }),
                                    children: props.isUploadingPicture ? <LoadingSpinner/> : <CameraOutlineIcon size={16}/>,
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
                <div
                    className='AdminUserCard__user-info'
                    data-testid='adminUserCard-userInfo'
                >
                    <span>{props.user.first_name} {props.user.last_name}</span>
                    <Bullet user={props.user}/>
                    <span
                        className='AdminUserCard__user-nickname'
                        data-testid='adminUserCard-userNickname'
                    >{props.user.nickname}</span>
                </div>
                <div
                    className='AdminUserCard__user-id'
                    data-testid='adminUserCard-userId'
                >
                    <FormattedMessage
                        id='admin.userManagement.userDetail.userId'
                        defaultMessage='User ID: {userId}'
                        values={{
                            userId: props.user.id,
                        }}
                    />
                </div>
            </div>
            <div
                className='AdminUserCard__body'
                data-testid='adminUserCard-body'
            >
                {props.body}
            </div>
            <div
                className='AdminUserCard__footer'
                data-testid='adminUserCard-footer'
            >
                {props.footer}
            </div>
        </div>);
};

const Bullet = (props: BulletProps) => {
    if ((props.user.first_name || props.user.last_name) && props.user.nickname) {
        return (<span>{' • '}</span>);
    }
    return null;
};

export default AdminUserCard;
