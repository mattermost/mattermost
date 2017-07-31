// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import Constants from 'utils/constants.jsx';

import ModalStore from 'stores/modal_store.jsx';

import {FormattedMessage} from 'react-intl';
import {Modal} from 'react-bootstrap';
import React from 'react';

export default class ShortcutsModal extends React.PureComponent {
    constructor(props) {
        super(props);

        this.handleToggle = this.handleToggle.bind(this);
        this.handleHide = this.handleHide.bind(this);

        this.state = {
            show: false,
            data: '',
            error: ''
        };
    }

    componentDidMount() {
        ModalStore.addModalListener(Constants.ActionTypes.TOGGLE_SHORTCUTS_MODAL, this.handleToggle);
    }

    componentWillUnmount() {
        ModalStore.removeModalListener(Constants.ActionTypes.TOGGLE_SHORTCUTS_MODAL, this.handleToggle);
    }

    handleToggle(value, args) {
        this.setState({
            show: value,
            data: args.data,
            error: ''
        });
    }

    handleHide() {
        this.setState({show: false});
    }

    render() {
        if (!this.state.data) {
            return null;
        }

        const shortcuts = this.state.data.split('\n');

        return (
            <Modal
                dialogClassName='shortcuts-modal'
                show={this.state.show}
                onHide={this.handleHide}
                onExited={this.handleHide}
            >
                <div className='shortcuts-content'>
                    <Modal.Header closeButton={true}>
                        <Modal.Title>
                            <strong>{shortcuts[0]}</strong>
                        </Modal.Title>
                    </Modal.Header>
                    <Modal.Body ref='modalBody'>
                        <div className='shortcuts-body'>
                            <div className='section'>
                                <div>
                                    <h4 className='section-title'><strong>{shortcuts[1]}</strong></h4>
                                    {renderShortcuts(shortcuts.slice(2, 11))}
                                </div>
                            </div>
                            <div className='section'>
                                <div>
                                    <h4 className='section-title'><strong>{shortcuts[11]}</strong></h4>
                                    {renderShortcuts(shortcuts.slice(12, 14))}
                                    <span><strong>{shortcuts[14]}</strong></span>
                                    <div className='subsection'>
                                        {renderShortcuts(shortcuts.slice(15, 18))}
                                    </div>
                                    <span><strong>{shortcuts[18]}</strong></span>
                                    <div className='subsection'>
                                        {renderShortcuts(shortcuts.slice(19, 22))}
                                    </div>
                                </div>
                            </div>
                            <div className='section'>
                                <div>
                                    <h4 className='section-title'><strong>{shortcuts[22]}</strong></h4>
                                    {renderShortcuts([shortcuts[23]])}
                                </div>
                                <div>
                                    <h4 className='section-title'><strong>{shortcuts[24]}</strong></h4>
                                    {renderShortcuts(shortcuts.slice(25, 29))}
                                    <span><strong>{shortcuts[29]}</strong></span>
                                    <div className='subsection'>
                                        {renderShortcuts(shortcuts.slice(30, 33))}
                                    </div>
                                </div>
                            </div>
                            <div className='info__label'>
                                <FormattedMessage
                                    id='shortcuts.info'
                                    defaultMessage='Begin a message with / for a list of all the commands at your disposal.'
                                />
                            </div>
                        </div>
                    </Modal.Body>
                </div>
            </Modal>
        );
    }
}

function renderShortcuts(lines) {
    if (!lines) {
        return null;
    }

    const shortcuts = lines.map((line, index) =>
        renderShortcut(line, index)
    );

    return (
        <div>
            {shortcuts}
        </div>
    );
}

function renderShortcut(line, index) {
    if (!line) {
        return null;
    }

    const shortcut = line.split('\t');
    const description = <span>{shortcut[0]}</span>;
    const keys = shortcut[1].split('|').map((key) =>
        <span
            className='shortcut-key'
            key={key}
        >
            {key}
        </span>
    );

    return (
        <div
            key={index}
            className='shortcut-line'
        >
            {description}
            {keys}
        </div>
    );
}
