// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React from 'react';
import type {MessageDescriptor} from 'react-intl';
import {FormattedMessage} from 'react-intl';

import {AdminPanel as CompassAdminPanel} from '@mattermost/compass-ui/components/admin-panel';
import type {AdminPanelProps as CompassAdminPanelProps} from '@mattermost/compass-ui/components/admin-panel';

import './admin_panel.scss';

type PanelText = MessageDescriptor | string;

// Compass AdminPanelProps is a with-header | body-only union. Plain Omit on a
// union only keeps keys common to both arms, which drops header chrome
// (showBeta, expandable, iconLeft, …). Extract the with-header arm first.
type CompassWithHeaderProps = Extract<CompassAdminPanelProps, {title: NonNullable<React.ReactNode>}>;

type Props = {
    id?: string;
    className?: string;

    /**
     * Optional. When omitted (and there is no subtitle, button, or other header
     * chrome), Compass AdminPanel renders a body-only panel (no header).
     *
     * Prefer MessageDescriptor for i18n. Plain strings are allowed when the
     * caller already formatted the copy (e.g. Workspace Optimization sections).
     */
    title?: PanelText;
    subtitle?: PanelText;
    subtitleValues?: Record<string, unknown>;
    button?: React.ReactNode;
    children?: React.ReactNode;
} & Omit<CompassWithHeaderProps, 'title' | 'subtitle' | 'headerActions' | 'children' | 'className' | 'id'>;

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
    footer,
    ...rest
}: Props) => {
    const classNameWithFlags = classNames('AdminPanel', 'clearfix', className, {
        'AdminPanel--expandable': expandable,
    });

    // Compass AdminPanel supports header-only, body-only, or both (footer optional).
    // Omit title/header chrome for body-only panels; omit children for header-only.
    if (!hasCompassHeaderChrome({title, subtitle, button, expandable, ...rest})) {
        const headerlessProps = {
            id,
            className: classNameWithFlags,
            footer,
            children,
            ...rest,
        } as CompassAdminPanelProps;

        return (
            <CompassAdminPanel
                {...headerlessProps}
            />
        );
    }

    const titleNode = renderPanelText(title);
    const headedProps = {
        id,
        className: classNameWithFlags,
        title: titleNode ?? (
            <FormattedMessage
                id='admin.panel.untitled'
                defaultMessage=' '
            />
        ),
        subtitle: renderPanelText(subtitle, subtitleValues),
        headerActions: button,
        expandable,
        footer,
        children,
        ...rest,
    } as CompassAdminPanelProps;

    return (
        <CompassAdminPanel
            {...headedProps}
        />
    );
};

export default AdminPanel;
