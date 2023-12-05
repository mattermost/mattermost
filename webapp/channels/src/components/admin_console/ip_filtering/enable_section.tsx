// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage, useIntl} from 'react-intl';

import ExternalLink from 'components/external_link';
import Toggle from 'components/toggle';

type Props = {
    filterToggle: boolean;
    setFilterToggle: (value: boolean) => void;
};

const EnableSectionContent: React.FC<Props> = ({filterToggle, setFilterToggle}) => {
    const {formatMessage} = useIntl();

    return (
        <div className='EnableSectionContent'>
            <div className='TitleSubtitleContent'>
                <div className='TitleSubtitle'>
                    <div className='Title'>
                        {formatMessage({id: 'admin.ip_filtering.enable_ip_filtering', defaultMessage: 'Enable IP Filtering'})}
                    </div>
                    <div className='Subtitle'>
                        <FormattedMessage
                            id={'admin.ip_filtering.enable_ip_filtering_description'}
                            defaultMessage={'Limit access to your workspace by IP address. <learnmore>Learn more in the docs</learnmore>'}
                            values={{
                                learnmore: (msg) => (
                                    <ExternalLink
                                        href='https://mattermost.com/pl/cloud-ip-filtering'
                                        location={'ip_filtering_enable_section'}
                                    >
                                        {msg}
                                    </ExternalLink>
                                ),
                            }}
                        />
                    </div>
                </div>
                <div className='SwitchSelector'>
                    <Toggle
                        size={'btn-md'}
                        id={'filterToggle'}
                        disabled={false}
                        onToggle={() => setFilterToggle(!filterToggle)}
                        toggled={filterToggle}
                        toggleClassName='btn-toggle-primary'
                    />
                </div>
            </div>
        </div>
    );
};

export default EnableSectionContent;
