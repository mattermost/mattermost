// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {SxProps, Theme, styled} from '@mui/material/styles';
import MUIDialogTitle, {DialogTitleProps as MUIDialogTitleProps} from '@mui/material/DialogTitle';

import {CloseIcon} from '@mattermost/compass-icons/components';

import IconButton from '../icon_button/icon_button';

type DialogTitleProps = MUIDialogTitleProps & { hasCloseButton: boolean};

const StyledModalHeader = styled(MUIDialogTitle, {
    shouldForwardProp: (prop) => prop !== 'hasCloseButton',
})<DialogTitleProps>({
    display: 'grid',
    gridTemplateColumns: '1fr max-content max-content',
    gap: 12,
    fontFamily: 'Metropolis',
    fontStyle: 'normal',
    fontWeight: 600,
    fontSize: 22,
    lineHeight: '28px',
    color: 'var(--center-channel-color)',
    alignItems: 'center',
    padding: '0',
});

const StyledModalTitleSection = styled('div')`
    padding: '0 32px 24px 32px';
    borderBottom: '1px solid rgba(var(--center-channel-text-rgb), 0.12)';
`;

type ModalHeaderProps = {
    title: React.ReactNode | string;
    rightSection?: React.ReactNode | React.ReactNode[];
    children?: React.ReactNode | React.ReactNode[];
    onClose?: React.MouseEventHandler;
    sx?: SxProps<Theme>;
}

const ModalHeader = ({title, onClose, children, rightSection = null, sx}: ModalHeaderProps) => {
    const hasCloseButton = Boolean(onClose);

    return (
        <>
            <StyledModalHeader
                hasCloseButton={hasCloseButton}
                component={'div'}
                sx={sx}
            >
                {title}
                {rightSection}
                {hasCloseButton && (
                    <IconButton
                        compact={true}
                        type='button'
                        onClick={onClose}
                        IconComponent={CloseIcon}
                    />
                )}
            </StyledModalHeader>
            {children && (
                <StyledModalTitleSection>
                    {children}
                </StyledModalTitleSection>
            )}
        </>
    );
};

export default ModalHeader;
