import React from 'react';
import Select from 'react-select';
import Highlighter from 'react-highlight-words';

var DisabledUpsellOptions = React.createClass({
	displayName: 'DisabledUpsellOptions',
	propTypes: {
		label: React.PropTypes.string,
	},
	getInitialState () {
		return {};
	},
	setValue (value) {
		this.setState({ value });
		console.log('Support level selected:', value.label);
	},
	renderLink: function() {
		return <a style={{ marginLeft: 5 }} href="/upgrade" target="_blank">Upgrade here!</a>;
	},
	renderOption: function(option) {
		return (
			<Highlighter
			  searchWords={[this._inputValue]}
			  textToHighlight={option.label}
			/>
		);
	},
	renderValue: function(option) {
		return <strong style={{ color: option.color }}>{option.label}</strong>;
	},
	render: function() {
		var options = [
			{ label: 'Basic customer support', value: 'basic', color: '#E31864' },
			{ label: 'Premium customer support', value: 'premium', color: '#6216A3' },
			{ label: 'Pro customer support', value: 'pro', disabled: true, link: this.renderLink() },
		];
		return (
			<div className="section">
				<h3 className="section-heading">{this.props.label}</h3>
				<Select
					onInputChange={(inputValue) => this._inputValue = inputValue}
					options={options}
					optionRenderer={this.renderOption}
					onChange={this.setValue}
					value={this.state.value}
					valueRenderer={this.renderValue}
					/>
				<div className="hint">This demonstates custom render methods and links in disabled options</div>
			</div>
		);
	}
});
module.exports = DisabledUpsellOptions;
