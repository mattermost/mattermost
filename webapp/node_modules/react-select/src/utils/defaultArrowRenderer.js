import React from 'react';

export default function arrowRenderer ({ onMouseDown }) {
	return (
		<span
			className="Select-arrow"
			onMouseDown={onMouseDown}
		/>
	);
};
