// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

export default class Modal extends ReactBootstrap.Modal {
    constructor(props) {
        super(props);
    }

    componentWillMount() {
        if (this.props.show && this.props.onPreshow) {
            this.props.onPreshow();
        }
    }

    componentDidMount() {
        super.componentDidMount();

        if (this.props.show && this.props.onShow) {
            this.props.onShow();
        }
    }

    componentDidUpdate(prevProps) {
        super.componentDidUpdate(prevProps);

        if (this.props.show && !prevProps.show && this.props.onShow) {
            this.props.onShow();
        }
    }

    componentWillReceiveProps(nextProps) {
        super.componentWillReceiveProps(nextProps);

        if (nextProps.show && !this.props.show && this.props.onPreshow) {
            this.props.onPreshow();
        }
    }
}

Modal.propTypes = {
    ...ReactBootstrap.Modal.propTypes,

    // called before showing the dialog to allow for a state change before rendering
    onPreshow: React.PropTypes.func,

    // called after the dialog has been shown and rendered
    onShow: React.PropTypes.func
};
