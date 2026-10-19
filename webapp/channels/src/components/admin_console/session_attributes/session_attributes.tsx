// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useState} from 'react';
import {FormattedMessage, defineMessages, useIntl} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';

import {SESSION_ATTRIBUTES_GROUP_ID, SESSION_ATTRIBUTES_OBJECT_TYPE} from '@mattermost/types/properties_user';
import type {GlobalState} from '@mattermost/types/store';

import {fetchPropertyFields} from 'mattermost-redux/actions/properties';
import {getPropertyFieldsForObjectTypeAndGroup, getPropertyGroupByName} from 'mattermost-redux/selectors/entities/properties';

import {setNavigationBlocked} from 'actions/admin_actions';

import LoadingScreen from 'components/loading_screen';
import AdminHeader from 'components/widgets/admin_console/admin_header';

import SessionAttributesTable from './session_attributes_table';
import {useSessionAttributeEdits} from './use_session_attribute_edits';
import type {SessionAttributeEdits} from './use_session_attribute_edits';
import {SESSION_ATTRIBUTES_TARGET_TYPE} from './utils';
import type {SessionAttributeField} from './utils';

import SaveChangesPanel from '../save_changes_panel';
import {AdminSection, DangerText, SectionContent, SectionHeader, SectionHeading} from '../system_properties/controls';
import type {SearchableStrings} from '../types';

import './session_attributes.scss';

type Props = {
    disabled: boolean;
};

export default function SessionAttributesPage(props: Props) {
    const dispatch = useDispatch();
    const {formatMessage} = useIntl();

    const [loaded, setLoaded] = useState(false);
    const [loadError, setLoadError] = useState(false);

    const groupId = useSelector((state: GlobalState) =>
        getPropertyGroupByName(state, SESSION_ATTRIBUTES_GROUP_ID)?.id ?? '',
    );

    const fields = useSelector((state: GlobalState) =>
        getPropertyFieldsForObjectTypeAndGroup(state, SESSION_ATTRIBUTES_OBJECT_TYPE, groupId),
    ) as SessionAttributeField[];

    const edits = useSessionAttributeEdits(fields);

    useEffect(() => {
        let active = true;

        const load = async () => {
            try {
                await dispatch(fetchPropertyFields(SESSION_ATTRIBUTES_GROUP_ID, SESSION_ATTRIBUTES_OBJECT_TYPE, SESSION_ATTRIBUTES_TARGET_TYPE));
                if (active) {
                    setLoadError(false);
                }
            } catch {
                // Surface an error state instead of a misleading empty state.
                if (active) {
                    setLoadError(true);
                }
            } finally {
                if (active) {
                    setLoaded(true);
                }
            }
        };

        load();

        return () => {
            active = false;
        };
    }, [dispatch]);

    useEffect(() => {
        dispatch(setNavigationBlocked(edits.hasChanges));
    }, [edits.hasChanges, dispatch]);

    return (
        <div
            className='wrapper--fixed'
            data-testid='sessionAttributes'
        >
            <AdminHeader>
                <FormattedMessage {...msg.pageTitle}/>
            </AdminHeader>
            <div className='admin-console__wrapper'>
                <div className='admin-console__content SessionAttributes__content'>
                    <AdminSection data-testid='session_attributes'>
                        <SectionHeader>
                            <hgroup>
                                <FormattedMessage
                                    tagName={SectionHeading}
                                    id='admin.session_attributes.configure.title'
                                    defaultMessage='Configure session attributes'
                                />
                                <FormattedMessage
                                    id='admin.session_attributes.configure.subtitle'
                                    defaultMessage='Session attributes are evaluated per session and can be used in access control policies.'
                                />
                            </hgroup>
                        </SectionHeader>
                        <SectionContent $compact={true}>
                            <div
                                className='SessionAttributes__table-region'
                                aria-disabled={props.disabled}
                            >
                                {renderRegion(loaded, loadError, edits, props.disabled)}
                            </div>
                        </SectionContent>
                    </AdminSection>
                </div>
            </div>
            <SaveChangesPanel
                saving={edits.saving}
                saveNeeded={edits.hasChanges}
                onClick={edits.save}
                onCancel={edits.cancel}
                isDisabled={props.disabled || edits.saving}
                savingMessage={formatMessage({id: 'admin.session_attributes.saving', defaultMessage: 'Saving…'})}
                serverError={edits.serverError ? (
                    <FormattedMessage
                        tagName={DangerText}
                        id='admin.session_attributes.save_error'
                        defaultMessage='There was an error while saving the session attributes'
                    />
                ) : undefined}
            />
        </div>
    );
}

function renderRegion(loaded: boolean, loadError: boolean, edits: SessionAttributeEdits, disabled: boolean) {
    if (!loaded) {
        return <LoadingScreen/>;
    }

    if (loadError) {
        return (
            <div className='SessionAttributes__empty'>
                <FormattedMessage
                    id='admin.session_attributes.load_error'
                    defaultMessage='There was an error while loading the session attributes.'
                />
            </div>
        );
    }

    if (edits.merged.length === 0) {
        return (
            <div className='SessionAttributes__empty'>
                <FormattedMessage
                    id='admin.session_attributes.empty'
                    defaultMessage='No session attributes found.'
                />
            </div>
        );
    }

    return (
        <SessionAttributesTable
            data={edits.merged}
            onStageChange={edits.stage}
            disabled={disabled}
        />
    );
}

const msg = defineMessages({
    pageTitle: {id: 'admin.sidebar.sessionAttributes', defaultMessage: 'Session Attributes'},
});

export const searchableStrings: SearchableStrings = Object.values(msg);
