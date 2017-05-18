import PropTypes from 'prop-types';

// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';

export default class ModalToggleButton extends React.Component {
    constructor(props) {
        super(props);

        this.show = this.show.bind(this);
        this.hide = this.hide.bind(this);

        this.state = {
            show: false
        };
    }

    show(e) {
        if (e) {
            e.preventDefault();
        }
        this.setState({show: true});
    }

    hide() {
        this.setState({show: false});
    }

    render() {
        const {children, dialogType, dialogProps, onClick, ...props} = this.props;

        // allow callers to provide an onClick which will be called before the modal is shown
        let clickHandler = this.show;
        if (onClick) {
            clickHandler = (e) => {
                onClick();

                this.show(e);
            };
        }

        let dialog;
        if (this.state.show) {
            // this assumes that all modals will have an onHide event and will show when mounted
            dialog = React.createElement(dialogType, Object.assign({}, dialogProps, {
                onHide: () => {
                    this.hide();

                    if (dialogProps.onHide) {
                        dialogProps.onHide();
                    }
                }
            }));
        }

        // nesting the dialog in the anchor tag looks like it shouldn't work, but it does due to how react-bootstrap
        // renders modals at the top level of the DOM instead of where you specify in the virtual DOM
        return (
            <a
                {...props}
                href='#'
                onClick={clickHandler}
            >
                {children}
                {dialog}
            </a>
        );
    }
}

ModalToggleButton.propTypes = {
    children: PropTypes.node.isRequired,
    dialogType: PropTypes.func.isRequired,
    dialogProps: PropTypes.object,
    onClick: PropTypes.func
};

ModalToggleButton.defaultProps = {
    dialogProps: {}
};
