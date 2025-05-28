// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {useRef, useState, useEffect} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';

import {ArchiveOutlineIcon} from '@mattermost/compass-icons/components';
import type {FileInfo} from '@mattermost/types/files';

import {getFileThumbnailUrl, getFileUrl} from 'mattermost-redux/utils/file_utils';

import GetPublicModal from 'components/get_public_link_modal';
import Menu from 'components/widgets/menu/menu';
import MenuWrapper from 'components/widgets/menu/menu_wrapper';
import WithTooltip from 'components/with_tooltip';

import {Constants, FileTypes, ModalIdentifiers} from 'utils/constants';
import {trimFilename} from 'utils/file_utils';
import {
    fileSizeToString,
    getFileType,
    loadImage,
} from 'utils/utils';

import ArchivedTooltip from './archived_tooltip';
import FileThumbnail from './file_thumbnail';
import FilenameOverlay from './filename_overlay';

import type {PropsFromRedux} from './index';

type Props = PropsFromRedux & {

    /*
    * File detailed information
    */
    fileInfo: FileInfo;

    /*
    * The index of this attachment preview in the parent FileAttachmentList
    */
    index: number;

    /*
    * Handler for when the thumbnail is clicked passed the index above
    */
    handleImageClick?: (index: number) => void;

    /*
    * Display in compact format
    */
    compactDisplay?: boolean;
    disablePreview?: boolean;
    handleFileDropdownOpened?: (open: boolean) => void;
    disableThumbnail?: boolean;
    disableActions?: boolean;
};

export default function FileAttachment(props: Props) {
    const mounted = useRef(true);

    const {formatMessage} = useIntl();

    const [loaded, setLoaded] = useState(getFileType(props.fileInfo.extension) !== FileTypes.IMAGE);
    const [loadFilesCalled, setLoadFilesCalled] = useState(false);
    const [keepOpen, setKeepOpen] = useState(false);
    const [openUp, setOpenUp] = useState(false);
    const [showTooltip, setShowTooltip] = useState(true);

    const buttonRef = useRef<HTMLButtonElement | null>(null);

    const handleImageLoaded = () => {
        if (mounted.current) {
            setLoaded(true);
        }
    };

    const loadFiles = () => {
        const fileInfo = props.fileInfo;
        if (fileInfo.archived) {
            // if archived, file preview will not be accessible anyway.
            // So skip trying to load.
            return;
        }
        const fileType = getFileType(fileInfo.extension);

        if (!props.disableThumbnail) {
            if (fileType === FileTypes.IMAGE) {
                const thumbnailUrl = getFileThumbnailUrl(fileInfo.id);

                loadImage(thumbnailUrl, handleImageLoaded);
            } else if (fileInfo.extension === FileTypes.SVG && props.enableSVGs) {
                loadImage(getFileUrl(fileInfo.id), handleImageLoaded);
            }
        }
    };

    useEffect(() => {
        if (!loadFilesCalled) {
            setLoadFilesCalled(true);
            loadFiles();
        }
    }, [loadFilesCalled]);

    useEffect(() => {
        if (!loaded && props.fileInfo.id) {
            loadFiles();
        }
    }, [props.fileInfo.id, loaded]);

    useEffect(() => {
        return () => {
            mounted.current = false;
        };
    }, []);

    useEffect(() => {
        if (props.fileInfo.id) {
            setLoaded(getFileType(props.fileInfo.extension) !== FileTypes.IMAGE && !(props.enableSVGs && props.fileInfo.extension === FileTypes.SVG));
        }
    }, [props.fileInfo.extension, props.fileInfo.id, props.enableSVGs]);

    const onAttachmentClick = (e: React.MouseEvent<HTMLElement, MouseEvent>) => {
        e.preventDefault();
        e.stopPropagation();

        if (props.fileInfo.archived || props.disablePreview) {
            return;
        }

        if ('blur' in e.target) {
            (e.target as HTMLElement).blur();
        }

        if (props.handleImageClick) {
            props.handleImageClick(props.index);
        }
    };

    const handleDropdownOpened = (open: boolean) => {
        props.handleFileDropdownOpened?.(open);
        setKeepOpen(open);
        setShowTooltip(!open);

        if (open) {
            setMenuPosition();
        }
    };

    const setMenuPosition = () => {
        if (!buttonRef.current) {
            return;
        }

        const anchorRect = buttonRef.current?.getBoundingClientRect();
        let y;
        if (typeof anchorRect?.y === 'undefined') {
            y = typeof anchorRect?.top === 'undefined' ? 0 : anchorRect?.top;
        } else {
            y = anchorRect?.y;
        }
        const windowHeight = window.innerHeight;

        const totalSpace = windowHeight - 80;
        const spaceOnTop = y - Constants.CHANNEL_HEADER_HEIGHT;
        const spaceOnBottom = (totalSpace - (spaceOnTop + Constants.POST_AREA_HEIGHT));

        setOpenUp(spaceOnTop > spaceOnBottom);
    };

    const handleGetPublicLink = () => {
        props.actions.openModal({
            modalId: ModalIdentifiers.GET_PUBLIC_LINK_MODAL,
            dialogType: GetPublicModal,
            dialogProps: {
                fileId: props.fileInfo.id,
            },
        });
    };

    const renderFileMenuItems = () => {
        const {enablePublicLink, fileInfo, pluginMenuItems} = props;

        let divider;
        const defaultItems = [];
        if (enablePublicLink) {
            defaultItems.push(
                <Menu.ItemAction
                    data-title='Public Image'
                    key={fileInfo.id + '_publiclinkmenuitem'}
                    onClick={handleGetPublicLink}
                    ariaLabel={formatMessage({id: 'view_image_popover.publicLink', defaultMessage: 'Get a public link'})}
                    text={formatMessage({id: 'view_image_popover.publicLink', defaultMessage: 'Get a public link'})}
                />,
            );
        }

        const pluginItems = pluginMenuItems?.filter((item) => item?.match(fileInfo)).map((item) => {
            return (
                <Menu.ItemAction
                    id={item.id + '_pluginmenuitem'}
                    key={item.id + '_pluginmenuitem'}
                    onClick={() => item?.action(fileInfo)}
                    text={item.text}
                />
            );
        });

        const isMenuVisible = defaultItems?.length || pluginItems?.length;
        if (!isMenuVisible) {
            return null;
        }

        const isDividerVisible = defaultItems?.length && pluginItems?.length;
        if (isDividerVisible) {
            divider = (
                <li
                    id={`divider_file_${fileInfo.id}_plugins`}
                    className='MenuItem__divider'
                    role='menuitem'
                />
            );
        }

        return (
            <MenuWrapper
                onToggle={handleDropdownOpened}
                stopPropagationOnToggle={true}
            >
                <WithTooltip
                    title={formatMessage({id: 'file_search_result_item.more_actions', defaultMessage: 'More Actions'})}
                    disabled={!showTooltip}
                >
                    <button
                        ref={buttonRef}
                        id={`file_action_button_${props.fileInfo.id}`}
                        aria-label={formatMessage({id: 'file_search_result_item.more_actions', defaultMessage: 'More Actions'}).toLowerCase()}
                        className={classNames(
                            'file-dropdown-icon', 'dots-icon', 'btn', 'btn-icon', 'btn-sm',
                            {'a11y--active': keepOpen},
                        )}
                        aria-expanded={keepOpen}
                    >
                        <i className='icon icon-dots-vertical'/>
                    </button>
                </WithTooltip>
                <Menu
                    id={`file_dropdown_${props.fileInfo.id}`}
                    ariaLabel={'file menu'}
                    openLeft={true}
                    openUp={openUp}
                >
                    {defaultItems}
                    {divider}
                    {pluginItems}
                </Menu>
            </MenuWrapper>
        );
    };

    const {compactDisplay, fileInfo} = props;

    let fileThumbnail;
    let fileDetail;
    let fileActions;
    const ariaLabelImage = `${formatMessage({id: 'file_attachment.thumbnail', defaultMessage: 'file thumbnail'})} ${fileInfo.name}`.toLowerCase();

    if (!compactDisplay) {
        fileThumbnail = (
            <a
                aria-label={ariaLabelImage}
                className='post-image__thumbnail'
                href='#'
                onClick={onAttachmentClick}
            >
                {loaded && !props.disableThumbnail ? (
                    <FileThumbnail
                        fileInfo={fileInfo}
                        disablePreview={props.disablePreview}
                    />
                ) : (
                    <FileThumbnail
                        fileInfo={props.fileInfo}
                        disablePreview={true}
                    />
                )}
            </a>
        );

        if (fileInfo.archived) {
            fileThumbnail = (
                <ArchiveOutlineIcon
                    size={48}
                    color={'rgba(var(--center-channel-color-rgb), 0.48)'}
                    data-testid='archived-file-icon'
                />
            );
        }

        fileDetail = (
            <div
                className='post-image__detail_wrapper'
                onClick={onAttachmentClick}
            >
                <div className='post-image__detail'>
                    <span
                        className={classNames('post-image__name', {
                            'post-image__name--archived': fileInfo.archived,
                        })}
                    >
                        {fileInfo.name}
                    </span>
                    {fileInfo.archived ? <span className={'post-image__archived'}>

                        <FormattedMessage
                            id='workspace_limits.archived_file.archived'
                            defaultMessage='This file is archived'
                        />
                    </span> : <>
                        <span className='post-image__type'>{fileInfo.extension.toUpperCase()}</span>
                        <span className='post-image__size'>{fileSizeToString(fileInfo.size)}</span>
                    </>
                    }
                </div>
            </div>
        );

        if (!fileInfo.archived && !props.disableActions) {
            fileActions = renderFileMenuItems();
        }
    }

    let filenameOverlay;
    if (props.canDownloadFiles && !fileInfo.archived) {
        filenameOverlay = (
            <FilenameOverlay
                fileInfo={fileInfo}
                compactDisplay={compactDisplay}
                canDownload={props.canDownloadFiles}
                handleImageClick={onAttachmentClick}
                iconClass={'post-image__download'}
            >
                <i className='icon icon-download-outline'/>
            </FilenameOverlay>
        );
    } else if (fileInfo.archived && compactDisplay) {
        const fileName = fileInfo.name;
        const trimmedFilename = trimFilename(fileName);
        fileThumbnail = (
            <ArchiveOutlineIcon
                size={16}
                color={'rgba(var(--center-channel-color-rgb), 0.48)'}
                data-testid='archived-file-icon'
            />
        );
        filenameOverlay =
            (<span className='post-image__archived-name'>
                <span className='post-image__archived-filename'>
                    {trimmedFilename}
                </span>
                <span className='post-image__archived-label'>
                    {formatMessage({
                        id: 'workspace_limits.archived_file.archived_compact',
                        defaultMessage: '(archived)',
                    })}
                </span>
            </span>);
    }

    return (
        <WithTooltip
            title={<ArchivedTooltip/>}
            disabled={!fileInfo.archived}
        >
            <div
                className={classNames([
                    'post-image__column',
                    {'keep-open': keepOpen},
                    {'post-image__column--archived': fileInfo.archived},
                ])}
            >
                {fileThumbnail}
                <div className='post-image__details'>
                    {fileDetail}
                    {fileActions}
                    {filenameOverlay}
                </div>
            </div>
        </WithTooltip>
    );
}
