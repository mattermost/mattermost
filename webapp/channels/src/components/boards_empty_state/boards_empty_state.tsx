// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useIntl} from 'react-intl';
import {useSelector} from 'react-redux';
import {Redirect} from 'react-router-dom';

import {PlusIcon, ProductBoardsIcon} from '@mattermost/compass-icons/components';
import {Button} from '@mattermost/compass-ui/components/button';
import {Icon} from '@mattermost/compass-ui/components/icon';

import Permissions from 'mattermost-redux/constants/permissions';
import {haveICurrentChannelPermission} from 'mattermost-redux/selectors/entities/roles';
import {getCurrentTeam} from 'mattermost-redux/selectors/entities/teams';

import {getBoardCreateMenuItems, getFirstBoardInCurrentTeam, hasBoardChannelKind} from 'selectors/views/product_rail';

import type {GlobalState} from 'types/store';

import './boards_empty_state.scss';

/**
 * The center of the Boards rail item while the team has no boards the user is a member of: what
 * boards are, and a way to create one through the board plugin's own "Create new board" item.
 * Once there's a board to open, or no plugin registers boards, it sends the user on.
 */
export default function BoardsEmptyState() {
    const {formatMessage} = useIntl();
    const currentTeam = useSelector(getCurrentTeam);
    const hasBoards = useSelector(hasBoardChannelKind);
    const firstBoard = useSelector(getFirstBoardInCurrentTeam);
    const createItems = useSelector(getBoardCreateMenuItems);
    const canCreatePublicChannel = useSelector((state: GlobalState) => haveICurrentChannelPermission(state, Permissions.CREATE_PUBLIC_CHANNEL));
    const canCreatePrivateChannel = useSelector((state: GlobalState) => haveICurrentChannelPermission(state, Permissions.CREATE_PRIVATE_CHANNEL));

    if (!currentTeam) {
        return null;
    }
    if (!hasBoards) {
        return <Redirect to={`/${currentTeam.name}`}/>;
    }
    if (firstBoard) {
        return <Redirect to={`/${currentTeam.name}/channels/${firstBoard.name}`}/>;
    }

    const createItem = (canCreatePublicChannel || canCreatePrivateChannel) ? createItems[0] : undefined;

    return (
        <div
            id='app-content'
            className='BoardsEmptyState app__content'
        >
            <div className='BoardsEmptyState__body'>
                <div className='BoardsEmptyState__icon'>
                    <ProductBoardsIcon size={40}/>
                </div>
                <h2 className='BoardsEmptyState__title'>
                    {formatMessage({id: 'boards_empty_state.title', defaultMessage: 'Plan and track work with boards'})}
                </h2>
                <p className='BoardsEmptyState__description'>
                    {formatMessage({
                        id: 'boards_empty_state.description',
                        defaultMessage: 'Boards organize work as cards that you can group, filter and assign. Each board has its own members, and every card has a thread for discussing it.',
                    })}
                </p>
                {createItem && (
                    <Button
                        emphasis='primary'
                        leadingIcon={<Icon glyph={<PlusIcon/>}/>}
                        onClick={() => createItem.action(currentTeam.id)}
                    >
                        {formatMessage({id: 'boards_empty_state.create', defaultMessage: 'Create a board'})}
                    </Button>
                )}
            </div>
        </div>
    );
}
