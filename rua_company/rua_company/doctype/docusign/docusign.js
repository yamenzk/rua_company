// Copyright (c) 2024, Yamen Zakhour and contributors
// For license information, please see license.txt

frappe.ui.form.on("Docusign", {
	refresh(frm) {
		frm.add_custom_button(__('Sign'), function() {
			show_signing_dialog(frm);
		});
	},
});

function show_signing_dialog(frm) {
	const dialog = new frappe.ui.Dialog({
		title: 'Choose Signing Method',
		fields: [
			{
				fieldname: 'signing_method_html',
				fieldtype: 'HTML',
				options: `
					<div class="signing-methods">
						<div class="signing-method-card" data-method="sign_pad">
							<h3>Sign Pad</h3>
							<p>Draw your signature using our digital pad</p>
						</div>
						<div class="signing-method-card" data-method="upload_image">
							<h3>Upload Image</h3>
							<p>Upload an image of your signature</p>
						</div>
						<div class="signing-method-card" data-method="from_password">
							<h3>From Password</h3>
							<p>Generate signature using your password</p>
						</div>
					</div>
					<style>
						.signing-methods {
							display: flex;
							gap: 15px;
							padding: 10px;
						}
						.signing-method-card {
							flex: 1;
							padding: 15px;
							border: 1px solid #ddd;
							border-radius: 8px;
							cursor: pointer;
							transition: all 0.3s ease;
							text-align: center;
						}
						.signing-method-card:hover {
							border-color: var(--primary);
							background-color: var(--primary-light);
						}
						.signing-method-card h3 {
							margin-top: 0;
							margin-bottom: 10px;
							color: var(--text-color);
						}
						.signing-method-card p {
							margin: 0;
							color: var(--text-muted);
							font-size: 0.9em;
						}
					</style>
				`
			}
		]
	});

	dialog.$wrapper.find('.signing-method-card').on('click', function() {
		const method = $(this).data('method');
		dialog.hide();
		
		if (method === 'sign_pad') {
			show_sign_pad_dialog(frm);
		} else if (method === 'upload_image') {
			show_upload_dialog(frm);
		} else if (method === 'from_password') {
			show_password_dialog(frm);
		}
	});

	dialog.show();
}

function show_sign_pad_dialog(frm) {
	const sign_pad_dialog = new frappe.ui.Dialog({
		title: 'Sign Document',
		fields: [
			{
				fieldname: 'signature',
				fieldtype: 'Signature',
				label: 'Signature',
				reqd: 1
			},
			{
				fieldname: 'include_name',
				fieldtype: 'Check',
				label: 'Include Name',
				default: 1,
				onchange: function() {
					if (!this.get_value()) {
						sign_pad_dialog.set_value('signee_name', '');
					}
				}
			},
			{
				fieldname: 'signee_name',
				fieldtype: 'Data',
				label: 'Signee Name',
				depends_on: 'eval:doc.include_name'
			},
			{
				fieldname: 'include_position',
				fieldtype: 'Check',
				label: 'Include Position',
				default: 1,
				onchange: function() {
					if (!this.get_value()) {
						sign_pad_dialog.set_value('position', '');
					}
				}
			},
			{
				fieldname: 'position',
				fieldtype: 'Data',
				label: 'Position',
				depends_on: 'eval:doc.include_position'
			},
			{
				fieldname: 'include_date',
				fieldtype: 'Check',
				label: 'Include Date',
				default: 1,
				onchange: function() {
					if (!this.get_value()) {
						sign_pad_dialog.set_value('date', '');
					}
				}
			},
			{
				fieldname: 'date',
				fieldtype: 'Date',
				label: 'Date',
				default: 'Today',
				depends_on: 'eval:doc.include_date'
			},
			{
				fieldname: 'protect_signature',
				fieldtype: 'Check',
				label: 'Protect Signature',
				default: 1
			}
		],
		primary_action_label: 'Save',
		primary_action(values) {
			if (!values.signature) {
				frappe.throw(__('Please draw your signature'));
				return;
			}

			// Call server method to process signature
			frappe.call({
				method: 'rua_company.rua_company.doctype.docusign.docusign.process_signature',
				args: {
					docname: frm.doc.name,
					signature: values.signature,
					signee_name: values.signee_name,
					position: values.position,
					date: values.date,
					protect_signature: values.protect_signature,
					values: {
						include_name: values.include_name,
						include_position: values.include_position,
						include_date: values.include_date
					}
				},
				callback: function(r) {
					if (!r.exc) {
						frm.reload_doc();
						frappe.show_alert({
							message: __('Signature saved successfully'),
							indicator: 'green'
						});
					}
				}
			});
			sign_pad_dialog.hide();
		}
	});

	sign_pad_dialog.show();
}

function show_upload_dialog(frm) {
	const upload_dialog = new frappe.ui.Dialog({
		title: 'Upload Signature Image',
		fields: [
			{
				fieldname: 'signature_file',
				fieldtype: 'Attach',
				label: 'Upload Signature',
				reqd: 1
			},
			{
				fieldname: 'include_name',
				fieldtype: 'Check',
				label: 'Include Name',
				default: 1,
				onchange: function() {
					if (!this.get_value()) {
						upload_dialog.set_value('signee_name', '');
					}
				}
			},
			{
				fieldname: 'signee_name',
				fieldtype: 'Data',
				label: 'Signee Name',
				depends_on: 'eval:doc.include_name'
			},
			{
				fieldname: 'include_position',
				fieldtype: 'Check',
				label: 'Include Position',
				default: 1,
				onchange: function() {
					if (!this.get_value()) {
						upload_dialog.set_value('position', '');
					}
				}
			},
			{
				fieldname: 'position',
				fieldtype: 'Data',
				label: 'Position',
				depends_on: 'eval:doc.include_position'
			},
			{
				fieldname: 'include_date',
				fieldtype: 'Check',
				label: 'Include Date',
				default: 1,
				onchange: function() {
					if (!this.get_value()) {
						upload_dialog.set_value('date', '');
					}
				}
			},
			{
				fieldname: 'date',
				fieldtype: 'Date',
				label: 'Date',
				default: 'Today',
				depends_on: 'eval:doc.include_date'
			},
			{
				fieldname: 'protect_signature',
				fieldtype: 'Check',
				label: 'Protect Signature',
				default: 1
			}
		],
		primary_action_label: 'Save',
		primary_action(values) {
			if (!values.signature_file) {
				frappe.throw(__('Please upload a signature image'));
				return;
			}

			// Get the file data
			frappe.call({
				method: 'rua_company.rua_company.doctype.docusign.docusign.process_uploaded_signature',
				args: {
					docname: frm.doc.name,
					file_url: values.signature_file,
					signee_name: values.signee_name,
					position: values.position,
					date: values.date,
					protect_signature: values.protect_signature,
					values: {
						include_name: values.include_name,
						include_position: values.include_position,
						include_date: values.include_date
					}
				},
				callback: function(r) {
					if (!r.exc) {
						frm.reload_doc();
						frappe.show_alert({
							message: __('Signature saved successfully'),
							indicator: 'green'
						});
					}
				}
			});
			upload_dialog.hide();
		}
	});

	upload_dialog.show();
}

function show_password_dialog(frm) {
	const password_dialog = new frappe.ui.Dialog({
		title: 'Quick Sign with Password',
		fields: [
			{
				fieldname: 'password',
				fieldtype: 'Password',
				label: 'Quick Sign Password',
				reqd: 1
			},
			{
				fieldname: 'include_name',
				fieldtype: 'Check',
				label: 'Include Name',
				default: 1,
				onchange: function() {
					if (!this.get_value()) {
						password_dialog.set_value('signee_name', '');
					}
				}
			},
			{
				fieldname: 'signee_name',
				fieldtype: 'Data',
				label: 'Signee Name',
				depends_on: 'eval:doc.include_name'
			},
			{
				fieldname: 'include_position',
				fieldtype: 'Check',
				label: 'Include Position',
				default: 1,
				onchange: function() {
					if (!this.get_value()) {
						password_dialog.set_value('position', '');
					}
				}
			},
			{
				fieldname: 'position',
				fieldtype: 'Data',
				label: 'Position',
				depends_on: 'eval:doc.include_position'
			},
			{
				fieldname: 'include_date',
				fieldtype: 'Check',
				label: 'Include Date',
				default: 1,
				onchange: function() {
					if (!this.get_value()) {
						password_dialog.set_value('date', '');
					}
				}
			},
			{
				fieldname: 'date',
				fieldtype: 'Date',
				label: 'Date',
				default: 'Today',
				depends_on: 'eval:doc.include_date'
			},
			{
				fieldname: 'protect_signature',
				fieldtype: 'Check',
				label: 'Protect Signature',
				default: 1
			}
		],
		primary_action_label: 'Sign',
		primary_action(values) {
			if (!values.password) {
				frappe.throw(__('Please enter your quick sign password'));
				return;
			}

			frappe.call({
				method: 'rua_company.rua_company.doctype.docusign.docusign.process_password_signature',
				args: {
					docname: frm.doc.name,
					password: values.password,
					signee_name: values.signee_name,
					position: values.position,
					date: values.date,
					protect_signature: values.protect_signature,
					values: {
						include_name: values.include_name,
						include_position: values.include_position,
						include_date: values.include_date
					}
				},
				callback: function(r) {
					if (!r.exc) {
						frm.reload_doc();
						frappe.show_alert({
							message: __('Signature applied successfully'),
							indicator: 'green'
						});
					}
				}
			});
			password_dialog.hide();
		}
	});

	password_dialog.show();
}
