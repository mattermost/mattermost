// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect} from 'react';
import {FormattedMessage, defineMessages, useIntl} from 'react-intl';
import {useDispatch} from 'react-redux';

import {PlusIcon} from '@mattermost/compass-icons/components';
import type {UserPropertyField} from '@mattermost/types/properties';
import {collectionToArray} from '@mattermost/types/utilities';

import {setNavigationBlocked} from 'actions/admin_actions';

import LoadingScreen from 'components/loading_screen';
import AdminHeader from 'components/widgets/admin_console/admin_header';

import {AdminSection, AdminWrapper, LinkButton, SectionContent, SectionHeader, SectionHeading} from './controls';
import {SharedChannelRemotesTable} from './user_properties_table';
import {newPendingField, useUserPropertyFields} from './user_properties_utils';

import SaveChangesPanel from '../team_channel_settings/save_changes_panel';
import type {SearchableStrings} from '../types';

type Props = {
    disabled: boolean;
}
export default function SystemProperties(props: Props) {
    const {formatMessage} = useIntl();
    const dispatch = useDispatch();

    const [{data, order}, readIO, pendingIO] = useUserPropertyFields();

    const handleSave = async () => {
        const newData = await pendingIO.commit();

        if (newData && !newData.errors) {
            readIO.setData(newData);
        }
    };

    const handleCancel = () => {
        pendingIO.reset();
    };

    useEffect(() => {
        // block nav when changes are pending
        dispatch(setNavigationBlocked(pendingIO.hasChanges));
    }, [pendingIO.hasChanges]);

    const handleFieldChange = (field: UserPropertyField) => {
        pendingIO.apply((current) => {
            if (field.delete_at !== 0 && field.create_at === 0) {
                // immediately remove if deleting a field that is pending creation
                const data = {...current.data};
                Reflect.deleteProperty(data, field.id);
                const order = current.order.filter((id) => id !== field.id);

                return {data, order};
            }

            // else normal patch for update, delete, and create flows
            const data = {...current.data, [field.id]: field};
            const order = current.order;

            return {data, order};
        });
    };

    const handleCreateField = () => {
        pendingIO.apply((current) => {
            const item = newPendingField();
            const data = {...current.data, [item.id]: item};
            const order = [...current.order, item.id];

            return {data, order};
        });
    };

    return (
        <div
            className='wrapper--fixed'
            data-testid='systemProperties'
        >
            <AdminHeader>
                <FormattedMessage {...msg.pageTitle}/>
            </AdminHeader>
            <AdminWrapper>
                <AdminSection data-testid='user_properties'>
                    <SectionHeader>
                        <hgroup>
                            <FormattedMessage
                                tagName={SectionHeading}
                                id='admin.user_properties.title'
                                defaultMessage='User properties'
                            />
                            <FormattedMessage
                                id='admin.user_properties.subtitle'
                                defaultMessage='Customize the properties to show in user profiles'
                            />
                        </hgroup>
                    </SectionHeader>
                    <SectionContent $compact={true}>
                        {readIO.loading || !data || !order ? (
                            <LoadingScreen/>
                        ) : (
                            <>
                                <SharedChannelRemotesTable
                                    data={collectionToArray({data, order})}
                                    updateField={handleFieldChange}
                                />
                                <LinkButton onClick={handleCreateField}>
                                    <PlusIcon size={16}/>
                                    <FormattedMessage
                                        id='admin.user_properties.'
                                        defaultMessage='Add property'
                                    />
                                </LinkButton>
                            </>
                        )}
                    </SectionContent>
                </AdminSection>
            </AdminWrapper>
            <SaveChangesPanel
                saving={pendingIO.saving}
                saveNeeded={pendingIO.hasChanges}
                onClick={handleSave}
                onCancel={handleCancel}
                cancelLink='/admin_console/site_config/system_properties'
                serverError={pendingIO.error ? (
                    <FormattedMessage
                        id='admin.system_properties.details.saving_changes_error'
                        defaultMessage='There was an error while saving the configuration'
                    />
                ) : undefined}
                savingMessage={formatMessage({id: 'admin.system_properties.details.saving_changes', defaultMessage: 'Saving configuration…'})}
                isDisabled={props.disabled}
            />
        </div>
    );
}

const msg = defineMessages({
    pageTitle: {id: 'admin.sidebar.system_properties', defaultMessage: 'System Properties'},
});

export const searchableStrings: SearchableStrings = Object.values(msg);
