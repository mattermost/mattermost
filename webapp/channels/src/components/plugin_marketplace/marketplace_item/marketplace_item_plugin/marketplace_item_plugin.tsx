// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React from 'react';
import {FormattedMessage} from 'react-intl';
import {Link} from 'react-router-dom';
import semver from 'semver';

import ConfirmModal from 'components/confirm_modal';
import ExternalLink from 'components/external_link';
import FormattedMarkdownMessage from 'components/formatted_markdown_message';
import LoadingWrapper from 'components/widgets/loading/loading_wrapper';

import {localizeMessage} from 'utils/utils';

import MarketplaceItem from '../marketplace_item';

import type {MarketplaceLabel} from '@mattermost/types/marketplace';
import type {PluginStatusRedux} from '@mattermost/types/plugins';

type UpdateVersionProps = {
    version: string;
    releaseNotesUrl?: string;
};

// UpdateVersion renders the version text in the update details, linking out to release notes if available.
export const UpdateVersion = ({version, releaseNotesUrl}: UpdateVersionProps): JSX.Element => {
    if (!releaseNotesUrl) {
        return (
            <span>
                {version}
            </span>
        );
    }

    return (
        <ExternalLink
            location='marketplace_item_plugin'
            href={releaseNotesUrl}
        >
            {version}
        </ExternalLink>
    );
};

export type UpdateDetailsProps = {
    version: string;
    releaseNotesUrl?: string;
    installedVersion?: string;
    isInstalling: boolean;
    onUpdate: (e: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => void;
};

// UpdateDetails renders an inline update prompt for plugins, when available.
export const UpdateDetails = ({version, releaseNotesUrl, installedVersion, isInstalling, onUpdate}: UpdateDetailsProps): JSX.Element | null => {
    if (!installedVersion || isInstalling) {
        return null;
    }

    let isUpdate = false;
    try {
        isUpdate = semver.gt(version, installedVersion);
    } catch (e) {
        // If we fail to parse the version, assume not an update;
    }

    if (!isUpdate) {
        return null;
    }

    return (
        <div className={classNames('update')}>
            <FormattedMessage
                id='marketplace_modal.list.update_available'
                defaultMessage='Update available:'
            />
            {' '}
            <UpdateVersion
                version={version}
                releaseNotesUrl={releaseNotesUrl}
            />
            {' - '}
            <b>
                <a onClick={onUpdate}>
                    <FormattedMessage
                        id='marketplace_modal.list.update'
                        defaultMessage='Update'
                    />
                </a>
            </b>
        </div>
    );
};

export type UpdateConfirmationModalProps = {
    show: boolean;
    name: string;
    version: string;
    releaseNotesUrl?: string;
    installedVersion?: string;
    onUpdate: (checked: boolean) => void;
    onCancel: (checked: boolean) => void;
};

// UpdateConfirmationModal prompts before allowing upgrade, specially handling major version changes.
export const UpdateConfirmationModal = ({show, name, version, installedVersion, releaseNotesUrl, onUpdate, onCancel}: UpdateConfirmationModalProps): JSX.Element | null => {
    if (!installedVersion) {
        return null;
    }

    let isUpdate = false;
    try {
        isUpdate = semver.gt(version, installedVersion);
    } catch (e) {
        // If we fail to parse the version, assume not an update;
    }

    if (!isUpdate) {
        return null;
    }

    const messages = [(
        <p key='intro'>
            <FormattedMessage
                id='marketplace_modal.list.update_confirmation.message.intro'
                defaultMessage={`Are you sure you want to update the ${name} plugin to ${version}?`}
                values={{name, version}}
            />
        </p>
    )];

    if (releaseNotesUrl) {
        messages.push(
            <p key='current'>
                <FormattedMarkdownMessage
                    id='marketplace_modal.list.update_confirmation.message.current_with_release_notes'
                    defaultMessage='You currently have {installedVersion} installed. View the [release notes](!{releaseNotesUrl}) to learn about the changes included in this update.'
                    values={{installedVersion, releaseNotesUrl}}
                />
            </p>,
        );
    } else {
        messages.push(
            <p key='current'>
                <FormattedMessage
                    id='marketplace_modal.list.update_confirmation.message.current'
                    defaultMessage={`You currently have ${installedVersion} installed.`}
                    values={{installedVersion}}
                />
            </p>,
        );
    }

    let sameMajorVersion = false;
    try {
        sameMajorVersion = semver.major(version) === semver.major(installedVersion);
    } catch (e) {
        // If we fail to parse the version, assume a potentially breaking change.
        // In practice, this won't happen since we already tried to parse the version above.
    }

    if (!sameMajorVersion) {
        if (releaseNotesUrl) {
            messages.push(
                <p
                    className='alert alert-warning'
                    key='warning'
                >
                    <FormattedMarkdownMessage
                        id='marketplace_modal.list.update_confirmation.message.warning_major_version_with_release_notes'
                        defaultMessage='This update may contain breaking changes. Consult the [release notes](!{releaseNotesUrl}) before upgrading.'
                        values={{releaseNotesUrl}}
                    />
                </p>,
            );
        } else {
            messages.push(
                <p
                    className='alert alert-warning'
                    key='warning'
                >
                    <FormattedMessage
                        id='marketplace_modal.list.update_confirmation.message.warning_major_version'
                        defaultMessage={'This update may contain breaking changes.'}
                    />
                </p>,
            );
        }
    }

    return (
        <ConfirmModal
            show={show}
            title={
                <FormattedMessage
                    id='marketplace_modal.list.update_confirmation.title'
                    defaultMessage={'Confirm Plugin Update'}
                />
            }
            message={messages}
            confirmButtonText={
                <FormattedMessage
                    id='marketplace_modal.list.update_confirmation.confirm_button'
                    defaultMessage='Update'
                />
            }
            onConfirm={onUpdate}
            onCancel={onCancel}
        />
    );
};

export type MarketplaceItemPluginProps = {
    id: string;
    name: string;
    description?: string;
    version: string;
    homepageUrl?: string;
    releaseNotesUrl?: string;
    labels?: MarketplaceLabel[];
    iconData?: string;
    installedVersion?: string;
    installing: boolean;
    pluginStatus?: PluginStatusRedux;
    error?: string;
    isDefaultMarketplace: boolean;
    trackEvent: (category: string, event: string, props?: unknown) => void;

    actions: {
        installPlugin: (id: string) => void;
        closeMarketplaceModal: () => void;
    };
};

type MarketplaceItemState = {
    showUpdateConfirmationModal: boolean;
};

export default class MarketplaceItemPlugin extends React.PureComponent <MarketplaceItemPluginProps, MarketplaceItemState> {
    constructor(props: MarketplaceItemPluginProps) {
        super(props);

        this.state = {
            showUpdateConfirmationModal: false,
        };
    }

    trackEvent = (eventName: string, allowDetail = true): void => {
        if (this.props.isDefaultMarketplace && allowDetail) {
            this.props.trackEvent('plugins', eventName, {
                plugin_id: this.props.id,
                version: this.props.version,
                installed_version: this.props.installedVersion,
            });
        } else {
            this.props.trackEvent('plugins', eventName);
        }
    };

    showUpdateConfirmationModal = (): void => {
        this.setState({showUpdateConfirmationModal: true});
    };

    hideUpdateConfirmationModal = (): void => {
        this.setState({showUpdateConfirmationModal: false});
    };

    onInstall = (): void => {
        this.trackEvent('ui_marketplace_download');
        this.props.actions.installPlugin(this.props.id);
    };

    onConfigure = (): void => {
        this.trackEvent('ui_marketplace_configure', false);

        this.props.actions.closeMarketplaceModal();
    };

    onUpdate = (): void => {
        this.trackEvent('ui_marketplace_download_update');

        this.hideUpdateConfirmationModal();
        this.props.actions.installPlugin(this.props.id);
    };

    getItemButton(): JSX.Element {
        if (this.props.installedVersion !== '' && !this.props.installing && !this.props.error) {
            return (
                <Link
                    to={'/admin_console/plugins/plugin_' + this.props.id}
                >
                    <button
                        onClick={this.onConfigure}
                        className='plugin-configure'
                    >
                        <FormattedMessage
                            id='marketplace_modal.list.configure'
                            defaultMessage='Configure'
                        />
                    </button>
                </Link>
            );
        }

        let actionButton: JSX.Element;
        if (this.props.error) {
            actionButton = (
                <FormattedMessage
                    id='marketplace_modal.list.try_again'
                    defaultMessage='Try Again'
                />
            );
        } else {
            actionButton = (
                <FormattedMessage
                    id='marketplace_modal.list.install'
                    defaultMessage='Install'
                />
            );
        }

        return (
            <button
                onClick={this.onInstall}
                className='plugin-install always-show-enabled'
                disabled={this.props.installing}
            >
                <LoadingWrapper
                    loading={this.props.installing}
                    text={localizeMessage('marketplace_modal.installing', 'Installing...')}
                >
                    {actionButton}
                </LoadingWrapper>

            </button>
        );
    }

    render(): JSX.Element {
        let version = `(${this.props.version})`;
        if (this.props.installedVersion !== '') {
            version = `(${this.props.installedVersion})`;
        }

        const versionLabel = <span className='light subtitle'>{version}</span>;

        const updateDetails = (
            <UpdateDetails
                version={this.props.version}
                installedVersion={this.props.installedVersion}
                releaseNotesUrl={this.props.releaseNotesUrl}
                isInstalling={this.props.installing}
                onUpdate={this.showUpdateConfirmationModal}
            />
        );

        return (
            <>
                <MarketplaceItem
                    button={this.getItemButton()}
                    versionLabel={versionLabel}
                    updateDetails={updateDetails}
                    iconSource={this.props.iconData}
                    {...this.props}
                    error={this.props.error || this.props.pluginStatus?.error}
                />
                <UpdateConfirmationModal
                    show={this.state.showUpdateConfirmationModal}
                    name={this.props.name}
                    version={this.props.version}
                    installedVersion={this.props.installedVersion}
                    releaseNotesUrl={this.props.releaseNotesUrl}
                    onUpdate={this.onUpdate}
                    onCancel={this.hideUpdateConfirmationModal}
                />
            </>
        );
    }
}
