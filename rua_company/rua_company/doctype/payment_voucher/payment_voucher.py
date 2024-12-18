# Copyright (c) 2024, Yamen Zakhour and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document
from frappe.utils import flt

class PaymentVoucher(Document):
    def update_project_tables(self):
        """Update the corresponding payment tables in the Project document"""
        from rua_company.rua_company.doctype.project.project_calculations import update_payment_voucher_tables
        update_payment_voucher_tables(self)

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

        from rua_company.rua_company.doctype.project.project_calculations import allocate_project_payments
        allocate_project_payments(self.project, self.type, self.party)

    @frappe.whitelist()
    def get_due_amount(self):
        """Calculate due amount for the selected project and party"""
        if not (self.project and self.party):
            return 0

        from rua_company.rua_company.doctype.project.project_calculations import get_payment_due_amount
        return get_payment_due_amount(self.project, self.party, self.type)