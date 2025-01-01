# Copyright (c) 2024, Yamen Zakhour and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document
from frappe.utils import today

class Project(Document):
    def validate(self):
        if self.has_value_changed("status"):
            if self.status == "Cancelled":
                self.serial_number = 0
            elif self.status == "In Progress":
                self.serial_number = self.get_next_serial_number()
    
    def get_next_serial_number(self):
        # Get the highest serial number from existing projects (excluding cancelled)
        highest_serial = frappe.db.sql("""
            SELECT MAX(serial_number) 
            FROM tabProject 
            WHERE status != 'Cancelled'
        """)[0][0]
        
        # If no projects exist or all have serial_number 0, start from 1
        return (highest_serial or 0) + 1

    pass

@frappe.whitelist()
def create_additional_expense(self, party, date, amount, details):
    try:
        # Create new payment voucher
        payment_voucher = frappe.get_doc({
            "doctype": "Payment Voucher",
            "type": "Pay",
            "date": date,
            "party": party,
            "project": self,  # self is already the project name
            "mode": "Cash",
            "payment_amount": amount,
            "petty_cash": 1,
            "details": details
        })
        
        payment_voucher.insert()
        payment_voucher.submit()
        
        frappe.db.commit()
        
        return payment_voucher
        
    except Exception as e:
        frappe.log_error(str(e), "Additional Expense Creation Error")
        raise e
