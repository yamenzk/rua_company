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

    def set_bill_number(self):
        """Set bill number based on highest bill number for same project and bill type"""
        # Find highest bill number for this project and bill type
        highest = frappe.db.sql("""
            SELECT MAX(bill_number) 
            FROM `tabProject Bill`
            WHERE project = %s 
            AND bill_type = %s 
            AND docstatus = 1
        """, (self.project, self.bill_type))[0][0]

        # Set bill number as highest + 1, or 1 if no existing bills
        self.bill_number = (highest or 0) + 1
        frappe.db.set_value('Project Bill', self.name,
                            'bill_number', self.bill_number)
        frappe.db.commit()

    def reconcile_bill_numbers(self):
        """Reconcile bill numbers after cancellation"""
        # First set this document's bill number to 0
        current_bill_number = self.bill_number
        self.bill_number = 0
        frappe.db.set_value('Project Bill', self.name, 'bill_number', 0)

        if current_bill_number:
            # Get all documents with higher bill numbers
            higher_bills = frappe.db.sql("""
                SELECT name, bill_number 
                FROM `tabProject Bill`
                WHERE project = %s 
                AND bill_type = %s 
                AND bill_number > %s
                AND docstatus = 1
                ORDER BY bill_number
            """, (self.project, self.bill_type, current_bill_number), as_dict=1)

            # Update their bill numbers
            for bill in higher_bills:
                new_number = bill.bill_number - 1
                frappe.db.set_value('Project Bill', bill.name,
                                    'bill_number', new_number)

        frappe.db.commit()