// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {defineMessages, FormattedMessage, useIntl} from 'react-intl';
import {useDispatch} from 'react-redux';
import {Link} from 'react-router-dom';

import type {ClientError} from '@mattermost/client';
import {buttonClassNames} from '@mattermost/shared/components/button';
import type {PropertyField, PropertyFieldOption} from '@mattermost/types/properties';

import {Client4} from 'mattermost-redux/client';
import {ACCESS_CONTROL_PROPERTY_GROUP, CHANNEL_OBJECT_TYPE} from 'mattermost-redux/constants/properties';

import {setNavigationBlocked} from 'actions/admin_actions';

import BlockableLink from 'components/admin_console/blockable_link';
import {ColorSwatch, LevelOptionLabel} from 'components/admin_console/classification_markings/classification_markings_styled';
import {
    CLASSIFICATIONS_MARKINGS_ADMIN_URL,
    fetchChannelClassificationField,
    fetchClassificationField,
    optionsToLevels,
    saveDeleteChannelLinkedField,
} from 'components/admin_console/classification_markings/utils';
import Card from 'components/card/card';
import LoadingScreen from 'components/loading_screen';
import SaveButton from 'components/save_button';
import AdminHeader from 'components/widgets/admin_console/admin_header';

import {useChannelResourceRemove} from './remove_channel_resource_modal';

import AppliesToCard from '../applies_to/applies_to_card';
import {buildChannelFieldPatch, buildChannelFieldPayload, parseChannelFieldConfig} from '../applies_to/channels';
import type {ChannelResourceConfig} from '../applies_to/channels';
import {GLOBAL_ATTRIBUTES_LIST_ROUTE} from '../constants';

import './classification_attribute.scss';

export const CLASSIFICATION_ATTRIBUTE_ROUTE = `${GLOBAL_ATTRIBUTES_LIST_ROUTE}/classification`;

type LoadState = 'loading' | 'ready' | 'missing' | 'failed';

type Props = {
    disabled?: boolean;
};

/**
 * Classification's own attribute page.
 *
 * It exists because classification is the one attribute whose channel settings have
 * nowhere else to live: its fields are created by the Classification Markings page,
 * so the create-only card on the New attribute page can never reach them.
 *
 * The definition is deliberately read-only here. Levels, colors and ranks stay on
 * the Classification Markings page — one editor, not two.
 */
export default function ClassificationAttribute({disabled = false}: Props): JSX.Element {
    const dispatch = useDispatch();
    const {formatMessage} = useIntl();
    const {promptRemove} = useChannelResourceRemove();

    const [loadState, setLoadState] = useState<LoadState>('loading');
    const [template, setTemplate] = useState<PropertyField | null>(null);

    // The field as the server currently holds it, so Save knows whether to create,
    // patch or delete rather than inferring it from the form.
    const [channelField, setChannelField] = useState<PropertyField | null>(null);

    // null means classification does not apply to channels.
    const [channelResource, setChannelResource] = useState<ChannelResourceConfig | null>(null);

    const [saving, setSaving] = useState(false);
    const [saveFailed, setSaveFailed] = useState(false);
    const [serverErrorMessage, setServerErrorMessage] = useState<string | null>(null);

    // Gates Save, so an idle click cannot rewrite a field with what it already holds.
    const [dirty, setDirty] = useState(false);

    const isMountedRef = useRef(true);
    useEffect(() => () => {
        isMountedRef.current = false;
    }, []);

    useEffect(() => {
        (async () => {
            try {
                const [templateField, existingChannelField] = await Promise.all([
                    fetchClassificationField(),
                    fetchChannelClassificationField(),
                ]);
                if (!isMountedRef.current) {
                    return;
                }
                if (!templateField) {
                    setLoadState('missing');
                    return;
                }
                setTemplate(templateField);
                setChannelField(existingChannelField ?? null);
                setChannelResource(existingChannelField ? parseChannelFieldConfig(existingChannelField) : null);
                setLoadState('ready');
            } catch {
                if (isMountedRef.current) {
                    setLoadState('failed');
                }
            }
        })();
    }, []);

    const levels = useMemo(() => {
        const options = (template?.attrs?.options ?? []) as PropertyFieldOption[];
        return optionsToLevels(options);
    }, [template]);

    const markDirty = useCallback(() => {
        setDirty(true);
        dispatch(setNavigationBlocked(true));
        setSaveFailed(false);
        setServerErrorMessage(null);
    }, [dispatch]);

    const markClean = useCallback(() => {
        setDirty(false);
        dispatch(setNavigationBlocked(false));
    }, [dispatch]);

    const handleChannelResourceChange = useCallback((next: ChannelResourceConfig | null) => {
        setChannelResource(next);
        markDirty();
    }, [markDirty]);

    // Removal is destructive on this page in a way it is not on the New attribute
    // page: there the resource has not been saved yet, here the field exists and its
    // values go with it. So it asks, and only a saved field needs asking about.
    const handleChannelResourceRemove = useCallback(async () => {
        if (!channelField) {
            handleChannelResourceChange(null);
            return;
        }
        if (!await promptRemove()) {
            return;
        }
        setSaving(true);
        setSaveFailed(false);
        try {
            await saveDeleteChannelLinkedField(channelField.id);
            if (!isMountedRef.current) {
                return;
            }
            setChannelField(null);
            setChannelResource(null);
            markClean();
        } catch (error) {
            if (isMountedRef.current) {
                setSaveFailed(true);
                setServerErrorMessage((error as ClientError | undefined)?.message ?? null);
            }
        } finally {
            if (isMountedRef.current) {
                setSaving(false);
            }
        }
    }, [channelField, handleChannelResourceChange, markClean, promptRemove]);

    const canSave = dirty && !saving && !disabled;

    const handleSave = useCallback(async () => {
        if (!template || !canSave) {
            return;
        }
        setSaving(true);
        setSaveFailed(false);
        try {
            if (channelResource && channelField) {
                const patched = await Client4.patchPropertyField(
                    ACCESS_CONTROL_PROPERTY_GROUP,
                    CHANNEL_OBJECT_TYPE,
                    channelField.id,
                    buildChannelFieldPatch(channelResource),
                );
                if (!isMountedRef.current) {
                    return;
                }
                setChannelField(patched);
                setChannelResource(parseChannelFieldConfig(patched));
            } else if (channelResource) {
                const created = await Client4.createPropertyField(
                    ACCESS_CONTROL_PROPERTY_GROUP,
                    CHANNEL_OBJECT_TYPE,
                    buildChannelFieldPayload(template, channelResource),
                );
                if (!isMountedRef.current) {
                    return;
                }
                setChannelField(created);
                setChannelResource(parseChannelFieldConfig(created));
            }

            if (!isMountedRef.current) {
                return;
            }
            markClean();
        } catch (error) {
            if (isMountedRef.current) {
                setSaveFailed(true);
                setServerErrorMessage((error as ClientError | undefined)?.message ?? null);
            }
        } finally {
            if (isMountedRef.current) {
                setSaving(false);
            }
        }
    }, [canSave, channelField, channelResource, markClean, template]);

    return (
        <div
            className='wrapper--fixed ClassificationAttribute'
            data-testid='classificationAttribute'
        >
            <AdminHeader withBackButton={true}>
                <div>
                    <BlockableLink
                        to={GLOBAL_ATTRIBUTES_LIST_ROUTE}
                        className='fa fa-angle-left back'
                        aria-label={formatMessage(messages.backLink)}
                        data-testid='classificationAttributeBackLink'
                    />
                    <hgroup className='ClassificationAttribute__headerGroup'>
                        <FormattedMessage
                            tagName='h1'
                            {...messages.title}
                        />
                        <FormattedMessage
                            tagName='p'
                            {...messages.subtitle}
                        />
                    </hgroup>
                </div>
            </AdminHeader>
            <div className='admin-console__wrapper'>
                <div className='admin-console__content'>
                    {loadState === 'loading' && <LoadingScreen/>}
                    {loadState === 'missing' && (
                        <p
                            className='ClassificationAttribute__notice'
                            data-testid='classificationAttributeMissing'
                        >
                            <FormattedMessage
                                {...messages.notConfigured}
                                values={{link: (
                                    <Link to={CLASSIFICATIONS_MARKINGS_ADMIN_URL}>
                                        <FormattedMessage {...messages.markingsPageName}/>
                                    </Link>
                                )}}
                            />
                        </p>
                    )}
                    {loadState === 'failed' && (
                        <p
                            className='ClassificationAttribute__notice'
                            role='alert'
                            data-testid='classificationAttributeLoadError'
                        >
                            <FormattedMessage {...messages.loadFailed}/>
                        </p>
                    )}
                    {loadState === 'ready' && template && (
                        <>
                            <Card
                                expanded={true}
                                disableExpandAnimation={true}
                                className='console'
                            >
                                <Card.Header>
                                    <div className='ClassificationAttribute__cardHeader'>
                                        <div className='ClassificationAttribute__blockTitle'>
                                            <FormattedMessage {...messages.definitionTitle}/>
                                        </div>
                                        <FormattedMessage
                                            tagName='p'
                                            {...messages.definitionSubtitle}
                                            values={{link: (
                                                <Link
                                                    to={CLASSIFICATIONS_MARKINGS_ADMIN_URL}
                                                    data-testid='classificationAttributeMarkingsLink'
                                                >
                                                    <FormattedMessage {...messages.markingsPageName}/>
                                                </Link>
                                            )}}
                                        />
                                    </div>
                                </Card.Header>
                                <Card.Body expanded={true}>
                                    <div className='ClassificationAttribute__row'>
                                        <span className='ClassificationAttribute__label'>
                                            <FormattedMessage {...messages.nameLabel}/>
                                        </span>
                                        <span data-testid='classificationAttributeName'>{template.name}</span>
                                    </div>
                                    <div className='ClassificationAttribute__row'>
                                        <span className='ClassificationAttribute__label'>
                                            <FormattedMessage {...messages.typeLabel}/>
                                        </span>
                                        <span data-testid='classificationAttributeType'>
                                            <FormattedMessage {...messages.typeRank}/>
                                        </span>
                                    </div>
                                    <div className='ClassificationAttribute__row'>
                                        <span className='ClassificationAttribute__label'>
                                            <FormattedMessage {...messages.levelsLabel}/>
                                        </span>
                                        <ul
                                            className='ClassificationAttribute__levels'
                                            data-testid='classificationAttributeLevels'
                                        >
                                            {levels.map((level) => (
                                                <li key={level.id}>
                                                    <LevelOptionLabel>
                                                        <ColorSwatch style={{backgroundColor: level.color}}/>
                                                        {level.name}
                                                    </LevelOptionLabel>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                </Card.Body>
                            </Card>
                            <AppliesToCard
                                ordered={true}
                                channelResource={channelResource}
                                onChannelResourceChange={handleChannelResourceChange}
                                onChannelResourceRemove={handleChannelResourceRemove}
                                disabled={saving || disabled}
                            />
                        </>
                    )}
                </div>
            </div>
            {loadState === 'ready' && (
                <div className='admin-console-save'>
                    <SaveButton
                        disabled={!canSave}
                        saving={saving}
                        onClick={handleSave}
                        defaultMessage={<FormattedMessage {...messages.save}/>}
                    />
                    <BlockableLink
                        className={buttonClassNames({emphasis: 'quaternary'})}
                        to={GLOBAL_ATTRIBUTES_LIST_ROUTE}
                        data-testid='classificationAttributeCancelLink'
                    >
                        <FormattedMessage {...messages.cancel}/>
                    </BlockableLink>
                    {saveFailed && (
                        <span
                            className='ClassificationAttribute__error'
                            role='alert'
                            data-testid='classificationAttributeSaveError'
                        >
                            <i className='icon icon-alert-outline'/>
                            {serverErrorMessage ?? formatMessage(messages.saveFailed)}
                        </span>
                    )}
                </div>
            )}
        </div>
    );
}

const messages = defineMessages({
    backLink: {id: 'admin.global_attributes.classification.back_link', defaultMessage: 'Back to Manage Attributes'},
    title: {id: 'admin.global_attributes.classification.title', defaultMessage: 'Classification'},
    subtitle: {
        id: 'admin.global_attributes.classification.subtitle',
        defaultMessage: 'Choose the resources classification applies to, and how it behaves on each.',
    },
    definitionTitle: {id: 'admin.global_attributes.classification.definition.title', defaultMessage: 'Definition'},
    definitionSubtitle: {
        id: 'admin.global_attributes.classification.definition.subtitle',
        defaultMessage: 'Levels, colors and ranks are edited on the {link} page.',
    },
    markingsPageName: {
        id: 'admin.global_attributes.classification.markings_page_name',
        defaultMessage: 'Classification Markings',
    },
    nameLabel: {id: 'admin.global_attributes.classification.name_label', defaultMessage: 'Name'},
    typeLabel: {id: 'admin.global_attributes.classification.type_label', defaultMessage: 'Type'},
    typeRank: {id: 'admin.global_attributes.classification.type_rank', defaultMessage: 'Rank'},
    levelsLabel: {id: 'admin.global_attributes.classification.levels_label', defaultMessage: 'Levels'},
    notConfigured: {
        id: 'admin.global_attributes.classification.not_configured',
        defaultMessage: 'Classification is not set up yet. Enable it on the {link} page first.',
    },
    loadFailed: {
        id: 'admin.global_attributes.classification.load_failed',
        defaultMessage: 'Something went wrong while loading classification. Please try again.',
    },
    saveFailed: {
        id: 'admin.global_attributes.classification.save_failed',
        defaultMessage: 'Something went wrong while saving. Please try again.',
    },
    save: {id: 'admin.global_attributes.classification.save', defaultMessage: 'Save'},
    cancel: {id: 'admin.global_attributes.classification.cancel', defaultMessage: 'Cancel'},
});
