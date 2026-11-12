// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage, defineMessages} from 'react-intl';

import ExternalLink from 'components/external_link';
import AdminPanel from 'components/widgets/admin_console/admin_panel';

type Props = {
    filterToggle: boolean;
    setFilterToggle: (value: boolean) => void;
};

const messages = defineMessages({
    title: {id: 'admin.ip_filtering.enable_ip_filtering', defaultMessage: 'Enable IP Filtering'},
    subtitle: {
        id: 'admin.ip_filtering.enable_ip_filtering_description',
        defaultMessage: 'Limit access to your workspace by IP address. <learnmore>Learn more in the docs</learnmore>',
    },
});

const EnableSectionContent: React.FC<Props> = ({filterToggle, setFilterToggle}) => {
    const switchLabel = filterToggle ? (
        <FormattedMessage
            id='admin.ip_filtering.on'
            defaultMessage='On'
        />
    ) : (
        <FormattedMessage
            id='admin.ip_filtering.off'
            defaultMessage='Off'
        />
    );

    return (
        <AdminPanel
            id='ip_filtering_enable'
            title={messages.title}
            subtitle={messages.subtitle}
            subtitleValues={{
                learnmore: (msg: string) => (
                    <ExternalLink
                        href='https://mattermost.com/pl/cloud-ip-filtering'
                        location={'ip_filtering_enable_section'}
                    >
                        {msg}
                    </ExternalLink>
                ),
            }}
            showSwitch={true}
            switchLabel={switchLabel}
            switchChecked={filterToggle}
            switchDisabled={false}
            onSwitchChange={(checked) => setFilterToggle(checked)}
        />
    );
};

export default EnableSectionContent;
