import React from 'react';
import Select from 'react-select';

var ValuesAsNumbersField = React.createClass({
	displayName: 'ValuesAsNumbersField',
	propTypes: {
		label: React.PropTypes.string
	},
	getInitialState () {
		return {
			options: [
				{ value: 10, label: 'Ten' },
				{ value: 11, label: 'Eleven' },
				{ value: 12, label: 'Twelve' },
				{ value: 23, label: 'Twenty-three' },
				{ value: 24, label: 'Twenty-four' }
			],
			matchPos: 'any',
			matchValue: true,
			matchLabel: true,
			value: null,
			multi: false
		};
	},
	onChangeMatchStart(event) {
		this.setState({
			matchPos: event.target.checked ? 'start' : 'any'
		});
	},
	onChangeMatchValue(event) {
		this.setState({
			matchValue: event.target.checked
		});
	},
	onChangeMatchLabel(event) {
		this.setState({
			matchLabel: event.target.checked
		});
	},
	onChange(value) {
		this.setState({ value });
		console.log('Numeric Select value changed to', value);
	},
	onChangeMulti(event) {
		this.setState({
			multi: event.target.checked
		});
	},
	render () {
		var matchProp = 'any';
		if (this.state.matchLabel && !this.state.matchValue) {
			matchProp = 'label';
		}
		if (!this.state.matchLabel && this.state.matchValue) {
			matchProp = 'value';
		}
		return (
			<div className="section">
				<h3 className="section-heading">{this.props.label}</h3>
				<Select
					matchPos={this.state.matchPos}
					matchProp={matchProp}
					multi={this.state.multi}
					onChange={this.onChange}
					options={this.state.options}
					simpleValue
					value={this.state.value}
					/>
				<div className="checkbox-list">
					<label className="checkbox">
						<input type="checkbox" className="checkbox-control" checked={this.state.multi} onChange={this.onChangeMulti} />
						<span className="checkbox-label">Multi-Select</span>
					</label>
					<label className="checkbox">
						<input type="checkbox" className="checkbox-control" checked={this.state.matchValue} onChange={this.onChangeMatchValue} />
						<span className="checkbox-label">Match value</span>
					</label>
					<label className="checkbox">
						<input type="checkbox" className="checkbox-control" checked={this.state.matchLabel} onChange={this.onChangeMatchLabel} />
						<span className="checkbox-label">Match label</span>
					</label>
					<label className="checkbox">
						<input type="checkbox" className="checkbox-control" checked={this.state.matchPos === 'start'} onChange={this.onChangeMatchStart} />
						<span className="checkbox-label">Only include matches from the start of the string</span>
					</label>
				</div>
				<div className="hint">This example uses simple numeric values</div>
			</div>
		);
	}
});

module.exports = ValuesAsNumbersField;
