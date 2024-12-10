// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {defineMessages} from 'react-intl';

export const holders = defineMessages({
    usernameReserved: {
        id: 'user.settings.general.usernameReserved',
        defaultMessage: 'This username is reserved, please choose a new one.',
    },
    usernameGroupNameUniqueness: {
        id: 'user.settings.general.usernameGroupNameUniqueness',
        defaultMessage: 'This username conflicts with an existing group name.',
    },
    usernameRestrictions: {
        id: 'user.settings.general.usernameRestrictions',
        defaultMessage: "Username must begin with a letter, and contain between {min} to {max} lowercase characters made up of numbers, letters, and the symbols '.', '-', and '_'.",
    },
    validEmail: {
        id: 'user.settings.general.validEmail',
        defaultMessage: 'Please enter a valid email address.',
    },
    emailMatch: {
        id: 'user.settings.general.emailMatch',
        defaultMessage: 'The new emails you entered do not match.',
    },
    incorrectPassword: {
        id: 'user.settings.general.incorrectPassword',
        defaultMessage: 'Your password is incorrect.',
    },
    emptyPassword: {
        id: 'user.settings.general.emptyPassword',
        defaultMessage: 'Please enter your current password.',
    },
    validImage: {
        id: 'user.settings.general.validImage',
        defaultMessage: 'Only BMP, JPG, JPEG, or PNG images may be used for profile pictures',
    },
    imageTooLarge: {
        id: 'user.settings.general.imageTooLarge',
        defaultMessage: 'Unable to upload profile image. File is too large.',
    },
    uploadImage: {
        id: 'user.settings.general.uploadImage',
        defaultMessage: "Click 'Edit' to upload an image.",
    },
    uploadImageMobile: {
        id: 'user.settings.general.mobile.uploadImage',
        defaultMessage: 'Click to upload an image',
    },
    fullName: {
        id: 'user.settings.general.fullName',
        defaultMessage: 'Full Name',
    },
    nickname: {
        id: 'user.settings.general.nickname',
        defaultMessage: 'Nickname',
    },
    username: {
        id: 'user.settings.general.username',
        defaultMessage: 'Username',
    },
    profilePicture: {
        id: 'user.settings.general.profilePicture',
        defaultMessage: 'Profile Picture',
    },
    close: {
        id: 'user.settings.general.close',
        defaultMessage: 'Close',
    },
    position: {
        id: 'user.settings.general.position',
        defaultMessage: 'Position',
    },
});
