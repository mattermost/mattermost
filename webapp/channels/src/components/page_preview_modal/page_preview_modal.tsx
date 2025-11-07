// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {Modal} from 'react-bootstrap';
import {FormattedMessage} from 'react-intl';
import moment from 'moment';

import {Client4} from 'mattermost-redux/client';

import LoadingScreen from 'components/loading_screen';
import Markdown from 'components/markdown';

import Constants from 'utils/constants';
import * as Keyboard from 'utils/keyboard';

import './page_preview_modal.scss';

const KeyCodes = Constants.KeyCodes;

export type Props = {
    pageId: string;
    wikiId: string;
    channelId: string;
    teamName: string;
    onExited: () => void;
    onEdit?: () => void;
};

type PageData = {
    id: string;
    title: string;
    message: string;
    user_id: string;
    update_at: number;
    create_at: number;
    props?: {
        status?: string;
    };
};

type State = {
    show: boolean;
    page: PageData | null;
    loading: boolean;
    error: string | null;
    author: any;
};

export default class PagePreviewModal extends React.PureComponent<Props, State> {
    constructor(props: Props) {
        super(props);

        this.state = {
            show: true,
            page: null,
            loading: true,
            error: null,
            author: null,
        };
    }

    componentDidMount() {
        document.addEventListener('keydown', this.handleKeyPress);
        this.loadPage();
    }

    componentWillUnmount() {
        document.removeEventListener('keydown', this.handleKeyPress);
    }

    loadPage = async () => {
        try {
            this.setState({loading: true});
            const page = await Client4.getPage(this.props.wikiId, this.props.pageId);

            let author = null;
            if (page.user_id) {
                try {
                    author = await Client4.getUser(page.user_id);
                } catch (err) {
                    // Ignore author fetch errors
                }
            }

            const pageData: PageData = {
                id: page.id,
                title: (page.props?.title as string) || 'Untitled',
                message: page.message,
                user_id: page.user_id,
                update_at: page.update_at,
                create_at: page.create_at,
                props: page.props,
            };

            this.setState({
                page: pageData,
                author,
                loading: false,
                error: null,
            });
        } catch (err: any) {
            this.setState({
                loading: false,
                error: err.message || 'Failed to load page',
            });
        }
    };

    handleKeyPress = (e: KeyboardEvent) => {
        if (Keyboard.isKeyPressed(e, KeyCodes.ESCAPE) && this.state.show) {
            this.handleHide();
        }
    };

    handleHide = () => {
        this.setState({show: false});
    };

    handleEdit = () => {
        if (this.props.onEdit) {
            this.props.onEdit();
        }
        this.handleHide();
    };

    render() {
        const {page, loading, error, author, show} = this.state;

        return (
            <Modal
                dialogClassName='page-preview-modal a11y__modal'
                show={show}
                onHide={this.handleHide}
                onExited={this.props.onExited}
                backdrop='static'
                role='dialog'
                aria-labelledby='pagePreviewModalLabel'
            >
                <Modal.Header closeButton={true}>
                    {page && (
                        <div className='page-preview-modal__header-content'>
                            <h1
                                id='pagePreviewModalLabel'
                                className='page-preview-modal__title'
                            >
                                {page.title}
                            </h1>
                            <div className='page-preview-modal__metadata'>
                                {author && (
                                    <span className='page-preview-modal__author'>
                                        <FormattedMessage
                                            id='page_preview.by_author'
                                            defaultMessage='By {author}'
                                            values={{author: author.username}}
                                        />
                                    </span>
                                )}
                                {page.props?.status && (
                                    <span className='page-preview-modal__status-badge'>
                                        {page.props.status}
                                    </span>
                                )}
                            </div>
                            <div className='page-preview-modal__actions'>
                                <span className='page-preview-modal__updated'>
                                    <FormattedMessage
                                        id='page_preview.updated'
                                        defaultMessage='Updated {time}'
                                        values={{time: moment(page.update_at).fromNow()}}
                                    />
                                </span>
                                <button
                                    className='btn btn-primary page-preview-modal__edit-btn'
                                    onClick={this.handleEdit}
                                >
                                    <FormattedMessage
                                        id='page_preview.edit'
                                        defaultMessage='Edit'
                                    />
                                </button>
                            </div>
                        </div>
                    )}
                </Modal.Header>
                <Modal.Body>
                    {loading && (
                        <div className='page-preview-modal__loading'>
                            <LoadingScreen/>
                        </div>
                    )}
                    {error && (
                        <div className='page-preview-modal__error'>
                            {error}
                        </div>
                    )}
                    {page && !loading && !error && (
                        <div className='page-preview-modal__content'>
                            <Markdown
                                message={page.message}
                                options={{
                                    mentionHighlight: false,
                                }}
                            />
                        </div>
                    )}
                </Modal.Body>
            </Modal>
        );
    }
}
