// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import type {MouseEvent, DragEvent, ChangeEvent} from 'react';

import type {FileInfo} from '@mattermost/types/files';

import {General} from 'mattermost-redux/constants';

import {renderWithContext, act} from 'tests/react_testing_utils';
import {clearFileInput} from 'utils/utils';

import type {FilesWillUploadHook} from 'types/store/plugins';

import FileUpload, {type FileUpload as FileUploadClass} from './file_upload';

const generatedIdRegex = /[a-z0-9]{8}-[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{12}/;

jest.mock('utils/file_utils', () => {
    const original = jest.requireActual('utils/file_utils');
    return {
        ...original,
        canDownloadFiles: jest.fn(() => true),
    };
});

jest.mock('utils/utils', () => {
    const original = jest.requireActual('utils/utils');
    return {
        ...original,
        clearFileInput: jest.fn(),
        sortFilesByName: jest.fn((files) => {
            return files.sort((a: File, b: File) => a.name.localeCompare(b.name, 'en', {numeric: true}));
        }),
    };
});

const RealDate = Date;
const RealFile = File;

beforeEach(() => {
    global.Date.prototype.getDate = () => 1;
    global.Date.prototype.getFullYear = () => 2000;
    global.Date.prototype.getHours = () => 1;
    global.Date.prototype.getMinutes = () => 1;
    global.Date.prototype.getMonth = () => 1;
});

afterEach(() => {
    global.Date = RealDate;
    global.File = RealFile;
});

describe('components/FileUpload', () => {
    const MaxFileSize = 10;
    const uploadFile: () => XMLHttpRequest = jest.fn();
    const baseProps = {
        channelId: 'channel_id',
        fileCount: 1,
        getTarget: jest.fn(),
        locale: General.DEFAULT_LOCALE,
        onClick: jest.fn(),
        onFileUpload: jest.fn(),
        onFileUploadChange: jest.fn(),
        onUploadError: jest.fn(),
        onUploadStart: jest.fn(),
        onUploadProgress: jest.fn(),
        postType: 'post' as const,
        maxFileSize: MaxFileSize,
        canUploadFiles: true,
        rootId: 'root_id',
        pluginFileUploadMethods: [],
        pluginFilesWillUploadHooks: [],
        centerChannelPostBeingEdited: false,
        rhsPostBeingEdited: false,
        actions: {
            uploadFile,
        },
    };

    test('should match snapshot', () => {
        const ref = React.createRef<FileUploadClass>();
        const {container} = renderWithContext(
            <FileUpload
                {...baseProps}
                ref={ref}
            />,
        );

        expect(container).toMatchSnapshot();
    });

    test('should call onClick when fileInput is clicked', () => {
        const ref = React.createRef<FileUploadClass>();
        const {container} = renderWithContext(
            <FileUpload
                {...baseProps}
                ref={ref}
            />,
        );

        const input = container.querySelector('input');
        input?.click();
        expect(baseProps.onClick).toHaveBeenCalledTimes(1);
    });

    test('should prevent event default and progogation on call of onTouchEnd on fileInput', () => {
        const ref = React.createRef<FileUploadClass>();
        renderWithContext(
            <FileUpload
                {...baseProps}
                ref={ref}
            />,
        );

        const instance = ref.current!;
        instance.handleLocalFileUploaded = jest.fn();
        instance.fileInput = {
            current: {
                click: () => instance.handleLocalFileUploaded({} as unknown as MouseEvent<HTMLInputElement>),
            } as unknown as HTMLInputElement,
        };

        const event = {stopPropagation: jest.fn(), preventDefault: jest.fn()};
        instance.handleLocalFileUploaded(event as unknown as MouseEvent<HTMLInputElement>);

        expect(instance.handleLocalFileUploaded).toHaveBeenCalled();
    });

    test('should prevent event default and progogation on call of onClick on fileInput', () => {
        const ref = React.createRef<FileUploadClass>();
        renderWithContext(
            <FileUpload
                {...baseProps}
                ref={ref}
            />,
        );

        const instance = ref.current!;
        instance.handleLocalFileUploaded = jest.fn();
        instance.fileInput = {
            current: {
                click: () => instance.handleLocalFileUploaded({} as unknown as MouseEvent<HTMLInputElement>),
            } as unknown as HTMLInputElement,
        };

        const event = {stopPropagation: jest.fn(), preventDefault: jest.fn()};
        instance.handleLocalFileUploaded(event as unknown as MouseEvent<HTMLInputElement>);

        expect(instance.handleLocalFileUploaded).toHaveBeenCalled();
    });

    test('should match state and call handleMaxUploadReached or props.onClick on handleLocalFileUploaded', () => {
        const ref = React.createRef<FileUploadClass>();
        const {rerender} = renderWithContext(
            <FileUpload
                {...baseProps}
                ref={ref}
                fileCount={9}
            />,
        );

        const instance = ref.current!;

        const evt = {preventDefault: jest.fn()} as unknown as MouseEvent<HTMLInputElement>;
        instance.handleMaxUploadReached = jest.fn();

        // allow file upload
        act(() => {
            instance.setState({menuOpen: true});
            instance.handleLocalFileUploaded(evt);
        });
        expect(baseProps.onClick).toHaveBeenCalledTimes(1);
        expect(instance.handleMaxUploadReached).not.toHaveBeenCalled();
        expect(instance.state.menuOpen).toEqual(false);

        // not allow file upload, max limit has been reached
        act(() => {
            instance.setState({menuOpen: true});
        });
        rerender(
            <FileUpload
                {...baseProps}
                ref={ref}
                fileCount={10}
            />,
        );
        act(() => {
            instance.handleLocalFileUploaded(evt);
        });
        expect(baseProps.onClick).toHaveBeenCalledTimes(1);
        expect(instance.handleMaxUploadReached).toHaveBeenCalledTimes(1);
        expect(instance.handleMaxUploadReached).toHaveBeenCalledWith(evt);
        expect(instance.state.menuOpen).toEqual(false);
    });

    test('should props.onFileUpload when fileUploadSuccess is called', () => {
        const data = {
            file_infos: [{id: 'file_info1'} as FileInfo],
            client_ids: ['id1'],
        };

        const ref = React.createRef<FileUploadClass>();
        renderWithContext(
            <FileUpload
                {...baseProps}
                ref={ref}
            />,
        );

        const instance = ref.current!;

        instance.fileUploadSuccess(data, 'channel_id', 'root_id');

        expect(baseProps.onFileUpload).toHaveBeenCalledTimes(1);
        expect(baseProps.onFileUpload).toHaveBeenCalledWith(data.file_infos, data.client_ids, 'channel_id', 'root_id');
    });

    test('should props.onUploadError when fileUploadFail is called', () => {
        const params = {
            err: 'error_message',
            clientId: 'client_id',
            channelId: 'channel_id',
            rootId: 'root_id',
        };

        const ref = React.createRef<FileUploadClass>();
        renderWithContext(
            <FileUpload
                {...baseProps}
                ref={ref}
            />,
        );

        const instance = ref.current!;
        instance.fileUploadFail(params.err, params.clientId, params.channelId, params.rootId);

        expect(baseProps.onUploadError).toHaveBeenCalledTimes(1);
        expect(baseProps.onUploadError).toHaveBeenCalledWith(params.err, params.clientId, params.channelId, params.rootId);
    });

    test('should upload file on paste', () => {
        const expectedFileName = 'test.png';

        const event = new Event('paste');
        event.preventDefault = jest.fn();
        const getAsFile = jest.fn().mockReturnValue(new File(['test'], 'test.png'));
        const file = {getAsFile, kind: 'file', name: 'test.png'};
        (event as any).clipboardData = {items: [file], types: ['image/png'], getData: () => {}};

        const ref = React.createRef<FileUploadClass>();
        renderWithContext(
            <FileUpload
                {...baseProps}
                ref={ref}
            />,
        );

        const instance = ref.current!;
        jest.spyOn(instance, 'containsEventTarget').mockReturnValue(true);
        const spy = jest.spyOn(instance, 'checkPluginHooksAndUploadFiles');

        document.dispatchEvent(event);
        expect(event.preventDefault).toHaveBeenCalled();
        expect(spy).toHaveBeenCalledWith([expect.objectContaining({name: expectedFileName})]);
        expect(spy.mock.calls[0][0][0]).toBeInstanceOf(Blob); // first call, first arg, first item in array
        expect(baseProps.onFileUploadChange).toHaveBeenCalled();
    });

    test('should not prevent paste event default if no file in clipboard', () => {
        const event = new Event('paste');
        event.preventDefault = jest.fn();
        const getAsString = jest.fn();
        (event as any).clipboardData = {items: [{getAsString, kind: 'string', type: 'text/plain'}],
            types: ['text/plain'],
            getData: () => {
                return '';
            }};

        const ref = React.createRef<FileUploadClass>();
        renderWithContext(
            <FileUpload
                {...baseProps}
                ref={ref}
            />,
        );
        const instance = ref.current!;
        const spy = jest.spyOn(instance, 'containsEventTarget').mockReturnValue(true);

        document.dispatchEvent(event);

        expect(spy).toHaveBeenCalled();
        expect(event.preventDefault).not.toHaveBeenCalled();
    });

    test('should have props.functions when uploadFiles is called', () => {
        const files = [{name: 'file1.pdf'} as File, {name: 'file2.jpg'} as File];

        const ref = React.createRef<FileUploadClass>();
        renderWithContext(
            <FileUpload
                {...baseProps}
                ref={ref}
            />,
        );

        const instance = ref.current!;
        instance.checkPluginHooksAndUploadFiles(files);

        expect(uploadFile).toHaveBeenCalledTimes(2);

        expect(baseProps.onUploadStart).toHaveBeenCalledTimes(1);
        expect(baseProps.onUploadStart).toHaveBeenCalledWith(
            Array(2).fill(expect.stringMatching(generatedIdRegex)),
            baseProps.channelId,
        );

        expect(baseProps.onUploadError).toHaveBeenCalledTimes(1);
        expect(baseProps.onUploadError).toHaveBeenCalledWith(null);
    });

    test('should error max upload files', () => {
        const fileCount = 10;
        const props = {...baseProps, fileCount};
        const files = [{name: 'file1.pdf'} as File, {name: 'file2.jpg'} as File];

        const ref = React.createRef<FileUploadClass>();
        renderWithContext(
            <FileUpload
                {...props}
                ref={ref}
            />,
        );

        const instance = ref.current!;
        instance.checkPluginHooksAndUploadFiles(files);

        expect(uploadFile).not.toHaveBeenCalled();

        expect(baseProps.onUploadStart).toHaveBeenCalledWith([], props.channelId);

        expect(baseProps.onUploadError).toHaveBeenCalledTimes(2);
        expect(baseProps.onUploadError.mock.calls[0][0]).toEqual(null);
    });

    test('should error max upload files', () => {
        const fileCount = 10;
        const props = {...baseProps, fileCount};
        const files = [{name: 'file1.pdf'} as File, {name: 'file2.jpg'} as File];

        const ref = React.createRef<FileUploadClass>();
        renderWithContext(
            <FileUpload
                {...props}
                ref={ref}
            />,
        );

        const instance = ref.current!;
        instance.checkPluginHooksAndUploadFiles(files);

        expect(uploadFile).not.toHaveBeenCalled();

        expect(baseProps.onUploadStart).toHaveBeenCalledWith([], props.channelId);

        expect(baseProps.onUploadError).toHaveBeenCalledTimes(2);
        expect(baseProps.onUploadError.mock.calls[0][0]).toEqual(null);
    });

    test('should error max too large files', () => {
        const files = [{name: 'file1.pdf', size: MaxFileSize + 1} as File];

        const ref = React.createRef<FileUploadClass>();
        renderWithContext(
            <FileUpload
                {...baseProps}
                ref={ref}
            />,
        );

        const instance = ref.current!;
        instance.checkPluginHooksAndUploadFiles(files);

        expect(uploadFile).not.toHaveBeenCalled();

        expect(baseProps.onUploadStart).toHaveBeenCalledWith([], baseProps.channelId);

        expect(baseProps.onUploadError).toHaveBeenCalledTimes(2);
        expect(baseProps.onUploadError.mock.calls[0][0]).toEqual(null);
    });

    test('should functions when handleChange is called', () => {
        const ref = React.createRef<FileUploadClass>();
        renderWithContext(
            <FileUpload
                {...baseProps}
                ref={ref}
            />,
        );

        const e = {target: {files: [{name: 'file1.pdf'}]}} as unknown as ChangeEvent<HTMLInputElement>;
        const instance = ref.current!;
        instance.uploadFiles = jest.fn();
        instance.handleChange(e);

        expect(instance.uploadFiles).toHaveBeenCalled();
        expect(instance.uploadFiles).toHaveBeenCalledWith(e.target.files);

        expect(clearFileInput).toHaveBeenCalled();
        expect(clearFileInput).toHaveBeenCalledWith(e.target);

        expect(baseProps.onFileUploadChange).toHaveBeenCalled();
        expect(baseProps.onFileUploadChange).toHaveBeenCalledWith();
    });

    test('should functions when handleDrop is called', () => {
        const ref = React.createRef<FileUploadClass>();
        renderWithContext(
            <FileUpload
                {...baseProps}
                ref={ref}
            />,
        );

        const e = {dataTransfer: {files: [{name: 'file1.pdf'}]}} as unknown as DragEvent<HTMLInputElement>;
        const instance = ref.current!;
        instance.uploadFiles = jest.fn();
        instance.handleDrop(e);

        expect(baseProps.onUploadError).toHaveBeenCalled();
        expect(baseProps.onUploadError).toHaveBeenCalledWith(null);

        expect(instance.uploadFiles).toHaveBeenCalled();
        expect(instance.uploadFiles).toHaveBeenCalledWith(e.dataTransfer.files);

        expect(baseProps.onFileUploadChange).toHaveBeenCalled();
        expect(baseProps.onFileUploadChange).toHaveBeenCalledWith();
    });

    test('FilesWillUploadHook - should reject all files', () => {
        const pluginHook = () => {
            return {files: null};
        };
        const props = {...baseProps, pluginFilesWillUploadHooks: [{hook: pluginHook} as unknown as FilesWillUploadHook]};
        const files = [{name: 'file1.pdf'} as File, {name: 'file2.jpg'} as File];

        const ref = React.createRef<FileUploadClass>();
        renderWithContext(
            <FileUpload
                {...props}
                ref={ref}
            />,
        );

        const instance = ref.current!;
        instance.checkPluginHooksAndUploadFiles(files);

        expect(uploadFile).toHaveBeenCalledTimes(0);

        expect(baseProps.onUploadStart).toHaveBeenCalledTimes(0);

        expect(baseProps.onUploadError).toHaveBeenCalledTimes(1);
        expect(baseProps.onUploadError).toHaveBeenCalledWith(null);
    });

    test('FilesWillUploadHook - should reject one file and allow one file', () => {
        const pluginHook = (files: File[]) => {
            return {files: files.filter((f) => f.name === 'file1.pdf')};
        };
        const props = {...baseProps, pluginFilesWillUploadHooks: [{hook: pluginHook} as unknown as FilesWillUploadHook]};
        const files = [{name: 'file1.pdf'} as File, {name: 'file2.jpg'} as File];

        const ref = React.createRef<FileUploadClass>();
        renderWithContext(
            <FileUpload
                {...props}
                ref={ref}
            />,
        );

        const instance = ref.current!;
        instance.checkPluginHooksAndUploadFiles(files);

        expect(uploadFile).toHaveBeenCalledTimes(1);

        expect(baseProps.onUploadStart).toHaveBeenCalledTimes(1);
        expect(baseProps.onUploadStart).toHaveBeenCalledWith([expect.stringMatching(generatedIdRegex)], props.channelId);

        expect(baseProps.onUploadError).toHaveBeenCalledTimes(1);
        expect(baseProps.onUploadError).toHaveBeenCalledWith(null);
    });
});
