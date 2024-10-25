// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import type {ReactNode} from 'react';
import React from 'react';
import {useIntl, FormattedMessage, defineMessages} from 'react-intl';
import {useHistory} from 'react-router-dom';

import LoadingScreen from 'components/loading_screen';
import * as Menu from 'components/menu';
import SectionNotice from 'components/section_notice';
import AdminHeader from 'components/widgets/admin_console/admin_header';

import BuildingSvg from './building.svg';
import {AdminSection, SectionHeader, SectionHeading, SectionContent, PlaceholderContainer, PlaceholderHeading} from './controls';
import {useRemoteClusterAcceptInvite} from './modals/modal_utils';
import SecureConnectionRow from './secure_connection_row';
import {getCreateLocation, getEditLocation, useRemoteClusters} from './utils';

import type {SearchableStrings} from '../types';

export default function SecureConnections() {
    const [remoteClusters, {loading, error, fetch}] = useRemoteClusters();

    const serviceNotRunning = error?.server_error_id === 'api.remote_cluster.service_not_enabled.app_error';
    const disabled = loading || serviceNotRunning;

    const placeholder = loading ? <LoadingScreen/> : (
        <Placeholder
            disabled={disabled}
            serviceNotRunning={serviceNotRunning}
        />
    );

    return (
        <div
            className='wrapper--fixed'
            data-testid='secureConnectionsSection'
        >
            <AdminHeader>
                <FormattedMessage {...msg.pageTitle}/>
            </AdminHeader>
            <AdminWrapper>
                <AdminSection>
                    <SectionHeader>
                        <hgroup>
                            <FormattedMessage
                                tagName={SectionHeading}
                                {...msg.title}
                            />
                            <FormattedMessage {...msg.subtitle}/>
                        </hgroup>
                        <AddMenu disabled={disabled}/>
                    </SectionHeader>
                    {remoteClusters?.map((rc) => {
                        return (
                            <SecureConnectionRow
                                key={rc.remote_id}
                                remoteCluster={rc}
                                onDeleteSuccess={fetch}
                                disabled={disabled}
                            />
                        );
                    }) ?? placeholder}
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

const Placeholder = ({disabled, serviceNotRunning}: {disabled: boolean; serviceNotRunning: boolean}) => {
    return (
        <SectionContent>
            {serviceNotRunning && (
                <SectionNotice
                    type='danger'
                    title={(
                        <FormattedMessage {...msg.serviceNotRunning}/>
                    )}
                />
            )}
            <PlaceholderContainer>
                <BuildingSvg/>
                <hgroup>
                    <FormattedMessage
                        tagName={PlaceholderHeading}
                        {...msg.placeholderTitle}
                    />
                    <FormattedMessage
                        tagName={'p'}
                        {...msg.placeholderSubtitle}
                    />
                </hgroup>
                <AddMenu
                    buttonClassNames='btn-tertiary'
                    disabled={disabled}
                />
            </PlaceholderContainer>
        </SectionContent>
    );
};

const menuId = 'secure_connections_add_menu';

const AddMenu = ({buttonClassNames, disabled}: {buttonClassNames?: string; disabled: boolean}) => {
    const {formatMessage} = useIntl();
    const history = useHistory();
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
                class: classNames('btn', buttonClassNames ?? 'btn-primary btn-sm', {disabled}),
                disabled,
                children: (
                    <>
                        <FormattedMessage {...msg.addConnection}/>
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
                'aria-label': formatMessage(msg.menuAriaLabel),
            }}
        >
            <Menu.Item
                id={`${menuId}-add_connection`}
                labels={<FormattedMessage {...msg.createConnection}/>}
                onClick={handleCreate}
            />
            <Menu.Item
                id={`${menuId}-accept_invitation`}
                labels={<FormattedMessage {...msg.acceptInvitation}/>}
                onClick={handleAccept}
            />
        </Menu.Container>
    );
};

const msg = defineMessages({
    pageTitle: {id: 'admin.sidebar.secureConnections', defaultMessage: 'Connected Workspaces (Beta)'},
    title: {id: 'admin.secure_connections.title', defaultMessage: 'Connected Workspaces'},
    subtitle: {id: 'admin.secure_connections.subtitle', defaultMessage: 'Connected workspaces with this server'},
    placeholderTitle: {id: 'admin.secure_connections.placeholder.title', defaultMessage: 'Share channels'},
    placeholderSubtitle: {id: 'admin.secure_connections.placeholder.subtitle', defaultMessage: 'Connecting with an external workspace allows you to share channels with them'},
    addConnection: {id: 'admin.secure_connections.menu.add_connection', defaultMessage: 'Add a connection'},
    menuAriaLabel: {id: 'admin.secure_connections.menu.dropdownAriaLabel', defaultMessage: 'Connected workspaces actions menu'},
    createConnection: {id: 'admin.secure_connections.menu.create_connection', defaultMessage: 'Create a connection'},
    acceptInvitation: {id: 'admin.secure_connections.menu.accept_invitation', defaultMessage: 'Accept an invitation'},
    serviceNotRunning: {id: 'admin.secure_connections.serviceNotRunning', defaultMessage: 'Service not running, please restart server.'},
});

export const searchableStrings: SearchableStrings = Object.values(msg);
