// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import WithTooltip from 'components/with_tooltip';

import './dm_list_header.scss';

type Props = {
    onNewMessageClick: () => void;
};

const DmListHeader = ({onNewMessageClick}: Props) => {
    return (
        <div className='dm-list-header'>
            <div className='dm-list-header__left'>
                <h1 className='dm-list-header__title'>
                    <FormattedMessage
                        id='guilded_layout.dm_list.title'
                        defaultMessage='Direct Messages'
                    />
                </h1>
            </div>

            <WithTooltip
                title={
                    <FormattedMessage
                        id='guilded_layout.dm_list.new_message'
                        defaultMessage='New Message'
                    />
                }
            >
                <button
                    className='dm-list-header__new-button'
                    onClick={onNewMessageClick}
                    aria-label='New Message'
                >
                    <i className='icon icon-plus'/>
                </button>
            </WithTooltip>
        </div>
    );
};

export default DmListHeader;