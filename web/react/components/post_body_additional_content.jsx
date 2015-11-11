// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

const PostAttachmentList = require('./post_attachment_list.jsx');
const PostAttachmentOEmbed = require('./post_attachment_oembed.jsx');

export default class PostBodyAdditionalContent extends React.Component {
    constructor(props) {
        super(props);

        this.getSlackAttachment = this.getSlackAttachment.bind(this);
        this.getOembedAttachment = this.getOembedAttachment.bind(this);
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

    getOembedAttachment() {
        const link = this.props.post.props && this.props.post.props.oEmbedLink || '';
        return (
            <PostAttachmentOEmbed
                key={'post_body_additional_content' + this.props.post.id}
                link={link}
            />
        );
    }

    getComponent() {
        switch (this.props.post.type) {
        case 'slack_attachment':
            return this.getSlackAttachment();
        case 'oEmbed':
            return this.getOembedAttachment();
        default:
            return '';
        }
    }

    render() {
        let content = [];

        if (Boolean(this.props.post.type)) {
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