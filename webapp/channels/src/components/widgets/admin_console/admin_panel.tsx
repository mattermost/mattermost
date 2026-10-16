// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React from 'react';
import type {MessageDescriptor} from 'react-intl';
import {FormattedMessage} from 'react-intl';

import {AdminPanel as CompassAdminPanel} from '@mattermost/compass-ui/components/admin-panel';

import './admin_panel.scss';

type PanelText = MessageDescriptor | string;

type Props = {
    id?: string;
    className?: string;

    /**
     * Optional. When omitted (and there is no subtitle, button, or other header
     * chrome), the panel renders Compass AdminPanel body chrome without a header.
     * Compass AdminPanel itself always requires a title and always mounts
     * AdminPanelHeader — there is no hideHeader / headerless prop upstream.
     *
     * Prefer MessageDescriptor for i18n. Plain strings are allowed when the
     * caller already formatted the copy (e.g. Workspace Optimization sections).
     */
    title?: PanelText;
    subtitle?: PanelText;
    subtitleValues?: Record<string, unknown>;
    button?: React.ReactNode;
    children?: React.ReactNode;
} & Omit<React.ComponentProps<typeof CompassAdminPanel>, 'title' | 'subtitle' | 'headerActions' | 'children' | 'className'>;

function isMessageDescriptor(value: PanelText): value is MessageDescriptor {
    return typeof value === 'object' && value !== null && 'id' in value;
}

function renderPanelText(
    message: PanelText | undefined,
    values?: Record<string, unknown>,
): React.ReactNode | undefined {
    if (message == null || message === '') {
        return undefined;
    }
    if (typeof message === 'string') {
        return message;
    }
    if (isMessageDescriptor(message)) {
        return (
            <FormattedMessage
                {...message}
                {...(values ? {values: values as React.ComponentProps<typeof FormattedMessage>['values']} : {})}
            />
        );
    }
    return undefined;
}

function hasCompassHeaderChrome(props: {
    title?: PanelText;
    subtitle?: PanelText;
    button?: React.ReactNode;
    showBeta?: boolean;
    showEnterpriseLabel?: boolean;
    showButton?: boolean;
    showSwitch?: boolean;
    leadingIcon?: React.ReactNode;
    iconLeft?: boolean;
    expandable?: boolean;
}): boolean {
    return Boolean(
        props.title ||
        props.subtitle ||
        props.button ||
        props.showBeta ||
        props.showEnterpriseLabel ||
        props.showButton ||
        props.showSwitch ||
        props.leadingIcon ||
        props.iconLeft ||
        props.expandable,
    );
}

const AdminPanel = ({
    subtitle,
    title,
    button,
    children,
    className = '',
    id,
    subtitleValues,
    expandable,
    ...rest
}: Props) => {
    // Compass AdminPanel always renders AdminPanelHeader and types `title` as
    // required. When callers need panel chrome without a redundant header
    // (e.g. Classification Markings settings after enable moved out), omit
    // title/subtitle/actions and use a headerless shell that matches Compass
    // surface + body padding.
    if (!hasCompassHeaderChrome({title, subtitle, button, expandable, ...rest})) {
        return (
            <section
                id={id}
                className={classNames('AdminPanel', 'AdminPanel--headerless', 'clearfix', className)}
            >
                <div className='AdminPanel__body'>
                    {children}
                </div>
            </section>
        );
    }

    const titleNode = renderPanelText(title);

    return (
        <CompassAdminPanel
            id={id}
            className={classNames('AdminPanel', 'clearfix', className, {
                'AdminPanel--expandable': expandable,
            })}
            title={titleNode ?? (
                <FormattedMessage
                    id='admin.panel.untitled'
                    defaultMessage=' '
                />
            )}
            subtitle={renderPanelText(subtitle, subtitleValues)}
            headerActions={button}
            expandable={expandable}
            {...rest}
        >
            {children}
        </CompassAdminPanel>
    );
};

export default AdminPanel;
