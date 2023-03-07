// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {ReactNode, useEffect, useState} from 'react';
import {useIntl} from 'react-intl';
import classnames from 'classnames';
import styled from 'styled-components';

import {haveISystemPermission} from 'mattermost-redux/selectors/entities/roles';

import store from 'stores/redux_store';
import NotifyAdminCTA from 'components/notify_admin_cta/notify_admin_cta';

import {MattermostFeatures} from 'utils/constants';

interface GenericPreviewSectionProps {
    items: Array<{ id: string; name?: string; illustration?: string }>;
    onUpdateIllustration?: (illustration: string) => void;
    className?: string;
    message?: string;
    id?: string;
}

type IntegrationPreviewSectionItemsProps = {id: string; name?: string; category?: string; description?: string; icon?: string; installed?: boolean}

interface IntegrationPreviewSectionProps {
    items: IntegrationPreviewSectionItemsProps[];
    className?: string;
    message?: string;
    id?: string;
    categoryId?: string;
}

const SYSCONSOLE_WRITE_PLUGINS = 'sysconsole_write_plugins';
const getState = store.getState;

const viewPreview = (props: GenericPreviewSectionProps | IntegrationPreviewSectionProps) => {
    if (props.id === 'integrations') {
        const integrationsProps = props as IntegrationPreviewSectionProps;
        return (
            <IntegrationsPreview
                categoryId={integrationsProps.categoryId}
                items={integrationsProps.items}
            />);
    }
    const genericProps = props as GenericPreviewSectionProps;
    return (
        <GenericPreview
            items={props.items}
            onUpdateIllustration={genericProps.onUpdateIllustration}
        />);
};

const PreviewSection = (props: GenericPreviewSectionProps | IntegrationPreviewSectionProps) => {
    const {formatMessage} = useIntl();
    return (
        <div className={props.className}>
            <p>
                {props.message}
            </p>
            <span className='included-title'>
                {
                    formatMessage({
                        id: 'work_templates.preview.section.included',
                        defaultMessage: 'Included',
                    })
                }
            </span>
            {viewPreview(props)}

        </div>
    );
};

const IntegrationsPreview = ({items, categoryId}: IntegrationPreviewSectionProps) => {
    const state = getState();
    const {formatMessage} = useIntl();

    const haveIWritePluginPermission = haveISystemPermission(state, {permission: SYSCONSOLE_WRITE_PLUGINS});
    const [pluginInstallationPossible, setPluginInstallationPossible] = useState(false);

    useEffect(() => {
        if (haveIWritePluginPermission) {
            setPluginInstallationPossible(true);
        }
    }, [haveIWritePluginPermission]);

    const pluginsToInstall = items.filter((item) => !item.installed);

    const createWarningMessage = () => {
        if (pluginsToInstall.length === 1) {
            return formatMessage(
                {
                    id: 'work_templates.preview.integrations.admin_install.single_plugin',
                    defaultMessage: '{plugin} will not be added until admin installs it.',
                },
                {
                    plugin: pluginsToInstall[0].name,
                });
        } else if (pluginsToInstall.length > 1) {
            return formatMessage({
                id: 'work_templates.preview.integrations.admin_install.multiple_plugin',
                defaultMessage: 'Integrations will not be added until admin installs them.',
            });
        }
        return '';
    };
    const warningMessage = pluginInstallationPossible ? '' : createWarningMessage();
    const notifyAdminCTA = formatMessage({
        id: 'work_templates.preview.integrations.admin_install.notify',
        defaultMessage: 'Notify admin to install integrations.',
    });
    return (
        <div className='preview-integrations'>
            <div className='preview-integrations-plugins'>
                {items.map((item) => {
                    return (
                        <div
                            key={item.id}
                            className={classnames('preview-integrations-plugins-item', {'preview-integrations-plugins-item__readonly': !item.installed && !pluginInstallationPossible})}
                        >
                            <div className='preview-integrations-plugins-item__icon'>
                                <img src={item.icon}/>
                            </div>
                            <div className='preview-integrations-plugins-item__name'>
                                {item.name}
                            </div>
                            {item.installed &&
                                <div className='icon-check-circle preview-integrations-plugins-item__icon_blue'/>}
                            {!item.installed && <div className='icon-download-outline'/>}
                        </div>);
                })}
            </div>

            {warningMessage &&
                <>
                    <div className='preview-integrations-warning'>
                        <div className='icon-alert-outline'/>
                        <div className='preview-integrations-warning-message'> {warningMessage} </div>
                    </div>

                    <NotifyAdminCTA
                        callerInfo={`${MattermostFeatures.PLUGIN_FEATURE}-${categoryId}`}
                        ctaText={notifyAdminCTA}
                        notifyRequestData={{
                            required_plan: pluginsToInstall.map((plugin) => plugin.id).join(','),
                            required_feature: `${MattermostFeatures.PLUGIN_FEATURE}-${categoryId}`,
                            trial_notification: false,
                        }}
                    />
                </>}
        </div>

    );
};

const GenericPreview = ({items, onUpdateIllustration}: GenericPreviewSectionProps) => {
    const updateIllustration = (e: React.MouseEvent<HTMLAnchorElement>, illustration: string) => {
        e.preventDefault();
        onUpdateIllustration?.(illustration);
    };

    if (!items || items.length === 0) {
        return null;
    }

    let list: ReactNode = (<li key={items[0].id}>{items[0].name}</li>);
    if (items.length > 1) {
        list = items.map((c) => (
            <li key={c.id}>
                <a
                    href='#'
                    onClick={(e) => updateIllustration(e, c.illustration || '')}
                >
                    {c.name}
                </a>
            </li>
        ));
    }

    return (<ul>{list}</ul>);
};

const StyledPreviewSection = styled(PreviewSection)`
    .included-title {
        color: rgba(var(--center-channel-color-rgb), 0.56);
        font-weight: 600;
        text-transform: uppercase;
    }

    .preview-integrations {
        #notify_admin_cta {
            padding: 0 2px;
            font-family: 'Open Sans';
            font-style: normal;
            font-weight: 600;
            font-size: 11px;
            line-height: 10px;
        }
        &-plugins {
            display: flex;
            flex-wrap: wrap;
            margin-top: 8px;
            gap: 8px;

            &-item {
                display: flex;
                width: 128px;
                height: 48px;
                flex-basis: 45%;
                border: 1px solid rgba(var(--center-channel-text-rgb), 0.24);
                border-radius: 4px;

                &__readonly {
                    opacity: 65%;
                }

                &__icon {
                    display: flex;
                    width: 24px;
                    height: 24px;
                    align-items: center;
                    margin: 12px 10px;

                    img {
                        position: relative !important;
                        width: 100%;
                        height: 100%;
                    }

                    &_blue {
                        color: var(--denim-button-bg);
                    }
                }

                &__name {
                    flex-grow: 2;
                    margin-top: 8px;
                    color: var(--center-channel-text);
                    font-family: 'Open Sans';
                    font-size: 11px;
                    font-style: normal;
                    font-weight: 600;
                    letter-spacing: 0.02em;
                    line-height: 22px;
                }
            }
        }

        &-warning {
            display: flex;
            margin: 8px 0px;
            color: var(--error-text);

            &-message {
                margin-left: 3px;
                font-family: 'Open Sans';
                font-size: 11px;
                font-style: normal;
                font-weight: 600;
                line-height: 16px;
            }
        }
    }

    .icon-check-circle::before {
        margin-top: 8px;
        margin-right: 8px;
    }

    .icon-download-outline::before {
        margin-top: 8px;
        margin-right: 8px;
    }
`;

export default StyledPreviewSection;
