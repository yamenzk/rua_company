// Copyright (c) 2024, Yamen Zakhour and contributors
// For license information, please see license.txt

frappe.ui.form.on('Scope Items', {
    refresh: function(frm) {
        new ScopeItemsRenderer(frm);
    },
    scope_type: function(frm) {
        new ScopeItemsRenderer(frm);
    },
    items: function(frm) {
        new ScopeItemsRenderer(frm);
    },
    _totals_data: function(frm) {
        new ScopeItemsRenderer(frm);
    }
});

class ConstantsDialog {
    constructor(frm) {
        this.frm = frm;
        this.constants = [];
        this.dialog = null;
    }

    async init() {
        if (!this.frm.doc.scope_type) {
            frappe.throw(__('Please select a Scope Type first'));
            return;
        }

        // Get constants from scope type
        const scope_type = await frappe.db.get_doc('Scope Type', this.frm.doc.scope_type);
        this.constants = scope_type.constants || [];

        if (!this.constants.length) {
            frappe.throw(__('No constants defined in the Scope Type'));
            return;
        }

        // Get current constants data
        let constants_data = {};
        try {
            constants_data = JSON.parse(this.frm.doc._constants_data || '{}');
        } catch (e) {
            console.error('Error parsing constants data:', e);
        }

        // Create fields for dialog
        const fields = this.constants.map(constant => ({
            fieldname: constant.constant_name,
            label: constant.label || constant.constant_name,
            fieldtype: constant.constant_type || 'Float',
            default: constants_data[constant.constant_name] || 0,
            description: constant.description,
            read_only: constant.read_only
        }));

        this.dialog = new frappe.ui.Dialog({
            title: __('Define Constants'),
            fields: fields,
            primary_action_label: __('Save'),
            primary_action: (values) => {
                this.save_constants(values);
            }
        });
    }

    show() {
        if (this.dialog) {
            this.dialog.show();
        } else {
            frappe.throw(__('Dialog not initialized. Please try again.'));
        }
    }

    save_constants(values) {
        // Save constants to _constants_data
        this.frm.doc._constants_data = JSON.stringify(values);
        
        // Mark form as dirty and trigger change event
        this.frm.set_value('_constants_data', this.frm.doc._constants_data);
        this.frm.dirty();
        // Save the form
        this.frm.save().then(() => {
            this.dialog.hide();
            frappe.show_alert({
                message: __('Constants saved successfully'),
                indicator: 'green'
            });
        }).catch(err => {
            frappe.show_alert({
                message: __('Error saving constants: ') + err.message,
                indicator: 'red'
            });
        });
    }
}

class ScopeItemsRenderer {
    constructor(frm) {
        this.frm = frm;
        this.scope_fields = [];
        this.calculation_formulas = [];
        this.constants = [];
        this.make();
    }

    async make() {
        if (!this.frm.doc.scope_type) return;

        // Get scope fields and calculation formulas
        const [fields_response, scope_type] = await Promise.all([
            frappe.call({
                method: 'rua_company.rua_company.doctype.scope_items.scope_items.get_scope_fields',
                args: { scope_type: this.frm.doc.scope_type }
            }),
            frappe.db.get_doc('Scope Type', this.frm.doc.scope_type)
        ]);

        this.scope_fields = fields_response.message;
        this.calculation_formulas = scope_type.calculation_formulas;
        this.constants = scope_type.constants;

        this.render_items();
        this.render_totals();
        this.render_constants();
    }

    check_constants() {
        // Return true if all constants are properly defined
        if (!this.constants || !this.constants.length) return true;

        let constants_data = {};
        try {
            constants_data = JSON.parse(this.frm.doc._constants_data || '{}');
        } catch (e) {
            console.error('Error parsing constants data:', e);
            return false;
        }

        // Check if any constant is undefined or 0
        const missing_constants = this.constants.filter(constant => {
            const value = constants_data[constant.constant_name];
            return value === undefined || value === 0;
        });

        if (missing_constants.length > 0) {
            const constant_names = missing_constants.map(c => c.label || c.constant_name).join(', ');
            $(this.frm.fields_dict.items_html.wrapper).find('.add-item')
                .prop('disabled', true)
                .attr('title', __(`Please define values for constants: ${constant_names}`));
            return false;
        }

        $(this.frm.fields_dict.items_html.wrapper).find('.add-item')
            .prop('disabled', false)
            .attr('title', '');
        return true;
    }

    render_items() {
        // Create table HTML
        let table_html = `
            <div class="scope-items-container">
                <div class="d-flex justify-content-between align-items-center mb-3">
                    <div class="h6 text-uppercase mb-0">${__('Items')}</div>
                    <button class="btn btn-primary btn-sm add-item" ${!this.check_constants() ? 'disabled' : ''}>
                        ${frappe.utils.icon('add', 'xs')} ${__('Add Item')}
                    </button>
                </div>
                <div class="scope-items-table-wrapper">
                    ${this.frm.doc.items && this.frm.doc.items.length ? `
                        <table class="table table-bordered">
                            <thead>
                                <tr>
                                    <th class="item-name-col">${__('Item Name')}</th>
                                    ${this.scope_fields.map(field => 
                                        `<th class="text-right">${field.label}</th>`
                                    ).join('')}
                                    <th class="actions-col text-right">${__('Actions')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${this.get_items_html()}
                            </tbody>
                        </table>
                    ` : `
                        <div class="no-items-message text-center text-muted p-4">
                            ${!this.check_constants() ? 
                                __('Please define all constants before adding items') :
                                __('No items added yet. Click "Add Item" to get started.')}
                        </div>
                    `}
                </div>
            </div>
        `;

        $(this.frm.fields_dict.items_html.wrapper).html(table_html);
        this.setup_actions();
    }

    get_items_html() {
        return (this.frm.doc.items || []).map(item => {
            let data = {};
            try {
                data = JSON.parse(item._data || '{}');
            } catch (e) {
                console.error('Error parsing item data:', e);
                data = {};
            }

            return `
                <tr data-row-id="${item.row_id}">
                    <td class="item-name-col">
                        <div>
                            <div class="font-weight-bold">${item.item_name || __('Untitled Item')}</div>
                            ${item.item_code ? `
                                <div class="text-muted small">${item.item_code}</div>
                            ` : ''}
                        </div>
                    </td>
                    ${this.scope_fields.map(field => {
                        const value = data[field.field_name];
                        return `
                            <td class="text-right">
                                <div class="field-value ${value ? '' : 'text-muted'}">
                                    ${this.format_field_value(value, field)}
                                </div>
                            </td>
                        `;
                    }).join('')}
                    <td class="actions-col text-right">
                        <div class="d-flex justify-content-end">
                            <button class="btn btn-xs btn-default edit-item mr-1" title="${__('Edit Item')}">
                                ${frappe.utils.icon('edit', 'xs')}
                            </button>
                            <button class="btn btn-xs btn-danger delete-item" title="${__('Remove Item')}">
                                ${frappe.utils.icon('delete', 'xs')}
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('') || `
            <tr>
                <td colspan="${this.scope_fields.length + 2}" class="text-center text-muted">
                    ${__('No items found')}
                </td>
            </tr>
        `;
    }

    setup_actions() {
        const me = this;
        
        // Add Item button
        this.frm.fields_dict.items_html.$wrapper.find('.add-item').on('click', () => {
            this.show_item_dialog();
        });

        // Edit button
        this.frm.fields_dict.items_html.$wrapper.find('.edit-item').on('click', function() {
            const row_id = $(this).closest('tr').data('row-id');
            const item = me.frm.doc.items.find(i => i.row_id === row_id);
            me.show_item_dialog(item);
        });

        // Delete button
        this.frm.fields_dict.items_html.$wrapper.find('.delete-item').on('click', function() {
            const row_id = $(this).closest('tr').data('row-id');
            me.delete_item(row_id);
        });
    }

    render_totals() {
        if (!this.frm.doc._totals_data) return;
        
        let totals;
        try {
            totals = JSON.parse(this.frm.doc._totals_data || '{}');
        } catch (e) {
            console.error('Error parsing totals data:', e);
            return;
        }

        // Only show totals if we have data
        if (!Object.keys(totals).length) return;

        let totals_html = `
            <div class="scope-totals-container">
                <div class="d-flex justify-content-between align-items-center mb-3">
                    <div class="h6 text-uppercase mb-0">${__('Totals')}</div>
                </div>
                <div class="scope-totals-table-wrapper">
                    <table class="table table-bordered">
                        <thead>
                            <tr>
                                <th>${__('Field')}</th>
                                <th class="text-right">${__('Total')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${Object.entries(totals).map(([key, value]) => {
                                const formula = this.calculation_formulas?.find(f => f.field_name === key);
                                if (!formula) return '';
                                
                                // Determine field type from formula
                                const field_type = formula.field_type || 'Float';
                                
                                return `
                                    <tr>
                                        <td>
                                            <div class="font-weight-bold">${formula.label || key}</div>
                                        </td>
                                        <td class="text-right">
                                            <div class="total-value">
                                                ${this.format_field_value(value, { field_type })}
                                            </div>
                                        </td>
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;

        $(this.frm.fields_dict.totals_html.wrapper).html(totals_html);
    }

    render_constants() {
        if (!this.constants || !this.constants.length) {
            $(this.frm.fields_dict.constants_html.wrapper).empty();
            return;
        }

        // Parse current constants data
        let constants_data = {};
        try {
            constants_data = JSON.parse(this.frm.doc._constants_data || '{}');
        } catch (e) {
            console.error('Error parsing constants data:', e);
        }

        // Create table HTML with warning if constants are not defined
        let table_html = `
            <div class="scope-constants-container">
                <div class="d-flex justify-content-between align-items-center mb-3">
                    <div class="h6 text-uppercase mb-0">${__('Constants')}</div>
                    <button class="btn btn-sm btn-primary define-constants">
                        ${frappe.utils.icon('edit', 'xs')} ${__('Define Constants')}
                    </button>
                </div>
                ${!this.check_constants() ? `
                    <div class="alert alert-warning mb-3">
                        ${__('Please define all constants before adding items')}
                    </div>
                ` : ''}
                <div class="scope-constants-table-wrapper">
                    <table class="table table-bordered">
                        <thead>
                            <tr>
                                <th>${__('Constant')}</th>
                                <th class="text-right">${__('Value')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${this.constants.map(constant => {
                                const value = constants_data[constant.constant_name] || 0;
                                return `
                                    <tr class="${value === 0 ? 'text-danger' : ''}">
                                        <td>
                                            <div class="font-weight-bold">${constant.label || constant.constant_name}</div>
                                        </td>
                                        <td class="text-right">
                                            <div class="constant-value">
                                                ${this.format_value(value, constant.constant_type)}
                                            </div>
                                        </td>
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;

        const wrapper = $(this.frm.fields_dict.constants_html.wrapper);
        wrapper.html(table_html);

        // Setup Define Constants button action
        wrapper.find('.define-constants').on('click', async () => {
            const dialog = new ConstantsDialog(this.frm);
            await dialog.init();
            dialog.show();
        });
    }

    format_field_value(value, field) {
        if (value === undefined || value === null) return '';
        
        switch(field.field_type) {
            case 'Currency':
                return frappe.format(value, { fieldtype: 'Currency' });
            case 'Float':
            case 'Percent':
                return frappe.format(value, { fieldtype: field.field_type });
            case 'Check':
                return value ? '✅' : '❌';
            default:
                return value;
        }
    }

    get_type_indicator(type) {
        const indicators = {
            'Float': 'blue',
            'Int': 'green',
            'Currency': 'yellow',
            'Percent': 'purple'
        };
        return indicators[type] || 'gray';
    }

    format_value(value, type) {
        switch (type) {
            case 'Currency':
                return format_currency(value);
            case 'Percent':
                return flt(value, 2) + '%';
            case 'Int':
                return cint(value);
            default: // Float
                return flt(value, 2);
        }
    }

    show_item_dialog(item = null) {
        const me = this;

        // Filter out auto-calculated fields
        const editable_fields = this.scope_fields.filter(field => 
            !field.auto_calculate && !field.read_only
        );

        // Get auto-calculated fields
        const calculated_fields = this.scope_fields.filter(field => 
            field.auto_calculate || field.read_only
        );

        // Create field dependencies graph
        const dependencies = {};
        calculated_fields.forEach(field => {
            if (field.calculation_formula) {
                dependencies[field.field_name] = this.get_field_dependencies(field.calculation_formula);
            }
        });

        // Sort fields by dependencies
        const sorted_fields = this.sort_fields_by_dependencies(calculated_fields, dependencies);

        const d = new frappe.ui.Dialog({
            title: __(item ? 'Edit Item' : 'Add Item'),
            fields: [
                {
                    fieldname: 'item_name',
                    fieldtype: 'Data',
                    label: 'Item Name',
                    reqd: 1,
                    default: item?.item_name
                },
                {
                    fieldtype: 'Column Break',
                    fieldname: 'col_break_1'
                },
                {
                    fieldtype: 'Section Break',
                    fieldname: 'sec_break_1',
                    label: 'Item Details'
                },
                {
                    fieldtype: 'Column Break',
                    fieldname: 'col_break_2'
                },
                // Left column: Editable fields
                ...editable_fields.map(field => ({
                    fieldname: field.field_name,
                    fieldtype: field.field_type,
                    label: field.label,
                    options: field.options,
                    reqd: field.reqd ? 1 : 0,
                    default: item ? JSON.parse(item._data || '{}')[field.field_name] : field.default_value,
                    onchange: () => this.calculate_field_values(d, sorted_fields)
                })),
                {
                    fieldtype: 'Column Break',
                    fieldname: 'col_break_3'
                },
                // Right column: Auto-calculated fields
                ...sorted_fields.map(field => ({
                    fieldname: field.field_name,
                    fieldtype: field.field_type,
                    label: `${field.label} (Auto)`,
                    read_only: 1,
                    default: item ? JSON.parse(item._data || '{}')[field.field_name] : null
                }))
            ],
            primary_action_label: __('Save'),
            primary_action(values) {
                me.save_item(values, item);
                d.hide();
            }
        });

        // Initial calculation
        this.calculate_field_values(d, sorted_fields);

        d.show();

        // Add some styling to make the columns more distinct
        $(d.wrapper).find('.form-column').css({
            'padding': '0 15px',
            'border-right': '1px solid var(--border-color)'
        });
    }

    get_field_dependencies(formula) {
        const deps = new Set();
        this.scope_fields.forEach(field => {
            if (formula.includes(`variables['${field.field_name}']`)) {
                deps.add(field.field_name);
            }
        });
        return deps;
    }

    sort_fields_by_dependencies(fields, dependencies) {
        const sorted = [];
        const visited = new Set();
        const visiting = new Set();

        function visit(field) {
            if (visiting.has(field.field_name)) {
                frappe.throw(__('Circular dependency detected in calculations'));
            }
            if (visited.has(field.field_name)) {
                return;
            }

            visiting.add(field.field_name);

            // Visit dependencies first
            const deps = dependencies[field.field_name] || new Set();
            deps.forEach(dep => {
                const depField = fields.find(f => f.field_name === dep);
                if (depField) {
                    visit(depField);
                }
            });

            visiting.delete(field.field_name);
            visited.add(field.field_name);
            sorted.push(field);
        }

        fields.forEach(field => {
            if (!visited.has(field.field_name)) {
                visit(field);
            }
        });

        return sorted;
    }

    calculate_field_values(dialog, sorted_fields) {
        // Get current values
        const variables = {};
        this.scope_fields.forEach(field => {
            variables[field.field_name] = dialog.get_value(field.field_name);
        });

        // Get current totals
        const doc_totals = this.frm.doc._totals_data ? 
            JSON.parse(this.frm.doc._totals_data) : {};

        // Calculate each field in dependency order
        sorted_fields.forEach(field => {
            if (field.calculation_formula) {
                try {
                    // Skip if formula contains custom function
                    if (field.calculation_formula.includes('custom.')) {
                        return;
                    }

                    // Create evaluation context
                    const context = {
                        variables,
                        doc_totals,
                        math: Math,
                        flt: (val) => parseFloat(val || 0),
                        cint: (val) => parseInt(val || 0)
                    };

                    // Evaluate formula
                    let result = (new Function(
                        'variables', 'doc_totals', 'math', 'flt', 'cint',
                        `return ${field.calculation_formula}`
                    ))(context.variables, context.doc_totals, context.math, context.flt, context.cint);

                    // Convert result based on field type
                    if (field.field_type === 'Int') {
                        result = parseInt(result);
                    } else {
                        result = parseFloat(result);
                    }

                    // Update dialog field
                    dialog.set_value(field.field_name, result);
                    
                    // Update variables for next calculations
                    variables[field.field_name] = result;
                } catch (e) {
                    console.error(`Error calculating ${field.label}: ${e.message}`);
                }
            }
        });
    }

    async save_item(values, existing_item = null) {
        try {
            const { message: updated_doc } = await frappe.call({
                method: 'rua_company.rua_company.doctype.scope_items.scope_items.save_scope_item',
                args: {
                    scope_items: this.frm.doc.name,
                    item_data: {
                        row_id: existing_item?.row_id,
                        ...values
                    }
                }
            });

            // Update form doc
            this.frm.doc = updated_doc;
            await this.frm.refresh();
            frappe.show_alert({
                message: __('Item saved successfully'),
                indicator: 'green'
            });
        } catch (err) {
            frappe.msgprint(__('Error saving item: ' + err.message));
        }
    }

    async delete_item(row_id) {
        try {
            const confirmed = await new Promise(resolve => {
                frappe.confirm(
                    'Are you sure you want to delete this item?',
                    () => resolve(true),
                    () => resolve(false)
                );
            });

            if (!confirmed) return;
            
            const { message: updated_doc } = await frappe.call({
                method: 'rua_company.rua_company.doctype.scope_items.scope_items.delete_scope_item',
                args: {
                    scope_items: this.frm.doc.name,
                    row_id: row_id
                }
            });

            // Update form doc
            this.frm.doc = updated_doc;
            await this.frm.refresh();
            frappe.show_alert({
                message: __('Item deleted successfully'),
                indicator: 'green'
            });
        } catch (err) {
            frappe.msgprint(__('Error deleting item: ' + err.message));
        }
    }
}

// Add some CSS
frappe.dom.set_style(`
    .scope-items-container {
        margin: 15px 0;
    }

    .scope-items-table-wrapper {
        position: relative;
        overflow-x: auto;
        border-radius: var(--border-radius-md);
        box-shadow: var(--card-shadow);
    }

    .scope-items-table-wrapper table {
        margin: 0;
    }

    .scope-items-table-wrapper th {
        position: sticky;
        top: 0;
        background-color: var(--fg-color);
        font-weight: 600;
        white-space: nowrap;
    }

    .scope-items-table-wrapper td {
        background-color: var(--fg-color);
        vertical-align: middle;
    }

    .item-name-col {
        min-width: 200px;
    }

    .actions-col {
        width: 100px;
    }

    .no-items-message {
        background: var(--fg-color);
        border: 1px dashed var(--gray-400);
        border-radius: var(--border-radius-md);;
    }

    .field-value {
        font-variant-numeric: tabular-nums;
    }

    .scope-totals-container {
        margin: 15px 0;
    }

    .scope-totals-table-wrapper {
        display: flex;
        justify-content: flex-end;
        border-radius: var(--border-radius-md);
    }

    .scope-totals-table-wrapper table {
        width: auto;
        min-width: 300px;
        margin: 0;
        background-color: var(--fg-color);
        border-radius: var(--border-radius-md);;
        box-shadow: var(--card-shadow);
    }

    .scope-totals-table-wrapper th {
        background-color: var(--fg-color);
        font-weight: 600;
        white-space: nowrap;
        border-bottom: 2px solid var(--border-color);
    }

    .scope-totals-table-wrapper td {
        background-color: var(--fg-color);
        vertical-align: middle;
    }

    .scope-totals-table-wrapper .total-value {
        font-weight: 600;
        font-variant-numeric: tabular-nums;
        font-size: 1.1em;
        color: var(--text-color);
    }

    .scope-totals-table-wrapper tr:last-child td {
        border-bottom: none;
    }

    .scope-totals-table-wrapper tr:last-child .total-value {
        color: var(--primary);
    }

    .scope-constants-container {
        margin: 15px 0;
    }

    .scope-constants-table-wrapper {
        display: flex;
        justify-content: flex-start;
        border-radius: var(--border-radius-md);
    }

    .scope-constants-table-wrapper table {
        width: auto;
        min-width: 300px;
        max-width: 400px;
        margin: 0;
        background-color: var(--fg-color);
        border-radius: var(--border-radius-md);
        box-shadow: var(--card-shadow);
    }

    .scope-constants-table-wrapper th {
        background-color: var(--fg-color);
        font-weight: 600;
        white-space: nowrap;
        border-bottom: 2px solid var(--border-color);
    }

    .scope-constants-table-wrapper td {
        background-color: var(--fg-color);
        vertical-align: middle;
    }

    .scope-constants-table-wrapper .constant-value {
        font-weight: 600;
        font-variant-numeric: tabular-nums;
        font-size: 1.1em;
        color: var(--text-color);
    }

    .scope-constants-table-wrapper tr.text-danger .constant-value {
        color: var(--red-500);
    }

    .scope-constants-table-wrapper tr:last-child td {
        border-bottom: none;
    }
`);