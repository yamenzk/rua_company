# Copyright (c) 2024, Yamen Zakhour and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document
from frappe.utils import getdate, flt


class ProjectBill(Document):
	def before_insert(self):
		# Dynamically set naming series based on the document type
		if self.bill_type == 'Quotation':
			self.naming_series = 'RC-QTN-' + self.get_year_suffix()
		elif self.bill_type == 'Proforma':
			self.naming_series = 'RC-PRF-' + self.get_year_suffix()
		elif self.bill_type == 'Tax Invoice':
			self.naming_series = 'RC-INV-' + self.get_year_suffix()
		elif self.bill_type == 'Purchase Order':
			self.naming_series = 'RC-LPO-' + self.get_year_suffix()
		elif self.bill_type == 'Request for Quotation':
			self.naming_series = 'RC-RFQ-' + self.get_year_suffix()
		if not self.vat:
			self.vat = frappe.db.get_single_value('Rua', 'vat')

	def get_year_suffix(self):
		# Get the last two digits of the current year
		return str(getdate().year)[2:4]

	def validate(self):
		self.calculate_amounts()
		self.calculate_totals()

	def calculate_amounts(self):
		for item in self.items:
			item.amount = flt(item.qty or 0) * flt(item.rate or 0)

	def calculate_totals(self):
		# Calculate total from items
		total_amount = sum(flt(item.amount) for item in self.items)
		
		if self.apply_vat:
			# VAT is applied on top of the total
			self.total = total_amount
			self.vat_amount = flt(self.total * flt(self.vat) / 100)
		else:
			# Items are VAT inclusive, need to extract VAT
			vat_factor = flt(self.vat) / (100 + flt(self.vat))
			self.vat_amount = flt(total_amount * vat_factor)
			self.total = total_amount - self.vat_amount
		
		self.grand_total = flt(self.total + self.vat_amount)

	def update_project_tables(self):
		"""Update the corresponding child tables in the Project document"""
		if not self.project:
			return

		draft_table = {
			"Quotation": "quotation_drafts",
			"Request for Quotation": "rfq_drafts",
			"Proforma": "proforma_drafts",
			"Purchase Order": "lpo_drafts",
			"Tax Invoice": "invoice_drafts"
		}
		
		final_table = {
			"Quotation": "quotations",
			"Request for Quotation": "rfqs",
			"Proforma": "proformas",
			"Purchase Order": "lpos",
			"Tax Invoice": "invoices"
		}

		if not self.bill_type in draft_table:
			return

		draft_table_name = draft_table[self.bill_type]
		final_table_name = final_table[self.bill_type]

		# Remove existing entries from both tables
		frappe.db.sql("""
			DELETE FROM `tabProject Bills`
			WHERE parent = %s AND bill = %s AND parentfield = %s
		""", (self.project, self.name, draft_table_name))

		frappe.db.sql("""
			DELETE FROM `tabProject Bills`
			WHERE parent = %s AND bill = %s AND parentfield = %s
		""", (self.project, self.name, final_table_name))

		# Add new entry to appropriate table based on docstatus
		if self.docstatus in [0, 1]:  # Draft or Submitted
			table_field = draft_table_name if self.docstatus == 0 else final_table_name
			
			frappe.db.sql("""
				INSERT INTO `tabProject Bills` 
				(
					name, 
					parent, 
					parentfield, 
					parenttype, 
					bill,
					scope,
					bill_type,
					date,
					grand_total,
					status,
					party
				)
				VALUES (%s, %s, %s, 'Project', %s, %s, %s, %s, %s, %s, %s)
			""", (
				frappe.generate_hash(),
				self.project,
				table_field,
				self.name,
				self.scope_number,
				self.bill_type,
				self.date,
				self.grand_total,
				self.status,
				self.party
			))

		# Get project doc and recalculate totals
		project = frappe.get_doc("Project", self.project)
		project.calculate_financial_totals_optimized()

		# Update only the calculated fields using SQL
		frappe.db.sql("""
			UPDATE `tabProject`
			SET 
				total_proformas = %s,
				total_invoices = %s,
				total_expenses = %s,
				total_received = %s,
				total_additional_expenses = %s,
				total_paid = %s,
				total_receivable = %s,
				total_payable = %s,
				due_receivables = %s,
				due_payables = %s,
				total_project_value = %s,
				project_profit = %s,
				profit_percentage = %s
			WHERE name = %s
		""", (
			project.total_proformas,
			project.total_invoices,
			project.total_expenses,
			project.total_received,
			project.total_additional_expenses,
			project.total_paid,
			project.total_receivable,
			project.total_payable,
			project.due_receivables,
			project.due_payables,
			project.total_project_value,
			project.project_profit,
			project.profit_percentage,
			self.project
		))
		frappe.db.commit()

	def on_update(self):
		self.update_project_tables()

	def on_submit(self):
		"""Called when document is submitted"""
		# Update status for specific bill types if Not Billable
		billable_types = ["Purchase Order", "Tax Invoice"]
		if self.bill_type in billable_types and self.status == "Not Billable":
			if self.bill_type in ["Tax Invoice", "Purchase Order"]:
				# Set parameters based on bill type
				if self.bill_type == "Tax Invoice":
					payment_type = "Receive"
					# For receivables, check only project
					total_paid = frappe.db.sql("""
						SELECT COALESCE(SUM(amount), 0) as total
						FROM `tabPayment Voucher`
						WHERE project = %s
						AND type = %s
						AND docstatus = 1
					""", (self.project, payment_type))[0][0]
					
					# Check for existing bills total
					total_billed = frappe.db.sql("""
						SELECT COALESCE(SUM(grand_total), 0) as total
						FROM `tabProject Bill`
						WHERE project = %s
						AND bill_type = %s
						AND docstatus = 1
						AND name != %s
					""", (self.project, self.bill_type, self.name))[0][0]
				else:  # Purchase Order
					payment_type = "Pay"
					# For payables, check both project and party
					total_paid = frappe.db.sql("""
						SELECT COALESCE(SUM(amount), 0) as total
						FROM `tabPayment Voucher`
						WHERE project = %s
						AND party = %s
						AND type = %s
						AND docstatus = 1
					""", (self.project, self.party, payment_type))[0][0]
					
					# Check for existing bills total for this supplier
					total_billed = frappe.db.sql("""
						SELECT COALESCE(SUM(grand_total), 0) as total
						FROM `tabProject Bill`
						WHERE project = %s
						AND party = %s
						AND bill_type = %s
						AND docstatus = 1
						AND name != %s
					""", (self.project, self.party, self.bill_type, self.name))[0][0]
				
				# Calculate remaining payment amount
				remaining_payment = total_paid - total_billed
				
				# Set initial status based on available payments
				if remaining_payment <= 0:
					status = "Unpaid"
				elif remaining_payment >= self.grand_total:
					status = "Paid"
				else:
					status = "Partially Paid"
					
				frappe.db.set_value("Project Bill", self.name, "status", status)
			
			frappe.db.commit()
			
		self.update_project_tables()

	def on_cancel(self):
		"""Called when document is cancelled"""
		self.update_project_tables()

	def on_trash(self):
		"""Called when document is deleted"""
		if not self.project:
			return
			
		draft_table = {
			"Quotation": "quotation_drafts",
			"Request for Quotation": "rfq_drafts",
			"Proforma": "proforma_drafts",
			"Purchase Order": "lpo_drafts",
			"Tax Invoice": "invoice_drafts"
		}
		final_table = {
			"Quotation": "quotations",
			"Request for Quotation": "rfqs",
			"Proforma": "proformas",
			"Purchase Order": "lpos",
			"Tax Invoice": "invoices"
		}

		if self.bill_type in draft_table:
			draft_table_name = draft_table[self.bill_type]
			final_table_name = final_table[self.bill_type]
			
			# Remove from both tables using SQL
			frappe.db.sql("""
				DELETE FROM `tabProject Bills`
				WHERE parent = %s AND bill = %s AND parentfield = %s
			""", (self.project, self.name, draft_table_name))
			
			frappe.db.sql("""
				DELETE FROM `tabProject Bills`
				WHERE parent = %s AND bill = %s AND parentfield = %s
			""", (self.project, self.name, final_table_name))
			
			# Get project doc and recalculate totals
			project = frappe.get_doc("Project", self.project)
			project.calculate_financial_totals_optimized()

			# Update only the calculated fields using SQL
			frappe.db.sql("""
				UPDATE `tabProject`
				SET 
					total_proformas = %s,
					total_invoices = %s,
					total_expenses = %s,
					total_received = %s,
					total_additional_expenses = %s,
					total_paid = %s,
					total_receivable = %s,
					total_payable = %s,
					due_receivables = %s,
					due_payables = %s,
					total_project_value = %s,
					project_profit = %s,
					profit_percentage = %s
				WHERE name = %s
			""", (
				project.total_proformas,
				project.total_invoices,
				project.total_expenses,
				project.total_received,
				project.total_additional_expenses,
				project.total_paid,
				project.total_receivable,
				project.total_payable,
				project.due_receivables,
				project.due_payables,
				project.total_project_value,
				project.project_profit,
				project.profit_percentage,
				self.project
			))
			frappe.db.commit()
