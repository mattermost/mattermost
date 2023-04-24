// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import PropTypes from 'prop-types';
import React from 'react';

import Setting from './setting';

export default class RemoveFileSetting extends Setting {
    static get propTypes() {
        return {
            id: PropTypes.string.isRequired,
            label: PropTypes.node.isRequired,
            helpText: PropTypes.node,
            removeButtonText: PropTypes.node.isRequired,
            removingText: PropTypes.node,
            fileName: PropTypes.string.isRequired,
            onSubmit: PropTypes.func.isRequired,
            disabled: PropTypes.bool,
        };
    }

    constructor(props) {
        super(props);

        this.state = {
            removing: false,
        };
    }

    handleRemove = (e) => {
        e.preventDefault();

        this.setState({removing: true});
        this.props.onSubmit(this.props.id, () => {
            this.setState({removing: false});
        });
    };

    render() {
        return (
            <Setting
                label={this.props.label}
                helpText={this.props.helpText}
                inputId={this.props.id}
            >
                <div>
                    <div className='help-text remove-filename'>
                        {this.props.fileName}
                    </div>
                    <button
                        type='button'
                        className='btn btn-danger'
                        onClick={this.handleRemove}
                        ref={this.removeButtonRef}
                        disabled={this.props.disabled}
                    >
                        {this.state.removing && (
                            <>
                                <span className='glyphicon glyphicon-refresh glyphicon-refresh-animate'/>
                                {this.props.removingText}
                            </>)}
                        {!this.state.removing && this.props.removeButtonText}
                    </button>
                </div>
            </Setting>
        );
    }
}
