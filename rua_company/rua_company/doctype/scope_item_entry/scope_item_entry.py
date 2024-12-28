# Copyright (c) 2024, Yamen Zakhour and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document
import json


class ScopeItemEntry(Document):
    def get_dynamic_value(self, field_name):
        """Get value from JSON storage"""
        if self.data:
            data = json.loads(self.data)
            return data.get(field_name)
        return None

    def set_dynamic_value(self, field_name, value):
        """Set value in JSON storage with type validation"""
        if not self.parent:
            return

        parent_doc = frappe.get_doc("Scope Items", self.parent)
        scope_type = frappe.get_doc("Scope Type", parent_doc.scope_type)

        # Find field configuration
        field_config = next(
            (f for f in scope_type.scope_fields if f.field_name == field_name), None)
        if field_config:
            # Validate type before setting
            value = field_config.validate_field_type(
                value, field_config.field_type)

        data = {}
        try:
            if self.data:
                data = json.loads(self.data)
        except json.JSONDecodeError:
            data = {}

        data[field_name] = value
        self.data = json.dumps(data)

    def validate(self):
        """Validate required fields based on scope type"""
        if not self.parent:
            return

        parent_doc = frappe.get_doc("Scope Items", self.parent)
        scope_type = frappe.get_doc("Scope Type", parent_doc.scope_type)

        # Validate required fields
        for field in scope_type.scope_fields:
            if field.mandatory and not self.get_dynamic_value(field.field_name):
                frappe.throw(f"{field.label} is required")
