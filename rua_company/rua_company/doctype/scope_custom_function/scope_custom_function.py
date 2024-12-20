# Copyright (c) 2024, Yamen Zakhour and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document
from frappe.utils import flt, cint
import math


class ScopeCustomFunction(Document):
    def validate(self):
        """Validate function code"""
        try:
            # Create test context
            context = {
                "frappe": frappe,
                "math": math,
                "flt": flt,
                "cint": cint
            }
            
            # Compile function to check syntax
            params = [p.strip() for p in (self.parameters or "").split('\n') if p.strip()]
            param_str = ', '.join(params)
            
            full_code = f"def {self.function_name}({param_str}):\n"
            full_code += '    result = None\n'  # Initialize result variable
            full_code += '\n'.join(f"    {line}" for line in self.function_code.split('\n'))
            full_code += "\n    if result is None:\n"
            full_code += "        frappe.throw('Function must set the result variable')\n"
            full_code += "    return result\n"
            
            compile(full_code, '', 'exec')
        except Exception as e:
            frappe.throw(f"Invalid function code: {str(e)}")

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
            
            # Add standard imports and utilities
            full_code = "from frappe.utils import flt, cint\n"
            full_code += "import math\n\n"
            
            full_code += f"def {func.function_name}({param_str}):\n"
            full_code += "    result = None\n"
            full_code += '\n'.join(f"    {line}" for line in func.function_code.split('\n'))
            full_code += "\n    if result is None:\n"
            full_code += "        frappe.throw('Function did not set result variable')\n"
            full_code += "    return flt(result)"  # Ensure numeric result
            
            # Add function to namespace
            exec(full_code, self.custom_functions)
            
            # Test the function with appropriate test values
            test_params = []
            for _ in params:
                test_params.append(1.0)  # Use float for better compatibility
                
            try:
                result = self.custom_functions[func.function_name](*test_params)
                if not isinstance(result, (int, float)):
                    frappe.throw(f"Function {func.function_name} must return a numeric value")
            except Exception as e:
                frappe.throw(f"Function {func.function_name} failed test execution: {str(e)}")
            
        except Exception as e:
            frappe.log_error(
                f"Error loading custom function {func.function_name}: {str(e)}"
            )