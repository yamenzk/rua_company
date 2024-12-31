__version__ = "1.2.0"

import frappe
from frappe.utils.pdf import get_pdf
from rua_company.utils.pdf import get_pdf as get_pdf_gc

def pdf(*args, **kwargs):
    return get_pdf_gc(*args, **kwargs)

frappe.utils.pdf.get_pdf = pdf