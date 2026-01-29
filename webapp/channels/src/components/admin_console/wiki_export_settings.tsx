// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState, useEffect, useRef, useCallback} from 'react';
import type {MessageDescriptor} from 'react-intl';
import {defineMessages, FormattedMessage, useIntl} from 'react-intl';

import {Client4} from 'mattermost-redux/client';

import AdminPanel from 'components/widgets/admin_console/admin_panel';

import {JobTypes} from 'utils/constants';

import JobsTable from './jobs';

interface Props {
    isDisabled?: boolean;
}

const messages = defineMessages({
    title: {id: 'admin.wikiExport.title', defaultMessage: 'Wiki Export'},
    description: {id: 'admin.wikiExport.description', defaultMessage: 'Export wiki pages and comments for backup or migration.'},
    exportButton: {id: 'admin.wikiExport.exportButton', defaultMessage: 'Run Wiki Export Now'},
    exportHelp: {id: 'admin.wikiExport.exportHelp', defaultMessage: 'Initiates a Wiki Export job immediately.'},
    includeAttachments: {id: 'admin.wikiExport.includeAttachments', defaultMessage: 'Include Attachments'},
    includeAttachmentsHelp: {id: 'admin.wikiExport.includeAttachmentsHelp', defaultMessage: 'Include files, images, and videos attached to pages. Creates a ZIP file instead of JSONL.'},
    includeComments: {id: 'admin.wikiExport.includeComments', defaultMessage: 'Include Comments'},
    includeCommentsHelp: {id: 'admin.wikiExport.includeCommentsHelp', defaultMessage: 'Include comments and replies on pages.'},
    importTitle: {id: 'admin.wikiImport.title', defaultMessage: 'Wiki Import'},
    importDescription: {id: 'admin.wikiImport.description', defaultMessage: 'Import wiki pages from a JSONL or ZIP file.'},
    importButton: {id: 'admin.wikiImport.importButton', defaultMessage: 'Run Wiki Import'},
    importHelp: {id: 'admin.wikiImport.importHelp', defaultMessage: 'Import wiki pages from the selected file.'},
    selectFile: {id: 'admin.wikiImport.selectFile', defaultMessage: 'Import File:'},
    selectFilePlaceholder: {id: 'admin.wikiImport.selectFilePlaceholder', defaultMessage: 'Select a file...'},
    noFilesAvailable: {id: 'admin.wikiImport.noFilesAvailable', defaultMessage: 'No import files available. Upload a file or use mmctl.'},
    uploadFile: {id: 'admin.wikiImport.uploadFile', defaultMessage: 'Upload File'},
    uploading: {id: 'admin.wikiImport.uploading', defaultMessage: 'Uploading...'},
    uploadSuccess: {id: 'admin.wikiImport.uploadSuccess', defaultMessage: 'File uploaded successfully'},
    uploadError: {id: 'admin.wikiImport.uploadError', defaultMessage: 'Upload failed: {error}'},
    chooseFile: {id: 'admin.wikiImport.chooseFile', defaultMessage: 'Choose File'},
    loading: {id: 'admin.wikiExport.loading', defaultMessage: 'Loading...'},
    enabled: {id: 'admin.wikiExport.enabled', defaultMessage: 'Enabled'},
    supportedFormats: {id: 'admin.wikiImport.supportedFormats', defaultMessage: 'Supports .jsonl and .zip files'},
});

export const searchableStrings: Array<
string | MessageDescriptor | [MessageDescriptor, { [key: string]: any }]
> = [
    messages.title,
    messages.description,
    messages.exportButton,
    messages.exportHelp,
    messages.includeAttachments,
    messages.includeAttachmentsHelp,
    messages.includeComments,
    messages.includeCommentsHelp,
    messages.importTitle,
    messages.importDescription,
    messages.importButton,
    messages.importHelp,
    messages.selectFile,
    messages.noFilesAvailable,
    messages.uploadFile,
    messages.uploading,
    messages.uploadSuccess,
    messages.uploadError,
    messages.chooseFile,
    messages.loading,
    messages.enabled,
    messages.supportedFormats,
];

const WikiExportSettings: React.FC<Props> = (props: Props) => {
    const {isDisabled = false} = props;
    const {formatMessage} = useIntl();

    // Export options
    const [includeAttachments, setIncludeAttachments] = useState<boolean>(true);
    const [includeComments, setIncludeComments] = useState<boolean>(true);

    // Import state
    const [importFile, setImportFile] = useState<string>('');
    const [availableImports, setAvailableImports] = useState<string[]>([]);
    const [loadingImports, setLoadingImports] = useState<boolean>(true);

    // Upload state
    const [uploading, setUploading] = useState<boolean>(false);
    const [uploadError, setUploadError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const loadImports = useCallback(async () => {
        setLoadingImports(true);
        try {
            const imports = await Client4.listImports();

            // Filter for wiki-compatible files
            const wikiImports = imports.filter((f: string) =>
                f.endsWith('.jsonl') || f.endsWith('.zip'),
            );
            setAvailableImports(wikiImports);
        } catch (err) {
            // Failed to load imports - leave empty
            setAvailableImports([]);
        } finally {
            setLoadingImports(false);
        }
    }, []);

    useEffect(() => {
        loadImports();
    }, [loadImports]);

    const handleImportFileChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        setImportFile(e.target.value);
        setUploadError(null);
    };

    const handleChooseFileClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) {
            return;
        }

        // Validate file extension
        const ext = file.name.toLowerCase();
        if (!ext.endsWith('.jsonl') && !ext.endsWith('.zip')) {
            setUploadError('Invalid file type. Please upload a .jsonl or .zip file.');
            return;
        }

        setUploading(true);
        setUploadError(null);

        try {
            // Create upload session with type="import"
            const session = await Client4.createUploadSession({
                type: 'import',
                filename: file.name,
                file_size: file.size,
            });

            // Upload the file data
            await Client4.uploadData(session.id, file);

            // Refresh the list of available imports
            await loadImports();

            // Select the newly uploaded file
            const uploadedFilename = `${session.id}_${file.name}`;
            setImportFile(uploadedFilename);
        } catch (err: any) {
            const errorMessage = err?.message || 'Unknown error';
            setUploadError(errorMessage);
        } finally {
            setUploading(false);

            // Clear the file input
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        }
    };

    const renderImportFileSelector = () => {
        if (loadingImports) {
            return (
                <p className='help-text'>
                    <i className='fa fa-spinner fa-spin'/>
                    {' '}
                    <FormattedMessage {...messages.loading}/>
                </p>
            );
        }

        if (availableImports.length === 0) {
            return (
                <p className='help-text'>
                    <FormattedMessage {...messages.noFilesAvailable}/>
                </p>
            );
        }

        return (
            <select
                id='importFile'
                className='form-control'
                value={importFile}
                onChange={handleImportFileChange}
                disabled={isDisabled}
            >
                <option value=''>
                    {formatMessage(messages.selectFilePlaceholder)}
                </option>
                {availableImports.map((file) => (
                    <option
                        key={file}
                        value={file}
                    >
                        {file}
                    </option>
                ))}
            </select>
        );
    };

    return (
        <div className='admin-console__wrapper'>
            <div className='admin-console__content'>
                <AdminPanel
                    id='wikiExportPanel'
                    title={messages.title}
                    subtitle={messages.description}
                >
                    <div className='form-group'>
                        <label
                            className='control-label col-sm-4'
                            htmlFor='includeAttachments'
                        >
                            <FormattedMessage {...messages.includeAttachments}/>
                        </label>
                        <div className='col-sm-8'>
                            <label className='radio-inline'>
                                <input
                                    id='includeAttachments'
                                    type='checkbox'
                                    checked={includeAttachments}
                                    onChange={(e) => setIncludeAttachments(e.target.checked)}
                                    disabled={isDisabled}
                                />
                                <span><FormattedMessage {...messages.enabled}/></span>
                            </label>
                            <div className='help-text'>
                                <FormattedMessage {...messages.includeAttachmentsHelp}/>
                            </div>
                        </div>
                    </div>

                    <div className='form-group'>
                        <label
                            className='control-label col-sm-4'
                            htmlFor='includeComments'
                        >
                            <FormattedMessage {...messages.includeComments}/>
                        </label>
                        <div className='col-sm-8'>
                            <label className='radio-inline'>
                                <input
                                    id='includeComments'
                                    type='checkbox'
                                    checked={includeComments}
                                    onChange={(e) => setIncludeComments(e.target.checked)}
                                    disabled={isDisabled}
                                />
                                <span><FormattedMessage {...messages.enabled}/></span>
                            </label>
                            <div className='help-text'>
                                <FormattedMessage {...messages.includeCommentsHelp}/>
                            </div>
                        </div>
                    </div>

                    <JobsTable
                        jobType={JobTypes.WIKI_EXPORT}
                        disabled={isDisabled}
                        jobData={{
                            include_attachments: String(includeAttachments),
                            include_comments: String(includeComments),
                        }}
                        createJobButtonText={
                            <FormattedMessage {...messages.exportButton}/>
                        }
                        createJobHelpText={
                            <FormattedMessage {...messages.exportHelp}/>
                        }
                    />
                </AdminPanel>

                <AdminPanel
                    id='wikiImportPanel'
                    title={messages.importTitle}
                    subtitle={messages.importDescription}
                >
                    {/* File Upload Section */}
                    <div className='form-group'>
                        <label
                            className='control-label col-sm-4'
                            htmlFor='uploadFileButton'
                        >
                            <FormattedMessage {...messages.uploadFile}/>
                        </label>
                        <div className='col-sm-8'>
                            <div className='file__upload'>
                                <button
                                    id='uploadFileButton'
                                    type='button'
                                    className='btn btn-tertiary'
                                    disabled={isDisabled || uploading}
                                    onClick={handleChooseFileClick}
                                >
                                    {uploading ? (
                                        <>
                                            <span className='fa fa-spinner fa-spin'/>
                                            {' '}
                                            <FormattedMessage {...messages.uploading}/>
                                        </>
                                    ) : (
                                        <FormattedMessage {...messages.chooseFile}/>
                                    )}
                                </button>
                                <input
                                    ref={fileInputRef}
                                    type='file'
                                    accept='.jsonl,.zip'
                                    onChange={handleFileInputChange}
                                    disabled={isDisabled || uploading}
                                    style={{display: 'none'}}
                                />
                            </div>
                            <p className='help-text'>
                                <FormattedMessage {...messages.supportedFormats}/>
                            </p>
                            {uploadError && (
                                <div className='has-error'>
                                    <span className='control-label'>
                                        {uploadError}
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* File Selection Section */}
                    <div className='form-group'>
                        <label
                            className='control-label col-sm-4'
                            htmlFor='importFile'
                        >
                            <FormattedMessage {...messages.selectFile}/>
                        </label>
                        <div className='col-sm-8'>
                            {renderImportFileSelector()}
                        </div>
                    </div>

                    <JobsTable
                        jobType={JobTypes.WIKI_IMPORT}
                        disabled={isDisabled || !importFile}
                        jobData={{
                            import_file: importFile,
                        }}
                        createJobButtonText={
                            <FormattedMessage {...messages.importButton}/>
                        }
                        createJobHelpText={
                            <FormattedMessage {...messages.importHelp}/>
                        }
                    />
                </AdminPanel>
            </div>
        </div>
    );
};

export default WikiExportSettings;
