import React from 'react';
import Select from 'react-select';
import Gravatar from 'react-gravatar';

const USERS = require('../data/users');
const GRAVATAR_SIZE = 15;

const GravatarOption = React.createClass({
	propTypes: {
		children: React.PropTypes.node,
		className: React.PropTypes.string,
		isDisabled: React.PropTypes.bool,
		isFocused: React.PropTypes.bool,
		isSelected: React.PropTypes.bool,
		onFocus: React.PropTypes.func,
		onSelect: React.PropTypes.func,
		option: React.PropTypes.object.isRequired,
	},
	handleMouseDown (event) {
		event.preventDefault();
		event.stopPropagation();
		this.props.onSelect(this.props.option, event);
	},
	handleMouseEnter (event) {
		this.props.onFocus(this.props.option, event);
	},
	handleMouseMove (event) {
		if (this.props.isFocused) return;
		this.props.onFocus(this.props.option, event);
	},
	render () {
		let gravatarStyle = {
			borderRadius: 3,
			display: 'inline-block',
			marginRight: 10,
			position: 'relative',
			top: -2,
			verticalAlign: 'middle',
		};
		return (
			<div className={this.props.className}
				onMouseDown={this.handleMouseDown}
				onMouseEnter={this.handleMouseEnter}
				onMouseMove={this.handleMouseMove}
				title={this.props.option.title}>
				<Gravatar email={this.props.option.email} size={GRAVATAR_SIZE} style={gravatarStyle} />
				{this.props.children}
			</div>
		);
	}
});

const GravatarValue = React.createClass({
	propTypes: {
		children: React.PropTypes.node,
		placeholder: React.PropTypes.string,
		value: React.PropTypes.object
	},
	render () {
		var gravatarStyle = {
			borderRadius: 3,
			display: 'inline-block',
			marginRight: 10,
			position: 'relative',
			top: -2,
			verticalAlign: 'middle',
		};
		return (
			<div className="Select-value" title={this.props.value.title}>
				<span className="Select-value-label">
					<Gravatar email={this.props.value.email} size={GRAVATAR_SIZE} style={gravatarStyle} />
					{this.props.children}
				</span>
			</div>
		);
	}
});

const UsersField = React.createClass({
	propTypes: {
		hint: React.PropTypes.string,
		label: React.PropTypes.string,
	},
	getInitialState () {
		return {};
	},
	setValue (value) {
		this.setState({ value });
	},
	render () {
		var placeholder = <span>&#9786; Select User</span>;

		return (
			<div className="section">
				<h3 className="section-heading">{this.props.label}</h3>
				<Select
					arrowRenderer={arrowRenderer}
					onChange={this.setValue}
					optionComponent={GravatarOption}
					options={USERS}
					placeholder={placeholder}
					value={this.state.value}
					valueComponent={GravatarValue}
					/>
				<div className="hint">
					This example implements custom Option and Value components to render a Gravatar image for each user based on their email.
					It also demonstrates rendering HTML elements as the placeholder.
				</div>
			</div>
		);
	}
});

function arrowRenderer () {
	return (
		<span>+</span>
	);
}

module.exports = UsersField;
