// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {Modal} from 'react-bootstrap';
import {FormattedMessage} from 'react-intl';

import AuditTable from 'components/audit_table';
import LoadingScreen from 'components/loading_screen';

type Props = {
    onHide: () => void;
    actions: {
        getUserAudits: (userId: string, page?: number, perPage?: number) => void;
    };
    userAudits: any[];
    currentUserId: string;
}

type State = {
    show: boolean;
}

export default class AccessHistoryModal extends React.PureComponent<Props, State> {
    public constructor(props: Props) {
        super(props);

        this.state = {
            show: true,
        };
    }

    public onShow = () => { // public for testing
        this.props.actions.getUserAudits(this.props.currentUserId, 0, 200);
    };

    public onHide = () => { // public for testing
        this.setState({show: false});
    };

    public componentDidMount() {
        this.onShow();
    }

    public render() {
        let content;
        if (this.props.userAudits.length === 0) {
            content = (<LoadingScreen/>);
        } else {
            content = (
                <AuditTable
                    audits={this.props.userAudits}
                    showIp={true}
                    showSession={true}
                />
            );
        }

        return (
            <Modal
                dialogClassName='a11y__modal modal--scroll'
                show={this.state.show}
                onHide={this.onHide}
                onExited={this.props.onHide}
                bsSize='large'
                role='dialog'
                aria-labelledby='accessHistoryModalLabel'
            >
                <Modal.Header closeButton={true}>
                    <Modal.Title
                        componentClass='h1'
                        id='accessHistoryModalLabel'
                    >
                        <FormattedMessage
                            id='access_history.title'
                            defaultMessage='Access History'
                        />
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    {content}
                </Modal.Body>
                <Modal.Footer className='modal-footer--invisible'>
                    <button
                        id='closeModalButton'
                        type='button'
                        className='btn btn-link'
                    >
                        <FormattedMessage
                            id='general_button.close'
                            defaultMessage='Close'
                        />
                    </button>
                </Modal.Footer>
            </Modal>
        );
    }
}
