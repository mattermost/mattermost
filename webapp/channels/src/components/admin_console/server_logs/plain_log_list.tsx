// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {defineMessages, injectIntl} from 'react-intl';
import type {WrappedComponentProps} from 'react-intl';

import NextIcon from 'components/widgets/icons/fa_next_icon';
import PreviousIcon from 'components/widgets/icons/fa_previous_icon';
import LoadingSpinner from 'components/widgets/loading/loading_spinner';

import './log_list.scss';

const NEXT_BUTTON_TIMEOUT = 500;

const messages = defineMessages({
    prevPage: {
        id: 'admin.logs.prev',
        defaultMessage: 'Previous',
        description: 'Pagination button label on the plain-text server logs view; goes to the previous page of log lines.',
    },
    nextPage: {
        id: 'admin.logs.next',
        defaultMessage: 'Next',
        description: 'Pagination button label on the plain-text server logs view; goes to the next page of log lines.',
    },
});

type Props = {
    loading: boolean;
    logs: string[];
    page: number;
    perPage: number;
    nextPage: () => void;
    previousPage: () => void;
} & WrappedComponentProps;

type State = {
    nextDisabled: boolean;
};

class PlainLogList extends React.PureComponent<Props, State> {
    private logPanel: React.RefObject<HTMLDivElement | null>;

    constructor(props: Props) {
        super(props);

        this.logPanel = React.createRef();

        this.state = {
            nextDisabled: false,
        };
    }

    componentDidMount() {
        // Scroll Down to get the latest logs
        const node = this.logPanel.current;
        if (node) {
            node.scrollTop = node.scrollHeight;
        }
    }

    componentDidUpdate() {
        // Scroll Down to get the latest logs
        const node = this.logPanel.current;
        if (node) {
            node.scrollTop = node.scrollHeight;
        }
    }

    nextPage = (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
        e.preventDefault();
        if (this.state.nextDisabled || this.props.logs.length < this.props.perPage) {
            return;
        }

        this.setState({nextDisabled: true});
        setTimeout(() => this.setState({nextDisabled: false}), NEXT_BUTTON_TIMEOUT);

        this.props.nextPage();
    };

    previousPage = (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
        e.preventDefault();
        if (this.props.page <= 0) {
            return;
        }

        this.props.previousPage();
    };

    render() {
        if (this.props.loading) {
            return (
                <div className='log__panel'>
                    <LoadingSpinner/>
                </div>
            );
        }

        const firstPage = this.props.page <= 0;
        const lastPage = this.props.logs.length < this.props.perPage || this.state.nextDisabled;

        const content: React.ReactNode[] = [];

        for (let i = 0; i < this.props.logs.length; i++) {
            const style: React.CSSProperties = {
                whiteSpace: 'nowrap',
                fontFamily: 'monospace',
                color: '',
            };

            if (this.props.logs[i].indexOf('[EROR]') > 0) {
                style.color = 'red';
            }
            content.push(<br key={'br_' + i}/>);
            content.push(
                <span
                    key={'log_' + i}
                    style={style}
                >
                    {this.props.logs[i]}
                </span>,
            );
        }

        return (
            <div className='plain-log-list'>
                <div
                    tabIndex={-1}
                    ref={this.logPanel}
                    className='log__panel'
                >
                    {content}
                </div>
                <div
                    className='plain-log-list__footer'
                    data-testid='plain-log-list-footer'
                >
                    <button
                        aria-label={this.props.intl.formatMessage(messages.prevPage)}
                        type='button'
                        className={'btn btn-quaternary btn-icon btn-sm prev ' + (firstPage ? 'disabled' : '')}
                        onClick={this.previousPage}
                        disabled={firstPage}
                    >
                        <PreviousIcon/>
                    </button>
                    <button
                        aria-label={this.props.intl.formatMessage(messages.nextPage)}
                        type='button'
                        className={'btn btn-quaternary btn-icon btn-sm next ' + (lastPage ? 'disabled' : '')}
                        onClick={this.nextPage}
                        disabled={lastPage}
                    >
                        <NextIcon/>
                    </button>
                </div>
            </div>
        );
    }
}

export default injectIntl(PlainLogList);
