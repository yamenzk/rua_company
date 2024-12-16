# Copyright (c) 2024, Yamen Zakhour and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document
from frappe.utils import getdate, date_diff, nowdate
from dateutil.relativedelta import relativedelta


class Employee(Document):
    def validate(self):
        self.update_full_name()
        self.update_age()
    
    def update_full_name(self):
        """Update full_name field from first_name and last_name"""
        self.full_name = f"{self.first_name or ''} {self.last_name or ''}".strip()
    
    def update_age(self):
        """Calculate and update age based on date_of_birth"""
        if self.date_of_birth:
            dob = getdate(self.date_of_birth)
            today = getdate(nowdate())
            self.age = relativedelta(today, dob).years
