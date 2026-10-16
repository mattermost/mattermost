// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React from 'react';
import type {MessageDescriptor} from 'react-intl';
import {FormattedMessage} from 'react-intl';

import {AdminPanel as CompassAdminPanel} from '@mattermost/compass-ui/components/admin-panel';

import './admin_panel.scss';

type Props = {
    id?: string;
    className?: string;

    /**
     * Optional. When omitted (and there is no subtitle, button, or other header
     * chrome), the panel renders Compass AdminPanel body chrome without a header.
     * Compass AdminPanel itself always requires a title and always mounts
     * AdminPanelHeader — there is no hideHeader / headerless prop upstream.
     */
    title?: MessageDescriptor;
    subtitle?: MessageDescriptor;
    subtitleValues?: Record<string, unknown>;
    button?: React.ReactNode;
    children?: React.ReactNode;
} & Omit<React.ComponentProps<typeof CompassAdminPanel>, 'title' | 'subtitle' | 'headerActions' | 'children' | 'className'>;

function hasCompassHeaderChrome(props: {
    title?: MessageDescriptor;
    subtitle?: MessageDescriptor;
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
    ...rest
}: Props) => {
    // Compass AdminPanel always renders AdminPanelHeader and types `title` as
    // required. When callers need panel chrome without a redundant header
    // (e.g. Classification Markings settings after enable moved out), omit
    // title/subtitle/actions and use a headerless shell that matches Compass
    // surface + body padding.
    if (!hasCompassHeaderChrome({title, subtitle, button, ...rest})) {
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

    return (
        <CompassAdminPanel
            id={id}
            className={classNames('AdminPanel', 'clearfix', className)}
            title={title ? (
                <FormattedMessage {...title}/>
            ) : (
                // Subtitle/actions without a title still need Compass's required
                // title slot; AdminSectionPanel uses the same space fallback.
                <FormattedMessage
                    id='admin.panel.untitled'
                    defaultMessage=' '
                />
            )}
            subtitle={subtitle ? (
                <FormattedMessage
                    {...subtitle}
                    {...(subtitleValues ? {values: subtitleValues as React.ComponentProps<typeof FormattedMessage>['values']} : {})}
                />
            ) : undefined}
            headerActions={button}
            {...rest}
        >
            {children}
        </CompassAdminPanel>
    );
};

export default AdminPanel;
