import React from 'react';
import Select from 'react-select';

var CreatableDemo = React.createClass({
	displayName: 'CreatableDemo',
	propTypes: {
		hint: React.PropTypes.string,
		label: React.PropTypes.string
	},
	getInitialState () {
		return {
			multi: true,
			multiValue: [],
			options: [
				{ value: 'R', label: 'Red' },
				{ value: 'G', label: 'Green' },
				{ value: 'B', label: 'Blue' }
			],
			value: undefined
		};
	},
	handleOnChange (value) {
		const { multi } = this.state;
		if (multi) {
			this.setState({ multiValue: value });
		} else {
			this.setState({ value });
		}
	},
	render () {
		const { multi, multiValue, options, value } = this.state;
		return (
			<div className="section">
				<h3 className="section-heading">{this.props.label}</h3>
				<Select.Creatable
					multi={multi}
					options={options}
					onChange={this.handleOnChange}
					value={multi ? multiValue : value}
				/>
				<div className="hint">{this.props.hint}</div>
				<div className="checkbox-list">
					<label className="checkbox">
						<input
							type="radio"
							className="checkbox-control"
							checked={multi}
							onChange={() => this.setState({ multi: true })}
						/>
						<span className="checkbox-label">Multiselect</span>
					</label>
					<label className="checkbox">
						<input
							type="radio"
							className="checkbox-control"
							checked={!multi}
							onChange={() => this.setState({ multi: false })}
						/>
						<span className="checkbox-label">Single Value</span>
					</label>
				</div>
			</div>
		);
	}
});

module.exports = CreatableDemo;
