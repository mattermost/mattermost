// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {defineMessage, FormattedMessage} from 'react-intl';

import {getFileDownloadUrl} from 'mattermost-redux/utils/file_utils';

import FileThumbnail from 'components/file_attachment/file_thumbnail';
import FilePreviewModal from 'components/file_preview_modal';
import Timestamp, {RelativeRanges} from 'components/timestamp';
import Menu from 'components/widgets/menu/menu';
import MenuWrapper from 'components/widgets/menu/menu_wrapper';
import Tag from 'components/widgets/tag/tag';
import WithTooltip from 'components/with_tooltip';

import {getHistory} from 'utils/browser_history';
import Constants, {ModalIdentifiers} from 'utils/constants';
import {getSiteURL} from 'utils/url';
import {fileSizeToString, copyToClipboard, localizeMessage} from 'utils/utils';

import type {PropsFromRedux, OwnProps} from './index';

import './file_search_result_item.scss';

type Props = OwnProps & PropsFromRedux;

type State = {
    keepOpen: boolean;
}

const FILE_TOOLTIP_RANGES = [
    RelativeRanges.TODAY_TITLE_CASE,
    RelativeRanges.YESTERDAY_TITLE_CASE,
];

export default class FileSearchResultItem extends React.PureComponent<Props, State> {
    public constructor(props: Props) {
        super(props);
        this.state = {keepOpen: false};
    }

    private jumpToConv = (e: MouseEvent) => {
        e.stopPropagation();
        getHistory().push(`/${this.props.teamName}/pl/${this.props.fileInfo.post_id}`);
    };

    private copyLink = () => {
        copyToClipboard(`${getSiteURL()}/${this.props.teamName}/pl/${this.props.fileInfo.post_id}`);
    };

    private stopPropagation = (e: React.MouseEvent<HTMLElement, MouseEvent>) => {
        e.stopPropagation();
    };

    private keepOpen = (open: boolean) => {
        this.setState({keepOpen: open});
    };

    private renderPluginItems = () => {
        const {fileInfo} = this.props;
        const pluginItems = this.props.pluginMenuItems?.filter((item) => item?.match(fileInfo)).map((item) => {
            return (
                <Menu.ItemAction
                    id={item.id + '_pluginmenuitem'}
                    key={item.id + '_pluginmenuitem'}
                    onClick={() => item.action?.(fileInfo)}
                    text={item.text}
                />
            );
        });

        if (!pluginItems?.length) {
            return null;
        }

        return (
            <>
                <li
                    id={`divider_file_${this.props.fileInfo.id}_plugins`}
                    className='MenuItem__divider'
                    role='menuitem'
                />
                {pluginItems}
            </>
        );
    };

    private showPreview = () => {
        this.props.actions.openModal({
            modalId: ModalIdentifiers.FILE_PREVIEW_MODAL,
            dialogType: FilePreviewModal,
            dialogProps: {
                fileInfos: [this.props.fileInfo],
                postId: this.props.fileInfo.post_id,
                startIndex: 0,
            },
        });
    };

    public render(): React.ReactNode {
        const {fileInfo, channelDisplayName, channelType} = this.props;
        let channelName: React.ReactNode = channelDisplayName;
        if (channelType === Constants.DM_CHANNEL) {
            channelName = (
                <FormattedMessage
                    id='search_item.file_tag.direct_message'
                    defaultMessage='Direct Message'
                />
            );
        } else if (channelType === Constants.GM_CHANNEL) {
            channelName = (
                <FormattedMessage
                    id='search_item.file_tag.group_message'
                    defaultMessage='Group Message'
                />
            );
        }

        return (
            <div
                data-testid='search-item-container'
                className='search-item__container'
            >
                <button
                    className={'FileSearchResultItem' + (this.state.keepOpen ? ' keep-open' : '')}
                    onClick={this.showPreview}
                >
                    <FileThumbnail fileInfo={fileInfo}/>
                    <div className='fileData'>
                        <div className='fileDataName'>{fileInfo.name}</div>
                        <div className='fileMetadata'>
                            {channelName && (
                                <Tag
                                    className='file-search-channel-name'
                                    text={channelName}
                                />
                            )}
                            <span>{fileSizeToString(fileInfo.size)}</span>
                            <span>{' • '}</span>
                            <Timestamp
                                value={fileInfo.create_at}
                                ranges={FILE_TOOLTIP_RANGES}
                            />
                        </div>
                    </div>
                    {this.props.fileInfo.post_id && (
                        <WithTooltip
                            title={defineMessage({id: 'file_search_result_item.more_actions', defaultMessage: 'More Actions'})}
                        >
                            <MenuWrapper
                                onToggle={this.keepOpen}
                                stopPropagationOnToggle={true}
                            >
                                <a
                                    href='#'
                                    className='action-icon dots-icon btn btn-icon btn-sm'
                                >
                                    <i className='icon icon-dots-vertical'/>
                                </a>
                                <Menu
                                    ariaLabel={'file menu'}
                                    openLeft={true}
                                >
                                    <Menu.ItemAction
                                        onClick={this.jumpToConv}
                                        ariaLabel={localizeMessage({id: 'file_search_result_item.open_in_channel', defaultMessage: 'Open in channel'})}
                                        text={localizeMessage({id: 'file_search_result_item.open_in_channel', defaultMessage: 'Open in channel'})}
                                    />
                                    <Menu.ItemAction
                                        onClick={this.copyLink}
                                        ariaLabel={localizeMessage({id: 'file_search_result_item.copy_link', defaultMessage: 'Copy link'})}
                                        text={localizeMessage({id: 'file_search_result_item.copy_link', defaultMessage: 'Copy link'})}
                                    />
                                    {this.renderPluginItems()}
                                </Menu>
                            </MenuWrapper>
                        </WithTooltip>
                    )}
                    <WithTooltip
                        title={defineMessage({id: 'file_search_result_item.download', defaultMessage: 'Download'})}
                    >
                        <a
                            className='action-icon download-icon btn btn-icon btn-sm'
                            href={getFileDownloadUrl(fileInfo.id)}
                            onClick={this.stopPropagation}
                        >
                            <i className='icon icon-download-outline'/>
                        </a>
                    </WithTooltip>
                </button>
            </div>
        );
    }
}
