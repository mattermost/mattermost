// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';
import styled from 'styled-components';

import {
    ContentCopyIcon,
    DotsHorizontalIcon,
    FormatListBulletedIcon,
    PencilOutlineIcon,
    TrashCanOutlineIcon,
} from '@mattermost/compass-icons/components';

import DotMenu, {DropdownMenu, DropdownMenuItem} from 'src/components/dot_menu';
import type {PropertyField} from 'src/types/properties';

type Props = {
    field: PropertyField;
    onRename?: (field: PropertyField) => void;
    onEditType?: (field: PropertyField) => void;
    onDelete?: (field: PropertyField) => void;
    onDuplicate?: (field: PropertyField) => void;
};

const PropertyDotMenu = ({
    field,
    onRename,
    onEditType,
    onDelete,
    onDuplicate,
}: Props) => {
    const handleRename = () => {
        onRename?.(field);
    };

    const handleEditType = () => {
        onEditType?.(field);
    };

    const handleDeleteClick = () => {
        onDelete?.(field);
    };

    const handleDuplicate = () => {
        onDuplicate?.(field);
    };

    return (
        <MenuContainer>
            <DotMenu
                placement='bottom-end'
                dotMenuButton={FullWidthActionsButton}
                dropdownMenu={CustomDropdownMenu}
                icon={<DotsHorizontalIcon size={18}/>}
            >
                <DropdownMenuItem onClick={handleRename}>
                    <MenuItemContent>
                        <MenuItemLeft>
                            <PencilOutlineIcon size={18}/>
                            <FormattedMessage
                                defaultMessage='Rename'
                            />
                        </MenuItemLeft>
                    </MenuItemContent>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleEditType}>
                    <MenuItemContent>
                        <MenuItemLeft>
                            <FormatListBulletedIcon size={18}/>
                            <FormattedMessage
                                defaultMessage='Edit attribute type'
                            />
                        </MenuItemLeft>
                    </MenuItemContent>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleDuplicate}>
                    <MenuItemContent>
                        <MenuItemLeft>
                            <ContentCopyIcon size={18}/>
                            <FormattedMessage
                                defaultMessage='Duplicate attribute'
                            />
                        </MenuItemLeft>
                    </MenuItemContent>
                </DropdownMenuItem>
                <DangerDropdownMenuItem onClick={handleDeleteClick}>
                    <MenuItemContent>
                        <MenuItemLeft>
                            <TrashCanOutlineIcon
                                size={18}
                                color='#D24B4E'
                            />
                            <FormattedMessage
                                defaultMessage='Delete attribute'
                            />
                        </MenuItemLeft>
                    </MenuItemContent>
                </DangerDropdownMenuItem>
            </DotMenu>
        </MenuContainer>
    );
};

const MenuContainer = styled.div`
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: flex-end;
`;

const CustomDropdownMenu = styled(DropdownMenu)`
    max-width: 496px;
    min-width: 114px;
`;

const FullWidthActionsButton = styled.button<{$isActive?: boolean}>`
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 12px;
    border: none;
    border-radius: 0;
    background-color: ${(props) => (props.$isActive ? 'rgba(var(--button-bg-rgb), 0.08)' : 'transparent')};
    color: ${(props) => (props.$isActive ? 'var(--button-bg)' : 'rgba(var(--center-channel-color-rgb), 0.56)')};

    &:hover {
        background-color: ${(props) => (props.$isActive ? 'rgba(var(--button-bg-rgb), 0.08)' : 'rgba(var(--center-channel-color-rgb), 0.08)')};
    }
`;

const MenuItemContent = styled.div`
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 32px;
    width: 100%;
`;

const MenuItemLeft = styled.div`
    display: flex;
    align-items: center;
    gap: 8px;
`;

const DangerDropdownMenuItem = styled(DropdownMenuItem)`
    && {
        color: #D24B4E;
    }

    &&:hover {
        color: #D24B4E;
    }
`;

export default PropertyDotMenu;
