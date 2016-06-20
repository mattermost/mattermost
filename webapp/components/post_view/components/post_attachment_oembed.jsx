// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import $ from 'jquery';
import React from 'react';

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
        if (nextProps.link !== this.props.link) {
            this.isLoading = false;
            this.fetchData(nextProps.link);
        }
    }

    componentDidMount() {
        this.fetchData(this.props.link);
    }

    fetchData(link) {
        if (!this.isLoading) {
            this.isLoading = true;
            let url = 'https://noembed.com/embed?nowrap=on';
            url += '&url=' + encodeURIComponent(link);
            url += '&maxheight=' + this.props.provider.height;
            return $.ajax({
                url,
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
        return null;
    }

    render() {
        let data = {};
        let content;
        if ($.isEmptyObject(this.state.data)) {
            content = <div style={{height: this.props.provider.height}}/>;
        } else {
            data = this.state.data;
            content = (
                <div
                    style={{height: this.props.provider.height}}
                    dangerouslySetInnerHTML={{__html: data.html}}
                />
            );
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
                                href={data.url}
                                target='_blank'
                                rel='noopener noreferrer'
                            >
                                {data.title}
                            </a>
                        </h1>
                        <div >
                            <div
                                className={'attachment__body attachment__body--no_thumb'}
                            >
                                {content}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }
}

PostAttachmentOEmbed.propTypes = {
    link: React.PropTypes.string.isRequired,
    provider: React.PropTypes.object.isRequired
};
