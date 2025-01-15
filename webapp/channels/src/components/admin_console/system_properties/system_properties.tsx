// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect} from 'react';
import {FormattedMessage, defineMessages, useIntl} from 'react-intl';
import {useDispatch} from 'react-redux';

import {setNavigationBlocked} from 'actions/admin_actions';

import AdminHeader from 'components/widgets/admin_console/admin_header';

import {AdminSection, AdminWrapper, DangerText, SectionContent, SectionHeader, SectionHeading} from './controls';
import {useUserPropertiesTable} from './user_properties_table';

import SaveChangesPanel from '../save_changes_panel';
import type {SearchableStrings} from '../types';

type Props = {
    disabled: boolean;
}

export default function SystemProperties(props: Props) {
    const {formatMessage} = useIntl();
    const dispatch = useDispatch();

    const userProperties = useUserPropertiesTable();

    const saving = userProperties.saving;
    const hasChanges = userProperties.hasChanges;
    const isValid = userProperties.isValid;
    const saveError = userProperties.saveError;

    const handleSave = () => {
        userProperties.save();
    };

    const handleCancel = () => {
        userProperties.cancel();
    };

    useEffect(() => {
        // block nav when changes are pending
        dispatch(setNavigationBlocked(hasChanges));
    }, [hasChanges]);

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
                                id='admin.system_properties.user_properties.title'
                                defaultMessage='User Properties'
                            />
                            <FormattedMessage
                                id='admin.system_properties.user_properties.subtitle'
                                defaultMessage='Customize the properties to show in user profiles'
                            />
                        </hgroup>
                    </SectionHeader>
                    <SectionContent $compact={true}>
                        {userProperties.content}
                    </SectionContent>
                </AdminSection>
            </AdminWrapper>
            <SaveChangesPanel
                saving={saving}
                saveNeeded={hasChanges}
                onClick={handleSave}
                onCancel={handleCancel}
                serverError={saveError ? (
                    <FormattedMessage
                        tagName={DangerText}
                        id='admin.system_properties.details.saving_changes_error'
                        defaultMessage='There was an error while saving the configuration'
                    />
                ) : undefined}
                savingMessage={formatMessage({id: 'admin.system_properties.details.saving_changes', defaultMessage: 'Saving configuration…'})}
                isDisabled={props.disabled || saving || !isValid}
            />
        </div>
    );
}

const msg = defineMessages({
    pageTitle: {id: 'admin.sidebar.system_properties', defaultMessage: 'System Properties'},
});

export const searchableStrings: SearchableStrings = Object.values(msg);
