// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

export default class ModalToggleButton extends React.Component {
    constructor(props) {
        super(props);

        this.show = this.show.bind(this);
        this.hide = this.hide.bind(this);

        this.state = {
            show: false
        };
    }

    show() {
        this.setState({show: true});
    }

    hide() {
        this.setState({show: false});
    }

    render() {
        const {children, dialogType, dialogProps, ...props} = this.props;

        // this assumes that all modals will have a show property and an onModalDismissed event
        const dialog = React.createElement(this.props.dialogType, Object.assign({}, dialogProps, {
            show: this.state.show,
            onModalDismissed: () => {
                this.hide();

                if (dialogProps.onModalDismissed) {
                    dialogProps.onModalDismissed();
                }
            }
        }));

        return (
            <div style={{display: 'inline'}}>
                <a
                    {...props}
                    href='#'
                    onClick={this.show}
                >
                    {children}
                </a>
                {dialog}
            </div>
        );
    }
}

ModalToggleButton.propTypes = {
    children: React.PropTypes.node.isRequired,
    dialogType: React.PropTypes.func.isRequired,
    dialogProps: React.PropTypes.object
};

ModalToggleButton.defaultProps = {
    dialogProps: {}
};
