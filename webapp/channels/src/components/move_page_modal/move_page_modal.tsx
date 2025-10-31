// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

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
    const helpText = (selectedWiki: string, currentWiki: string) => {
        if (selectedWiki === currentWiki) {
            return 'Moving within the same wiki allows you to reorganize the hierarchy.';
        }
        return 'The page and all child pages will be moved to the selected wiki.';
    };

    const childrenWarning = props.hasChildren ? 'This page has child pages. All child pages will be moved with this page to maintain the hierarchy.' : undefined;

    return (
        <PageDestinationModal
            {...props}
            modalHeaderText='Move Page to Wiki'
            confirmButtonText='Move'
            helpText={helpText}
            childrenWarningText={childrenWarning}
        />
    );
};

export default MovePageModal;
