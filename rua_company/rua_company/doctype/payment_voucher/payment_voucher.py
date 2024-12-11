# Copyright (c) 2024, Yamen Zakhour and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document
from frappe.utils import flt


class PaymentVoucher(Document):
	def update_project_tables(self):
		"""Update the corresponding payment tables in the Project document"""
		if not self.project:
			return

		project = frappe.get_doc("Project", self.project)
		table_name = "received_table" if self.type == "Receive" else "paid_table"
		
		# Get current entries
		entries = project.get(table_name)
		
		# Remove existing entry if any
		project.set(table_name, [d for d in entries if d.voucher != self.name])
		
		# Add new entry if not cancelled
		if self.docstatus == 1:  # Submitted
			project.append(table_name, {
				"voucher": self.name,
			})
		
		project.save()

	def on_submit(self):
		"""Called when document is submitted"""
		self.update_project_tables()
		self.allocate_payments()

	def on_cancel(self):
		"""Called when document is cancelled"""
		self.update_project_tables()
		self.allocate_payments()
	
	def allocate_payments(self):
		"""Allocate payments to bills"""
		if self.type == "Receive":
			# Get all submitted Tax Invoices for this project
			bills = frappe.get_all(
				"Project Bill",
				filters={
					"project": self.project,
					"bill_type": "Tax Invoice",
					"docstatus": 1
				},
				fields=["name", "grand_total", "status"],
				order_by="creation"
			)
		else:  # Pay
			# Get all submitted Purchase Orders for this project and supplier
			bills = frappe.get_all(
				"Project Bill",
				filters={
					"project": self.project,
					"party": self.party,
					"bill_type": "Purchase Order",
					"docstatus": 1
				},
				fields=["name", "grand_total", "status"],
				order_by="creation"
			)

		# Get all submitted payments for this project
		if self.type == "Receive":
			payments = frappe.get_all(
				"Payment Voucher",
				filters={
					"project": self.project,
					"type": self.type,
					"docstatus": 1
				},
				fields=["amount"],
				order_by="creation"
			)
		else:  # Pay
			payments = frappe.get_all(
				"Payment Voucher",
				filters={
					"project": self.project,
					"party": self.party,
					"type": self.type,
					"docstatus": 1
				},
				fields=["amount"],
				order_by="creation"
			)

		# Calculate total payments
		total_payments = sum(payment.amount for payment in payments)

		# Update bill statuses based on available payments
		remaining_payment = total_payments
		for bill in bills:
			if remaining_payment <= 0:
				status = "Unpaid"
			elif remaining_payment >= bill.grand_total:
				status = "Paid"
			else:
				status = "Partially Paid"

			frappe.db.set_value("Project Bill", bill.name, "status", status)
			remaining_payment -= bill.grand_total

		frappe.db.commit()

	@frappe.whitelist()
	def get_due_amount(self):
		"""Calculate due amount for the selected project and party"""
		if not (self.project and self.party):
			return 0
			
		if self.type == "Receive":
			# Get total of submitted Tax Invoices
			total_billed = frappe.db.sql("""
				SELECT COALESCE(SUM(grand_total), 0) as total
				FROM `tabProject Bill`
				WHERE project = %s
				AND party = %s
				AND bill_type = 'Tax Invoice'
				AND docstatus = 1
			""", (self.project, self.party))[0][0]
			
			# Get total received payments
			total_paid = frappe.db.sql("""
				SELECT COALESCE(SUM(amount), 0) as total
				FROM `tabPayment Voucher`
				WHERE project = %s
				AND party = %s
				AND type = 'Receive'
				AND docstatus = 1
			""", (self.project, self.party))[0][0]
			
		else:  # Pay
			# Get total of submitted Purchase Orders
			total_billed = frappe.db.sql("""
				SELECT COALESCE(SUM(grand_total), 0) as total
				FROM `tabProject Bill`
				WHERE project = %s
				AND party = %s
				AND bill_type = 'Purchase Order'
				AND docstatus = 1
			""", (self.project, self.party))[0][0]
			
			# Get total paid to supplier
			total_paid = frappe.db.sql("""
				SELECT COALESCE(SUM(amount), 0) as total
				FROM `tabPayment Voucher`
				WHERE project = %s
				AND party = %s
				AND type = 'Pay'
				AND docstatus = 1
			""", (self.project, self.party))[0][0]
		
		return total_billed - total_paid
