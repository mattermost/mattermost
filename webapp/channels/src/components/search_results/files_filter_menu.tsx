// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

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
    return (
        <div className='FilesFilterMenu'>
            <MenuWrapper>
                <WithTooltip
                    id='files-filter-tooltip'
                    title={
                        <FormattedMessage
                            id='channel_info_rhs.menu.files.filter'
                            defaultMessage='Filter'
                        />}
                    placement='top'
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
                    ariaLabel={'file menu'}
                    openLeft={true}
                >
                    <Menu.ItemAction
                        ariaLabel={'All file types'}
                        text={
                            <FormattedMessage
                                id='channel_info_rhs.menu.files.filter.type.all'
                                defaultMessage='All file types'
                            />
                        }
                        onClick={() => props.onFilter('all')}
                        icon={props.selectedFilter === 'all' ? <i className='icon icon-check'/> : null}
                    />
                    <Menu.ItemAction
                        ariaLabel={'Documents'}
                        text={
                            <FormattedMessage
                                id='channel_info_rhs.menu.files.filter.type.documents'
                                defaultMessage='Documents'
                            />
                        }
                        onClick={() => props.onFilter('documents')}
                        icon={props.selectedFilter === 'documents' ? <i className='icon icon-check'/> : null}
                    />
                    <Menu.ItemAction
                        ariaLabel={'Spreadsheets'}
                        text={
                            <FormattedMessage
                                id='channel_info_rhs.menu.files.filter.type.spreadsheets'
                                defaultMessage='Spreadsheets'
                            />
                        }
                        onClick={() => props.onFilter('spreadsheets')}
                        icon={props.selectedFilter === 'spreadsheets' ? <i className='icon icon-check'/> : null}
                    />
                    <Menu.ItemAction
                        ariaLabel={'Presentations'}
                        text={
                            <FormattedMessage
                                id='channel_info_rhs.menu.files.filter.type.presentations'
                                defaultMessage='Presentations'
                            />
                        }
                        onClick={() => props.onFilter('presentations')}
                        icon={props.selectedFilter === 'presentations' ? <i className='icon icon-check'/> : null}
                    />
                    <Menu.ItemAction
                        ariaLabel={'Code'}
                        text={
                            <FormattedMessage
                                id='channel_info_rhs.menu.files.filter.type.code'
                                defaultMessage='Code'
                            />
                        }
                        onClick={() => props.onFilter('code')}
                        icon={props.selectedFilter === 'code' ? <i className='icon icon-check'/> : null}
                    />
                    <Menu.ItemAction
                        ariaLabel={'Images'}
                        text={
                            <FormattedMessage
                                id='channel_info_rhs.menu.files.filter.type.images'
                                defaultMessage='Images'
                            />
                        }
                        onClick={() => props.onFilter('images')}
                        icon={props.selectedFilter === 'images' ? <i className='icon icon-check'/> : null}
                    />
                    <Menu.ItemAction
                        ariaLabel={'Audio'}
                        text={
                            <FormattedMessage
                                id='channel_info_rhs.menu.files.filter.type.audio'
                                defaultMessage='Audio'
                            />
                        }
                        onClick={() => props.onFilter('audio')}
                        icon={props.selectedFilter === 'audio' ? <i className='icon icon-check'/> : null}
                    />
                    <Menu.ItemAction
                        ariaLabel={'Videos'}
                        text={
                            <FormattedMessage
                                id='channel_info_rhs.menu.files.filter.type.video'
                                defaultMessage='Videos'
                            />
                        }
                        onClick={() => props.onFilter('video')}
                        icon={props.selectedFilter === 'video' ? <i className='icon icon-check'/> : null}
                    />
                </Menu>
            </MenuWrapper>
        </div>
    );
}
