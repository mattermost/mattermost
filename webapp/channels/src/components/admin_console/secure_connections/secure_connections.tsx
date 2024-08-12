// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import type {ReactNode} from 'react';
import React from 'react';
import {useIntl, FormattedMessage, defineMessages} from 'react-intl';
import {useHistory} from 'react-router-dom';

import LoadingScreen from 'components/loading_screen';
import * as Menu from 'components/menu';
import AdminHeader from 'components/widgets/admin_console/admin_header';

import BuildingSvg from './building.svg';
import {AdminSection, SectionHeader, SectionHeading, SectionContent, PlaceholderContainer, PlaceholderHeading} from './controls';
import SecureConnectionRow from './secure_connection_row';
import {getCreateLocation, getEditLocation, useRemoteClusterAcceptInvite, useRemoteClusters} from './utils';

import type {SearchableStrings} from '../types';

export default function SecureConnections() {
    const {formatMessage} = useIntl();
    const [remoteClusters, {isLoading, fetch}] = useRemoteClusters();

    return (
        <div
            className='wrapper--fixed'
            data-testid='secureConnectionsSection'
        >
            <AdminHeader>
                <span id='secureConnections-header'>{formatMessage(messages.title)}</span>
            </AdminHeader>
            <AdminWrapper>
                <AdminSection>
                    <SectionHeader>
                        <hgroup>
                            <SectionHeading>{formatMessage(messages.title)}</SectionHeading>
                            <FormattedMessage {...messages.subtitle}/>
                        </hgroup>
                        <AddMenu/>
                    </SectionHeader>
                    {remoteClusters?.map((rc) => {
                        return (
                            <SecureConnectionRow
                                key={rc.remote_id}
                                remoteCluster={rc}
                                onDeleteSuccess={fetch}
                            />
                        );
                    }) ?? (isLoading ? <LoadingScreen/> : <Placeholder/>)}
                </AdminSection>
            </AdminWrapper>
        </div>
    );
}

const AdminWrapper = (props: {children: ReactNode}) => {
    return (
        <div className='admin-console__wrapper'>
            <div className='admin-console__content'>
                {props.children}
            </div>
        </div>
    );
};

const Placeholder = () => {
    return (
        <SectionContent>
            <PlaceholderContainer>
                <BuildingSvg/>
                <hgroup>
                    <FormattedMessage
                        tagName={PlaceholderHeading}
                        {...messages.placeholderTitle}
                    />
                    <FormattedMessage
                        tagName={'p'}
                        {...messages.placeholderSubtitle}
                    />
                </hgroup>
                <AddMenu buttonClassNames='btn-tertiary'/>
            </PlaceholderContainer>
        </SectionContent>
    );
};

const menuId = 'secure_connections_add_menu';

const AddMenu = (props: {buttonClassNames?: string}) => {
    const {formatMessage} = useIntl();
    const history = useHistory();
    const disabled = false;
    const {promptAcceptInvite} = useRemoteClusterAcceptInvite();

    const handleCreate = () => {
        history.push(getCreateLocation());
    };

    const handleAccept = async () => {
        const rc = await promptAcceptInvite();
        if (rc) {
            history.push(getEditLocation(rc));
        }
    };

    return (
        <Menu.Container
            menuButton={{
                id: `${menuId}-button`,
                class: classNames('btn', props.buttonClassNames ?? 'btn-primary btn-sm', {disabled}),
                disabled,
                children: (
                    <>
                        <FormattedMessage {...messages.addConnection}/>
                        {!disabled && (
                            <i
                                aria-hidden='true'
                                className='icon icon-chevron-down'
                            />
                        )}
                    </>
                ),
            }}
            menu={{
                id: menuId,
                'aria-label': formatMessage(messages.menuAriaLabel),
            }}
        >
            <Menu.Item
                id={`${menuId}-add_connection`}
                labels={<FormattedMessage {...messages.createConnection}/>}
                onClick={handleCreate}
            />
            <Menu.Item
                id={`${menuId}-accept_invitation`}
                labels={<FormattedMessage {...messages.acceptInvitation}/>}
                onClick={handleAccept}
            />
        </Menu.Container>
    );
};

const messages = defineMessages({
    title: {id: 'admin.secure_connections.title', defaultMessage: 'Secure Connections'},
    subtitle: {id: 'admin.secure_connections.subtitle', defaultMessage: 'Secure connections with this server'},
    placeholderTitle: {id: 'admin.secure_connections.placeholder.title', defaultMessage: 'Share channels'},
    placeholderSubtitle: {id: 'admin.secure_connections.placeholder.subtitle', defaultMessage: 'Connecting with an external organization allows you to share channels with them'},
    addConnection: {id: 'admin.secure_connections.menu.add_connection', defaultMessage: 'Add a connection'},
    menuAriaLabel: {id: 'admin.secure_connections.menu.dropdownAriaLabel', defaultMessage: 'Connected organizations actions menu'},
    createConnection: {id: 'admin.secure_connections.menu.create_connection', defaultMessage: 'Create a connection'},
    acceptInvitation: {id: 'admin.secure_connections.menu.accept_invitation', defaultMessage: 'Accept an invitation'},
});

export const searchableStrings: SearchableStrings = Object.values(messages);
