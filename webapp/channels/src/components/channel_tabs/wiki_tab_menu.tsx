// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback} from 'react';
import {useIntl} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';
import {useHistory, useRouteMatch} from 'react-router-dom';

import {
    DotsHorizontalIcon,
    PencilOutlineIcon,
    TrashCanOutlineIcon,
    LinkVariantIcon,
    ArrowRightIcon,
} from '@mattermost/compass-icons/components';
import type {Wiki} from '@mattermost/types/wikis';

import {getCurrentTeam, getCurrentRelativeTeamUrl} from 'mattermost-redux/selectors/entities/teams';

import {updateWiki, deleteWiki, moveWikiToChannel} from 'actions/pages';
import {openModal} from 'actions/views/modals';

import * as Menu from 'components/menu';
import MoveWikiModal from 'components/move_wiki_modal';
import TextInputModal from 'components/text_input_modal';
import WikiDeleteModal from 'components/wiki_delete_modal';

import {ModalIdentifiers} from 'utils/constants';
import {getWikiUrl, getSiteURL} from 'utils/url';
import {copyToClipboard} from 'utils/utils';

import type {GlobalState} from 'types/store';

type Props = {
    wiki: Wiki;
    channelId: string;
};

function WikiTabMenu({wiki, channelId}: Props) {
    const {formatMessage} = useIntl();
    const dispatch = useDispatch();
    const history = useHistory();
    const currentTeam = useSelector(getCurrentTeam);
    const teamName = currentTeam?.name || 'team';
    const teamUrl = useSelector((state: GlobalState) =>
        getCurrentRelativeTeamUrl(state),
    );

    const match = useRouteMatch<{wikiId: string}>(`${teamUrl}/wiki/:channelId/:wikiId/*`);
    const isViewingThisWiki = match?.params.wikiId === wiki.id;

    const renameLabel = formatMessage({id: 'wiki_tab.rename', defaultMessage: 'Rename'});
    const moveLabel = formatMessage({id: 'wiki_tab.move', defaultMessage: 'Move wiki'});
    const deleteLabel = formatMessage({id: 'wiki_tab.delete', defaultMessage: 'Delete'});
    const copyLinkLabel = formatMessage({id: 'wiki_tab.copy_link', defaultMessage: 'Copy link'});

    const handleRename = useCallback(() => {
        dispatch(openModal({
            modalId: ModalIdentifiers.WIKI_RENAME,
            dialogType: TextInputModal,
            dialogProps: {
                modalId: ModalIdentifiers.WIKI_RENAME,
                title: formatMessage({id: 'wiki_tab.rename_modal_title', defaultMessage: 'Rename wiki'}),
                placeholder: formatMessage({id: 'wiki_tab.rename_modal_placeholder', defaultMessage: 'Enter wiki name'}),
                confirmButtonText: formatMessage({id: 'wiki_tab.rename_modal_confirm', defaultMessage: 'Rename'}),
                initialValue: wiki.title,
                onConfirm: async (newTitle: string) => {
                    await dispatch(updateWiki(wiki.id, {title: newTitle}));
                },
                onCancel: () => {},
            },
        }));
    }, [dispatch, formatMessage, wiki.id, wiki.title]);

    const handleDelete = useCallback(() => {
        dispatch(openModal({
            modalId: ModalIdentifiers.WIKI_DELETE,
            dialogType: WikiDeleteModal,
            dialogProps: {
                wikiTitle: wiki.title,
                onConfirm: async () => {
                    await dispatch(deleteWiki(wiki.id));

                    if (isViewingThisWiki && currentTeam) {
                        history.push(`${teamUrl}/channels/${channelId}`);
                    }
                },
            },
        }));
    }, [dispatch, wiki.id, wiki.title, isViewingThisWiki, currentTeam, history, teamUrl, channelId]);

    const handleCopyLink = useCallback(() => {
        const wikiUrl = `${getSiteURL()}${getWikiUrl(teamName, channelId, wiki.id)}`;
        copyToClipboard(wikiUrl);
    }, [teamName, channelId, wiki.id]);

    const handleMove = useCallback(() => {
        dispatch(openModal({
            modalId: ModalIdentifiers.WIKI_MOVE,
            dialogType: MoveWikiModal,
            dialogProps: {
                wikiTitle: wiki.title,
                currentChannelId: channelId,
                onConfirm: async (targetChannelId: string) => {
                    await dispatch(moveWikiToChannel(wiki.id, targetChannelId));

                    if (isViewingThisWiki && currentTeam) {
                        history.push(`${teamUrl}/channels/${channelId}`);
                    }
                },
                onExited: () => {},
            },
        }));
    }, [dispatch, wiki.id, wiki.title, channelId, isViewingThisWiki, currentTeam, history, teamUrl]);

    return (
        <div
            className='wiki-tab__menu'
            onClick={(e) => e.stopPropagation()}
        >
            <Menu.Container
                anchorOrigin={{vertical: 'bottom', horizontal: 'left'}}
                transformOrigin={{vertical: 'top', horizontal: 'left'}}
                menuButton={{
                    id: `wiki-tab-menu-${wiki.id}`,
                    class: 'wiki-tab__menu-button',
                    children: <DotsHorizontalIcon size={16}/>,
                    'aria-label': formatMessage({id: 'wiki_tab.menu_label', defaultMessage: 'Wiki options'}),
                }}
                menu={{
                    id: `wiki-tab-menu-dropdown-${wiki.id}`,
                }}
            >
                <Menu.Item
                    key='wiki-tab-rename'
                    id='wiki-tab-rename'
                    onClick={handleRename}
                    leadingElement={<PencilOutlineIcon size={18}/>}
                    labels={<span>{renameLabel}</span>}
                    aria-label={renameLabel}
                />
                <Menu.Item
                    key='wiki-tab-copy-link'
                    id='wiki-tab-copy-link'
                    onClick={handleCopyLink}
                    leadingElement={<LinkVariantIcon size={18}/>}
                    labels={<span>{copyLinkLabel}</span>}
                    aria-label={copyLinkLabel}
                />
                <Menu.Item
                    key='wiki-tab-move'
                    id='wiki-tab-move'
                    onClick={handleMove}
                    leadingElement={<ArrowRightIcon size={18}/>}
                    labels={<span>{moveLabel}</span>}
                    aria-label={moveLabel}
                />
                <Menu.Item
                    key='wiki-tab-delete'
                    id='wiki-tab-delete'
                    onClick={handleDelete}
                    leadingElement={<TrashCanOutlineIcon size={18}/>}
                    labels={<span>{deleteLabel}</span>}
                    aria-label={deleteLabel}
                    isDestructive={true}
                />
            </Menu.Container>
        </div>
    );
}

export default WikiTabMenu;
