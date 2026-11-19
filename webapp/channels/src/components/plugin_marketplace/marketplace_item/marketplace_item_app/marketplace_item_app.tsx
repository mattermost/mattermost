// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {type JSX} from 'react';
import {FormattedMessage} from 'react-intl';

import {Button} from '@mattermost/compass-ui/components/button';
import type {MarketplaceLabel} from '@mattermost/types/marketplace';

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

    actions: {
        installApp: (id: string) => Promise<boolean>;
        closeMarketplaceModal: () => void;
    };
};

export default class MarketplaceItemApp extends React.PureComponent <MarketplaceItemAppProps> {
    onInstall = (): void => {
        this.props.actions.installApp(this.props.id).then((res) => {
            if (res) {
                this.props.actions.closeMarketplaceModal();
            }
        });
    };

    getItemButton(): JSX.Element {
        if (this.props.installed && !this.props.installing && !this.props.error) {
            return (
                <Button
                    className='app-installed'
                    emphasis='tertiary'
                    disabled={true}
                >
                    <FormattedMessage
                        id='marketplace_modal.list.installed'
                        defaultMessage='Installed'
                    />
                </Button>
            );
        }

        let actionLabel: JSX.Element;
        if (this.props.installing) {
            actionLabel = (
                <FormattedMessage
                    id='marketplace_modal.installing'
                    defaultMessage='Installing...'
                />
            );
        } else if (this.props.error) {
            actionLabel = (
                <FormattedMessage
                    id='marketplace_modal.list.try_again'
                    defaultMessage='Try Again'
                />
            );
        } else {
            actionLabel = (
                <FormattedMessage
                    id='marketplace_modal.list.install'
                    defaultMessage='Install'
                />
            );
        }

        return (
            <Button
                onClick={this.onInstall}
                className='app-install'
                loading={this.props.installing}
            >
                {actionLabel}
            </Button>
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
