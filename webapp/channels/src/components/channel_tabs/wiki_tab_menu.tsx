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
    LinkVariantOffIcon,
} from '@mattermost/compass-icons/components';
import type {Wiki} from '@mattermost/types/wikis';

import {updateWiki as updateWikiMattermost} from 'mattermost-redux/actions/wikis';
import {getCurrentTeam, getCurrentRelativeTeamUrl} from 'mattermost-redux/selectors/entities/teams';
import type {ActionResult} from 'mattermost-redux/types/actions';

import {deleteWiki} from 'actions/pages';
import {openModal} from 'actions/views/modals';
import {unlinkWikiFromChannel} from 'actions/wiki_actions';

import * as Menu from 'components/menu';
import TextInputModal from 'components/text_input_modal';
import WikiDeleteModal from 'components/wiki_delete_modal';
import WikiUnlinkModal from 'components/wiki_unlink_modal';

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

    const match = useRouteMatch<{wikiId: string}>(`${teamUrl}/wiki/:wikiId/*`);
    const isViewingThisWiki = match?.params.wikiId === wiki.id;

    const renameLabel = formatMessage({id: 'wiki_tab.rename', defaultMessage: 'Rename'});
    const deleteLabel = formatMessage({id: 'wiki_tab.delete', defaultMessage: 'Delete'});
    const copyLinkLabel = formatMessage({id: 'wiki_tab.copy_link', defaultMessage: 'Copy link'});
    const unlinkLabel = formatMessage({id: 'wiki_tab.unlink', defaultMessage: 'Remove from channel'});

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
                    const result = await dispatch(updateWikiMattermost({
                        ...wiki,
                        title: newTitle,
                    })) as ActionResult;
                    if (result?.error) {
                        throw new Error(String(result.error));
                    }
                },
                onCancel: () => {},
            },
        }));
    }, [dispatch, formatMessage, wiki]);

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
        const wikiUrl = `${getSiteURL()}${getWikiUrl(teamName, wiki.id)}`;
        copyToClipboard(wikiUrl);
    }, [teamName, wiki.id]);

    const handleUnlink = useCallback(() => {
        dispatch(openModal({
            modalId: ModalIdentifiers.WIKI_UNLINK,
            dialogType: WikiUnlinkModal,
            dialogProps: {
                wikiTitle: wiki.title,
                onConfirm: async () => {
                    const result = await dispatch(unlinkWikiFromChannel(channelId, wiki.id)) as ActionResult;
                    if (result?.error) {
                        throw new Error(String(result.error));
                    }
                    if (isViewingThisWiki && currentTeam) {
                        history.push(`${teamUrl}/channels/${channelId}`);
                    }
                },
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
                    key='wiki-tab-unlink'
                    id='wiki-tab-unlink'
                    onClick={handleUnlink}
                    leadingElement={<LinkVariantOffIcon size={18}/>}
                    labels={<span>{unlinkLabel}</span>}
                    aria-label={unlinkLabel}
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
