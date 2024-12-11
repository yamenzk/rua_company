// Copyright (c) 2024, Yamen Zakhour and contributors
// For license information, please see license.txt

frappe.ui.form.on('Payment Voucher', {
	refresh: function(frm) {
		// Add any refresh logic here
	},
	
	project: function(frm) {
		// When project changes, clear amount if party is not set
		if (!frm.doc.party) {
			frm.set_value('amount', 0);
		} else {
			// If both project and party are set, update amount
			update_due_amount(frm);
		}
	},
	
	party: function(frm) {
		// When party changes, update amount if project is set
		if (frm.doc.project) {
			update_due_amount(frm);
		} else {
			frm.set_value('amount', 0);
		}
	},
	
	type: function(frm) {
		// When type changes, update amount if both project and party are set
		if (frm.doc.project && frm.doc.party) {
			update_due_amount(frm);
		}
	}
});

function update_due_amount(frm) {
	frappe.call({
		method: 'get_due_amount',
		doc: frm.doc,
		callback: function(r) {
			if (!r.exc) {
				// Set the calculated due amount
				frm.set_value('amount', Math.abs(r.message || 0));
				
				// Show a message about the calculated amount
				let msg = '';
				if (frm.doc.type === 'Receive') {
					msg = `Outstanding receivable amount: ${format_currency(Math.abs(r.message))}`;
				} else {
					msg = `Outstanding payable amount: ${format_currency(Math.abs(r.message))}`;
				}
				frm.set_intro(msg);
			}
		}
	});
}
