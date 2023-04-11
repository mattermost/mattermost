// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState} from 'react';
import {ComponentStory} from '@storybook/react';

import {AlertCircleOutlineIcon, CheckIcon, InformationOutlineIcon} from '@mattermost/compass-icons/components';

import Button from '../button/button';

import Toast from './toast';

const icons = {
    CheckIcon,
    InformationOutlineIcon,
    AlertCircleOutlineIcon,
};

export default {
    title: 'Toast',
    component: Toast,
};

export const Simple: ComponentStory<typeof Toast> = (args) => {
    const [open, setOpen] = useState(false);

    const handleClick = () => {
        setOpen(true);
    };

    const handleClose = (event: React.SyntheticEvent | Event, reason?: string) => {
        if (reason === 'clickaway') {
            return;
        }

        setOpen(false);
    };

    const action = (
        <React.Fragment>
            <Button
                variant={'primary'}
                size='small'
                onClick={handleClose}
            >
                {'ACTION'}
            </Button>
        </React.Fragment>
    );

    return (
        <div>
            <Button onClick={handleClick}>{'Open simple toast'}</Button>
            <Toast
                {...args}
                open={open}
                onClose={handleClose}
                action={action}
            />
        </div>
    );
};
Simple.args = {
    message: 'Lorem ipsum dolor sit amet',
    autoHideDuration: 1000,
    showCloseButton: false,
};
Simple.argTypes = {
    message: {
        control: 'text',
    },
    autoHideDuration: {
        control: 'number',
    },
    showCloseButton: {
        control: 'boolean',
    },
    Icon: {
        options: Object.keys(icons),
        mapping: icons,
        control: {
            type: 'select',
            labels: {
                CheckIcon: 'Check',
                InformationOutlineIcon: 'Info',
                AlertCircleOutlineIcon: 'Alert',
            },
        },
    },
};
