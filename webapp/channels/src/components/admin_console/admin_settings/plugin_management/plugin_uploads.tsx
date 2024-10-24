// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {useCallback, useRef, useState} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';

import {
    getPlugins,
    uploadPlugin,
} from 'mattermost-redux/actions/admin';
import {getConfig} from 'mattermost-redux/selectors/entities/admin';

import ExternalLink from 'components/external_link';

import {DeveloperLinks} from 'utils/constants';
import * as Utils from 'utils/utils';

import type {GlobalState} from 'types/store';

import {messages} from './messages';

const renderLink = (msg: React.ReactNode) => (
    <ExternalLink
        href={DeveloperLinks.PLUGINS}
        location='plugin_management'
    >
        {msg}
    </ExternalLink>
);

type Props = {
    enableUploads: boolean;
    isDisabled?: boolean;
    confirmOverwrite: (onAccept: () => void, onCancel: () => void) => void;
    setLoading: (value: boolean) => void;
    setServerError: (value: string | undefined) => void;
    serverError?: string;
}

const PluginUploads = ({
    enableUploads,
    isDisabled,
    confirmOverwrite,
    setLoading,
    serverError,
    setServerError,
}: Props) => {
    const intl = useIntl();
    const dispatch = useDispatch();

    const [lastMessage, setLastMessage] = useState<string>();
    const [fileSelected, setFileSelected] = useState(false);
    const [file, setFile] = useState<File>();
    const [uploading, setUploading] = useState(false);

    const overwritingUpload = useRef(false);

    const fileInput = useRef<HTMLInputElement>(null);

    const enablePlugins = useSelector((state: GlobalState) => getConfig(state).PluginSettings?.Enable);
    const enableUploadButton = useSelector((state: GlobalState) => {
        if (isDisabled) {
            return false;
        }
        const config = getConfig(state);
        const requirePluginsSignature = config.PluginSettings?.RequirePluginSignature;
        return enableUploads && enablePlugins && !requirePluginsSignature;
    });

    const handleUpload = useCallback(() => {
        setLastMessage(undefined);
        setServerError(undefined);
        const element = fileInput.current;
        if (element?.files && element.files.length > 0) {
            setFileSelected(true);
            setFile(element.files[0]);
        }
    }, [setServerError]);

    const helpSubmitUpload = useCallback(async (file: File, force: boolean) => {
        setUploading(true);
        const {error} = await dispatch(uploadPlugin(file, force));

        if (error) {
            if (error.server_error_id === 'app.plugin.install_id.app_error' && !force) {
                confirmOverwrite(
                    () => helpSubmitUpload(file, true),
                    () => {
                        setFile(undefined);
                        setFileSelected(false);
                        setServerError(undefined);
                        setLastMessage(undefined);
                        setUploading(false);

                        // setLoading(false);
                        // overwritingUpload.current = false;
                    },
                );
                overwritingUpload.current = true;
                return;
            }
            setFile(undefined);
            setFileSelected(false);
            setUploading(false);
            if (error.server_error_id === 'app.plugin.activate.app_error') {
                setServerError(intl.formatMessage({
                    id: 'admin.plugin.error.activate',
                    defaultMessage: 'Unable to upload the plugin. It may conflict with another plugin on your server.',
                }));
            } else if (error.server_error_id === 'app.plugin.extract.app_error') {
                setServerError(intl.formatMessage({
                    id: 'admin.plugin.error.extract',
                    defaultMessage: 'Encountered an error when extracting the plugin. Review your plugin file content and try again.',
                }));
            } else {
                setServerError(error.message);
            }
            return;
        }

        setLoading(true);
        await dispatch(getPlugins());

        let msg = `Successfully uploaded plugin from ${file?.name}`;
        if (overwritingUpload.current) {
            msg = `Successfully updated plugin from ${file?.name}`;
        }

        setFile(undefined);
        setFileSelected(false);
        setServerError(undefined);
        setLastMessage(msg);
        overwritingUpload.current = false;
        setUploading(false);
        setLoading(false);
    }, [confirmOverwrite, dispatch, intl, setLoading, setServerError]);

    const handleSubmitUpload = useCallback((e: React.SyntheticEvent) => {
        e.preventDefault();

        const element = fileInput.current;
        if (!element) {
            return;
        }

        if (element.files?.length === 0) {
            return;
        }

        const file = element.files && element.files[0];
        if (file) {
            helpSubmitUpload(file, false);
        }
        Utils.clearFileInput(element);
    }, [helpSubmitUpload]);

    let uploadButtonText;
    if (uploading) {
        uploadButtonText = (
            <FormattedMessage
                id='admin.plugin.uploading'
                defaultMessage='Uploading...'
            />
        );
    } else {
        uploadButtonText = (
            <FormattedMessage
                id='admin.plugin.upload'
                defaultMessage='Upload'
            />
        );
    }

    let uploadHelpText;
    if (enableUploads && enablePlugins) {
        uploadHelpText = (
            <FormattedMessage
                {...messages.uploadDesc}
                values={{
                    link: (msg: React.ReactNode) => (
                        <ExternalLink
                            href={DeveloperLinks.PLUGINS}
                            location='plugin_management'
                        >
                            {msg}
                        </ExternalLink>
                    ),
                }}
            />
        );
    } else if (enablePlugins && !enableUploads) {
        uploadHelpText = (
            <FormattedMessage
                {...messages.uploadDisabledDesc}
                values={{
                    link: (msg: React.ReactNode) => (
                        <ExternalLink
                            href={DeveloperLinks.PLUGINS}
                            location='plugin_management'
                        >
                            {msg}
                        </ExternalLink>
                    ),
                }}
            />
        );
    } else {
        uploadHelpText = (
            <FormattedMessage
                id='admin.plugin.uploadAndPluginDisabledDesc'
                defaultMessage='To enable plugins, set **Enable Plugins** to true. See <link>documentation</link> to learn more.'
                values={{
                    link: renderLink,
                }}
            />
        );
    }

    const renderedServerError = serverError ? (
        <div className='col-sm-12'>
            <div className='form-group has-error half'>
                <label className='control-label'>{serverError}</label>
            </div>
        </div>
    ) : undefined;

    const renderedLastMessage = lastMessage ? (
        <div className='col-sm-12'>
            <div className='form-group half'>{lastMessage}</div>
        </div>
    ) : undefined;

    return (
        <div className='form-group'>
            <label className='control-label col-sm-4'>
                <FormattedMessage {...messages.uploadTitle}/>
            </label>
            <div className='col-sm-8'>
                <div className='file__upload'>
                    <button
                        type='button'
                        className={classNames(['btn', {'btn-tertiary': enableUploads}])}
                        disabled={!enableUploadButton}
                    >
                        <FormattedMessage
                            id='admin.plugin.choose'
                            defaultMessage='Choose File'
                        />
                    </button>
                    <input
                        ref={fileInput}
                        type='file'
                        accept='.gz'
                        onChange={handleUpload}
                        disabled={!enableUploadButton}
                    />
                </div>
                <button
                    className={'btn btn-primary'}
                    id='uploadPlugin'
                    disabled={!fileSelected}
                    onClick={handleSubmitUpload}
                >
                    {uploadButtonText}
                </button>
                <div className='help-text m-0'>
                    {file?.name}
                </div>
                {renderedServerError}
                {renderedLastMessage}
                <p className='help-text'>
                    {uploadHelpText}
                </p>
            </div>
        </div>
    );
};

export default PluginUploads;
