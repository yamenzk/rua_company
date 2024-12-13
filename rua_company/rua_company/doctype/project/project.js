// Copyright (c) 2024, Yamen Zakhour and contributors
// For license information, please see license.txt

frappe.ui.form.on("Project", {
	refresh(frm) {
        if (frm.doc.__islocal) {
            frappe.prompt({
                label: 'Project Name',
                fieldname: 'project_name',
                fieldtype: 'Data',
                reqd: 1
            }, function(values) {
                frappe.model.set_value(frm.doctype, frm.docname, 'project_name', values.project_name);
                frm.save()
            }, 'Enter Project Name', 'Continue');
        }
        
        // Handle items table visibility based on scopes
        const hasScopes = frm.doc.scopes && frm.doc.scopes.length > 0;
        
        // Get the items field wrapper
        const itemsWrapper = frm.fields_dict.items.wrapper;
        
        if (!hasScopes) {
            // Hide the items table
            $(itemsWrapper).addClass('hidden');
            
            // Show the message if it doesn't exist
            if (!itemsWrapper.querySelector('.no-scope-message')) {
                const message = $(`
                    <div class="no-scope-message" style="
                        padding: 2rem;
                        text-align: center;
                        background-color: var(--bg-light-gray);
                        border-radius: 0.5rem;
                        margin: 1rem 0;
                    ">
                        <div style="
                            font-size: 4rem;
                            color: var(--text-muted);
                            margin-bottom: 1rem;
                        ">
                            <i class="fa fa-clipboard"></i>
                        </div>
                        <div style="
                            font-size: 1.2rem;
                            color: var(--text-muted);
                            margin-bottom: 0.5rem;
                        ">
                            Define a scope to start adding items.
                        </div>
                    </div>
                `);
                $(itemsWrapper).after(message);
            }
        } else {
            // Show the items table and remove the message
            $(itemsWrapper).removeClass('hidden');
            $('.no-scope-message').remove();
        }
        
        frm.page.clear_actions_menu();


        if (frappe.is_large_screen()) {
            // Add Generate dropdown items with icons
            frm.add_custom_button(__('Request for Quotation'), function() {
                create_project_bill(frm, 'Request for Quotation');
            }, __('Generate')).addClass('has-icon').prepend('<i class="fa fa-file-text-o"></i> ');

            frm.add_custom_button(__('Purchase Order'), function() {
                create_project_bill(frm, 'Purchase Order');
            }, __('Generate')).addClass('has-icon').prepend('<i class="fa fa-shopping-cart"></i> ');

            frm.add_custom_button(__('Quotation'), function() {
                create_project_bill(frm, 'Quotation');
            }, __('Generate')).addClass('has-icon').prepend('<i class="fa fa-quote-left"></i> ');

            frm.add_custom_button(__('Proforma'), function() {
                create_project_bill(frm, 'Proforma');
            }, __('Generate')).addClass('has-icon').prepend('<i class="fa fa-file"></i> ');

            frm.add_custom_button(__('Tax Invoice'), function() {
                create_project_bill(frm, 'Tax Invoice');
            }, __('Generate')).addClass('has-icon').prepend('<i class="fa fa-file-text"></i> ');

            frm.add_custom_button(__('Payment Voucher'), function() {
                create_project_bill(frm, 'Payment Voucher');
            }, __('Generate')).addClass('has-icon').prepend('<i class="fa fa-money"></i> ');

            // Style the Generate parent button
            $('.inner-group-button[data-label="Generate"] .btn-default')
                .removeClass('btn-default')
                .addClass('btn-warning');
            
                // Add refresh button
            frm.add_custom_button(__('Refresh'), function() {
                frappe.confirm(
                    __('This will clear and repopulate all child tables. Continue?'),
                    function() {
                        frappe.call({
                            method: 'rua_company.rua_company.doctype.project.project.refresh_all_tables',
                            args: {
                                project: frm.doc.name
                            },
                            freeze: true,
                            freeze_message: __('Refreshing all tables...'),
                            callback: function(r) {
                                frm.reload_doc();
                                frappe.show_alert({
                                    message: __('All tables refreshed successfully'),
                                    indicator: 'green'
                                });
                            }
                        });
                    }
                );
            }).addClass('has-icon').prepend('<i class="fa fa-refresh"></i>');
        }


        
        
        // Add import button to grid
        if (!frm.doc.__islocal) {
            frm.fields_dict['items'].grid.add_custom_button(
                __('Import from Excel'),
                function() {
                    show_import_dialog(frm);
                }
            );
            frm.fields_dict["items"].grid.grid_buttons.find('.btn-custom').removeClass('btn-default btn-secondary').addClass('btn-success');
        }
        
		if (frm.doc.docstatus === 0) {
			// For Open status
			if (frm.doc.status === "Open" && !frm.doc.__islocal) {
				frm.page.add_action_item(__('<i class="fa fa-file-text-o"></i> Set as Tender'), function() {
					frappe.confirm(
						__('Set this project as Tender?'),
						function() {
							frm.set_value('status', 'Tender');
							frm.save();
						}
					);
				});

				frm.page.add_action_item(__('<i class="fa fa-briefcase"></i> Set as Job In Hand'), function() {
					frappe.confirm(
						__('Set this project as Job In Hand?'),
						function() {
							frm.set_value('status', 'Job In Hand');
							frm.save();
						}
					);
				});

				frm.page.add_action_item(__('<i class="fa fa-ban"></i> Cancel Project'), function() {
					frappe.confirm(
						__('Are you sure you want to cancel this project? This action cannot be undone.'),
						function() {
							frm.set_value('status', 'Cancelled');
							frm.save();
						}
					);
				});
			}
			
			// For Tender status
			if (frm.doc.status === "Tender") {
				frm.page.add_action_item(__('<i class="fa fa-play"></i> Start Progress'), function() {
					frappe.confirm(
						__('Start progress on this project?'),
						function() {
							frm.set_value('status', 'In Progress');
							frm.save();
						}
					);
				});

				frm.page.add_action_item(__('<i class="fa fa-ban"></i> Cancel Project'), function() {
					frappe.confirm(
						__('Are you sure you want to cancel this project? This action cannot be undone.'),
						function() {
							frm.set_value('status', 'Cancelled');
							frm.save();
						}
					);
				});
			}
			
			// For Job In Hand status
			if (frm.doc.status === "Job In Hand") {
				frm.page.add_action_item(__('<i class="fa fa-play"></i> Start Progress'), function() {
					frappe.confirm(
						__('Start progress on this project?'),
						function() {
							frm.set_value('status', 'In Progress');
							frm.save();
						}
					);
				});

				frm.page.add_action_item(__('<i class="fa fa-ban"></i> Cancel Project'), function() {
					frappe.confirm(
						__('Are you sure you want to cancel this project? This action cannot be undone.'),
						function() {
							frm.set_value('status', 'Cancelled');
							frm.save();
						}
					);
				});
			}
			
			// For In Progress status
			if (frm.doc.status === "In Progress") {
				frm.page.add_action_item(__('<i class="fa fa-check-circle"></i> Mark Complete'), function() {
					frappe.confirm(
						__('Mark this project as completed?'),
						function() {
							frm.set_value('status', 'Completed');
							frm.save();
						}
					);
				});

				frm.page.add_action_item(__('<i class="fa fa-ban"></i> Cancel Project'), function() {
					frappe.confirm(
						__('Are you sure you want to cancel this project? This action cannot be undone.'),
						function() {
							frm.set_value('status', 'Cancelled');
							frm.save();
						}
					);
				});
			}
		}

        // Apply color coding to scopes and items grids
        if (frm.doc.scopes && frm.doc.scopes.length > 1) {
            apply_color_coding(frm);
        }
        
	},
    
    
    download_import_template: function(frm, scope) {
        frappe.call({
            method: 'rua_company.rua_company.doctype.project.project.get_import_template',
            args: {
                scope: JSON.stringify(scope)
            },
            callback: function(r) {
                if (r.message) {
                    const blob = b64toBlob(r.message.content, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.style.display = 'none';
                    a.href = url;
                    a.download = r.message.filename;
                    document.body.appendChild(a);
                    a.click();
                    window.URL.revokeObjectURL(url);
                    a.remove();
                }
            }
        });
    },

});

// Define scope colors using Frappe design system variables
const SCOPE_COLORS = [
    { bg: 'var(--bg-orange)', text: 'var(--text-on-orange)' },
    { bg: 'var(--bg-blue)', text: 'var(--text-on-blue)' },
    { bg: 'var(--bg-purple)', text: 'var(--text-on-purple)' },
    { bg: 'var(--bg-green)', text: 'var(--text-on-green)' },
    { bg: 'var(--bg-yellow)', text: 'var(--text-on-yellow)' },
    { bg: 'var(--bg-cyan)', text: 'var(--text-on-cyan)' },
    { bg: 'var(--bg-pink)', text: 'var(--text-on-pink)' },
    { bg: 'var(--bg-gray)', text: 'var(--text-on-gray)' }
];

// Function to apply color coding
function apply_color_coding(frm) {
    // Only proceed if we have more than one scope
    if (!frm.doc.scopes || frm.doc.scopes.length <= 1) {
        // Clear any existing colors
        frm.fields_dict['scopes'].grid.grid_rows.forEach(row => {
            const $row = $(row.row).length ? $(row.row) : 
                      $(row.wrapper).find('.grid-row').length ? $(row.wrapper).find('.grid-row') :
                      $(row.wrapper).find('[data-name="'+row.doc.name+'"]');
            $row.css({
                'background-color': '',
                'color': '',
                'border-color': ''
            });
        });
        
        frm.fields_dict['items'].grid.grid_rows.forEach(row => {
            const $row = $(row.row).length ? $(row.row) : 
                      $(row.wrapper).find('.grid-row').length ? $(row.wrapper).find('.grid-row') :
                      $(row.wrapper).find('[data-name="'+row.doc.name+'"]');
            $row.css({
                'background-color': '',
                'color': '',
                'border-color': ''
            });
        });
        return;
    }

    setTimeout(() => {
        // Color the scopes grid
        if (frm.fields_dict['scopes'].grid.grid_rows) {
            frm.fields_dict['scopes'].grid.grid_rows.forEach((row, index) => {
                const scopeNum = row.doc.scope_number;
                if (scopeNum) {
                    const colorSet = SCOPE_COLORS[(scopeNum - 1) % SCOPE_COLORS.length];
                    const $row = $(row.row).length ? $(row.row) : 
                               $(row.wrapper).find('.grid-row').length ? $(row.wrapper).find('.grid-row') :
                               $(row.wrapper).find('[data-name="'+row.doc.name+'"]');
                               
                    $row.css({
                        'background-color': colorSet.bg,
                        'color': colorSet.text
                    });
                    
                    // Apply border color to cells
                    $row.find('.col').css({
                        'border-right': '0'
                    });

                    
                }
            });
        }

        // Color the items grid
        if (frm.fields_dict['items'].grid.grid_rows) {
            frm.fields_dict['items'].grid.grid_rows.forEach(row => {
                const scopeNum = row.doc.scope_number;
                if (scopeNum) {
                    const colorSet = SCOPE_COLORS[(scopeNum - 1) % SCOPE_COLORS.length];
                    const $row = $(row.row).length ? $(row.row) : 
                               $(row.wrapper).find('.grid-row').length ? $(row.wrapper).find('.grid-row') :
                               $(row.wrapper).find('[data-name="'+row.doc.name+'"]');
                               
                    $row.css({
                        'background-color': colorSet.bg,
                        'color': colorSet.text
                    });
                    
                    // Apply border color to cells
                    $row.find('.col').css({
                        'border-right': '0'
                    });
                }
            });
        }
    }, 100);
}


// Handle items table scope number and read-only state
frappe.ui.form.on('Project Items', {
    before_items_remove: function(frm, cdt, cdn) {
        const row = locals[cdt][cdn];
        // Store the scope number in the frm object for use after removal
        frm.removed_item_scope = row.scope_number;
    },
    
    items_remove: function(frm, cdt, cdn) {
        apply_color_coding(frm);
        
        // If we have a stored scope number, trigger calculations for all items in that scope
        if (frm.removed_item_scope) {
            const scope_items = frm.doc.items.filter(item => item.scope_number === frm.removed_item_scope);
            if (scope_items.length > 0) {
                // Use the first remaining item to trigger calculations for the whole scope
                trigger_calculations(frm, scope_items[0]);
            } else {
                // If no items left in this scope, update the scope totals to zero
                update_scope_totals(frm, frm.removed_item_scope);
            }
            // Clear the stored scope
            delete frm.removed_item_scope;
        }
    },
    
    items_add: function(frm, cdt, cdn) {
        let scopes = frm.doc.scopes || [];
        if (scopes.length === 0) {
            frappe.throw(__('Please add at least one scope before adding items'));
            return false;
        }
        
        let row = frappe.get_doc(cdt, cdn);
        
        // Get the scope number from the grid row's index
        let grid_row = frm.fields_dict.items.grid.grid_rows.find(r => r.doc.name === cdn);
        let scope_number = grid_row.doc.scope_number;
        
        // If no scope number is set (new row), use the latest scope
        if (!scope_number) {
            let latest_scope = scopes[scopes.length - 1];
            scope_number = latest_scope.scope_number;
        }
        
        // Find the matching scope
        let matching_scope = scopes.find(scope => scope.scope_number === scope_number);
        if (matching_scope) {
            row.scope_number = matching_scope.scope_number;
            row.glass_unit = matching_scope.glass_sqm_price;
            row.profit_percentage = matching_scope.profit;
        }
        
        frm.fields_dict.items.grid.refresh();
        apply_color_coding(frm);
        trigger_calculations(frm, row);
        
    },
    
    scope_number: function(frm, cdt, cdn) {
        let row = frappe.get_doc(cdt, cdn);
        let scopes = frm.doc.scopes || [];
        
        // Find the matching scope
        let matching_scope = scopes.find(scope => scope.scope_number === row.scope_number);
        if (matching_scope) {
            frappe.model.set_value(cdt, cdn, 'glass_unit', matching_scope.glass_sqm_price);
            frappe.model.set_value(cdt, cdn, 'profit_percentage', matching_scope.profit);
        }
        apply_color_coding(frm);
        trigger_calculations(frm, row);
    },

    width: function(frm, cdt, cdn) {
        const row = locals[cdt][cdn];
        trigger_calculations(frm, row);
    },
    height: function(frm, cdt, cdn) {
        const row = locals[cdt][cdn];
        trigger_calculations(frm, row);
    },
    qty: function(frm, cdt, cdn) {
        const row = locals[cdt][cdn];
        trigger_calculations(frm, row);
    },
    glass_unit: function(frm, cdt, cdn) {
        const row = locals[cdt][cdn];
        trigger_calculations(frm, row);
    },
    curtain_wall: function(frm, cdt, cdn) {
        const row = locals[cdt][cdn];
        trigger_calculations(frm, row);
    },
    insertion_1: function(frm, cdt, cdn) {
        const row = locals[cdt][cdn];
        trigger_calculations(frm, row);
    },
    insertion_2: function(frm, cdt, cdn) {
        const row = locals[cdt][cdn];
        trigger_calculations(frm, row);
    },
    insertion_3: function(frm, cdt, cdn) {
        const row = locals[cdt][cdn];
        trigger_calculations(frm, row);
    },
    insertion_4: function(frm, cdt, cdn) {
        const row = locals[cdt][cdn];
        trigger_calculations(frm, row);
    },
    profit_percentage: function(frm, cdt, cdn) {
        const row = locals[cdt][cdn];
        trigger_calculations(frm, row);
    }
});


function create_project_bill(frm, bill_type) {
    // Get filtered parties based on bill type
    let party_type;
    if (bill_type === 'Purchase Order' || bill_type === 'Request for Quotation') {
        party_type = 'Supplier';
    } else if (bill_type === 'Payment Voucher') {
        party_type = null; // All parties allowed
    } else {
        party_type = 'Client';
    }

    let parties = frm.doc.parties.filter(p => !party_type || p.type === party_type);
    if (!parties.length) {
        frappe.msgprint(__(`No ${party_type || ''} parties found in the project`));
        return;
    }

    // If it's a payment voucher, get outstanding amounts for all parties
    if (bill_type === 'Payment Voucher') {
        frappe.call({
            method: "rua_company.rua_company.doctype.project.project.get_party_outstanding_amounts",
            args: {
                project: frm.doc.name,
                parties: parties.map(p => ({
                    party: p.party,
                    type: p.type
                }))
            },
            callback: function(r) {
                if (r.message) {
                    show_party_dialog(r.message);
                }
            }
        });
    } else {
        show_party_dialog({});
    }

    function show_party_dialog(outstanding_amounts) {
        // Format party labels based on type and section
        let party_options = parties.map(p => {
            let label;
            if (bill_type === 'Payment Voucher') {
                let amount = outstanding_amounts[p.party] || 0;
                let formatted_amount = format_currency(Math.abs(amount), frm.doc.currency);
                let direction;
                if (p.type === 'Supplier') {
                    direction = amount > 0 ? 'To Pay' : amount < 0 ? 'To Receive' : 'No Balance';
                } else {
                    direction = amount > 0 ? 'To Receive' : amount < 0 ? 'To Pay' : 'No Balance';
                }
                if (p.type === 'Supplier' && p.section) {
                    label = `${p.party} (${p.type} - ${p.section}) [${direction}: ${formatted_amount}]`;
                } else {
                    label = `${p.party} (${p.type}) [${direction}: ${formatted_amount}]`;
                }
            } else {
                if (p.type === 'Supplier' && p.section) {
                    label = `${p.party} (${p.type} - ${p.section})`;
                } else {
                    label = `${p.party} (${p.type})`;
                }
            }
            return {
                label: label,
                value: p.party
            };
        });

        // For non-supplier documents, auto-select the client if there's only one
        let default_party = null;
        if (party_type === 'Client') {
            let clients = parties.filter(p => p.type === 'Client');
            if (clients.length === 1) {
                default_party = clients[0].party;
            }
        }

        let fields = [
            {
                fieldtype: 'Select',
                fieldname: 'party',
                label: __('Select Party'),
                reqd: 1,
                options: party_options,
                default: default_party
            }
        ];

        // Add scope selection if there are scopes (except for Payment Vouchers)
        if (bill_type !== 'Payment Voucher' && frm.doc.scopes && frm.doc.scopes.length > 1) {
            let scope_options = [
                {
                    label: __('All Scopes'),
                    value: '0'
                },
                ...frm.doc.scopes.map(scope => ({
                    label: `Scope ${scope.scope_number}: ${scope.description || ''}`,
                    value: scope.scope_number
                }))
            ];

            fields.push({
                fieldtype: 'Select',
                fieldname: 'scope',
                label: __('Select Scope'),
                reqd: 1,
                options: scope_options
            });
        }

        // Add RFQ specific fields
        if (bill_type === 'Request for Quotation') {
            fields.push({
                fieldtype: 'Select',
                fieldname: 'rfq_type',
                label: __('RFQ Type'),
                reqd: 1,
                options: [
                    { label: 'RFQ from Items', value: 'items' },
                    { label: 'RFQ from Link', value: 'link' }
                ]
            }, {
                fieldtype: 'Data',
                fieldname: 'url',
                label: __('RFQ URL'),
                depends_on: "eval:doc.rfq_type=='link'"
            });
        }

        let d = new frappe.ui.Dialog({
            title: __(bill_type === 'Payment Voucher' ? 'Create Payment Voucher' : 'Create Project Bill'),
            fields: fields,
            primary_action_label: bill_type === 'Payment Voucher' ? __('Create') : __('Next'),
            primary_action(values) {
                // Get selected items
                d.hide();
                
                if (bill_type === 'Payment Voucher') {
                    frappe.model.open_mapped_doc({
                        method: "rua_company.rua_company.doctype.project.project.make_payment_voucher",
                        frm: frm,
                        args: {
                            party: values.party,
                            outstanding_amount: outstanding_amounts[values.party] || 0
                        },
                        freeze: true,
                        freeze_message: __("Creating Payment Voucher...")
                    });
                } else if (bill_type === 'Request for Quotation' && values.rfq_type === 'link') {
                    // Create RFQ directly with link
                    create_bill_with_scope(frm, bill_type, values.scope || 1, {
                        send_rfq_link: 1,
                        url: values.url,
                        party: values.party
                    });
                } else if (bill_type === 'Request for Quotation' || bill_type === 'Purchase Order') {
                    // Show item selection dialog
                    show_item_selection_dialog(frm, bill_type, values.scope || 1, values.party);
                } else {
                    create_bill_with_scope(frm, bill_type, values.scope || 1, {
                        party: values.party
                    });
                }
            }
        });

        d.show();
    }
}
function show_item_selection_dialog(frm, bill_type, scope, party) {
    // Get items for the selected scope
    let items = frm.doc.items.filter(item => 
        scope === '0' || String(item.scope_number) === String(scope)
    );
    if (!items.length) {
        frappe.msgprint(__('No items found for the selected scope'));
        return;
    }
    // Create HTML table for item selection
    let table_html = `
        <div style="max-height: 500px; overflow-y: auto;">
            <table class="table table-bordered">
                <thead>
                    <tr>
                        <th style="width: 30px;">
                            <input type="checkbox" class="select-all" title="Select All">
                        </th>
                        <th>${__('Item')}</th>
                        <th>${__('Description')}</th>
                        <th>${__('Qty')}</th>
                        <th>${__('Width')}</th>
                        <th>${__('Height')}</th>
                        ${bill_type === 'Purchase Order' ? `<th>${__('Rate')}</th>` : ''}
                    </tr>
                </thead>
                <tbody>
                    ${items.map((item, idx) => `
                        <tr>
                            <td>
                                <input type="checkbox" class="item-select" data-idx="${idx}">
                            </td>
                            <td>${item.item || ''}</td>
                            <td>${item.description || ''}</td>
                            <td>${item.qty || ''}</td>
                            <td>${item.width || ''}</td>
                            <td>${item.height || ''}</td>
                            ${bill_type === 'Purchase Order' ? 
                                `<td>${format_currency(item.actual_unit_rate || 0, frm.doc.currency)}</td>` : 
                                ''}
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
    let d = new frappe.ui.Dialog({
        title: __('Select Items'),
        fields: [{
            fieldtype: 'HTML',
            fieldname: 'items_html',
            options: table_html
        }],
        primary_action_label: __('Create'),
        primary_action(values) {
            // Get selected items
            let selected_items = [];
            d.$wrapper.find('.item-select:checked').each(function() {
                let idx = $(this).data('idx');
                let item = items[idx];
                selected_items.push({
                    item: item.item,
                    description: item.description,
                    qty: item.qty,
                    width: item.width,
                    height: item.height,
                    rate: bill_type === 'Purchase Order' ? item.actual_unit_rate : undefined
                });
            });
            d.hide();
            create_bill_with_scope(frm, bill_type, scope, {
                selected_items: selected_items,
                party: party
            });
        }
    });
    // Handle select all checkbox
    d.$wrapper.find('.select-all').on('change', function() {
        let checked = $(this).prop('checked');
        d.$wrapper.find('.item-select').prop('checked', checked);
    });
    d.show();
}
function create_bill_with_scope(frm, bill_type, scope, args = {}) {
    frappe.model.open_mapped_doc({
        method: "rua_company.rua_company.doctype.project.project.make_project_bill",
        frm: frm,
        args: {
            bill_type: bill_type,
            scope: scope,
            ...args
        },
        freeze: true,
        freeze_message: __("Creating {0} for Scope {1}...", [__(bill_type), scope])
    });
}


//#region Excel Import
function b64toBlob(b64Data, contentType = '', sliceSize = 512) {
    const byteCharacters = atob(b64Data);
    const byteArrays = [];

    for (let offset = 0; offset < byteCharacters.length; offset += sliceSize) {
        const slice = byteCharacters.slice(offset, offset + sliceSize);
        const byteNumbers = new Array(slice.length);
        
        for (let i = 0; i < slice.length; i++) {
            byteNumbers[i] = slice.charCodeAt(i);
        }
        
        const byteArray = new Uint8Array(byteNumbers);
        byteArrays.push(byteArray);
    }

    return new Blob(byteArrays, { type: contentType });
}

function show_import_dialog(frm) {
    let selected_scope = null;
    
    // Create a dialog for scope selection and file upload
    const dialog = new frappe.ui.Dialog({
        title: 'Import Items from Excel',
        fields: [
            {
                fieldname: 'scope_select_html',
                fieldtype: 'HTML',
                options: `<div class="scope-select mb-4"></div>`
            },
            {
                fieldname: 'upload_file',
                fieldtype: 'Attach',
                label: 'Upload Excel File',
                reqd: 1,
                onchange: function() {
                    const file = dialog.get_value('upload_file');
                    if (file && selected_scope) {
                        import_excel_data(file, selected_scope, dialog, frm);
                    } else if (!selected_scope) {
                        frappe.msgprint('Please select a scope first');
                        dialog.set_value('upload_file', '');
                    }
                }
            }
        ]
    });

    // Function to handle the import
    function import_excel_data(file_url, scope, dialog, frm) {
        frappe.call({
            method: 'rua_company.rua_company.doctype.project.project.import_items_from_excel',
            args: {
                file_url: file_url,
                scope: JSON.stringify(scope)
            },
            freeze: true,
            freeze_message: __('Importing items from Excel...'),
            callback: function(r) {
                if (!r.exc) {
                    dialog.hide();
                    frappe.show_alert({
                        message: __('Successfully imported {0} items', [r.message.items.length]),
                        indicator: 'green'
                    });
                    frm.reload_doc().then(() => {
                        // After reload, trigger calculations for all items in the imported scope
                        const scopeItems = frm.doc.items.filter(item => item.scope_number === scope.scope_number);
                        scopeItems.forEach(item => {
                            trigger_calculations(frm, item);
                        });
                        frm.refresh();
                    });
                }
            }
        });
    }

    // Create scope selection buttons
    const scope_container = dialog.fields_dict.scope_select_html.$wrapper.find('.scope-select');
    scope_container.empty();
    
    // Add instruction text only if there are multiple scopes
    if (frm.doc.scopes.length > 1) {
        scope_container.append(`
            <div class="scope-instruction mb-3" style="font-size: 14px; color: var(--text-muted);">
                Select a scope to import items into:
            </div>
            <div class="scope-buttons d-flex flex-wrap gap-2" style="margin: -4px;">
            </div>
        `);
    } else {
        scope_container.append(`
            <div class="scope-buttons d-flex flex-wrap gap-2" style="margin: -4px;">
            </div>
        `);
    }
    
    const buttons_container = scope_container.find('.scope-buttons');
    
    // Create buttons for each scope
    frm.doc.scopes.forEach((scope, index) => {
        const color = SCOPE_COLORS[(scope.scope_number - 1) % SCOPE_COLORS.length];
        
        const btn = $(`
            <div class="scope-button-wrapper" style="margin: 4px;">
                <button class="btn btn-default btn-scope" 
                        data-scope='${JSON.stringify(scope)}'
                        style="min-width: 150px; height: auto; white-space: normal; padding: 8px 15px;">
                    Scope ${scope.scope_number}${scope.description ? `<br><span style="font-size: 0.9em;">${scope.description}</span>` : ''}
                </button>
            </div>
        `);
        
        const $button = btn.find('.btn-scope');
        
        $button.on('click', function() {
            selectScope($(this), scope);
        });
        
        buttons_container.append(btn);
        
        // If there's only one scope, automatically select it
        if (frm.doc.scopes.length === 1) {
            selectScope($button, scope);
        }
    });
    
    // Function to handle scope selection
    function selectScope($button, scope) {
        // Remove active class from all buttons
        buttons_container.find('.btn-scope').removeClass('btn-primary').addClass('btn-default')
            .css({
                'background-color': '',
            });
        
        // Add active class to clicked button
        $button.removeClass('btn-default')
            .css({
                'background-color': SCOPE_COLORS[(scope.scope_number - 1) % SCOPE_COLORS.length].bg,
            });
            
        // Store selected scope
        selected_scope = scope;
        
        // Show download template button
        if (!dialog.$wrapper.find('.download-template').length) {
            const download_btn = $(`
                <button class="btn btn-sm btn-warning download-template" 
                        style="margin-right: 15px;">
                    Download Template
                </button>
            `);
            download_btn.on('click', () => {
                download_import_template(frm, selected_scope);
            });
            dialog.$wrapper.find('.modal-header').append(download_btn);
        }

        // If file is already uploaded, trigger import
        const file = dialog.get_value('upload_file');
        if (file) {
            import_excel_data(file, scope, dialog, frm);
        }
    }

    dialog.show();
}

function download_import_template(frm, scope) {
    frappe.call({
        method: 'rua_company.rua_company.doctype.project.project.get_import_template',
        args: {
            scope: JSON.stringify(scope)
        },
        callback: function(r) {
            if (r.message) {
                const blob = b64toBlob(r.message.content, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.style.display = 'none';
                a.href = url;
                a.download = r.message.filename;
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
                a.remove();
            }
        }
    });
}

//#endregion

//#region Project Items Calculations

// Main calculation function
function trigger_calculations(frm, row) {
    const scope = (frm.doc.scopes || []).find(s => s.scope_number === row.scope_number);
    if (!scope) return;
    
    calculate_glass_values(frm, row, scope);
    calculate_aluminum_price(frm, row)
        .then(aluminum_price => {
            // Calculate ratio for all items with the same scope
            const ratio = calculate_aluminum_ratio(frm, row.scope_number);
            
            // Update all items with the same scope number
            const promises = (frm.doc.items || []).map(item => {
                if (item.scope_number === row.scope_number) {
                    return calculate_remaining_values(frm, item, ratio);
                }
                return Promise.resolve();
            });

            // After all calculations are done, update scope totals
            Promise.all(promises).then(() => {
                update_scope_totals(frm, row.scope_number);
            });
        });
}

// Round a number to the nearest 5
function roundToNearest5(num) {
    return Math.ceil(num / 5) * 5;
}

// Calculate area and basic glass calculations
function calculate_glass_values(frm, row, scope) {
    // Calculate area
    if (row.width >= 0 && row.height >= 0) {
        const area = (row.width * row.height) / 10000;
        frappe.model.set_value(row.doctype, row.name, 'area', area);
        
        // Calculate glass price and total glass
        if (row.glass_unit >= 0 && scope) {
            // If VAT is inclusive, don't add VAT to the price
            const vat_multiplier = scope.vat_inclusive ? 0 : scope.vat;
            const glass_price = row.glass_unit * area * (1 + (vat_multiplier / 100));
            frappe.model.set_value(row.doctype, row.name, 'glass_price', glass_price);
            
            if (row.qty >= 0) {
                frappe.model.set_value(row.doctype, row.name, 'total_glass', glass_price * row.qty);
            }
        }
    }
}

// Calculate aluminum price
function calculate_aluminum_price(frm, row) {
    const aluminum_price = (row.curtain_wall || 0) + 
                         (row.insertion_1 || 0) + 
                         (row.insertion_2 || 0) + 
                         (row.insertion_3 || 0) + 
                         (row.insertion_4 || 0);
    
    return frappe.model.set_value(row.doctype, row.name, 'aluminum_price', aluminum_price)
        .then(() => aluminum_price);
}

// Calculate aluminum ratio for a specific scope
function calculate_aluminum_ratio(frm, scope_number) {
    const items = frm.doc.items || [];
    const scope = (frm.doc.scopes || []).find(s => s.scope_number === scope_number);
    
    if (!scope) return 1;
    
    // Get all items for this scope
    const scope_items = items.filter(item => item.scope_number === scope_number);
    
    // Calculate x (sum of VAT amounts)
    const x = scope_items.reduce((sum, item) => {
        if (!scope.vat_inclusive) {
            // If VAT is not inclusive, calculate VAT normally
            return sum + ((item.aluminum_price || 0) * (scope.vat / 100));
        } else {
            // If VAT is inclusive, extract VAT from the price
            // Formula: VAT amount = price - (price / (1 + VAT%))
            const price = item.aluminum_price || 0;
            return sum + (price - (price / (1 + scope.vat / 100)));
        }
    }, 0);
    
    // Calculate y (sum of aluminum_price * qty)
    const y = scope_items.reduce((sum, item) => {
        return sum + ((item.aluminum_price || 0) * (item.qty || 0));
    }, 0);
    
    // Calculate total
    const total = ((scope.aluminum_weight || 0) * (scope.sdf || 0)) + y + x;
    
    // Calculate ratio and round to 3 decimal places
    const ratio = y > 0 ? Number((total / y).toFixed(3)) : 1;
    
    // Store the ratio in the scope
    frappe.model.set_value(scope.doctype, scope.name, 'ratio', ratio);
    
    return ratio;
}

// Calculate remaining values
function calculate_remaining_values(frm, row, ratio) {
    if (row.aluminum_price >= 0) {
        // Calculate aluminum unit and total
        const aluminum_unit = row.aluminum_price * ratio;
        return frappe.model.set_value(row.doctype, row.name, 'aluminum_unit', aluminum_unit)
            .then(() => {
                if (row.qty >= 0) {
                    return frappe.model.set_value(row.doctype, row.name, 'total_aluminum', aluminum_unit * row.qty);
                }
            })
            .then(() => {
                // Calculate actual unit
                if (row.glass_price >= 0) {
                    // Find the corresponding scope to get labour_charges
                    const scope = frm.doc.scopes.find(s => s.scope_number === row.scope_number);
                    const labour_charges = scope ? (scope.labour_charges || 0) : 0;
                    
                    const actual_unit = aluminum_unit + row.glass_price + labour_charges;
                    return frappe.model.set_value(row.doctype, row.name, 'actual_unit', actual_unit)
                        .then(() => {
                            // Calculate profit and costs
                            if (row.profit_percentage >= 0) {
                                const total_profit = actual_unit * (row.profit_percentage / 100);
                                return frappe.model.set_value(row.doctype, row.name, 'total_profit', total_profit)
                                    .then(() => {
                                        if (row.qty >= 0) {
                                            return frappe.model.set_value(row.doctype, row.name, 'total_cost', actual_unit * row.qty);
                                        }
                                    })
                                    .then(() => {
                                        const actual_unit_rate = total_profit + actual_unit;
                                        return frappe.model.set_value(row.doctype, row.name, 'actual_unit_rate', actual_unit_rate)
                                            .then(() => {
                                                if (row.qty >= 0) {
                                                    let overall_price = actual_unit_rate * row.qty;
                                                    
                                                    // Find the corresponding scope
                                                    const scope = frm.doc.scopes.find(s => s.scope_number === row.scope_number);
                                                    
                                                    // Apply rounding if specified in scope
                                                    if (scope && scope.rounding === "Round up to nearest 5") {
                                                        overall_price = roundToNearest5(overall_price);
                                                    }
                                                    
                                                    return frappe.model.set_value(row.doctype, row.name, 'overall_price', overall_price);
                                                }
                                            });
                                    });
                            }
                        });
                }
            });
    }
    return Promise.resolve();
}

// Calculate scope totals
function update_scope_totals(frm, scope_number) {
    const scope = (frm.doc.scopes || []).find(s => s.scope_number === scope_number);
    if (!scope) return;

    const scope_items = (frm.doc.items || []).filter(item => item.scope_number === scope_number);
    
    // Calculate totals
    const totals = scope_items.reduce((acc, item) => {
        let vat_amount = 0;
        const price = item.overall_price || 0;
        
        if (scope.vat_inclusive) {
            // If VAT inclusive, extract VAT from the price
            vat_amount = price - (price / (1 + scope.vat / 100));
        } else {
            // If VAT not inclusive, calculate VAT normally
            vat_amount = price * (scope.vat / 100);
        }
        
        return {
            total_price: acc.total_price + price,
            total_cost: acc.total_cost + (item.total_cost || 0),
            // total_profit: acc.total_profit + (item.total_profit * item.qty || 0),
            total_items: acc.total_items + (item.qty || 0),
            total_vat_amount: acc.total_vat_amount + vat_amount
        };
    }, { total_price: 0, total_cost: 0, total_items: 0, total_vat_amount: 0 });
    
    // Calculate price excluding VAT
    const total_price_excluding_vat = totals.total_price - totals.total_vat_amount;
    
    // Calculate retention-related values
    const retention_percentage = scope.retention || 0;
    let price_after_retention = total_price_excluding_vat;
    
    if (retention_percentage > 0) {
        // Remove retention percentage from the price
        price_after_retention = total_price_excluding_vat * (1 - (retention_percentage / 100));
    }
    
    // Calculate VAT after retention
    const vat_after_retention = price_after_retention * (scope.vat / 100);
    
    // Calculate total price after retention
    const total_price_after_retention = price_after_retention + vat_after_retention;
    
    // Update scope with calculated totals
    frappe.model.set_value(scope.doctype, scope.name, {
        total_price: totals.total_price,
        total_cost: totals.total_cost,
        total_profit: total_price - total_cost,
        total_items: totals.total_items,
        total_vat_amount: totals.total_vat_amount,
        total_price_excluding_vat: total_price_excluding_vat,
        price_after_retention: price_after_retention,
        vat_after_retention: vat_after_retention,
        total_price_after_retention: total_price_after_retention
    });
}
//#endregion