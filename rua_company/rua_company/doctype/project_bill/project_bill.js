// Copyright (c) 2024, Yamen Zakhour and contributors
// For license information, please see license.txt

frappe.ui.form.on('Project Bill', {
    setup: function(frm) {
        if (frm.doc.__islocal) {
            frappe.db.get_single_value('Rua', 'vat')
                .then(value => {
                    frm.set_value('vat', value);
                });
        }
    },
    refresh: function(frm) {
        calculate_totals(frm);
    },
    
    apply_vat: function(frm) {
        calculate_totals(frm);
    },
    
    vat: function(frm) {
        calculate_totals(frm);
    }
});

frappe.ui.form.on('Items', {
    items_add: function(frm, cdt, cdn) {
        handle_fields_readonly(frm, cdt, cdn);
        calculate_totals(frm);
    },
    
    items_remove: function(frm, cdt, cdn) {
        calculate_totals(frm);
    },
    
    qty: function(frm, cdt, cdn) {
        let row = locals[cdt][cdn];
        calculate_amount(frm, row);
        calculate_totals(frm);
    },
    
    rate: function(frm, cdt, cdn) {
        let row = locals[cdt][cdn];
        calculate_amount(frm, row);
        calculate_totals(frm);
    }
});

function calculate_amount(frm, row) {
    let qty = row.qty || 0;
    let rate = row.rate || 0;
    frappe.model.set_value(row.doctype, row.name, 'amount', qty * rate);
}

function calculate_totals(frm) {
    let total_amount = 0;
    
    // Sum up all amounts
    frm.doc.items.forEach(item => {
        total_amount += flt(item.amount);
    });
    
    if (frm.doc.apply_vat) {
        // VAT is applied on top of the total
        frm.doc.total = total_amount;
        frm.doc.vat_amount = flt(frm.doc.total * flt(frm.doc.vat) / 100);
    } else {
        // Items are VAT inclusive, need to extract VAT
        let vat_factor = flt(frm.doc.vat) / (100 + flt(frm.doc.vat));
        frm.doc.vat_amount = flt(total_amount * vat_factor);
        frm.doc.total = total_amount - frm.doc.vat_amount;
    }
    
    frm.doc.grand_total = flt(frm.doc.total + frm.doc.vat_amount);
    
    frm.refresh_field('total');
    frm.refresh_field('vat_amount');
    frm.refresh_field('grand_total');
}

function handle_fields_readonly(frm, cdt, cdn) {
    let row = locals[cdt][cdn];
    let grid_row = frm.fields_dict.items.grid.grid_rows_by_docname[cdn];
    
    // Find the section field index
    let rate_field_idx = grid_row.docfields.findIndex(field => field.fieldname === 'rate');
    let amount_field_idx = grid_row.docfields.findIndex(field => field.fieldname === 'amount');
    
    if (frm.doc.bill_type == 'Request for Quotation') {
        grid_row.docfields[rate_field_idx].read_only = 1;
        grid_row.docfields[amount_field_idx].read_only = 1;
    } else {
        grid_row.docfields[rate_field_idx].read_only = 0;
        grid_row.docfields[amount_field_idx].read_only = 0;
    }
    
    frm.fields_dict.items.grid.refresh();
}
