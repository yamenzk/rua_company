# Copyright (c) 2024, Yamen Zakhour and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document


class ScopeType(Document):
    def validate(self):
        self.validate_field_names()
        self.validate_formulas()

    def validate_field_names(self):
        """Ensure field names are unique and valid"""
        field_names = []
        for field in self.scope_fields:
            if not field.field_name:
                frappe.throw("Field Name is mandatory")

            if not field.field_name.isidentifier():
                frappe.throw(f"Invalid field name: {field.field_name}")

            if field.field_name in field_names:
                frappe.throw(f"Duplicate field name: {field.field_name}")

            field_names.append(field.field_name)

    def validate_formulas(self):
        """Validate calculation formulas and field references"""
        field_names = set(field.field_name for field in self.scope_fields)

        # Validate field formulas
        for field in self.scope_fields:
            if field.auto_calculate and field.calculation_formula:
                try:
                    # Only validate field references, skip Python syntax check
                    for field_name in field_names:
                        if f"variables['{field_name}']" in field.calculation_formula:
                            if field_name not in field_names:
                                frappe.throw(
                                    f"Formula references undefined field: {field_name}")
                except Exception as e:
                    frappe.throw(
                        f"Invalid formula for {field.field_name}: {str(e)}")

        # Validate scope formulas
        for formula in self.calculation_formulas:
            try:
                # For scope formulas, we'll do basic validation since they use JavaScript
                formula_text = formula.formula.strip()
                
                # Check for basic syntax errors
                if formula_text.count('(') != formula_text.count(')'):
                    frappe.throw(f"Unmatched parentheses in formula: {formula.label}")
                
                # Handle simple aggregates (sum, avg, etc.)
                valid_funcs = ['sum', 'avg', 'min', 'max', 'count']
                for func in valid_funcs:
                    if f"{func}('" in formula_text:
                        field_ref = formula_text.split(
                            f"{func}('")[1].split("')")[0]
                        if field_ref not in field_names:
                            frappe.throw(
                                f"Formula references undefined field: {field_ref}")
                
                # Handle filtered aggregates
                if 'items.filter' in formula_text:
                    # Basic validation for filter syntax
                    if 'reduce' not in formula_text:
                        frappe.throw(f"Filter must be followed by reduce for aggregation in: {formula.label}")
                    
                    # Make sure arrow functions are properly formatted
                    if '=>' not in formula_text:
                        frappe.throw(f"Missing arrow function in filter/reduce for: {formula.label}")

            except Exception as e:
                frappe.throw(
                    f"Invalid scope formula for {formula.label}: {str(e)}")

    def on_update(self):
        """Update dependent documents"""
        # Clear cache for dependent doctypes
        frappe.clear_cache(doctype="Scope Item Entry")
        frappe.clear_cache(doctype="Scope Items")
