# Copyright (c) 2024, Yamen Zakhour and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document

class PaymentVoucher(Document):
    def on_submit(self):
        if self.bill:
            frappe.db.set_value('Bill', self.bill, 'payment_status', 'Paid')
            frappe.db.commit()

    def on_cancel(self):
        if self.bill:
            frappe.db.set_value('Bill', self.bill, 'payment_status', 'Unpaid')
            frappe.db.commit()
