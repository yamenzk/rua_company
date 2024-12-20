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

class ScopeItemsRenderer {
    constructor(frm) {
        this.frm = frm;
        this.scope_fields = [];
        this.calculation_formulas = [];
        this.make();
    }

    async make() {
        if (!this.frm.doc.scope_type) return;

        // Get scope fields and calculation formulas
        const [fields_response, formulas_response] = await Promise.all([
            frappe.call({
                method: 'rua_company.rua_company.doctype.scope_items.scope_items.get_scope_fields',
                args: { scope_type: this.frm.doc.scope_type }
            }),
            frappe.db.get_doc('Scope Type', this.frm.doc.scope_type)
        ]);

        this.scope_fields = fields_response.message;
        this.calculation_formulas = formulas_response.calculation_formulas;

        this.render_items();
        this.render_totals();
    }

    render_items() {
        // Create table HTML
        let table_html = `
            <div class="scope-items-container">
                <div class="d-flex justify-content-end mb-3">
                    <button class="btn btn-primary btn-sm add-item">
                        ${frappe.utils.icon('add', 'xs')} Add Item
                    </button>
                </div>
                <div class="scope-items-table-wrapper">
                    <table class="table table-bordered">
                        <thead>
                            <tr>
                                <th>Item Name</th>
                                ${this.scope_fields.map(field => 
                                    `<th>${field.label}</th>`
                                ).join('')}
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${this.get_items_html()}
                        </tbody>
                    </table>
                </div>
            </div>
        `;

        $(this.frm.fields_dict.items_html.wrapper).html(table_html);
        this.setup_actions();
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
                <div class="scope-totals-table-wrapper">
                    <table class="table table-bordered">
                        <thead>
                            <tr>
                                <th>Field</th>
                                <th>Total</th>
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
                                        <td>${formula.label || key}</td>
                                        <td>${this.format_field_value(value, { field_type })}</td>
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

    get_items_html() {
        return (this.frm.doc.items || []).map(item => {
            let data = {};
            try {
                data = JSON.parse(item._data || '{}');
            } catch (e) {
                console.error('Error parsing item data:', e);
            }
            return `
                <tr data-row-id="${item.row_id}">
                    <td>${item.item_name}</td>
                    ${this.scope_fields.map(field => 
                        `<td>${this.format_field_value(data[field.field_name], field)}</td>`
                    ).join('')}
                    <td>
                        <button class="btn btn-xs btn-default edit-item">
                            ${frappe.utils.icon('edit', 'xs')}
                        </button>
                        <button class="btn btn-xs btn-danger delete-item">
                            ${frappe.utils.icon('delete', 'xs')}
                        </button>
                    </td>
                </tr>
            `;
        }).join('') || `<tr><td colspan="${this.scope_fields.length + 2}" class="text-center text-muted">No items found</td></tr>`;
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
                return value ? '✓' : '';
            default:
                return value;
        }
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
    .scope-items-container,
    .scope-totals-container {
        margin: 15px 0;
    }

    .scope-items-table-wrapper,
    .scope-totals-table-wrapper {
        position: relative;
        overflow-x: auto;
        border-radius: var(--border-radius);
        border: 1px solid var(--border-color);
    }

    .scope-items-table-wrapper table,
    .scope-totals-table-wrapper table {
        margin: 0;
    }

    .scope-items-table-wrapper th,
    .scope-totals-table-wrapper th {
        position: sticky;
        top: 0;
        background-color: var(--fg-color);
        font-weight: 600;
        white-space: nowrap;
        border-bottom: 2px solid var(--border-color);
    }

    .scope-items-table-wrapper td,
    .scope-totals-table-wrapper td {
        background-color: var(--fg-color);
        vertical-align: middle;
    }

    .scope-items-table-wrapper tr:last-child td {
        border-bottom: none;
    }

    .scope-totals-table-wrapper table {
        width: auto;
        min-width: 300px;
    }

    .scope-totals-table-wrapper td:last-child {
        font-weight: 600;
        text-align: right;
    }
`);