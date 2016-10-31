// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import LoadingScreen from './loading_screen.jsx';
import AuditTable from './audit_table.jsx';

import UserStore from 'stores/user_store.jsx';

import * as AsyncClient from 'utils/async_client.jsx';
import * as Utils from 'utils/utils.jsx';

import $ from 'jquery';
import React from 'react';

import {Modal} from 'react-bootstrap';
import {FormattedMessage} from 'react-intl';

export default class AccessHistoryModal extends React.Component {
    constructor(props) {
        super(props);

        this.onAuditChange = this.onAuditChange.bind(this);
        this.onShow = this.onShow.bind(this);
        this.onHide = this.onHide.bind(this);

        const state = this.getStateFromStoresForAudits();
        state.moreInfo = [];
        state.show = true;

        this.state = state;
    }

    getStateFromStoresForAudits() {
        return {
            audits: UserStore.getAudits()
        };
    }

    onShow() {
        AsyncClient.getAudits();
        if (!Utils.isMobile()) {
            $('.modal-body').perfectScrollbar();
        }
    }

    onHide() {
        this.setState({show: false});
    }

    componentDidMount() {
        UserStore.addAuditsChangeListener(this.onAuditChange);
        this.onShow();
    }

    componentWillUnmount() {
        UserStore.removeAuditsChangeListener(this.onAuditChange);
    }

    onAuditChange() {
        var newState = this.getStateFromStoresForAudits();
        if (!Utils.areObjectsEqual(newState.audits, this.state.audits)) {
            this.setState(newState);
        }
    }

    render() {
        var content;
        if (this.state.audits.loading) {
            content = (<LoadingScreen/>);
        } else {
            content = (
                <AuditTable
                    audits={this.state.audits}
                    showIp={true}
                    showSession={true}
                />
            );
        }

        return (
            <Modal
                show={this.state.show}
                onHide={this.onHide}
                onExited={this.props.onHide}
                bsSize='large'
            >
                <Modal.Header closeButton={true}>
                    <Modal.Title>
                        <FormattedMessage
                            id='access_history.title'
                            defaultMessage='Access History'
                        />
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body ref='modalBody'>
                    {content}
                </Modal.Body>
            </Modal>
        );
    }
}

AccessHistoryModal.propTypes = {
    onHide: React.PropTypes.func.isRequired
};
