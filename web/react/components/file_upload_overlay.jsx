// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

module.exports = React.createClass({
	displayName: 'FileUploadOverlay',
	render: function() {
		return (
			<div className='center-file-overlay invisible'>
				<div>
					<i className='fa fa-upload'></i>
					<span>Drop a file to upload it.</span>
				</div>
			</div>
		);
	}
});
