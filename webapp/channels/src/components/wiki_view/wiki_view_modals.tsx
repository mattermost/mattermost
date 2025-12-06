// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {Post} from '@mattermost/types/posts';

import ConflictWarningModal from 'components/conflict_warning_modal';
import ConfirmOverwriteModal from 'components/conflict_warning_modal/confirm_overwrite_modal';
import DeletePageModal from 'components/delete_page_modal';
import MovePageModal from 'components/move_page_modal';
import PageVersionHistoryModal from 'components/page_version_history';
import type {usePageMenuHandlers} from 'components/pages_hierarchy_panel/hooks/usePageMenuHandlers';
import TextInputModal from 'components/text_input_modal';

type MenuHandlers = ReturnType<typeof usePageMenuHandlers>;

type ConflictModalProps = {
    show: boolean;
    currentPage: Post | null;
    draftContent: string;
    onViewChanges: () => void;
    onCopyContent: () => void;
    onOverwrite: () => void;
    onCancel: () => void;
};

type ConfirmOverwriteModalProps = {
    show: boolean;
    currentPage: Post | null;
    onConfirm: () => void;
    onCancel: () => void;
};

type VersionHistoryState = {
    show: boolean;
    pageId: string | null;
};

type WikiViewModalsProps = {
    wikiId: string;
    allPages: Post[];
    menuHandlers: MenuHandlers;
    versionHistory: VersionHistoryState;
    onCloseVersionHistory: () => void;
    conflictModal: ConflictModalProps;
    confirmOverwriteModal: ConfirmOverwriteModalProps;
};

const WikiViewModals: React.FC<WikiViewModalsProps> = ({
    wikiId,
    allPages,
    menuHandlers,
    versionHistory,
    onCloseVersionHistory,
    conflictModal,
    confirmOverwriteModal,
}) => {
    return (
        <>
            {/* Delete page modal */}
            {menuHandlers.showDeleteModal && menuHandlers.pageToDelete && (
                <DeletePageModal
                    pageTitle={(menuHandlers.pageToDelete.page.props?.title as string | undefined) || menuHandlers.pageToDelete.page.message || 'Untitled'}
                    childCount={menuHandlers.pageToDelete.childCount}
                    onConfirm={menuHandlers.handleDeleteConfirm}
                    onCancel={menuHandlers.handleDeleteCancel}
                />
            )}

            {/* Move page modal */}
            {menuHandlers.showMoveModal && menuHandlers.pageToMove && (
                <MovePageModal
                    pageId={menuHandlers.pageToMove.pageId}
                    pageTitle={menuHandlers.pageToMove.pageTitle}
                    currentWikiId={wikiId}
                    availableWikis={menuHandlers.availableWikis}
                    fetchPagesForWiki={menuHandlers.fetchPagesForWiki}
                    hasChildren={menuHandlers.pageToMove.hasChildren}
                    onConfirm={menuHandlers.handleMoveConfirm}
                    onCancel={menuHandlers.handleMoveCancel}
                />
            )}

            {/* Create page modal */}
            {menuHandlers.showCreatePageModal && (
                <TextInputModal
                    show={menuHandlers.showCreatePageModal}
                    title={menuHandlers.createPageParent ? `Create Child Page under "${menuHandlers.createPageParent.title}"` : 'Create New Page'}
                    fieldLabel='Page title'
                    placeholder='Enter page title...'
                    helpText={menuHandlers.createPageParent ? `This page will be created as a child of "${menuHandlers.createPageParent.title}".` : 'A new draft will be created for you to edit.'}
                    confirmButtonText='Create'
                    maxLength={255}
                    ariaLabel='Create Page'
                    inputTestId='create-page-modal-title-input'
                    onConfirm={menuHandlers.handleConfirmCreatePage}
                    onCancel={menuHandlers.handleCancelCreatePage}
                    onHide={() => menuHandlers.setShowCreatePageModal(false)}
                />
            )}

            {/* Version history modal */}
            {versionHistory.show && versionHistory.pageId && (() => {
                const versionHistoryPage = allPages.find((p) => p.id === versionHistory.pageId);
                if (!versionHistoryPage) {
                    return null;
                }
                const pageTitle = (versionHistoryPage.props?.title as string | undefined) || versionHistoryPage.message || 'Untitled';
                return (
                    <PageVersionHistoryModal
                        page={versionHistoryPage}
                        pageTitle={pageTitle}
                        wikiId={wikiId}
                        onClose={onCloseVersionHistory}
                        onVersionRestored={onCloseVersionHistory}
                    />
                );
            })()}

            {/* Conflict warning modal */}
            {conflictModal.show && conflictModal.currentPage && (
                <ConflictWarningModal
                    show={conflictModal.show}
                    currentPage={conflictModal.currentPage}
                    draftContent={conflictModal.draftContent}
                    onViewChanges={conflictModal.onViewChanges}
                    onCopyContent={conflictModal.onCopyContent}
                    onOverwrite={conflictModal.onOverwrite}
                    onCancel={conflictModal.onCancel}
                />
            )}

            {/* Confirm overwrite modal */}
            {confirmOverwriteModal.show && confirmOverwriteModal.currentPage && (
                <ConfirmOverwriteModal
                    show={confirmOverwriteModal.show}
                    currentPage={confirmOverwriteModal.currentPage}
                    onConfirm={confirmOverwriteModal.onConfirm}
                    onCancel={confirmOverwriteModal.onCancel}
                />
            )}
        </>
    );
};

export default WikiViewModals;
