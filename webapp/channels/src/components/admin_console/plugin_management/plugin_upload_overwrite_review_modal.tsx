// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import ConfirmModal from 'components/confirm_modal';

import PluginMetadataPanel, {formatPluginVersion} from '../plugin_metadata_panel/plugin_metadata_panel';

export type PluginInstallVersionDirection = 'upgrade' | 'downgrade' | 'same' | 'unknown';

// Mirrors model.PluginInstallConflict on the server, delivered in AppError.detailed_error.
export type PluginInstallConflict = {
    plugin_id?: string;
    plugin_name?: string;
    homepage_url?: string;
    existing_version?: string;
    uploaded_version?: string;
    version_direction?: PluginInstallVersionDirection;
};

type Props = {
    show: boolean;
    conflict: PluginInstallConflict | null;
    onConfirm: () => void;
    onCancel: () => void;
};

const renderReviewMessage = (conflict: PluginInstallConflict | null) => {
    if (!conflict) {
        return null;
    }

    const existingVersion = conflict.existing_version || '';
    const uploadedVersion = conflict.uploaded_version || '';
    const displayExistingVersion = formatPluginVersion(existingVersion) || (
        <FormattedMessage
            id='admin.plugin.upload.overwrite_review.version_unknown'
            defaultMessage='Unknown'
        />
    );
    const displayUploadedVersion = formatPluginVersion(uploadedVersion) || (
        <FormattedMessage
            id='admin.plugin.upload.overwrite_review.version_unknown'
            defaultMessage='Unknown'
        />
    );
    const direction = conflict.version_direction || 'unknown';
    const directionClassName = `PluginUploadOverwriteReview--${direction}`;

    let warningCopy = (
        <FormattedMessage
            id='admin.plugin.upload.overwrite_review.unknown'
            defaultMessage='Review the uploaded plugin before overwriting the existing installation. The server could not compare these plugin versions.'
        />
    );
    if (direction === 'upgrade') {
        warningCopy = (
            <FormattedMessage
                id='admin.plugin.upload.overwrite_review.upgrade'
                defaultMessage='This upload upgrades the existing plugin.'
            />
        );
    } else if (direction === 'same') {
        warningCopy = (
            <FormattedMessage
                id='admin.plugin.upload.overwrite_review.same'
                defaultMessage='This upload has the same version as the existing plugin.'
            />
        );
    } else if (direction === 'downgrade') {
        warningCopy = (
            <FormattedMessage
                id='admin.plugin.upload.overwrite_review.downgrade'
                defaultMessage='This upload downgrades the existing plugin. Downgrades can remove fixes or features.'
            />
        );
    }

    const plugin = conflict.plugin_id ? (
        <PluginMetadataPanel
            name={conflict.plugin_name || conflict.plugin_id}
            id={conflict.plugin_id}
            version=''
            homepageUrl={conflict.homepage_url}
        />
    ) : null;

    return (
        <div
            className={`PluginUploadOverwriteReview ${directionClassName}`}
            data-testid='plugin-upload-overwrite-review'
        >
            <p className='PluginUploadOverwriteReview__message'>
                {warningCopy}
            </p>
            <dl className='PluginUploadOverwriteReview__details'>
                {plugin && (
                    <>
                        <dt>
                            <FormattedMessage
                                id='admin.plugin.upload.overwrite_review.plugin'
                                defaultMessage='Plugin'
                            />
                        </dt>
                        <dd>{plugin}</dd>
                    </>
                )}
                <dt>
                    <FormattedMessage
                        id='admin.plugin.upload.overwrite_review.version_change'
                        defaultMessage='Version change'
                    />
                </dt>
                <dd>
                    {displayExistingVersion}
                    {' → '}
                    {displayUploadedVersion}
                </dd>
            </dl>
        </div>
    );
};

export default function PluginUploadOverwriteReviewModal({show, conflict, onConfirm, onCancel}: Props) {
    const direction = conflict?.version_direction || 'unknown';
    const title = (
        <FormattedMessage
            id='admin.plugin.upload.overwrite_review.title'
            defaultMessage='Review plugin overwrite'
        />
    );
    const overwriteButton = (
        <FormattedMessage
            id='admin.plugin.upload.overwrite_review.overwrite'
            defaultMessage='Overwrite'
        />
    );

    return (
        <ConfirmModal
            show={show}
            title={title}
            message={renderReviewMessage(conflict)}
            confirmButtonVariant={direction === 'downgrade' ? 'destructive' : undefined}
            confirmButtonText={overwriteButton}
            onConfirm={onConfirm}
            onCancel={onCancel}
        />
    );
}
