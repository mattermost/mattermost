// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// This module builds its own element and dialog objects rather than reusing
// the builders in webhook_utils.js. The grid needs collapsible containers,
// which those builders do not produce, and keeping it standalone leaves the
// shared file untouched.
function createElement(type, config) {
    const element = {
        display_name: config.display_name,
        name: config.name,
        type,
        optional: config.optional || false,
    };

    ['placeholder', 'subtype', 'default', 'options', 'refresh', 'action_button', 'collapsible_config'].forEach((key) => {
        if (config[key] !== undefined) {
            element[key] = config[key];
        }
    });

    return element;
}

function createCollapsible(config) {
    return createElement('collapsible', config);
}

// Grid dialog
//
// A fillable table built out of ordinary dialog elements: every cell is a real
// element with a synthesized name, the cells of one row are grouped in a
// collapsible, and those row collapsibles sit inside a container collapsible
// with subtype 'grid', which is what asks the webapp to lay them out as a
// table rather than stacking them.
//
// The data is a mundane order queue on purpose — the dialog under test is the
// layout and the submission round trip, not the domain.
// ---------------------------------------------------------------------------

const GRID_ADD_ROW_FIELD = 'grid_add_row';
const GRID_WIDTH_FIELD = 'grid_width';
const GRID_MAX_ROWS = 6;

const GRID_STATUS_OPTIONS = [
    {text: 'New', value: 'New'},
    {text: 'Picked', value: 'Picked'},
    {text: 'Shipped', value: 'Shipped'},
];

const GRID_WIDTH_OPTIONS = [
    {text: 'Small', value: 'small'},
    {text: 'Medium', value: 'medium'},
    {text: 'Large', value: 'large'},
];

// gridCellName is what makes per-cell errors possible: names are unique across
// the whole table, so an error keyed by one addresses exactly one input.
function gridCellName(rowId, column) {
    return `cell_${rowId}_${column}`;
}

function gridDefaultState() {
    return {
        rows: [
            {id: 'r1', order: 'SO-1042', weight: '', status: ''},
            {id: 'r2', order: 'SO-1043', weight: '', status: ''},
        ],
        size: 'large',
        next_id: 3,
    };
}

function gridEncodeState(state) {
    return JSON.stringify(state);
}

// gridDecodeState falls back to the default rather than throwing, so a test
// that opens the dialog without state still gets a working grid.
function gridDecodeState(raw) {
    if (!raw) {
        return gridDefaultState();
    }

    try {
        const state = JSON.parse(raw);
        if (!state || !Array.isArray(state.rows) || state.rows.length === 0) {
            return gridDefaultState();
        }
        return state;
    } catch {
        return gridDefaultState();
    }
}

// gridApplySubmission folds the submitted cells back onto the rows. This is
// what keeps half-finished input on screen across a refresh: the values come
// back as ordinary named fields and go straight into the next form's defaults.
function gridApplySubmission(state, submission = {}) {
    const rows = state.rows.map((row) => {
        const updated = {...row};
        ['order', 'weight', 'status'].forEach((column) => {
            const key = gridCellName(row.id, column);
            if (key in submission) {
                updated[column] = String(submission[key] ?? '').trim();
            }
        });
        return updated;
    });

    const size = GRID_WIDTH_OPTIONS.some((w) => w.value === submission[GRID_WIDTH_FIELD]) ? submission[GRID_WIDTH_FIELD] : state.size;

    return {...state, rows, size};
}

function gridAddRow(state) {
    if (state.rows.length >= GRID_MAX_ROWS) {
        return state;
    }

    return {
        ...state,
        rows: [...state.rows, {id: `r${state.next_id}`, order: '', weight: '', status: ''}],
        next_id: state.next_id + 1,
    };
}

// gridValidate returns one error per offending cell, keyed by that cell's own
// element name. The webapp enforces required fields before the request is
// sent, so the case that actually reaches here is a value the client accepts
// and the server rejects — a negative weight.
function gridValidate(state) {
    const errors = {};

    state.rows.forEach((row) => {
        if (!row.order) {
            errors[gridCellName(row.id, 'order')] = 'An order number is required';
        }
        if (row.weight !== '' && (isNaN(Number(row.weight)) || Number(row.weight) < 0)) {
            errors[gridCellName(row.id, 'weight')] = 'Enter a weight of 0 or more';
        }
    });

    return errors;
}

// gridRowElements is the column definition applied to one row. The columns are
// fixed and in the same order for every row, which is what lets the webapp take
// its column headers from the first row.
function gridRowElements(row, webhookBaseUrl) {
    return [
        createElement('text', {
            display_name: 'Order #',
            name: gridCellName(row.id, 'order'),
            placeholder: 'e.g. SO-1042',
            default: row.order,
        }),
        // Whole kilograms, not decimals: a 'number' subtype renders an
        // <input type="number">, and TextSetting reports those through
        // parseInt, so a fractional weight is truncated before submission. The
        // placeholder says so rather than inviting input the field discards.
        createElement('text', {
            display_name: 'Weight (kg)',
            name: gridCellName(row.id, 'weight'),
            subtype: 'number',
            placeholder: '0',
            default: row.weight,
            optional: true,
        }),
        createElement('select', {
            display_name: 'Status',
            name: gridCellName(row.id, 'status'),
            placeholder: 'Select...',
            default: row.status,
            optional: true,
            options: GRID_STATUS_OPTIONS,
        }),

        // The last column is a button rather than an input. A click carries
        // only this static context, never the values typed into the grid, so
        // the row has to name itself here.
        createElement('action_button', {
            display_name: 'Details',
            name: gridCellName(row.id, 'details'),
            optional: true,
            action_button: {
                url: `${webhookBaseUrl}/dialog/open_child`,
                context: {source: row.id},
            },
        }),
    ];
}

function gridDialogBody(webhookBaseUrl, state) {
    return {
        callback_id: 'grid_callback',
        title: 'Order Queue',
        submit_label: 'Submit orders',
        notify_on_cancel: true,
        introduction_text: 'Fill in a row per order, then choose Submit orders.',
        source_url: `${webhookBaseUrl}/dialog/grid_source`,

        // The width tier. The integration picks it because it is the party
        // that knows how many columns the grid has.
        size: state.size,
        state: gridEncodeState(state),
        elements: gridElements(state, webhookBaseUrl),
    };
}

function gridElements(state, webhookBaseUrl) {
    return [
        createCollapsible({
            display_name: 'Orders',
            name: 'order_grid',
            subtype: 'grid',
            optional: true,
            collapsible_config: {
                collapsed: false,
                borderless: true,
                elements: state.rows.map((row) => createCollapsible({
                    display_name: row.order || `New order ${row.id}`,
                    name: `row_${row.id}`,
                    optional: true,
                    collapsible_config: {
                        collapsed: false,
                        borderless: true,
                        elements: gridRowElements(row, webhookBaseUrl),
                    },
                })),
            },
        }),
        createElement('bool', {
            display_name: 'Add an order',
            name: GRID_ADD_ROW_FIELD,
            placeholder: 'Add an order',
            optional: true,
            refresh: true,
        }),

        // Refreshing with a new width returns this same form with a different
        // size, so the open modal resizes rather than reopening.
        createElement('select', {
            display_name: 'Dialog width',
            name: GRID_WIDTH_FIELD,
            placeholder: 'Dialog width',
            default: state.size,
            optional: true,
            refresh: true,
            options: GRID_WIDTH_OPTIONS,
        }),
    ];
}

function getGridDialog(triggerId, webhookBaseUrl, state = gridDefaultState()) {
    return {
        trigger_id: triggerId,
        url: `${webhookBaseUrl}/dialog/grid_source`,
        dialog: gridDialogBody(webhookBaseUrl, state),
    };
}

// getGridForm is the same dialog as a form response, which is what a refresh
// returns. Returning a form keeps the modal open and replaces its contents,
// and a new size on that form resizes the modal in place.
function getGridForm(webhookBaseUrl, state) {
    return {
        ...gridDialogBody(webhookBaseUrl, state),
        url: `${webhookBaseUrl}/dialog/grid_source`,
    };
}

module.exports = {
    getGridDialog,
    getGridForm,
    gridAddRow,
    gridApplySubmission,
    gridDecodeState,
    gridValidate,
    GRID_ADD_ROW_FIELD,
};
