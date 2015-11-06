// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

const PostAttachmentList = require('./post_attachment_list.jsx');

export default class PostBodyAdditionalContent extends React.Component {
    constructor(props) {
        super(props);

        this.getSlackAttachment = this.getSlackAttachment.bind(this);
        this.getComponent = this.getComponent.bind(this);
    }

    componentWillMount() {
        this.setState({type: this.props.post.type, shouldRender: Boolean(this.props.post.type)});
    }

    getSlackAttachment() {
        const attachments = this.props.post.props && this.props.post.props.attachments || [];
        return (
            <PostAttachmentList
                key={'post_body_additional_content' + this.props.post.id}
                attachments={attachments}
            />
        );
    }

    getComponent() {
        switch (this.state.type) {
        case 'slack_attachment':
            return this.getSlackAttachment();
        }
    }

    render() {
        let content = [];

        if (this.state.shouldRender) {
            const component = this.getComponent();

            if (component) {
                content = component;
            }
        }

        return (
            <div>
                {content}
            </div>
        );
    }
}

PostBodyAdditionalContent.propTypes = {
    post: React.PropTypes.object.isRequired
};