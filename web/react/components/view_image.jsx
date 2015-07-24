// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

var Client = require('../utils/client.jsx');
var utils = require('../utils/utils.jsx');

module.exports = React.createClass({
    handleNext: function() {
        var id = this.state.imgId + 1;
        if (id > this.props.filenames.length-1) {
            id = 0;
        }
        this.setState({ imgId: id });
        this.loadImage(id);
    },
    handlePrev: function() {
        var id = this.state.imgId - 1;
        if (id < 0) {
            id = this.props.filenames.length-1;
        }
        this.setState({ imgId: id });
        this.loadImage(id);
    },
    componentWillReceiveProps: function(nextProps) {
        this.setState({ imgId: nextProps.startId });
    },
    loadImage: function(id) {
        var imgHeight = $(window).height()-100;
        if (this.state.loaded[id] || this.state.images[id]){
            $('.modal .modal-image .image-wrapper img').css("max-height",imgHeight);
            return;
        };

        var fileInfo = utils.splitFileLocation(this.props.filenames[id]);
        // This is a temporary patch to fix issue with old files using absolute paths
        if (fileInfo.path.indexOf("/api/v1/files/get") !== -1) {
            fileInfo.path = fileInfo.path.split("/api/v1/files/get")[1];
        }
        fileInfo.path = utils.getWindowLocationOrigin() + "/api/v1/files/get" + fileInfo.path;
        var src = fileInfo['path'] + '_preview.jpg';

        var self = this;
        var img = new Image();
        img.load(src,
            function(){
                var progress = self.state.progress;
                progress[id] = img.completedPercentage;
                self.setState({ progress: progress });
        });
        img.onload = function(imgid) {
            return function() {
                var loaded = self.state.loaded;
                loaded[imgid] = true;
                self.setState({ loaded: loaded });
                $(self.refs.image.getDOMNode()).css("max-height",imgHeight);
            };
        }(id);
        var images = this.state.images;
        images[id] = img;
        this.setState({ images: images });
    },
    componentDidUpdate: function() {
        if (this.refs.image) {
            if (this.state.loaded[this.state.imgId]) {
                $(this.refs.imageWrap.getDOMNode()).removeClass("default");
            }
        }
    },
    componentDidMount: function() {
        var self = this;
        $("#"+this.props.modalId).on('shown.bs.modal', function() {
            self.setState({ viewed: true });
            self.loadImage(self.state.imgId);
        })

        $(this.refs.modal.getDOMNode()).click(function(e){
            if (e.target == this || e.target == self.refs.imageBody.getDOMNode()) {
                $('.image_modal').modal('hide');
            }
        });

        $(this.refs.imageWrap.getDOMNode()).hover(
            function() {
                $(self.refs.imageFooter.getDOMNode()).addClass("footer--show");
            }, function() {
                $(self.refs.imageFooter.getDOMNode()).removeClass("footer--show");
            }
        );
    },
    getPublicLink: function(e) {
        data = {};
        data["channel_id"] = this.props.channelId;
        data["user_id"] = this.props.userId;
        data["filename"] = this.props.filenames[this.state.imgId];
        Client.getPublicLink(data,
            function(data) {
                window.open(data["public_link"]);
            }.bind(this),
            function(err) {
            }.bind(this)
        );
    },
    getInitialState: function() {
        var loaded = [];
        var progress = [];
        for (var i = 0; i < this.props.filenames.length; i ++) {
            loaded.push(false);
            progress.push(0);
        }
        return { imgId: this.props.startId, viewed: false, loaded: loaded, progress: progress, images: {} };
    },
    render: function() {
        if (this.props.filenames.length < 1 || this.props.filenames.length-1 < this.state.imgId) {
            return <div/>;
        }

        var fileInfo = utils.splitFileLocation(this.props.filenames[this.state.imgId]);

        var name = fileInfo['name'] + '.' + fileInfo['ext'];

        var loading = "";
        var bgClass = "";
        var img = {};
        if (!this.state.loaded[this.state.imgId]) {
            var percentage = Math.floor(this.state.progress[this.state.imgId]);
            loading = (
                <div key={name+"_loading"}>
                    <img ref="placeholder" className="loader-image" src="/static/images/load.gif" />
                    { percentage > 0 ?
                    <span className="loader-percent" >{"Previewing " + percentage + "%"}</span>
                    : ""}
                </div>
            );
            bgClass = "black-bg";
        } else if (this.state.viewed) {
            for (var id in this.state.images) {
                var info = utils.splitFileLocation(this.props.filenames[id]);
                var preview_filename = "";

                // This is a temporary patch to fix issue with old files using absolute paths
                if (info.path.indexOf("/api/v1/files/get") !== -1) {
                    info.path = info.path.split("/api/v1/files/get")[1];
                }
                info.path = utils.getWindowLocationOrigin() + "/api/v1/files/get" + info.path;
                preview_filename = info['path'] + '_preview.jpg';

                var imgClass = "hidden";
                if (this.state.loaded[id] && this.state.imgId == id) imgClass = "";

                img[info['path']] = <a key={info['path']} className={imgClass} href={info.path+"."+info.ext} target="_blank"><img ref="image" src={preview_filename}/></a>;
            }
        }

        var imgFragment = React.addons.createFragment(img);

        // This is a temporary patch to fix issue with old files using absolute paths
        var download_link = this.props.filenames[this.state.imgId];
        if (download_link.indexOf("/api/v1/files/get") !== -1) {
            download_link = download_link.split("/api/v1/files/get")[1];
        }
        download_link = utils.getWindowLocationOrigin() + "/api/v1/files/get" + download_link;

        return (
            <div className="modal fade image_modal" ref="modal" id={this.props.modalId} tabIndex="-1" role="dialog" aria-hidden="true">
                <div className="modal-dialog modal-image">
                    <div className="modal-content image-content">
                        <div ref="imageBody" className="modal-body image-body">
                            <div ref="imageWrap" className={"image-wrapper default " + bgClass}>
                                <div className="modal-close" data-dismiss="modal"></div>
                                {imgFragment}
                                <div ref="imageFooter" className="modal-button-bar">
                                    <span className="pull-left text">{"Image "+(this.state.imgId+1)+" of "+this.props.filenames.length}</span>
                                    <div className="image-links">
                                        { config.AllowPublicLink ?
                                            <div>
                                                <a href="#" className="public-link text" data-title="Public Image" onClick={this.getPublicLink}>Get Public Link</a>
                                                <span className="text"> | </span>
                                            </div>
                                        : "" }
                                        <a href={download_link} download={decodeURIComponent(name)} className="text">Download</a>
                                    </div>
                                </div>
                                {loading}
                            </div>
                            { this.props.filenames.length > 1 ?
                            <a className="modal-prev-bar" href="#" onClick={this.handlePrev}>
                                <i className="image-control image-prev"/>
                            </a>
                            : "" }
                            { this.props.filenames.length > 1 ?
                            <a className="modal-next-bar" href="#" onClick={this.handleNext}>
                                <i className="image-control image-next"/>
                            </a>
                            : "" }
                        </div>
                    </div>
                </div>
            </div>
        );
    }
});
