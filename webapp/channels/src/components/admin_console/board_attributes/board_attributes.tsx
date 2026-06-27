// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect} from 'react';
import {FormattedMessage, defineMessages, useIntl} from 'react-intl';
import {useDispatch} from 'react-redux';

import {setNavigationBlocked} from 'actions/admin_actions';

import AdminHeader from 'components/widgets/admin_console/admin_header';

import {useBoardAttributesTable} from './board_attributes_table';

import SaveChangesPanel from '../save_changes_panel';
import {AdminSection, AdminWrapper, DangerText, SectionContent, SectionHeader, SectionHeading} from '../system_properties/controls';
import type {SearchableStrings} from '../types';

type Props = {
    disabled: boolean;
};

export default function BoardAttributes(props: Props) {
    const {formatMessage} = useIntl();
    const dispatch = useDispatch();

    const boardAttributes = useBoardAttributesTable();

    const saving = boardAttributes.saving;
    const hasChanges = boardAttributes.hasChanges;
    const isValid = boardAttributes.isValid;
    const saveError = boardAttributes.saveError;

    const handleSave = () => {
        boardAttributes.save();
    };

    useEffect(() => {
        // block nav when changes are pending
        dispatch(setNavigationBlocked(hasChanges));

        // Reset on unmount so leaving with `hasChanges=true` (e.g. via the
        // discard-changes prompt) doesn't leak a stale block into the next
        // admin screen.
        return () => {
            dispatch(setNavigationBlocked(false));
        };
    }, [hasChanges, dispatch]);

    return (
        <div
            className='wrapper--fixed'
            data-testid='boardAttributes'
        >
            <AdminHeader>
                <FormattedMessage {...msg.pageTitle}/>
            </AdminHeader>
            <AdminWrapper>
                <AdminSection data-testid='board_attributes'>
                    <SectionHeader>
                        <hgroup>
                            <FormattedMessage
                                tagName={SectionHeading}
                                id='admin.board_attributes.section_title'
                                defaultMessage='Board Attributes'
                            />
                            <FormattedMessage
                                id='admin.board_attributes.section_subtitle'
                                defaultMessage='Customize the attributes available by default in cards across every board on the system.'
                            />
                        </hgroup>
                    </SectionHeader>
                    <SectionContent $compact={true}>
                        {boardAttributes.content}
                    </SectionContent>
                </AdminSection>
            </AdminWrapper>
            <SaveChangesPanel
                saving={saving}
                saveNeeded={hasChanges}
                onClick={handleSave}
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
    pageTitle: {id: 'admin.board_attributes.page_title', defaultMessage: 'Board Attributes'},
});

export const searchableStrings: SearchableStrings = Object.values(msg);
