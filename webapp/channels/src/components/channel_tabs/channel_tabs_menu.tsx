// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {memo, useCallback} from 'react';
import {useIntl} from 'react-intl';
import {useDispatch} from 'react-redux';
import styled, {css} from 'styled-components';

import {
    LinkVariantIcon,
    PaperclipIcon,
    PlusIcon,
} from '@mattermost/compass-icons/components';
import type {ChannelTabCreate} from '@mattermost/types/channel_tabs';

import {createTab} from 'actions/channel_tabs';
import {openModal} from 'actions/views/modals';

import * as Menu from 'components/menu';

import {ModalIdentifiers} from 'utils/constants';

import ChannelTabCreateModal from './channel_tabs_create_modal';
import {MAX_TABS_PER_CHANNEL, useChannelTabPermission} from './utils';

type TabsMenuProps = {
    channelId: string;
    hasTabs: boolean;
    limitReached: boolean;
    canUploadFiles: boolean;};
function TabsMenu({
    channelId,
    hasTabs,
    limitReached,
    canUploadFiles,
}: TabsMenuProps) {
    const {formatMessage} = useIntl();
    const showLabel = !hasTabs;

    const {handleCreateLink, handleCreateFile} = useTabAddActions(channelId);
    const canAdd = useChannelTabPermission(channelId, 'add');

    const addTabLabel = formatMessage({id: 'channel_bookmarks.addBookmark', defaultMessage: 'Add a tab'});

    const addTabLimitReached = formatMessage({id: 'channel_bookmarks.addBookmarkLimitReached', defaultMessage: 'Cannot add more than {limit} tabs'}, {limit: MAX_TABS_PER_CHANNEL});
    let addTabTooltipText;

    if (limitReached) {
        addTabTooltipText = addTabLimitReached;
    } else if (hasTabs) {
        addTabTooltipText = addTabLabel;
    }

    const addLinkLabel = formatMessage({id: 'channel_bookmarks.addLink', defaultMessage: 'Add a link'});
    const attachFileLabel = formatMessage({id: 'channel_bookmarks.attachFile', defaultMessage: 'Attach a file'});

    if (!canAdd) {
        return null;
    }

    return (
        <MenuButtonContainer
            withLabel={showLabel}
        >
            <Menu.Container
                anchorOrigin={{vertical: 'bottom', horizontal: 'left'}}
                transformOrigin={{vertical: 'top', horizontal: 'left'}}
                menuButton={{
                    id: 'channelTabsPlusMenuButton',
                    class: classNames('channelTabsMenuButton', {withLabel: showLabel, disabled: limitReached}),
                    children: (
                        <>
                            <PlusIcon size={showLabel ? 16 : 18}/>
                            {showLabel && <span>{addTabLabel}</span>}
                        </>
                    ),
                    'aria-label': addTabLabel,
                    disabled: limitReached,
                }}
                menu={{
                    id: 'channelTabsPlusMenuDropdown',
                }}
                menuButtonTooltip={addTabTooltipText ? {
                    text: addTabTooltipText,
                } : undefined}
            >
                <Menu.Item
                    key='channelTabsAddLink'
                    id='channelTabsAddLink'
                    onClick={handleCreateLink}
                    leadingElement={<LinkVariantIcon size={18}/>}
                    labels={<span>{addLinkLabel}</span>}
                />
                {canUploadFiles && (
                    <Menu.Item
                        key='channelTabsAttachFile'
                        id='channelTabsAttachFile'
                        onClick={handleCreateFile}
                        leadingElement={<PaperclipIcon size={18}/>}
                        labels={<span>{attachFileLabel}</span>}
                    />
                )}
            </Menu.Container>
        </MenuButtonContainer>
    );
}

export default memo(TabsMenu);

const MenuButtonContainer = styled.div<{withLabel: boolean}>`
    position: sticky;
    right: 0;
    ${({withLabel}) => !withLabel && css`padding: 0 1rem;`}
    background: linear-gradient(to right, rgba(var(--center-channel-bg-rgb), .16), rgba(var(--center-channel-bg-rgb), 1) 25%);
`;

export const useTabAddActions = (channelId: string) => {
    const dispatch = useDispatch();

    const handleCreate = useCallback((file?: File) => {
        dispatch(openModal({
            modalId: ModalIdentifiers.CHANNEL_TAB_CREATE,
            dialogType: ChannelTabCreateModal,
            dialogProps: {
                channelId,
                tabType: file ? 'file' : 'link',
                file,
                onConfirm: async (data: ChannelTabCreate) => dispatch(createTab(channelId, data)),
            },
        }));
    }, [channelId, dispatch]);

    const handleCreateLink = useCallback(() => {
        handleCreate();
    }, [handleCreate]);

    const handleCreateFile = useCallback(() => {
        const input: HTMLInputElement = document.createElement('input');
        input.type = 'file';
        input.id = 'tab-create-file-input';
        input.hidden = true;

        input.addEventListener('change', () => {
            const file = input.files?.[0];
            if (file) {
                handleCreate(file);
            }
            input.remove();
        });
        input.addEventListener('cancel', input.remove);

        document.getElementById('root-portal')?.appendChild(input);

        input.click();
    }, [handleCreate]);

    return {handleCreateLink, handleCreateFile};
};
