// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import truncate from 'lodash/truncate';
import React from 'react';

import {trackEvent} from 'actions/telemetry_actions';

import ExternalImage from 'components/external_image';
import ExternalLink from 'components/external_link';
import FilePreviewModal from 'components/file_preview_modal';
import Markdown from 'components/markdown';
import ShowMore from 'components/post_view/show_more';
import SizeAwareImage from 'components/size_aware_image';

import {Constants, ModalIdentifiers} from 'utils/constants';
import LinkOnlyRenderer from 'utils/markdown/link_only_renderer';
import {isUrlSafe} from 'utils/url';
import * as Utils from 'utils/utils';

import ActionButton from '../action_button';
import ActionMenu from '../action_menu';

import type {PostAction, PostActionOption} from '@mattermost/types/integration_actions';
import type {
    MessageAttachment as MessageAttachmentType,
    MessageAttachmentField,
} from '@mattermost/types/message_attachments';
import type {PostImage} from '@mattermost/types/posts';
import type {ActionResult} from 'mattermost-redux/types/actions';
import type {CSSProperties} from 'react';
import type {ModalData} from 'types/actions';
import type {TextFormattingOptions} from 'utils/text_formatting';

type Props = {

    /**
     * The post id
     */
    postId: string;

    /**
     * The attachment to render
     */
    attachment: MessageAttachmentType;

    /**
     * Options specific to text formatting
     */
    options?: Partial<TextFormattingOptions>;

    /**
     * images object for dimensions
     */
    imagesMetadata?: Record<string, PostImage>;

    actions: {
        doPostActionWithCookie: (postId: string, actionId: string, actionCookie: string, selectedOption?: string) => Promise<ActionResult>;
        openModal: <P>(modalData: ModalData<P>) => void;
    };

    currentRelativeTeamUrl: string;
}

type State = {
    checkOverflow: number;
    actionExecuting: boolean;
    actionExecutingMessage: string | null;
}

export default class MessageAttachment extends React.PureComponent<Props, State> {
    private mounted = false;
    private imageProps = {};

    constructor(props: Props) {
        super(props);

        this.state = {
            checkOverflow: 0,
            actionExecuting: false,
            actionExecutingMessage: null,
        };

        this.imageProps = {
            onImageLoaded: this.handleHeightReceived,
            onImageHeightChanged: this.checkPostOverflow,
        };
    }

    componentDidMount() {
        this.mounted = true;
    }

    componentWillUnmount() {
        this.mounted = false;
    }

    handleHeightReceivedForThumbUrl = ({height}: {height: number}) => {
        const {attachment} = this.props;
        if (!this.props.imagesMetadata || (this.props.imagesMetadata && !this.props.imagesMetadata[attachment.thumb_url])) {
            this.handleHeightReceived(height);
        }
    };

    handleHeightReceivedForImageUrl = ({height}: {height: number}) => {
        const {attachment} = this.props;
        if (!this.props.imagesMetadata || (this.props.imagesMetadata && !this.props.imagesMetadata[attachment.image_url])) {
            this.handleHeightReceived(height);
        }
    };

    handleHeightReceived = (height: number) => {
        if (!this.mounted) {
            return;
        }

        if (height > 0) {
            this.checkPostOverflow();
        }
    };

    checkPostOverflow = () => {
        // Increment checkOverflow to indicate change in height
        // and recompute textContainer height at ShowMore component
        // and see whether overflow text of show more/less is necessary or not.
        this.setState((prevState) => {
            return {checkOverflow: prevState.checkOverflow + 1};
        });
    };

    renderPostActions = () => {
        const actions = this.props.attachment.actions;
        if (!actions || !actions.length) {
            return '';
        }

        const content = [] as JSX.Element[];

        actions.forEach((action: PostAction) => {
            if (!action.id || !action.name) {
                return;
            }

            switch (action.type) {
            case 'select':
                content.push(
                    <ActionMenu
                        key={action.id}
                        postId={this.props.postId}
                        action={action}
                        disabled={action.disabled}
                    />,
                );
                break;
            case 'button':
            default:
                content.push(
                    <ActionButton
                        key={action.id}
                        action={action}
                        disabled={action.disabled}
                        handleAction={this.handleAction}
                        actionExecuting={this.state.actionExecuting}
                        actionExecutingMessage={this.state.actionExecutingMessage || undefined}
                    />,
                );
                break;
            }
        });

        return (
            <div
                className='attachment-actions'
            >
                {content}
            </div>
        );
    };

    handleAction = (e: React.MouseEvent, actionOptions?: PostActionOption[]) => {
        e.preventDefault();

        const actionExecutingMessage = this.getActionOption(actionOptions, 'ActionExecutingMessage');
        if (actionExecutingMessage) {
            this.setState({actionExecuting: true, actionExecutingMessage: actionExecutingMessage.value});
        }

        const trackOption = this.getActionOption(actionOptions, 'TrackEventId');
        if (trackOption) {
            trackEvent('admin', 'click_warn_metric_bot_id', {metric: trackOption.value});
        }

        const actionId = e.currentTarget.getAttribute('data-action-id') || '';
        const actionCookie = e.currentTarget.getAttribute('data-action-cookie') || '';

        this.props.actions.doPostActionWithCookie(this.props.postId, actionId, actionCookie).then(() => {
            this.handleCustomActions(actionOptions);
            if (actionExecutingMessage) {
                this.setState({actionExecuting: false, actionExecutingMessage: null});
            }
        });
    };

    handleCustomActions = (actionOptions?: PostActionOption[]) => {
        const extUrlOption = this.getActionOption(actionOptions, 'WarnMetricMailtoUrl');
        if (extUrlOption) {
            const mailtoPayload = JSON.parse(extUrlOption.value);
            window.location.href = 'mailto:' + mailtoPayload.mail_recipient + '?cc=' + mailtoPayload.mail_cc + '&subject=' + encodeURIComponent(mailtoPayload.mail_subject) + '&body=' + encodeURIComponent(mailtoPayload.mail_body);
        }
    };

    getActionOption = (actionOptions: PostActionOption[] | undefined, optionName: string) => {
        let opt = null;
        if (actionOptions) {
            opt = actionOptions.find((option) => option.text === optionName);
        }
        return opt;
    };

    getFieldsTable = () => {
        const fields = this.props.attachment.fields;
        if (!fields || !fields.length) {
            return '';
        }

        const fieldTables = [];

        let headerCols = [] as JSX.Element[];
        let bodyCols = [] as JSX.Element[];
        let rowPos = 0;
        let lastWasLong = false;
        let nrTables = 0;
        const markdown = {markdown: false, mentionHighlight: false};

        fields.forEach((field: MessageAttachmentField, i: number) => {
            if (rowPos === 2 || !(field.short === true) || lastWasLong) {
                fieldTables.push(
                    <table
                        className='attachment-fields'
                        key={'attachment__table__' + nrTables}
                    >
                        <thead>
                            <tr>
                                {headerCols}
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                {bodyCols}
                            </tr>
                        </tbody>
                    </table>,
                );
                headerCols = [];
                bodyCols = [];
                rowPos = 0;
                nrTables += 1;
                lastWasLong = false;
            }
            headerCols.push(
                <th
                    className='attachment-field__caption'
                    key={'attachment__field-caption-' + i + '__' + nrTables}
                >
                    <Markdown
                        message={field.title}
                        options={markdown}
                        postId={this.props.postId}
                    />
                </th>,
            );

            bodyCols.push(
                <td
                    className='attachment-field'
                    key={'attachment__field-' + i + '__' + nrTables}
                >
                    <Markdown
                        message={String(field.value)}
                        postId={this.props.postId}
                    />
                </td>,
            );
            rowPos += 1;
            lastWasLong = !(field.short === true);
        });
        if (headerCols.length > 0) { // Flush last fields
            fieldTables.push(
                <table
                    className='attachment-fields'
                    key={'attachment__table__' + nrTables}
                >
                    <thead>
                        <tr>
                            {headerCols}
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            {bodyCols}
                        </tr>
                    </tbody>
                </table>,
            );
        }
        return (
            <div>
                {fieldTables}
            </div>
        );
    };

    handleFormattedTextClick = (e: React.MouseEvent) => Utils.handleFormattedTextClick(e, this.props.currentRelativeTeamUrl);

    getFileExtensionFromUrl = (url: string) => {
        const index = url.lastIndexOf('.');
        return index > 0 ? url.substring(index + 1) : null;
    };

    showModal = (e: {preventDefault: () => void}, link: string) => {
        e.preventDefault();

        const extension = this.getFileExtensionFromUrl(link);

        this.props.actions.openModal({
            modalId: ModalIdentifiers.FILE_PREVIEW_MODAL,
            dialogType: FilePreviewModal,
            dialogProps: {
                postId: this.props.postId,
                fileInfos: [{
                    has_preview_image: false,
                    link,
                    extension: extension ?? '',
                    name: link,
                }],
                startIndex: 0,
            },
        });
    };

    render() {
        const {attachment, options} = this.props;
        let preTextClass = '';

        let preText;
        if (attachment.pretext) {
            preTextClass = 'attachment--pretext';
            preText = (
                <div className='attachment__thumb-pretext'>
                    <Markdown
                        message={attachment.pretext}
                        postId={this.props.postId}
                    />
                </div>
            );
        }

        let author = [] as JSX.Element[];
        if (attachment.author_name || attachment.author_icon) {
            if (attachment.author_icon) {
                author.push(
                    <ExternalImage
                        key={'attachment__author-icon'}
                        src={attachment.author_icon}
                        imageMetadata={this.props.imagesMetadata && this.props.imagesMetadata[attachment.author_icon]}
                    >
                        {(iconUrl) => (
                            <img
                                alt={'attachment author icon'}
                                className='attachment__author-icon'
                                src={iconUrl}
                                height='14'
                                width='14'
                            />
                        )}
                    </ExternalImage>,
                );
            }
            if (attachment.author_name) {
                author.push(
                    <span
                        className='attachment__author-name'
                        key={'attachment__author-name'}
                    >
                        {attachment.author_name}
                    </span>,
                );
            }
        }
        if (attachment.author_link && isUrlSafe(attachment.author_link)) {
            author = [(
                <ExternalLink
                    href={attachment.author_link}
                    key={'attachment__author-name'}
                    location='message_attachment'
                >
                    {author}
                </ExternalLink>
            )];
        }

        let title;
        if (attachment.title) {
            if (attachment.title_link && isUrlSafe(attachment.title_link)) {
                title = (
                    <h1 className='attachment__title'>
                        <ExternalLink
                            className='attachment__title-link'
                            href={attachment.title_link}
                            location='message_attachment'
                        >
                            {attachment.title}
                        </ExternalLink>
                    </h1>
                );
            } else {
                title = (
                    <h1 className='attachment__title'>
                        <Markdown
                            message={attachment.title}
                            options={{
                                mentionHighlight: false,
                                renderer: new LinkOnlyRenderer(),
                                autolinkedUrlSchemes: [],
                            }}
                            postId={this.props.postId}
                        />
                    </h1>
                );
            }
        }

        let attachmentText;
        if (attachment.text) {
            attachmentText = (
                <ShowMore
                    checkOverflow={this.state.checkOverflow}
                    isAttachmentText={true}
                    text={attachment.text}
                    maxHeight={200}
                >
                    <Markdown
                        message={attachment.text || ''}
                        options={options}
                        postId={this.props.postId}
                        imageProps={this.imageProps}
                    />
                </ShowMore>
            );
        }

        let image;
        if (attachment.image_url) {
            const imageMetadata = this.props.imagesMetadata && this.props.imagesMetadata[attachment.image_url];

            image = (
                <div className='attachment__image-container'>
                    <ExternalImage
                        src={attachment.image_url}
                        imageMetadata={imageMetadata}
                    >
                        {(imageUrl) => (
                            <SizeAwareImage
                                className='attachment__image'
                                onImageLoaded={this.handleHeightReceivedForImageUrl}
                                src={imageUrl}
                                dimensions={imageMetadata}
                                onClick={this.showModal}
                            />
                        )}
                    </ExternalImage>
                </div>
            );
        }

        let footer;
        if (attachment.footer) {
            let footerIcon;
            if (attachment.footer_icon) {
                const footerIconMetadata = this.props.imagesMetadata && this.props.imagesMetadata[attachment.footer_icon];

                footerIcon = (
                    <ExternalImage
                        src={attachment.footer_icon}
                        imageMetadata={footerIconMetadata}
                    >
                        {(footerIconUrl) => (
                            <img
                                alt={'attachment footer icon'}
                                className='attachment__footer-icon'
                                src={footerIconUrl}
                                height='16'
                                width='16'
                            />
                        )}
                    </ExternalImage>
                );
            }

            footer = (
                <div className='attachment__footer-container'>
                    {footerIcon}
                    <span>{truncate(attachment.footer, {length: Constants.MAX_ATTACHMENT_FOOTER_LENGTH, omission: '…'})}</span>
                </div>
            );
        }

        let thumb;
        if (attachment.thumb_url) {
            const thumbMetadata = this.props.imagesMetadata && this.props.imagesMetadata[attachment.thumb_url];

            thumb = (
                <div className='attachment__thumb-container'>
                    <ExternalImage
                        src={attachment.thumb_url}
                        imageMetadata={thumbMetadata}
                    >
                        {(thumbUrl) => (
                            <SizeAwareImage
                                onImageLoaded={this.handleHeightReceivedForThumbUrl}
                                src={thumbUrl}
                                dimensions={thumbMetadata}
                            />
                        )}
                    </ExternalImage>
                </div>
            );
        }

        const fields = this.getFieldsTable();
        const actions = this.renderPostActions();

        let useBorderStyle;
        if (attachment.color && attachment.color[0] === '#') {
            useBorderStyle = {borderLeftColor: attachment.color};
        }

        const hasContent = author.length > 0 || Boolean(title) || Boolean(thumb) || Boolean(attachmentText) || Boolean(image) || Boolean(fields) || Boolean(footer) || Boolean(actions);

        return (
            <div
                className={'attachment ' + preTextClass}
                onClick={this.handleFormattedTextClick}
            >
                {preText}
                {
                    hasContent &&
                    <div className='attachment__content'>
                        <div
                            className={useBorderStyle ? 'clearfix attachment__container' : 'clearfix attachment__container attachment__container--' + attachment.color}
                            style={useBorderStyle}
                        >
                            {author}
                            {title}
                            <div>
                                <div
                                    className={thumb ? 'attachment__body' : 'attachment__body attachment__body--no_thumb'}
                                >
                                    {attachmentText}
                                    {image}
                                    {fields}
                                    {footer}
                                    {actions}
                                </div>
                                {thumb}
                                <div style={style.footer}/>
                            </div>
                        </div>
                    </div>
                }
            </div>
        );
    }
}

const style = {
    footer: {clear: 'both'} as CSSProperties,
};
