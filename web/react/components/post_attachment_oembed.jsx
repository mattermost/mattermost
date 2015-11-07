// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

export default class PostAttachmentOEmbed extends React.Component {
    constructor(props) {
        super(props);
        this.fetchData = this.fetchData.bind(this);

        this.isLoading = false;
    }

    componentWillMount() {
        this.setState({data: {}});
    }

    componentWillReceiveProps(nextProps) {
        this.fetchData(nextProps.link);
    }

    fetchData(link) {
        if (!this.isLoading) {
            this.isLoading = true;
            return $.ajax({
                url: 'https://noembed.com/embed?nowrap=on&url=' + encodeURIComponent(link),
                dataType: 'jsonp',
                success: (result) => {
                    this.isLoading = false;
                    if (result.error) {
                        this.setState({data: {}});
                    } else {
                        this.setState({data: result});
                    }
                },
                error: () => {
                    this.setState({data: {}});
                }
            });
        }
    }

    render() {
        if ($.isEmptyObject(this.state.data)) {
            return <div></div>;
        }

        return (
            <div
                className='attachment attachment--oembed'
                ref='attachment'
            >
                    <div className='attachment__content'>
                        <div
                            className={'clearfix attachment__container'}
                        >
                            <h1
                                className='attachment__title'
                            >
                                <a
                                    className='attachment__title-link'
                                    href={this.state.data.url}
                                    target='_blank'
                                >
                                    {this.state.data.title}
                                </a>
                            </h1>
                            <div>
                                <div className={'attachment__body attachment__body--no_thumb'}>
                                    <div
                                        dangerouslySetInnerHTML={{__html: this.state.data.html}}
                                    >
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
            </div>
        );
    }
}

PostAttachmentOEmbed.propTypes = {
    link: React.PropTypes.string.isRequired
};
