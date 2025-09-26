// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';
import styled from 'styled-components';

import InfoIcon from '@mattermost/compass-icons/components/information-outline';

import './auto_translate_info.scss';

import ExternalLink from 'components/external_link';

const Section = styled.div`
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    align-self: stretch;
    border-radius: 4px;
    border: 1px solid rgba(87, 158, 255, 0.16);
    background: rgba(87, 158, 255, 0.08);
`;

const Content = styled.div`
    display: flex;
    padding: 16px;
    align-items: flex-start;
    gap: 12px;
    align-self: stretch;
`;

const Body = styled.div`
    display: flex;
    padding-right: 24px;
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
    flex: 1 0 0;
`;

const AutoTranslateInfo = () => {
    return (
        <Section>
            <Content id='autoTranslateInfo'>
                <InfoIcon
                    className='auto-translate-info-icon'
                    aria-hidden='true'
                    size={20}
                    color={'var(--sidebar-text-active-border)'}
                />
                <Body>
                    <span>
                        <FormattedMessage
                            id='admin.general.localization.autoTranslateInfo'
                            defaultMessage="Auto-translation must also be enabled in each channel where it's needed."
                        />
                    </span>
                    <span className='auto-translate-info-secondary'>
                        <FormattedMessage
                            id='admin.general.localization.autoTranslateInfoSecondary'
                            defaultMessage='When multiple languages are detected, users will be prompted to enable auto-translation. <link>Learn more</link>'
                            values={{
                                link: (msg: string) => (
                                    <ExternalLink
                                        location='admin_console'
                                        href='http://docs.mattermost.com/'
                                    >
                                        {msg}
                                    </ExternalLink>
                                ),
                            }}
                        />
                    </span>
                </Body>
            </Content>
        </Section>
    );
};

export default React.memo(AutoTranslateInfo);
