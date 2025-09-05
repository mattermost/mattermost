// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {defineMessage, FormattedMessage} from 'react-intl';

import type {MarketplaceLabel} from '@mattermost/types/marketplace';

import LoadingWrapper from 'components/widgets/loading/loading_wrapper';

import MarketplaceItem from '../marketplace_item';

export type MarketplaceItemAppProps = {
    id: string;
    name: string;
    description?: string;
    homepageUrl?: string;
    iconURL?: string;

    installed: boolean;
    labels?: MarketplaceLabel[];

    installing: boolean;
    error?: string;

    trackEvent: (category: string, event: string, props?: Record<string, unknown>) => void;

    actions: {
        installApp: (id: string) => Promise<boolean>;
        closeMarketplaceModal: () => void;
    };
};

export default class MarketplaceItemApp extends React.PureComponent <MarketplaceItemAppProps> {
    onInstall = (): void => {
        this.props.trackEvent('plugins', 'ui_marketplace_install_app', {
            app_id: this.props.id,
        });

        this.props.actions.installApp(this.props.id).then((res) => {
            if (res) {
                this.props.actions.closeMarketplaceModal();
            }
        });
    };

    getItemButton(): JSX.Element {
        if (this.props.installed && !this.props.installing && !this.props.error) {
            return (
                <button
                    className='app-installed'
                    disabled={true}
                >
                    <FormattedMessage
                        id='marketplace_modal.list.installed'
                        defaultMessage='Installed'
                    />
                </button>
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
                className='app-install always-show-enabled'
                disabled={this.props.installing}
            >
                <LoadingWrapper
                    loading={this.props.installing}
                    text={defineMessage({id: 'marketplace_modal.installing', defaultMessage: 'Installing...'})}
                >
                    {actionButton}
                </LoadingWrapper>

            </button>
        );
    }

    render(): JSX.Element {
        return (
            <>
                <MarketplaceItem
                    button={this.getItemButton()}
                    updateDetails={null}
                    versionLabel={null}
                    iconSource={this.props.iconURL}
                    {...this.props}
                />
            </>
        );
    }
}
