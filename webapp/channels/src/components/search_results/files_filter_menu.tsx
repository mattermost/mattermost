// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage, useIntl} from 'react-intl';

import {FilterVariantIcon} from '@mattermost/compass-icons/components';

import {IconContainer} from 'components/advanced_text_editor/formatting_bar/formatting_icon';
import type {SearchFilterType} from 'components/search/types';
import Menu from 'components/widgets/menu/menu';
import MenuWrapper from 'components/widgets/menu/menu_wrapper';
import WithTooltip from 'components/with_tooltip';

import './files_filter_menu.scss';

type Props = {
    selectedFilter: string;
    onFilter: (filter: SearchFilterType) => void;
};

export default function FilesFilterMenu(props: Props): JSX.Element {
    const intl = useIntl();
    return (
        <div className='FilesFilterMenu'>
            <MenuWrapper>
                <WithTooltip
                    title={
                        <FormattedMessage
                            id='channel_info_rhs.menu.files.filter'
                            defaultMessage='Filter'
                        />}
                >
                    <IconContainer
                        id='filesFilterButton'
                        className='action-icon dots-icon'
                        type='button'
                    >
                        {props.selectedFilter !== 'all' && <i className='icon-dot'/>}
                        <FilterVariantIcon
                            size={18}
                            color='currentColor'
                        />
                    </IconContainer>
                </WithTooltip>

                <Menu
                    ariaLabel={intl.formatMessage({id: 'channel_info_rhs.menu.files.filter.file_menu', defaultMessage: 'file menu'})}
                    openLeft={true}
                >
                    <Menu.ItemAction
                        ariaLabel={intl.formatMessage({id: 'channel_info_rhs.menu.files.filter.all_file_types', defaultMessage: 'All file types'})}
                        text={intl.formatMessage({id: 'channel_info_rhs.menu.files.filter.all_file_types', defaultMessage: 'All file types'})}
                        onClick={() => props.onFilter('all')}
                        icon={props.selectedFilter === 'all' ? <i className='icon icon-check'/> : null}
                    />
                    <Menu.ItemAction
                        ariaLabel={intl.formatMessage({id: 'channel_info_rhs.menu.files.filter.documents', defaultMessage: 'Documents'})}
                        text={intl.formatMessage({id: 'channel_info_rhs.menu.files.filter.documents', defaultMessage: 'Documents'})}
                        onClick={() => props.onFilter('documents')}
                        icon={props.selectedFilter === 'documents' ? <i className='icon icon-check'/> : null}
                    />
                    <Menu.ItemAction
                        ariaLabel={intl.formatMessage({id: 'channel_info_rhs.menu.files.filter.spreadsheets', defaultMessage: 'Spreadsheets'})}
                        text={intl.formatMessage({id: 'channel_info_rhs.menu.files.filter.spreadsheets', defaultMessage: 'Spreadsheets'})}
                        onClick={() => props.onFilter('spreadsheets')}
                        icon={props.selectedFilter === 'spreadsheets' ? <i className='icon icon-check'/> : null}
                    />
                    <Menu.ItemAction
                        ariaLabel={intl.formatMessage({id: 'channel_info_rhs.menu.files.filter.presentations', defaultMessage: 'Presentations'})}
                        text={intl.formatMessage({id: 'channel_info_rhs.menu.files.filter.presentations', defaultMessage: 'Presentations'})}
                        onClick={() => props.onFilter('presentations')}
                        icon={props.selectedFilter === 'presentations' ? <i className='icon icon-check'/> : null}
                    />
                    <Menu.ItemAction
                        ariaLabel={intl.formatMessage({id: 'channel_info_rhs.menu.files.filter.code', defaultMessage: 'Code'})}
                        text={intl.formatMessage({id: 'channel_info_rhs.menu.files.filter.code', defaultMessage: 'Code'})}
                        onClick={() => props.onFilter('code')}
                        icon={props.selectedFilter === 'code' ? <i className='icon icon-check'/> : null}
                    />
                    <Menu.ItemAction
                        ariaLabel={intl.formatMessage({id: 'channel_info_rhs.menu.files.filter.images', defaultMessage: 'Images'})}
                        text={intl.formatMessage({id: 'channel_info_rhs.menu.files.filter.images', defaultMessage: 'Images'})}
                        onClick={() => props.onFilter('images')}
                        icon={props.selectedFilter === 'images' ? <i className='icon icon-check'/> : null}
                    />
                    <Menu.ItemAction
                        ariaLabel={intl.formatMessage({id: 'channel_info_rhs.menu.files.filter.audio', defaultMessage: 'Audio'})}
                        text={intl.formatMessage({id: 'channel_info_rhs.menu.files.filter.audio', defaultMessage: 'Audio'})}
                        onClick={() => props.onFilter('audio')}
                        icon={props.selectedFilter === 'audio' ? <i className='icon icon-check'/> : null}
                    />
                    <Menu.ItemAction
                        ariaLabel={intl.formatMessage({id: 'channel_info_rhs.menu.files.filter.videos', defaultMessage: 'Videos'})}
                        text={intl.formatMessage({id: 'channel_info_rhs.menu.files.filter.videos', defaultMessage: 'Videos'})}
                        onClick={() => props.onFilter('video')}
                        icon={props.selectedFilter === 'video' ? <i className='icon icon-check'/> : null}
                    />
                </Menu>
            </MenuWrapper>
        </div>
    );
}
