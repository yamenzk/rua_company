// Copyright (c) 2024, Yamen Zakhour and contributors
// For license information, please see license.txt

frappe.ui.form.on('Scope Items', {
    refresh: function(frm) {
        new ScopeItemsRenderer(frm);
        
        // Add Assign/Draft toggle button
        if (frm.doc.docstatus === 0) {  // Only show for non-submitted documents
            const buttonLabel = frm.doc.status === "Assigned" ? "Draft" : "Assign";
            const newStatus = frm.doc.status === "Assigned" ? "Draft" : "Assigned";
            
            frm.add_custom_button(__(buttonLabel), function() {
                frm.set_value('status', newStatus);
                frm.save();
            });

            // Apply styles directly
            setTimeout(() => {
                const $button = $(`button[data-label="${buttonLabel}"]`);
                if (buttonLabel === "Draft") {
                    $button.css({
                        'background-color': '#ff6b6b',
                        'color': 'white'
                    });
                } else {
                    $button.css({
                        'background-color': '#00CED1',
                        'color': 'white'
                    });
                }
            }, 100);
        }
    },
    project: function(frm) {
        if (frm.doc.project && frm.doc.scope_type) {
            frm.set_value('label', `${frm.doc.project}: ${frm.doc.scope_type}`);
        }
    },
    scope_type: function(frm) {
        if (frm.doc.project && frm.doc.scope_type) {
            frm.set_value('label', `${frm.doc.project}: ${frm.doc.scope_type}`);
        }
        new ScopeItemsRenderer(frm);
    },
    items: function(frm) {
        new ScopeItemsRenderer(frm);
    },
    totals_data: function(frm) {
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
            constants_data = JSON.parse(this.frm.doc.constants_data || '{}');
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
        // Save constants to constants_data
        this.frm.doc.constants_data = JSON.stringify(values);
        
        // Mark form as dirty and trigger change event
        this.frm.set_value('constants_data', this.frm.doc.constants_data);
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
            constants_data = JSON.parse(this.frm.doc.constants_data || '{}');
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
                data = JSON.parse(item.data || '{}');
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
        if (!this.frm.doc.totals_data) return;
        
        let totals;
        try {
            totals = JSON.parse(this.frm.doc.totals_data || '{}');
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
            constants_data = JSON.parse(this.frm.doc.constants_data || '{}');
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

        // Get required and optional fields for display
        const requiredFields = ['item_name', ...editable_fields.filter(f => f.reqd).map(f => f.field_name)];
        const optionalFields = editable_fields.filter(f => !f.reqd).map(f => f.field_name);

        const d = new frappe.ui.Dialog({
            title: __(item ? 'Edit Item' : 'Add Items'),
            size: 'large',
            fields: [
                // Style injection
                {
                    fieldname: 'custom_styles',
                    fieldtype: 'HTML',
                    options: `
                        <style>
                            .quick-actions {
                                display: flex;
                                gap: 15px;
                                padding: 5px 0;
                            }
                            .action-card {
                                flex: 1;
                                display: flex;
                                gap: 15px;
                                padding: 15px;
                                border: 1px solid var(--border-color);
                                border-radius: 8px;
                                cursor: pointer;
                                transition: all 0.2s;
                            }
                            .action-card:hover {
                                border-color: var(--primary);
                                background: var(--bg-light-gray);
                            }
                            .action-icon {
                                display: flex;
                                align-items: center;
                                justify-content: center;
                                width: 40px;
                                height: 40px;
                                background: var(--bg-light-gray);
                                border-radius: 8px;
                                color: var(--text-muted);
                                flex-shrink: 0;
                            }
                            .action-content {
                                flex-grow: 1;
                            }
                            .action-content h6 {
                                margin: 0 0 5px;
                                font-weight: 600;
                            }
                            .action-content p {
                                margin: 0 0 10px;
                            }
                            .bulk-import-help {
                                padding: 15px 0;
                            }
                            .import-steps {
                                display: flex;
                                flex-direction: column;
                                gap: 20px;
                            }
                            .step {
                                display: flex;
                                gap: 15px;
                                align-items: flex-start;
                            }
                            .step-number {
                                width: 24px;
                                height: 24px;
                                background: var(--primary);
                                color: white;
                                border-radius: 50%;
                                display: flex;
                                align-items: center;
                                justify-content: center;
                                font-weight: bold;
                                flex-shrink: 0;
                            }
                            .step-content {
                                flex-grow: 1;
                            }
                            .step-content h6 {
                                margin: 0 0 5px;
                                font-weight: 600;
                            }
                            .step-content p {
                                margin: 0 0 10px;
                            }
                            .fields-info {
                                background: var(--bg-light-gray);
                                padding: 10px;
                                border-radius: 6px;
                                font-size: 0.9em;
                            }
                            .fields-info > div {
                                margin-bottom: 5px;
                            }
                            .fields-info > div:last-child {
                                margin-bottom: 0;
                            }
                            .template-actions {
                                display: flex;
                                gap: 8px;
                                flex-wrap: wrap;
                            }
                            .template-actions .btn {
                                width: 100%;
                                text-align: left;
                            }
                            .include-data-checkbox {
                                margin-left: 4px;
                            }
                            .include-data-checkbox .label-area {
                                color: var(--text-muted);
                                font-size: var(--text-sm);
                            }
                        </style>
                    `
                },
                // Quick Actions Section (only show in add mode)
                ...(!item ? [{
                    fieldname: 'quick_actions_section',
                    fieldtype: 'Section Break',
                    label: __('Quick Actions'),
                }, {
                    fieldname: 'quick_actions',
                    fieldtype: 'HTML',
                    options: `
                        <div class="quick-actions">
                            <div class="action-card">
                                <div class="action-icon">${frappe.utils.icon('add-round', 'lg')}</div>
                                <div class="action-content">
                                    <h6>${__('Add Single Item')}</h6>
                                    <p class="text-muted">${__('Manually add one item at a time')}</p>
                                </div>
                            </div>
                            <div class="action-card bulk-import-card">
                                <div class="action-icon">${frappe.utils.icon('upload', 'lg')}</div>
                                <div class="action-content">
                                    <h6>${__('Bulk Import')}</h6>
                                    <p class="text-muted">${__('Import multiple items from Excel')}</p>
                                    <div class="template-actions">
                                        <button class="btn btn-sm btn-default download-template-with-formulas" style="width: fit-content">
                                            ${frappe.utils.icon('down-arrow', 'xs')} ${__('Download Template')}
                                        </button>
                                        <div class="include-data-checkbox mt-2">
                                            <label class="frappe-checkbox">
                                                <input type="checkbox" class="include-existing-data">
                                                <span class="label-area">${__('Include existing data')}</span>
                                            </label>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    `
                }] : []),

                // Single Item Section
                {
                    fieldname: 'single_item_section',
                    fieldtype: 'Section Break',
                    label: __('Item Details'),
                    depends_on: item ? '1' : 'eval:doc.entry_mode === "single"'
                },
                {
                    fieldname: 'item_name',
                    fieldtype: 'Data',
                    label: __('Item Name'),
                    reqd: 1,
                    default: item?.item_name,
                    depends_on: item ? '1' : 'eval:doc.entry_mode === "single"',
                    mandatory_depends_on: item ? '1' : 'eval:doc.entry_mode === "single"'
                },
                {
                    fieldtype: 'Column Break'
                },
                // Editable fields
                ...editable_fields.map(field => ({
                    fieldname: field.field_name,
                    fieldtype: field.field_type,
                    label: field.label,
                    options: field.options,
                    reqd: field.reqd ? 1 : 0,
                    default: item ? JSON.parse(item.data || '{}')[field.field_name] : field.default_value,
                    onchange: () => this.calculate_field_values(d, sorted_fields),
                    depends_on: item ? '1' : 'eval:doc.entry_mode === "single"',
                    mandatory_depends_on: field.reqd ? (item ? '1' : 'eval:doc.entry_mode === "single"') : '0'
                })),
                {
                    fieldtype: 'Section Break',
                    fieldname: 'calculated_section',
                    label: __('Calculated Values')
                },
                // Auto-calculated fields
                ...sorted_fields.map(field => ({
                    fieldname: field.field_name,
                    fieldtype: field.field_type,
                    label: field.label,
                    read_only: 1,
                    default: item ? JSON.parse(item.data || '{}')[field.field_name] : null
                })),

                // Bulk Import Section
                ...(!item ? [{
                    fieldname: 'entry_mode',
                    fieldtype: 'Data',
                    default: '',
                    hidden: 1
                }, {
                    fieldname: 'bulk_import_section',
                    fieldtype: 'Section Break',
                    label: __('Bulk Import'),
                    depends_on: 'eval:doc.entry_mode === "bulk"',
                }, {
                    fieldname: 'import_help',
                    fieldtype: 'HTML',
                    options: `
                        <div class="bulk-import-help">
                            <div class="import-steps">
                                <div class="step">
                                    <div class="step-number">1</div>
                                    <div class="step-content">
                                        <h6>${__('Fill Template')}</h6>
                                        <p class="text-muted">${__('Fill the template with your data. Required fields:')}</p>
                                        <div class="fields-info">
                                            <div class="required-fields">
                                                <strong>${__('Required:')}</strong> ${requiredFields.join(', ')}
                                            </div>
                                            <div class="optional-fields">
                                                <strong>${__('Optional:')}</strong> ${optionalFields.join(', ')}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div class="step">
                                    <div class="step-number">2</div>
                                    <div class="step-content">
                                        <h6>${__('Paste Data')}</h6>
                                        <p class="text-muted">${__('Copy your data from Excel and paste it below')}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    `
                }, {
                    fieldname: 'excel_data',
                    fieldtype: 'Code',
                    label: __('Paste Excel Data Here'),
                    description: __('Copy and paste your Excel data here. Make sure to include the header row.'),
                }] : [])
            ],
            primary_action_label: __('Save'),
            primary_action(values) {
                if (values.entry_mode === 'single') {
                    me.save_item(values, item);
                } else if (values.entry_mode === 'bulk') {
                    const data = values.excel_data;
                    if (!data) {
                        frappe.throw(__('Please paste some data first'));
                        return;
                    }
                    
                    try {
                        // Split into rows and remove empty rows
                        const rows = data.split('\n')
                            .map(row => row.trim())
                            .filter(row => row);
                        
                        if (rows.length < 2) {
                            frappe.throw(__('Please paste data with headers and at least one row'));
                            return;
                        }

                        // Parse headers (first row)
                        const headers = rows[0].split('\t')
                            .map(header => header.trim().toLowerCase());
                        
                        // Validate required fields
                        const missingFields = requiredFields.filter(field => !headers.includes(field));
                        if (missingFields.length > 0) {
                            frappe.throw(__(`Data must include the following required columns: ${missingFields.join(', ')}`));
                            return;
                        }

                        // Parse data rows
                        const items = rows.slice(1).map((row, rowIndex) => {
                            const values = row.split('\t');
                            const item = {};
                            
                            headers.forEach((header, index) => {
                                if (values[index]) {
                                    let value = values[index].trim();
                                    
                                    // Find the field definition to determine type
                                    const field = editable_fields.find(f => f.field_name === header);
                                    if (field) {
                                        // Convert value based on field type
                                        switch(field.field_type) {
                                            case 'Float':
                                            case 'Currency':
                                            case 'Percent':
                                                value = parseFloat(value) || 0;
                                                break;
                                            case 'Int':
                                                value = parseInt(value) || 0;
                                                break;
                                            case 'Check':
                                                value = value.toLowerCase() === 'true' || value === '1';
                                                break;
                                        }
                                    }
                                    
                                    item[header] = value;
                                }
                            });

                            // Validate required fields in the row
                            const missingRequiredFields = requiredFields.filter(field => {
                                const value = item[field];
                                return value === undefined || value === null || value === '';
                            });

                            if (missingRequiredFields.length > 0) {
                                frappe.throw(__(`Row ${rowIndex + 2}: Missing required values for fields: ${missingRequiredFields.join(', ')}`));
                            }
                            
                            return item;
                        });

                        // Check if we should clear existing items
                        const clearExisting = d.fields_dict.quick_actions.$wrapper.find('.include-existing-data').prop('checked');

                        // Save all items
                        me.save_multiple_items(items, d, clearExisting);
                    } catch (error) {
                        frappe.throw(__('Error processing data: ') + error.message);
                    }
                }
                d.hide();
            }
        });

        // Setup action cards
        if (!item) {
            d.fields_dict.quick_actions.$wrapper.find('.action-card:not(.bulk-import-card)').on('click', () => {
                d.set_value('entry_mode', 'single');
            });
            
            d.fields_dict.quick_actions.$wrapper.find('.bulk-import-card').on('click', () => {
                d.set_value('entry_mode', 'bulk');
            });


            
            d.fields_dict.quick_actions.$wrapper.find('.download-template-with-formulas').on('click', async (e) => {
                e.stopPropagation(); // Prevent triggering the card click
                
                const includeData = d.fields_dict.quick_actions.$wrapper.find('.include-existing-data').prop('checked');
                frappe.call({
                    method: 'rua_company.rua_company.doctype.scope_items.scope_items.get_template_with_formulas',
                    args: {
                        scope_items: this.frm.doc.name,
                        include_data: includeData ? 1 : 0
                    },
                    callback: function(r) {
                        if (!r.exc) {
                            window.open(r.message.file_url);
                        }
                    }
                });
            });
        }

        // Setup action cards
        if (!item) {
            d.fields_dict.quick_actions.$wrapper.find('.action-card:not(.bulk-import-card)').on('click', () => {
                d.set_value('entry_mode', 'single');
            });
            
            d.fields_dict.quick_actions.$wrapper.find('.bulk-import-card').on('click', () => {
                d.set_value('entry_mode', 'bulk');
            });
        }

        // Initial calculation
        this.calculate_field_values(d, sorted_fields);

        d.show();
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
        const doc_totals = this.frm.doc.totals_data ? 
            JSON.parse(this.frm.doc.totals_data) : {};

        // Get constants
        let constants = {};
        try {
            constants = JSON.parse(this.frm.doc.constants_data || '{}');
        } catch (e) {
            console.error('Error parsing constants data:', e);
        }

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
                        constants,
                        math: Math,
                        flt: (val) => parseFloat(val || 0),
                        cint: (val) => parseInt(val || 0)
                    };

                    // Evaluate formula
                    let result = (new Function(
                        'variables', 'doc_totals', 'constants', 'math', 'flt', 'cint',
                        `return ${field.calculation_formula}`
                    ))(context.variables, context.doc_totals, context.constants, context.math, context.flt, context.cint);

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
                    frappe.throw(`Error calculating ${field.label}: ${e.message}`);
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

    async save_multiple_items(items, dialog, clearExisting = false) {
        try {
            const { message: updated_doc } = await frappe.call({
                method: 'rua_company.rua_company.doctype.scope_items.scope_items.save_multiple_scope_items',
                args: {
                    scope_items: this.frm.doc.name,
                    items_data: items,
                    clear_existing: clearExisting ? 1 : 0  // Convert boolean to 1/0 for Python
                }
            });

            // Update form doc
            this.frm.doc = updated_doc;
            await this.frm.refresh();
            dialog.hide();
            
            frappe.show_alert({
                message: __('Items saved successfully'),
                indicator: 'green'
            });
        } catch (err) {
            frappe.msgprint(__('Error saving items: ' + err.message));
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

    .template-actions {
        display: flex;
        flex-direction: column;
        gap: 8px;
        margin-top: 10px;
    }

    .template-actions .btn {
        width: 100%;
        text-align: left;
    }

    .include-data-checkbox {
        margin-left: 4px;
    }

    .include-data-checkbox .label-area {
        color: var(--text-muted);
        font-size: var(--text-sm);
    }

    .draft-button {
        background-color: #ff6b6b !important;
        color: white !important;
    }
    
    .assign-button {
        background-color: #00CED1 !important;
        color: white !important;
    }
`);