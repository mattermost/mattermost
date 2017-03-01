// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';

import OpenGraphStore from 'stores/opengraph_store.jsx';
import * as Utils from 'utils/utils.jsx';
import * as CommonUtils from 'utils/commons.jsx';
import {requestOpenGraphMetadata} from 'actions/global_actions.jsx';

export default class PostAttachmentOpenGraph extends React.Component {
    constructor(props) {
        super(props);
        this.imageDimentions = {  // Image dimentions in pixels.
            height: 150,
            width: 150
        };
        this.maxDescriptionLength = 300;
        this.descriptionEllipsis = '...';
        this.fetchData = this.fetchData.bind(this);
        this.onOpenGraphMetadataChange = this.onOpenGraphMetadataChange.bind(this);
        this.toggleImageVisibility = this.toggleImageVisibility.bind(this);
        this.onImageLoad = this.onImageLoad.bind(this);
    }

    componentWillMount() {
        this.setState({
            data: {},
            imageLoaded: false,
            imageVisible: this.props.previewCollapsed.startsWith('false')
        });
        this.fetchData(this.props.link);
    }

    componentWillReceiveProps(nextProps) {
        this.setState({imageVisible: nextProps.previewCollapsed.startsWith('false')});
        if (!Utils.areObjectsEqual(nextProps.link, this.props.link)) {
            this.fetchData(nextProps.link);
        }
    }

    shouldComponentUpdate(nextProps, nextState) {
        if (nextState.imageVisible !== this.state.imageVisible) {
            return true;
        }
        if (nextState.imageLoaded !== this.state.imageLoaded) {
            return true;
        }
        if (!Utils.areObjectsEqual(nextState.data, this.state.data)) {
            return true;
        }
        return false;
    }

    componentDidMount() {
        OpenGraphStore.addUrlDataChangeListener(this.onOpenGraphMetadataChange);
    }

    componentDidUpdate() {
        if (this.props.childComponentDidUpdateFunction) {
            this.props.childComponentDidUpdateFunction();
        }
    }

    componentWillUnmount() {
        OpenGraphStore.removeUrlDataChangeListener(this.onOpenGraphMetadataChange);
    }

    onOpenGraphMetadataChange(url) {
        if (url === this.props.link) {
            this.fetchData(url);
        }
    }

    fetchData(url) {
        const data = OpenGraphStore.getOgInfo(url);
        this.setState({data, imageLoaded: false});
        if (Utils.isEmptyObject(data)) {
            requestOpenGraphMetadata(url);
        }
    }

    getBestImageUrl() {
        if (this.state.data.images == null) {
            return null;
        }

        const nearestPointData = CommonUtils.getNearestPoint(this.imageDimentions, this.state.data.images, 'width', 'height');

        const bestImage = nearestPointData.nearestPoint;
        const bestImageLte = nearestPointData.nearestPointLte;  // Best image <= 150px height and width

        let finalBestImage;

        if (
            !Utils.isEmptyObject(bestImageLte) &&
            bestImageLte.height <= this.imageDimentions.height &&
            bestImageLte.width <= this.imageDimentions.width
        ) {
            finalBestImage = bestImageLte;
        } else {
            finalBestImage = bestImage;
        }

        return finalBestImage.secure_url || finalBestImage.url;
    }

    toggleImageVisibility() {
        this.setState({imageVisible: !this.state.imageVisible});
    }

    onImageLoad() {
        this.setState({imageLoaded: true});
    }

    loadImage(src) {
        const img = new Image();
        img.onload = this.onImageLoad;
        img.src = src;
    }

    imageToggleAnchoreTag(imageUrl) {
        if (imageUrl) {
            return (
                <a
                    className={'post__embed-visibility'}
                    data-expanded={this.state.imageVisible}
                    aria-label='Toggle Embed Visibility'
                    onClick={this.toggleImageVisibility}
                />
            );
        }
        return null;
    }

    imageTag(imageUrl) {
        if (imageUrl && this.state.imageVisible) {
            return (
                <img
                    className={this.state.imageLoaded ? 'attachment__image' : 'attachment__image loading'}
                    src={this.state.imageLoaded ? imageUrl : null}
                />
            );
        }
        return null;
    }

    render() {
        if (Utils.isEmptyObject(this.state.data) || Utils.isEmptyObject(this.state.data.description)) {
            return null;
        }

        const data = this.state.data;
        const imageUrl = this.getBestImageUrl();
        var description = data.description;

        if (description.length > this.maxDescriptionLength) {
            description = description.substring(0, this.maxDescriptionLength - this.descriptionEllipsis.length) + this.descriptionEllipsis;
        }

        if (imageUrl && this.state.imageVisible) {
            this.loadImage(imageUrl);
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
                        <span className='sitename'>{data.site_name}</span>
                        <h1
                            className='attachment__title has-link'
                        >
                            <a
                                className='attachment__title-link'
                                href={data.url || this.props.link}
                                target='_blank'
                                rel='noopener noreferrer'
                                title={data.title || data.url || this.props.link}
                            >
                                {data.title || data.url || this.props.link}
                            </a>
                        </h1>
                        <div >
                            <div
                                className={'attachment__body attachment__body--no_thumb'}
                            >
                                <div>
                                    <div>
                                        {description} &nbsp;
                                        {this.imageToggleAnchoreTag(imageUrl)}
                                    </div>
                                    {this.imageTag(imageUrl)}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }
}

PostAttachmentOpenGraph.defaultProps = {
    previewCollapsed: 'false'
};

PostAttachmentOpenGraph.propTypes = {
    link: React.PropTypes.string.isRequired,
    childComponentDidUpdateFunction: React.PropTypes.func,
    previewCollapsed: React.PropTypes.string
};
