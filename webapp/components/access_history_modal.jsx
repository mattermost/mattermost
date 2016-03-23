// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import $ from 'jquery';
import {Modal} from 'react-bootstrap';
import LoadingScreen from './loading_screen.jsx';
import AuditTable from './audit_table.jsx';

import UserStore from 'stores/user_store.jsx';

import * as AsyncClient from 'utils/async_client.jsx';
import * as Utils from 'utils/utils.jsx';

import {intlShape, injectIntl, FormattedMessage} from 'react-intl';

import React from 'react';

class AccessHistoryModal extends React.Component {
    constructor(props) {
        super(props);

        this.onAuditChange = this.onAuditChange.bind(this);
        this.onShow = this.onShow.bind(this);
        this.onHide = this.onHide.bind(this);

        const state = this.getStateFromStoresForAudits();
        state.moreInfo = [];

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
        this.setState({moreInfo: []});
        this.props.onHide();
    }
    componentDidMount() {
        UserStore.addAuditsChangeListener(this.onAuditChange);

        if (this.props.show) {
            this.onShow();
        }
    }
    componentDidUpdate(prevProps) {
        if (this.props.show && !prevProps.show) {
            this.onShow();
        }
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
                show={this.props.show}
                onHide={this.onHide}
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
    intl: intlShape.isRequired,
    show: React.PropTypes.bool.isRequired,
    onHide: React.PropTypes.func.isRequired
};

export default injectIntl(AccessHistoryModal);
