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
        if self.grand_total <= 0 and self.bill_type != "Request for Quotation":
            frappe.throw(
                "The Grand Total must be greater than zero for a valid bill.")

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
        from rua_company.rua_company.doctype.project.project_calculations import update_project_bill_tables
        update_project_bill_tables(self)

    def on_update(self):
        self.update_project_tables()

    def on_submit(self):
        """Called when document is submitted"""
        # Set the bill number
        self.set_bill_number()

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

                frappe.db.set_value(
                    "Project Bill", self.name, "status", status)

            frappe.db.commit()

        self.update_project_tables()

    def on_cancel(self):
        """Called when document is cancelled"""
        self.reconcile_bill_numbers()
        self.update_project_tables()

    def on_trash(self):
        """Called when document is deleted"""
        from rua_company.rua_company.doctype.project.project_calculations import handle_project_bill_deletion
        handle_project_bill_deletion(self)

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


@frappe.whitelist()
def make_purchase_order(source_name, target_doc=None):
    doc = frappe.get_doc('Project Bill', source_name)

    new_doc = frappe.new_doc('Project Bill')
    new_doc.bill_type = 'Purchase Order'
    new_doc.project = doc.project
    new_doc.scope = doc.scope
    new_doc.serial_number = doc.serial_number
    new_doc.scope_description = doc.scope_description
    new_doc.date = frappe.utils.nowdate()
    new_doc.party = doc.party
    new_doc.vat = doc.vat

    for item in doc.items:
        new_doc.append('items', {
            'party': item.party,
            'item': item.item,
            'description': item.description,
            'width': item.width,
            'height': item.height,
            'qty': item.qty
        })

    return new_doc


@frappe.whitelist()
def make_payment_voucher(source_name, target_doc=None):
    doc = frappe.get_doc('Project Bill', source_name)

    new_doc = frappe.new_doc('Payment Voucher')
    new_doc.project = doc.project
    new_doc.type = "Pay" if doc.bill_type == "Purchase Order" else "Receive"
    new_doc.party = doc.party
    new_doc.amount = doc.grand_total
    new_doc.date = frappe.utils.nowdate()
    new_doc.trn = frappe.db.get_value("Party", doc.party, "trn")
    new_doc.emirate = frappe.db.get_value("Party", doc.party, "emirate")

    return new_doc
