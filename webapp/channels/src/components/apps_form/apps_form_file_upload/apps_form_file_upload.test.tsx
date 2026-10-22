// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {FileInfo} from '@mattermost/types/files';
import {MaxDialogFileIds} from '@mattermost/types/integrations';

import {renderWithContext, screen, fireEvent, waitFor, act} from 'tests/react_testing_utils';

import AppsFormFileUpload from './apps_form_file_upload';
import type {Props} from './apps_form_file_upload';

// ---- Mocks ----

let mockIdCounter = 0;
jest.mock('utils/utils', () => ({
    generateId: () => `stable-id-${mockIdCounter++}`,
}));

const mockUploadFile = jest.fn();
jest.mock('actions/file_actions', () => ({
    uploadFile: (params: any) => {
        mockUploadFile(params);
        return () => {};
    },
}));

const mockGetFileInfo = jest.fn();
jest.mock('mattermost-redux/client', () => ({
    Client4: {
        getFileInfo: (...args: any[]) => mockGetFileInfo(...args),
    },
}));

const mockLogError = jest.fn();
jest.mock('mattermost-redux/actions/errors', () => ({
    logError: (err: any) => {
        mockLogError(err);
        return {type: 'LOG_ERROR'};
    },
}));

jest.mock('mattermost-redux/selectors/entities/channels', () => ({
    getCurrentChannelId: () => 'channel-id-1',
}));

// Mock sub-components to avoid deep rendering
jest.mock('components/file_preview', () => {
    return function MockFilePreview(props: any) {
        return (
            <div data-testid='file-preview'>
                {props.fileInfos?.map((fi: any) => (
                    <div
                        key={fi.id}
                        data-testid={`file-preview-item-${fi.id}`}
                    >
                        <span>{fi.name}</span>
                        <button
                            data-testid={`remove-file-${fi.id}`}
                            onClick={() => props.onRemove?.(fi.id)}
                        >
                            {'Remove'}
                        </button>
                    </div>
                ))}
            </div>
        );
    };
});

jest.mock('components/file_preview/file_progress_preview', () => {
    return function MockFileProgressPreview(props: any) {
        return (
            <div data-testid={`file-progress-${props.clientId}`}>
                <span>{props.fileInfo?.name}</span>
                <span data-testid={`progress-percent-${props.clientId}`}>{props.fileInfo?.percent}{'%'}</span>
                <button
                    data-testid={`remove-progress-${props.clientId}`}
                    onClick={() => props.handleRemove(props.clientId)}
                >
                    {'Remove'}
                </button>
            </div>
        );
    };
});

// ---- Helpers ----

function makeFileInfo(overrides: Partial<FileInfo> = {}): FileInfo {
    return {
        id: 'file-info-1',
        user_id: 'user-1',
        post_id: 'post-1',
        channel_id: 'channel-id-1',
        create_at: 1000,
        update_at: 1000,
        delete_at: 0,
        name: 'test-file.png',
        extension: 'png',
        size: 1024,
        mime_type: 'image/png',
        mini_preview: null,
        width: 0,
        height: 0,
        has_preview_image: false,
        clientId: '',
        archived: false,
        ...overrides,
    } as FileInfo;
}

function makeFile(name = 'test-file.png', type = 'image/png'): File {
    return new File(['file-content'], name, {type});
}

function createFileList(files: File[]): FileList {
    const fileList = {
        length: files.length,
        item: (index: number) => files[index] || null,
    } as FileList;
    files.forEach((file, i) => {
        (fileList as any)[i] = file;
    });
    return fileList;
}

const baseProps: Props = {
    id: 'file-upload-1',
    label: 'Upload a file',
    onFileSelected: jest.fn(),
    onPendingChange: jest.fn(),
};

function renderComponent(overrides: Partial<Props> = {}) {
    const props = {...baseProps, ...overrides};
    return renderWithContext(<AppsFormFileUpload {...props}/>);
}

// Simulate a file selection on the hidden input
function selectFiles(container: HTMLElement, files: File[]) {
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const fileList = createFileList(files);
    Object.defineProperty(input, 'files', {value: fileList, configurable: true});
    fireEvent.change(input);
}

// Extract the callbacks from the most recent mockUploadFile call
function getUploadCallbacks(callIndex = 0) {
    const call = mockUploadFile.mock.calls[callIndex]?.[0];
    return {
        onProgress: call?.onProgress as (info: any) => void,
        onSuccess: call?.onSuccess as (response: any) => void,
        onError: call?.onError as (err: any) => void,
        clientId: call?.clientId as string,
        name: call?.name as string,
    };
}

// ---- Tests ----

describe('components/apps_form/apps_form_file_upload/AppsFormFileUpload', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockIdCounter = 0;
    });

    describe('happy path', () => {
        it('renders label and Choose File button', () => {
            renderComponent();

            expect(screen.getByText('Upload a file')).toBeVisible();
            expect(screen.getByRole('button', {name: /choose file/i})).toBeVisible();
        });

        it('file selection triggers upload and shows progress', () => {
            const {container} = renderComponent();
            const file = makeFile();

            selectFiles(container, [file]);

            expect(mockUploadFile).toHaveBeenCalledTimes(1);
            expect(mockUploadFile).toHaveBeenCalledWith(
                expect.objectContaining({
                    file,
                    name: 'test-file.png',
                    channelId: 'channel-id-1',
                }),
            );
        });

        it('successful upload shows FilePreview and calls onFileSelected', () => {
            const onFileSelected = jest.fn();
            const {container} = renderComponent({onFileSelected});
            const file = makeFile();

            selectFiles(container, [file]);

            const {onSuccess} = getUploadCallbacks();
            const fileInfo = makeFileInfo({id: 'uploaded-file-1', name: 'test-file.png'});

            act(() => {
                onSuccess({file_infos: [fileInfo]});
            });

            expect(screen.getByTestId('file-preview')).toBeVisible();
            expect(screen.getByTestId('file-preview-item-uploaded-file-1')).toBeVisible();
            expect(onFileSelected).toHaveBeenCalledWith(['uploaded-file-1']);
        });
    });

    describe('error paths', () => {
        it('upload failure shows error message with file name', () => {
            const onFileSelected = jest.fn();
            const {container} = renderComponent({onFileSelected});
            const file = makeFile('important.pdf');

            selectFiles(container, [file]);

            const {onError} = getUploadCallbacks();
            act(() => {
                onError('Network timeout');
            });

            expect(screen.getByText(/important\.pdf/)).toBeVisible();
            expect(screen.getByText(/Network timeout/)).toBeVisible();
        });

        it('upload failure does NOT call onFileSelected with the failed file', () => {
            const onFileSelected = jest.fn();
            const {container} = renderComponent({onFileSelected});

            selectFiles(container, [makeFile()]);

            const {onError} = getUploadCallbacks();
            act(() => {
                onError('Upload failed');
            });

            // onFileSelected is called but with empty array (no successful files)
            expect(onFileSelected).toHaveBeenCalledWith([]);
        });

        it('ServerError object extracts message correctly', () => {
            const {container} = renderComponent();

            selectFiles(container, [makeFile('doc.txt')]);

            const {onError} = getUploadCallbacks();
            act(() => {
                onError({message: 'File too large', server_error_id: 'err.too_large', status_code: 413});
            });

            expect(screen.getByText(/File too large/)).toBeVisible();
        });

        it('string error is used directly', () => {
            const {container} = renderComponent();

            selectFiles(container, [makeFile()]);

            const {onError} = getUploadCallbacks();
            act(() => {
                onError('Direct string error');
            });

            expect(screen.getByText(/Direct string error/)).toBeVisible();
        });

        it('i18n fallback used when ServerError has no message', () => {
            const {container} = renderComponent();

            selectFiles(container, [makeFile()]);

            const {onError} = getUploadCallbacks();
            act(() => {
                onError({server_error_id: 'some.id'} as any);
            });

            // Falls back to intl defaultMessage 'Upload failed'
            expect(screen.getByText(/Upload failed/)).toBeVisible();
        });

        it('dispatches logError on upload failure with string error', () => {
            const {container} = renderComponent();

            selectFiles(container, [makeFile()]);

            const {onError} = getUploadCallbacks();
            act(() => {
                onError('Some error string');
            });

            expect(mockLogError).toHaveBeenCalledWith({message: 'Some error string'});
        });

        it('dispatches logError on upload failure with ServerError object', () => {
            const {container} = renderComponent();

            selectFiles(container, [makeFile()]);

            const serverErr = {message: 'Server said no', server_error_id: 'err.no', status_code: 500};
            const {onError} = getUploadCallbacks();
            act(() => {
                onError(serverErr);
            });

            expect(mockLogError).toHaveBeenCalledWith(serverErr);
        });
    });

    describe('edge cases', () => {
        it('disabled prop disables the Choose File button', () => {
            renderComponent({disabled: true});

            expect(screen.getByRole('button', {name: /choose file/i})).toBeDisabled();
        });

        it('Choose File button disabled while uploading', () => {
            const {container} = renderComponent();

            selectFiles(container, [makeFile()]);

            // After file selected and upload started, button should be disabled
            expect(screen.getByRole('button', {name: /choose file/i})).toBeDisabled();
        });

        it('Choose File button re-enabled after upload completes', () => {
            const {container} = renderComponent();

            selectFiles(container, [makeFile()]);
            expect(screen.getByRole('button', {name: /choose file/i})).toBeDisabled();

            const {onSuccess} = getUploadCallbacks();
            const fileInfo = makeFileInfo({id: 'done-file'});
            act(() => {
                onSuccess({file_infos: [fileInfo]});
            });

            expect(screen.getByRole('button', {name: /choose file/i})).toBeEnabled();
        });

        it('allowMultiple=false replaces existing files on new selection', () => {
            const onFileSelected = jest.fn();
            const {container} = renderComponent({allowMultiple: false, onFileSelected});

            // Upload first file
            selectFiles(container, [makeFile('first.png')]);
            const {onSuccess: onSuccess1} = getUploadCallbacks(0);
            const fileInfo1 = makeFileInfo({id: 'file-1', name: 'first.png'});
            act(() => {
                onSuccess1({file_infos: [fileInfo1]});
            });

            expect(onFileSelected).toHaveBeenLastCalledWith(['file-1']);

            // Upload second file — should replace, not append
            selectFiles(container, [makeFile('second.png')]);
            const {onSuccess: onSuccess2} = getUploadCallbacks(1);
            const fileInfo2 = makeFileInfo({id: 'file-2', name: 'second.png'});
            act(() => {
                onSuccess2({file_infos: [fileInfo2]});
            });

            expect(onFileSelected).toHaveBeenLastCalledWith(['file-2']);
        });

        it('allowMultiple=false limits selection to one file per pick', () => {
            const {container} = renderComponent({allowMultiple: false});

            selectFiles(container, [makeFile('first.png'), makeFile('second.png')]);

            expect(mockUploadFile).toHaveBeenCalledTimes(1);
            expect(screen.getByText('Uploads limited to 1 files maximum.')).toBeVisible();
        });

        it('allowMultiple=false hydrates only the first value file ID on mount', async () => {
            mockGetFileInfo.mockImplementation((fileId: string) => {
                return Promise.resolve(makeFileInfo({id: fileId, name: `${fileId}.png`}));
            });

            renderComponent({
                allowMultiple: false,
                value: ['file-a', 'file-b'],
            });

            await waitFor(() => {
                expect(screen.getByTestId('file-preview-item-file-a')).toBeVisible();
            });

            expect(mockGetFileInfo).toHaveBeenCalledTimes(1);
            expect(mockGetFileInfo).toHaveBeenCalledWith('file-a');
            expect(screen.queryByTestId('file-preview-item-file-b')).not.toBeInTheDocument();
        });

        it('allowMultiple=true appends files on new selection', () => {
            const onFileSelected = jest.fn();
            const {container} = renderComponent({allowMultiple: true, onFileSelected});

            // Upload first file
            selectFiles(container, [makeFile('first.png')]);
            const {onSuccess: onSuccess1} = getUploadCallbacks(0);
            const fileInfo1 = makeFileInfo({id: 'file-1', name: 'first.png'});
            act(() => {
                onSuccess1({file_infos: [fileInfo1]});
            });

            expect(onFileSelected).toHaveBeenLastCalledWith(['file-1']);

            // Upload second file — should append
            selectFiles(container, [makeFile('second.png')]);
            const {onSuccess: onSuccess2} = getUploadCallbacks(1);
            const fileInfo2 = makeFileInfo({id: 'file-2', name: 'second.png'});
            act(() => {
                onSuccess2({file_infos: [fileInfo2]});
            });

            expect(onFileSelected).toHaveBeenLastCalledWith(['file-1', 'file-2']);
        });

        it('allowMultiple=true limits uploads to MaxDialogFileIds', () => {
            const onFileSelected = jest.fn();
            const {container} = renderComponent({allowMultiple: true, onFileSelected});

            const batch = Array.from({length: MaxDialogFileIds + 2}, (_, i) => makeFile(`file-${i}.png`));
            selectFiles(container, batch);

            expect(mockUploadFile).toHaveBeenCalledTimes(MaxDialogFileIds);
            expect(screen.getByText(`Uploads limited to ${MaxDialogFileIds} files maximum.`)).toBeVisible();
        });

        it('allowMultiple=true disables choose button at MaxDialogFileIds', async () => {
            const onFileSelected = jest.fn();
            const {container} = renderComponent({allowMultiple: true, onFileSelected});

            for (let i = 0; i < MaxDialogFileIds; i++) {
                selectFiles(container, [makeFile(`file-${i}.png`)]);
                const {onSuccess} = getUploadCallbacks(i);
                act(() => {
                    onSuccess({file_infos: [makeFileInfo({id: `file-id-${i}`, name: `file-${i}.png`})]});
                });
            }

            expect(screen.getByRole('button', {name: /choose files/i})).toBeDisabled();
        });

        it('onPendingChange(true) called when upload starts, false when done', () => {
            const onPendingChange = jest.fn();
            const {container} = renderComponent({onPendingChange});

            selectFiles(container, [makeFile()]);

            // After file selection triggers upload, onPendingChange(true) should fire
            expect(onPendingChange).toHaveBeenCalledWith(true);

            const {onSuccess} = getUploadCallbacks();
            const fileInfo = makeFileInfo();
            act(() => {
                onSuccess({file_infos: [fileInfo]});
            });

            expect(onPendingChange).toHaveBeenCalledWith(false);
        });

        it('onFileSelected NOT called on mount (hasInteractedRef guard)', () => {
            const onFileSelected = jest.fn();
            renderComponent({onFileSelected});

            // Should not be called since user hasn't interacted
            expect(onFileSelected).not.toHaveBeenCalled();
        });

        it('value prop hydrates files via Client4.getFileInfo on mount', async () => {
            const hydratedFileInfo = makeFileInfo({id: 'pre-existing-file', name: 'hydrated.png'});
            mockGetFileInfo.mockResolvedValue(hydratedFileInfo);

            renderComponent({value: ['pre-existing-file']});

            await waitFor(() => {
                expect(screen.getByTestId('file-preview')).toBeVisible();
            });

            expect(mockGetFileInfo).toHaveBeenCalledWith('pre-existing-file');
            expect(screen.getByTestId('file-preview-item-pre-existing-file')).toBeVisible();
        });

        it('deleted/inaccessible file IDs silently skipped during hydration', async () => {
            const goodFileInfo = makeFileInfo({id: 'good-file', name: 'good.png'});
            mockGetFileInfo.mockImplementation((fileId: string) => {
                if (fileId === 'good-file') {
                    return Promise.resolve(goodFileInfo);
                }
                const err = new Error('Not found');
                (err as any).status_code = 404;
                return Promise.reject(err);
            });

            renderComponent({value: ['bad-file', 'good-file']});

            await waitFor(() => {
                expect(screen.getByTestId('file-preview-item-good-file')).toBeVisible();
            });

            // bad-file should not appear anywhere
            expect(screen.queryByText('bad-file')).not.toBeInTheDocument();
        });

        it('does not duplicate a file when its ID is echoed back via value prop after upload', async () => {
            // Scenario: user uploads a file → onFileSelected(['uploaded-id']) → parent sets
            // value=['uploaded-id'] → hydration effect should not fetch/prepend a second entry.
            const fileInfo = makeFileInfo({id: 'uploaded-id', name: 'uploaded.png'});
            mockGetFileInfo.mockResolvedValue(fileInfo);
            const onFileSelected = jest.fn();
            const {container, rerender} = renderComponent({onFileSelected});

            // Upload a file
            selectFiles(container, [makeFile('uploaded.png')]);
            const {onSuccess} = getUploadCallbacks();
            act(() => {
                onSuccess({file_infos: [fileInfo]});
            });

            // Verify it appears once
            expect(screen.getAllByTestId('file-preview-item-uploaded-id')).toHaveLength(1);

            // Parent echoes the ID back via value prop (as would happen after onFileSelected fires)
            rerender(
                <AppsFormFileUpload
                    {...baseProps}
                    onFileSelected={onFileSelected}
                    value={['uploaded-id']}
                />,
            );

            // Wait a tick for any async hydration to run
            await act(async () => {
                await new Promise((r) => setTimeout(r, 0));
            });

            // Still only one entry — no duplicate hydration
            expect(screen.getAllByTestId('file-preview-item-uploaded-id')).toHaveLength(1);

            // getFileInfo should NOT have been called (ID is already in state)
            expect(mockGetFileInfo).not.toHaveBeenCalled();
        });

        it('remove file after upload removes it from list', () => {
            const onFileSelected = jest.fn();
            const {container} = renderComponent({onFileSelected});

            selectFiles(container, [makeFile('removable.png')]);
            const {onSuccess} = getUploadCallbacks();
            const fileInfo = makeFileInfo({id: 'removable-id', name: 'removable.png'});
            act(() => {
                onSuccess({file_infos: [fileInfo]});
            });

            expect(screen.getByTestId('file-preview-item-removable-id')).toBeVisible();

            // Click the remove button
            fireEvent.click(screen.getByTestId('remove-file-removable-id'));

            expect(screen.queryByTestId('file-preview-item-removable-id')).not.toBeInTheDocument();
            expect(onFileSelected).toHaveBeenLastCalledWith([]);
        });

        it('allowMultiple button shows "Choose Files" text', () => {
            renderComponent({allowMultiple: true});

            expect(screen.getByRole('button', {name: /choose files/i})).toBeVisible();
        });

        it('input accepts multiple files when allowMultiple is true', () => {
            const {container} = renderComponent({allowMultiple: true});

            const input = container.querySelector('input[type="file"]') as HTMLInputElement;
            expect(input).toHaveAttribute('multiple');
        });

        it('input does not accept multiple when allowMultiple is false', () => {
            const {container} = renderComponent({allowMultiple: false});

            const input = container.querySelector('input[type="file"]') as HTMLInputElement;
            expect(input).not.toHaveAttribute('multiple');
        });

        it('placeholder is shown when no files are present', () => {
            renderComponent({placeholder: 'Drag or select a file'});

            expect(screen.getByText('Drag or select a file')).toBeVisible();
        });

        it('placeholder is hidden when files are present', () => {
            const {container} = renderComponent({placeholder: 'Drag or select a file'});

            selectFiles(container, [makeFile()]);

            expect(screen.queryByText('Drag or select a file')).not.toBeInTheDocument();
        });

        it('helpText is rendered when provided', () => {
            renderComponent({helpText: 'Max file size: 10MB'});

            expect(screen.getByText('Max file size: 10MB')).toBeVisible();
        });

        it('submit button is disabled while upload is in progress', () => {
            const onPendingChange = jest.fn();
            const {container} = renderComponent({onPendingChange});

            // Select a file to trigger upload
            selectFiles(container, [makeFile('test.png')]);

            // At this point upload is in progress, so onPendingChange(true) should have been called
            expect(onPendingChange).toHaveBeenCalledWith(true);

            // Verify the button is disabled by checking the Choose File button
            const chooseButton = screen.getByRole('button', {name: /Choose File/i});
            expect(chooseButton).toBeDisabled();
        });

        it('submit button is re-enabled after upload completes', () => {
            const onPendingChange = jest.fn();
            const {container} = renderComponent({onPendingChange});

            // Select and upload a file
            selectFiles(container, [makeFile('test.png')]);
            const {onSuccess} = getUploadCallbacks();
            const fileInfo = makeFileInfo({id: 'completed-id', name: 'test.png'});
            act(() => {
                onSuccess({file_infos: [fileInfo]});
            });

            // After upload completes, onPendingChange(false) should be called
            expect(onPendingChange).toHaveBeenCalledWith(false);

            // Verify the button is re-enabled
            const chooseButton = screen.getByRole('button', {name: /Choose File/i});
            expect(chooseButton).not.toBeDisabled();
        });

        it('concurrent uploads in two different file fields do not clobber state', async () => {
            // Render two file upload fields with different IDs
            const onFileSelected1 = jest.fn();
            const onFileSelected2 = jest.fn();
            const onPendingChange1 = jest.fn();
            const onPendingChange2 = jest.fn();

            const {container: container1} = renderComponent({
                id: 'file-field-1',
                onFileSelected: onFileSelected1,
                onPendingChange: onPendingChange1,
            });

            const {container: container2} = renderComponent({
                id: 'file-field-2',
                onFileSelected: onFileSelected2,
                onPendingChange: onPendingChange2,
            });

            // Start upload in field 1
            selectFiles(container1, [makeFile('file1.png')]);
            expect(onPendingChange1).toHaveBeenCalledWith(true);

            // Start upload in field 2 (while field 1 is still uploading)
            selectFiles(container2, [makeFile('file2.png')]);
            expect(onPendingChange2).toHaveBeenCalledWith(true);

            // Both should be uploading
            expect(screen.getAllByTestId(/file-progress-/)).toHaveLength(2);

            // Complete upload in field 1
            const {onSuccess: onSuccess1} = getUploadCallbacks(0);
            const fileInfo1 = makeFileInfo({id: 'file1-id', name: 'file1.png'});
            act(() => {
                onSuccess1({file_infos: [fileInfo1]});
            });

            // Field 1 should be done uploading
            expect(onPendingChange1).toHaveBeenLastCalledWith(false);

            // Field 2 should still be uploading
            expect(onPendingChange2).toHaveBeenLastCalledWith(true);
            expect(mockUploadFile).toHaveBeenCalledTimes(2);

            // Complete upload in field 2
            const {onSuccess: onSuccess2} = getUploadCallbacks(1);
            const fileInfo2 = makeFileInfo({id: 'file2-id', name: 'file2.png'});
            act(() => {
                onSuccess2({file_infos: [fileInfo2]});
            });

            // Field 2 should now be done uploading
            expect(onPendingChange2).toHaveBeenLastCalledWith(false);

            // Verify both callbacks were called with the correct file IDs
            expect(onFileSelected1).toHaveBeenCalledWith(['file1-id']);
            expect(onFileSelected2).toHaveBeenCalledWith(['file2-id']);
        });

        it('upload state is tracked independently per field when allow_multiple is used', () => {
            const onFileSelected = jest.fn();
            const onPendingChange = jest.fn();
            const {container} = renderComponent({
                allowMultiple: true,
                onFileSelected,
                onPendingChange,
            });

            // Upload first file
            selectFiles(container, [makeFile('file1.png')]);
            expect(onPendingChange).toHaveBeenCalledWith(true);

            // File should show uploading
            const uploadingElements = screen.queryAllByTestId(/file-progress-/);
            expect(uploadingElements).toHaveLength(1);

            // Complete first upload
            const {onSuccess: onSuccess1} = getUploadCallbacks();
            act(() => {
                onSuccess1({file_infos: [makeFileInfo({id: 'file1-id', name: 'file1.png'})]});
            });

            // After first file completes, show in FilePreview
            expect(screen.getByTestId('file-preview-item-file1-id')).toBeInTheDocument();

            // onFileSelected should be called with the completed file
            expect(onFileSelected).toHaveBeenCalledWith(['file1-id']);

            // onPendingChange should be false since no more uploads are in progress
            expect(onPendingChange).toHaveBeenLastCalledWith(false);
        });
    });
});
