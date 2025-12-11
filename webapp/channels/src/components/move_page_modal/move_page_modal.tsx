// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useIntl} from 'react-intl';

import type {Post} from '@mattermost/types/posts';
import type {Wiki} from '@mattermost/types/wikis';

import PageDestinationModal from 'components/page_destination_modal';

type Props = {
    pageId: string;
    pageTitle: string;
    currentWikiId: string;
    availableWikis: Wiki[];
    fetchPagesForWiki: (wikiId: string) => Promise<Post[]>;
    hasChildren: boolean;
    onConfirm: (targetWikiId: string, parentPageId?: string) => void;
    onCancel: () => void;
};

const MovePageModal = (props: Props) => {
    const {formatMessage} = useIntl();

    const helpText = (selectedWiki: string, currentWiki: string) => {
        if (selectedWiki === currentWiki) {
            return formatMessage({id: 'move_page_modal.help_text_same_wiki', defaultMessage: 'Moving within the same wiki allows you to reorganize the hierarchy.'});
        }
        return formatMessage({id: 'move_page_modal.help_text_different_wiki', defaultMessage: 'The page and all child pages will be moved to the selected wiki.'});
    };

    const childrenWarning = props.hasChildren ?
        formatMessage({id: 'move_page_modal.children_warning', defaultMessage: 'This page has child pages. All child pages will be moved with this page to maintain the hierarchy.'}) :
        undefined;

    return (
        <PageDestinationModal
            {...props}
            modalHeaderText={formatMessage({id: 'move_page_modal.title', defaultMessage: 'Move Page to Wiki'})}
            confirmButtonText={formatMessage({id: 'move_page_modal.confirm', defaultMessage: 'Move'})}
            helpText={helpText}
            childrenWarningText={childrenWarning}
            confirmButtonTestId='confirm-button'
        />
    );
};

export default MovePageModal;
