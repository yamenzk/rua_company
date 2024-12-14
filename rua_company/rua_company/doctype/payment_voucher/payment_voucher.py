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
			
		table_name = "received_table" if self.type == "Receive" else "paid_table"

		# Remove existing entries
		if not self.is_petty_cash:
			frappe.db.sql("""
				DELETE FROM `tabPayments`
				WHERE parent = %s AND voucher = %s AND parentfield = %s
			""", (self.project, self.name, table_name))
		else:
			frappe.db.sql("""
				DELETE FROM `tabItems`
				WHERE parent = %s AND payment_voucher = %s AND parentfield = 'additional_items'
			""", (self.project, self.name))

		# Add new entry if not cancelled and not petty cash
		if self.docstatus == 1 and not self.is_petty_cash:
			frappe.db.sql("""
				INSERT INTO `tabPayments` 
				(
					name, 
					parent, 
					parentfield, 
					parenttype, 
					voucher,
					date,
					type,
					amount
				)
				VALUES (%s, %s, %s, 'Project', %s, %s, %s, %s)
			""", (
				frappe.generate_hash(),
				self.project,
				table_name,
				self.name,
				self.date,
				self.type,
				self.amount
			))
		
		# Get project doc and recalculate totals
		project = frappe.get_doc("Project", self.project)
		project.calculate_financial_totals()
		
		# Update only the calculated fields using SQL
		frappe.db.sql("""
			UPDATE `tabProject`
			SET 
				total_received = %s,
				total_paid = %s,
				total_payable = %s,
				due_receivables = %s,
				due_payables = %s,
				total_project_value = %s,
				project_profit = %s,
				profit_percentage = %s
			WHERE name = %s
		""", (
			project.total_received,
			project.total_paid,
			project.total_payable,
			project.due_receivables,
			project.due_payables,
			project.total_project_value,
			project.project_profit,
			project.profit_percentage,
			self.project
		))
		frappe.db.commit()

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
		if not self.project:
			return

		if self.type == "Receive":
			# Get all submitted Tax Invoices for this project
			bills = frappe.db.sql("""
				SELECT name, grand_total, status
				FROM `tabProject Bill`
				WHERE project = %s
				AND bill_type = 'Tax Invoice'
				AND docstatus = 1
				ORDER BY creation
			""", (self.project,), as_dict=1)
			
			total_payments = frappe.db.sql("""
				SELECT COALESCE(SUM(amount), 0) as total
				FROM `tabPayment Voucher`
				WHERE project = %s
				AND type = 'Receive'
				AND docstatus = 1
			""", (self.project,))[0][0]
		else:  # Pay
			# Get all submitted Purchase Orders for this project and supplier
			bills = frappe.db.sql("""
				SELECT name, grand_total, status
				FROM `tabProject Bill`
				WHERE project = %s
				AND party = %s
				AND bill_type = 'Purchase Order'
				AND docstatus = 1
				ORDER BY creation
			""", (self.project, self.party), as_dict=1)
			
			total_payments = frappe.db.sql("""
				SELECT COALESCE(SUM(amount), 0) as total
				FROM `tabPayment Voucher`
				WHERE project = %s
				AND party = %s
				AND type = %s
				AND docstatus = 1
			""", (self.project, self.party, self.type))[0][0]

		# Update statuses one by one
		remaining_payment = total_payments
		for bill in bills:
			if remaining_payment <= 0:
				status = "Unpaid"
			elif remaining_payment >= bill.grand_total:
				status = "Paid"
			else:
				status = "Partially Paid"
			
			frappe.db.sql("""
				UPDATE `tabProject Bill` 
				SET status = %s 
				WHERE name = %s
			""", (status, bill.name))
			
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
