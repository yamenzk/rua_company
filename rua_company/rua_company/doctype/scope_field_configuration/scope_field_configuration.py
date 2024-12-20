# Copyright (c) 2024, Yamen Zakhour and contributors
# For license information, please see license.txt

# import frappe
from frappe.model.document import Document


class ScopeFieldConfiguration(Document):
    VALID_FIELD_TYPES = {
        "Float": float,
        "Int": int,
        "Currency": float,
        "Percent": float,
        "Select": str,
        "Data": str,
        "Text": str,
        "Check": bool
    }
    def validate_field_type(self, value, field_type):
        if field_type not in self.VALID_FIELD_TYPES:
            return value
        try:
            return self.VALID_FIELD_TYPES[field_type](value)
        except (ValueError, TypeError):
            frappe.throw(f"Invalid value for field type {field_type}")
