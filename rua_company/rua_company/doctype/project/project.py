# Copyright (c) 2024, Yamen Zakhour and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document
from frappe.utils import today

class Project(Document):
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
