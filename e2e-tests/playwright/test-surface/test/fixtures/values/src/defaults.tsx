import React from 'react';

import fields from './default_fields';

// a field object reached through a default-exported object of constants (`import utils from './utils'`)
function Field({data}: {data: {testId: string}}) {
    return <input data-testid={data.testId}/>;
}
export function DefaultFields() {
    return <Field data={fields.Mute}/>;
}
