// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useIntl} from 'react-intl';

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
    const {formatMessage} = useIntl();
    const untitledText = formatMessage({id: 'wiki.untitled_page', defaultMessage: 'Untitled'});

    return (
        <>
            {/* Delete page modal */}
            {menuHandlers.showDeleteModal && menuHandlers.pageToDelete && (
                <DeletePageModal
                    pageTitle={(menuHandlers.pageToDelete.page.props?.title as string | undefined) || menuHandlers.pageToDelete.page.message || untitledText}
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
                    title={menuHandlers.createPageParent ?
                        formatMessage({id: 'pages_panel.create_child_modal.title', defaultMessage: 'Create Child Page under "{parentTitle}"'}, {parentTitle: menuHandlers.createPageParent.title}) :
                        formatMessage({id: 'pages_panel.create_modal.title', defaultMessage: 'Create New Page'})}
                    fieldLabel={formatMessage({id: 'pages_panel.modal.field_label', defaultMessage: 'Page title'})}
                    placeholder={formatMessage({id: 'pages_panel.modal.placeholder', defaultMessage: 'Enter page title...'})}
                    helpText={menuHandlers.createPageParent ?
                        formatMessage({id: 'pages_panel.create_child_modal.help_text', defaultMessage: 'This page will be created as a child of "{parentTitle}".'}, {parentTitle: menuHandlers.createPageParent.title}) :
                        formatMessage({id: 'pages_panel.create_modal.help_text', defaultMessage: 'A new draft will be created for you to edit.'})}
                    confirmButtonText={formatMessage({id: 'pages_panel.create_modal.confirm', defaultMessage: 'Create'})}
                    maxLength={255}
                    ariaLabel={formatMessage({id: 'pages_panel.create_modal.aria_label', defaultMessage: 'Create Page'})}
                    inputTestId='create-page-modal-title-input'
                    onConfirm={menuHandlers.handleConfirmCreatePage}
                    onCancel={menuHandlers.handleCancelCreatePage}
                    onHide={() => menuHandlers.setShowCreatePageModal(false)}
                />
            )}

            {/* Rename page modal */}
            <TextInputModal
                show={menuHandlers.showRenameModal}
                title={formatMessage({id: 'pages_panel.rename_modal.title', defaultMessage: 'Rename Page'})}
                fieldLabel={formatMessage({id: 'pages_panel.modal.field_label', defaultMessage: 'Page title'})}
                placeholder={formatMessage({id: 'pages_panel.modal.placeholder', defaultMessage: 'Enter page title...'})}
                helpText={formatMessage({id: 'pages_panel.rename_modal.help_text', defaultMessage: 'The page will be renamed immediately.'})}
                confirmButtonText={formatMessage({id: 'pages_panel.rename_modal.confirm', defaultMessage: 'Rename'})}
                maxLength={255}
                initialValue={menuHandlers.pageToRename?.currentTitle || ''}
                ariaLabel={formatMessage({id: 'pages_panel.rename_modal.aria_label', defaultMessage: 'Rename Page'})}
                inputTestId='rename-page-modal-title-input'
                onConfirm={menuHandlers.handleConfirmRename}
                onCancel={menuHandlers.handleCancelRename}
                onHide={() => menuHandlers.setShowRenameModal(false)}
            />

            {/* Version history modal */}
            {versionHistory.show && versionHistory.pageId && (() => {
                const versionHistoryPage = allPages.find((p) => p.id === versionHistory.pageId);
                if (!versionHistoryPage) {
                    return null;
                }
                const pageTitle = (versionHistoryPage.props?.title as string | undefined) || versionHistoryPage.message || untitledText;
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
