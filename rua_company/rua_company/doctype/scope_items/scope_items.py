# Copyright (c) 2024, Yamen Zakhour and contributors
# For license information, please see license.txt

import frappe
import json
from frappe.model.document import Document
from frappe.utils import flt, cint
import math


class ScopeItems(Document):
    def validate(self):
        self.load_custom_functions()
        self.calculate_item_values()
        self.calculate_totals()

    def load_custom_functions(self):
        """Load custom functions for calculations"""
        self.custom_functions = {}
        
        functions = frappe.get_all(
            "Scope Custom Function",
            fields=["function_name", "function_code", "parameters", "disabled"],
            filters={"disabled": 0}  # Only load enabled functions
        )
        
        for func in functions:
            try:
                params = [p.strip() for p in (func.parameters or "").split('\n') if p.strip()]
                param_str = ', '.join(params)
                
                # Create the function code with result variable pattern
                full_code = f"def {func.function_name}({param_str}):\n"
                full_code += '    result = None\n'  # Initialize result variable
                full_code += '\n'.join(f"    {line}" for line in func.function_code.split('\n'))
                full_code += "\n    if result is None:\n"
                full_code += "        frappe.throw('Function must set the result variable')\n"
                full_code += "    return result\n"
                
                # Create a local namespace with required modules
                local_ns = {}
                
                # Execute the function definition in the local namespace
                exec(full_code, {"frappe": frappe, "math": math, "flt": flt, "cint": cint}, local_ns)
                
                # Store the function in our custom functions dict
                self.custom_functions[func.function_name] = local_ns[func.function_name]
                
                # Test the function
                try:
                    test_args = [1.0] * len(params)  # Test with 1.0 for each parameter
                    self.custom_functions[func.function_name](*test_args)
                except Exception as e:
                    frappe.throw(f"Test failed for {func.function_name}: {str(e)}")
                    
            except Exception as e:
                frappe.log_error(
                    f"Error loading custom function {func.function_name}: {str(e)}"
                )

    def get_eval_context(self, variables, doc_totals):
        """Get evaluation context for formulas"""
        class CustomFunctions:
            def __init__(self, functions):
                for name, func in functions.items():
                    setattr(self, name, func)
        
        return {
            "variables": variables,
            "doc_totals": doc_totals,
            "custom": CustomFunctions(self.custom_functions),
            "frappe": frappe,
            "math": math,
            "flt": flt,
            "cint": cint
        }

    def calculate_item_values(self):
        """Calculate values for each item based on scope type formulas"""
        if not self.scope_type:
            return

        scope_type = frappe.get_doc("Scope Type", self.scope_type)
        doc_totals = self.get_scope_totals()

        # Load custom functions if not already loaded
        if not hasattr(self, 'custom_functions'):
            self.load_custom_functions()

        # Sort fields by dependencies
        def get_dependencies(formula):
            if not formula:
                return set()
            deps = set()
            for field_name in [f.field_name for f in scope_type.scope_fields]:
                if f"variables['{field_name}']" in formula:
                    deps.add(field_name)
            # Check for doc_totals dependencies
            if formula and "doc_totals[" in formula:
                deps.add("__doc_totals__")  # Special marker for doc_totals dependency
            return deps

        # Create dependency graph
        field_deps = {}
        doc_totals_dependent_fields = []
        regular_fields = []
        
        for field in scope_type.scope_fields:
            if field.auto_calculate and field.calculation_formula:
                deps = get_dependencies(field.calculation_formula)
                if "__doc_totals__" in deps:
                    doc_totals_dependent_fields.append(field)
                    deps.remove("__doc_totals__")
                else:
                    regular_fields.append(field)
                field_deps[field.field_name] = deps

        # Sort regular fields by dependencies
        calculated_fields = set()
        sorted_regular_fields = []
        
        def add_field_to_list(field, target_list):
            if field.field_name in calculated_fields:
                return
            if field.auto_calculate and field.calculation_formula:
                deps = field_deps.get(field.field_name, set())
                for dep_name in deps:
                    dep_field = next((f for f in scope_type.scope_fields if f.field_name == dep_name), None)
                    if dep_field:
                        # Only add dependency if it's in the same category (regular or doc_totals)
                        if (dep_field in regular_fields and target_list == sorted_regular_fields) or \
                           (dep_field in doc_totals_dependent_fields and target_list == sorted_doc_totals_fields):
                            add_field_to_list(dep_field, target_list)
            calculated_fields.add(field.field_name)
            if field not in target_list:  # Prevent duplicates
                target_list.append(field)

        # Sort non-doc_totals dependent fields
        for field in regular_fields:
            add_field_to_list(field, sorted_regular_fields)

        # First calculate fields that don't depend on doc_totals
        for item in self.items:
            variables = self.get_item_variables(item)
            for field in sorted_regular_fields:
                if field.auto_calculate and field.calculation_formula:
                    try:
                        eval_globals = self.get_eval_context(variables, doc_totals)
                        result = eval(field.calculation_formula, eval_globals)
                        
                        if field.field_type == 'Int':
                            result = cint(result)
                        else:  # Float, Currency, or Percent
                            result = flt(result)
                            
                        item.set_dynamic_value(field.field_name, result)
                        variables[field.field_name] = result
                    except Exception as e:
                        frappe.throw(f"Error calculating {field.label}: {str(e)}")

        # Sort doc_totals dependent fields by their dependencies (excluding doc_totals)
        sorted_doc_totals_fields = []
        calculated_fields = set()  # Reset calculated fields for doc_totals sorting
        
        for field in doc_totals_dependent_fields:
            add_field_to_list(field, sorted_doc_totals_fields)

        # Now handle doc_totals dependent fields with multiple passes
        MAX_PASSES = 10  # Prevent infinite loops
        for pass_num in range(MAX_PASSES):
            # Store previous values to check for convergence
            previous_values = {}
            for item in self.items:
                previous_values[item.name] = {
                    field.field_name: item.get_dynamic_value(field.field_name)
                    for field in doc_totals_dependent_fields
                }
            
            # Calculate totals
            self.calculate_totals()
            doc_totals = self.get_scope_totals()
            
            # Calculate doc_totals dependent fields
            max_diff = 0
            for item in self.items:
                variables = self.get_item_variables(item)
                # Update variables with current field values
                for field in scope_type.scope_fields:
                    value = item.get_dynamic_value(field.field_name)
                    if value is not None:
                        variables[field.field_name] = value
                        
                for field in sorted_doc_totals_fields:
                    try:
                        eval_globals = self.get_eval_context(variables, doc_totals)
                        result = eval(field.calculation_formula, eval_globals)
                        
                        if field.field_type == 'Int':
                            result = cint(result)
                        else:  # Float, Currency, or Percent
                            result = flt(result)
                        
                        # Calculate maximum difference from previous value
                        prev_value = previous_values[item.name].get(field.field_name, 0)
                        max_diff = max(max_diff, abs(flt(result) - flt(prev_value)))
                        
                        item.set_dynamic_value(field.field_name, result)
                        variables[field.field_name] = result
                    except Exception as e:
                        frappe.throw(f"Error calculating {field.label}: {str(e)}")
            
            # Check if values have stabilized (convergence)
            if max_diff < 0.0001:  # Tolerance for floating point differences
                break
                
            if pass_num == MAX_PASSES - 1:
                frappe.msgprint(
                    "Warning: Calculations did not fully converge after maximum passes. "
                    "Some values might be approximate.",
                    indicator='orange'
                )

        # Final totals calculation
        self.calculate_totals()

    def calculate_totals(self):
        """Calculate scope-level totals"""
        totals = {}
        
        if not self.scope_type:
            return
            
        scope_type = frappe.get_doc("Scope Type", self.scope_type)
        
        # Get all items with their variables
        items_data = [self.get_item_variables(item) for item in self.items]
        
        def parse_filter_condition(condition):
            """Parse a single filter condition into field, operator, and value"""
            # Support for different operators
            operators = {
                '===': '==',
                '!==': '!=',
                '>=': '>=',
                '<=': '<=',
                '>': '>',
                '<': '<'
            }
            
            for js_op, py_op in operators.items():
                if js_op in condition:
                    field = condition.split('item.')[1].split(' ')[0]
                    value = condition.split(js_op)[1].split(')')[0].strip()
                    
                    # Convert value to appropriate type
                    if value.isdigit():
                        value = int(value)
                    elif value.replace('.', '').isdigit():
                        value = float(value)
                    elif value.lower() in ('true', 'false'):
                        value = value.lower() == 'true'
                    elif value.startswith('"') or value.startswith("'"):
                        value = value.strip("'\"")
                        
                    return field, py_op, value
            
            return None, None, None
            
        def evaluate_condition(item, field, op, value):
            """Evaluate a single condition against an item"""
            item_value = item.get(field)
            if item_value is None:
                return False
                
            if op == '==':
                return item_value == value
            elif op == '!=':
                return item_value != value
            elif op == '>=':
                return item_value >= value
            elif op == '<=':
                return item_value <= value
            elif op == '>':
                return item_value > value
            elif op == '<':
                return item_value < value
            
            return False

        # Calculate each formula
        for formula in scope_type.calculation_formulas:
            try:
                # Detect if this is a filtered aggregate formula
                if 'items.filter' in formula.formula:
                    filter_part = formula.formula.split('items.filter(')[1].split('.reduce')[0]
                    
                    # Handle multiple conditions with && or ||
                    conditions = []
                    if '&&' in filter_part:
                        condition_parts = filter_part.split('&&')
                        combine_op = all
                    elif '||' in filter_part:
                        condition_parts = filter_part.split('||')
                        combine_op = any
                    else:
                        condition_parts = [filter_part]
                        combine_op = all
                        
                    # Parse each condition
                    parsed_conditions = []
                    for part in condition_parts:
                        field, op, value = parse_filter_condition(part)
                        if field:
                            parsed_conditions.append((field, op, value))
                    
                    # Extract the field being aggregated and the operation type
                    reduce_part = formula.formula.split('.reduce')[1]
                    
                    # Determine the operation type
                    if 'count' in formula.formula.lower():
                        result = len(filtered_items)
                    else:
                        # Extract field name from reduce operation
                        sum_field = formula.formula.split('item.')[2].split(' ')[0].rstrip(')')
                        
                        if not filtered_items:
                            result = 0
                        elif 'min' in formula.formula.lower():
                            result = min(item.get(sum_field, 0) for item in filtered_items)
                        elif 'max' in formula.formula.lower():
                            result = max(item.get(sum_field, 0) for item in filtered_items)
                        elif 'avg' in formula.formula.lower():
                            result = sum(item.get(sum_field, 0) for item in filtered_items) / len(filtered_items)
                        else:  # sum
                            result = sum(item.get(sum_field, 0) for item in filtered_items)
                else:
                    # Create evaluation context for regular formulas
                    eval_globals = {
                        "items": items_data,
                        "frappe": frappe,
                        "math": math,
                        "flt": flt,
                        "cint": cint,
                        "sum": lambda field: sum(item.get(field, 0) for item in items_data),
                        "avg": lambda field: sum(item.get(field, 0) for item in items_data) / len(items_data) if items_data else 0,
                        "min": lambda field: min(item.get(field, 0) for item in items_data) if items_data else 0,
                        "max": lambda field: max(item.get(field, 0) for item in items_data) if items_data else 0,
                        "count": lambda field: sum(1 for item in items_data if field in item),
                        "distinct_count": lambda field: len(set(item.get(field) for item in items_data if field in item)),
                        "doc_totals": totals  # Add current totals to context
                    }
                    
                    result = eval(formula.formula, eval_globals)
                
                # Convert result based on field type
                if formula.field_type == 'Int':
                    result = cint(result)
                else:  # Float or Currency
                    result = flt(result)
                    
                totals[formula.field_name] = result
                
            except Exception as e:
                frappe.throw(f"Error calculating {formula.label}: {str(e)}")
        
        self._totals_data = json.dumps(totals)

    def get_item_variables(self, item):
        """Get all variables for an item with defaults"""
        if not item._data:
            # Get scope type for default values
            scope_type = frappe.get_doc("Scope Type", self.scope_type)
            defaults = {}
            
            # Initialize with default values from field configuration
            for field in scope_type.scope_fields:
                if field.default_value:
                    # Convert default value based on field type
                    if field.field_type in ['Float', 'Currency', 'Percent']:
                        defaults[field.field_name] = flt(field.default_value)
                    elif field.field_type == 'Int':
                        defaults[field.field_name] = cint(field.default_value)
                    elif field.field_type == 'Check':
                        defaults[field.field_name] = field.default_value.lower() == 'true'
                    else:
                        defaults[field.field_name] = field.default_value
            
            return defaults
            
        try:
            return json.loads(item._data)
        except json.JSONDecodeError:
            return {}

    def get_scope_totals(self):
        """Get scope-level totals with error handling"""
        if not self._totals_data:
            return {}
        try:
            return json.loads(self._totals_data)
        except json.JSONDecodeError:
            frappe.log_error("Invalid JSON in _totals_data")
            return {}

    def get_field_values(self, field_name):
        """Get all values for a field"""
        return [
            flt(item.get_dynamic_value(field_name), 0)
            for item in self.items
            if item.get_dynamic_value(field_name) is not None
        ]

@frappe.whitelist()
def get_scope_fields(scope_type):
    """Get field configurations for a scope type"""
    doc = frappe.get_doc("Scope Type", scope_type)
    return doc.scope_fields


@frappe.whitelist()
def save_scope_item(scope_items, item_data):
    """Save a scope item"""
    doc = frappe.get_doc("Scope Items", scope_items)

    # Parse item data
    item_data = frappe.parse_json(item_data)

    # Create or update item
    if item_data.get("row_id"):
        # Update existing item
        item = next((item for item in doc.items if item.row_id == item_data.get("row_id")), None)
        if item:
            item.item_name = item_data.get("item_name")
            # Handle other fields
            for field_name, value in item_data.items():
                if field_name not in ["row_id", "item_name"]:
                    item.set_dynamic_value(field_name, value)
    else:
        # Create new item
        item = doc.append("items", {
            "row_id": frappe.utils.random_string(10),
            "item_name": item_data.get("item_name")
        })
        # Handle other fields
        for field_name, value in item_data.items():
            if field_name not in ["row_id", "item_name"]:
                item.set_dynamic_value(field_name, value)

    doc.save()
    return doc.as_dict()


@frappe.whitelist()
def delete_scope_item(scope_items, row_id):
    """Delete a scope item"""
    doc = frappe.get_doc("Scope Items", scope_items)
    
    # Find and remove the item
    items_before = len(doc.items)
    doc.items = [item for item in doc.items if item.row_id != row_id]
    
    if len(doc.items) == items_before:
        frappe.throw(_("Item not found"))
        
    doc.save()
    return doc.as_dict()
