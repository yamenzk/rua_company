# Copyright (c) 2024, Yamen Zakhour and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document
import math
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment
from openpyxl.utils import get_column_letter
import base64
from io import BytesIO
import json
import re


class Project(Document):
    def validate(self):
        # Handle serial number for In Progress projects
        if self.status == "In Progress" and self.serial_number == 0:
            # Get the highest serial number
            highest_serial = frappe.db.get_value(
                "Project",
                {"serial_number": (">", 0)},
                "serial_number",
                order_by="serial_number desc"
            )
            
            # Assign next serial number
            self.serial_number = (highest_serial or 0) + 1
    
    def before_save(self):
        self.calculate_all_values()
    
    def get_party(self, party_name):
        """Get party details from project"""
        return next((p for p in self.parties if p.party == party_name), None)
    
    #region "Calculations"
    def calculate_all_values(self):
        # Get unique scope numbers
        scope_numbers = set(item.scope_number for item in self.items if item.scope_number)
        
        # Calculate for each scope
        for scope_number in scope_numbers:
            scope = next((s for s in self.scopes if s.scope_number == scope_number), None)
            if not scope:
                continue
                
            scope_items = [item for item in self.items if item.scope_number == scope_number]
            
            # Calculate aluminum ratio first
            ratio = self.calculate_aluminum_ratio(scope, scope_items)
            scope.ratio = ratio
            
            # Calculate values for each item
            for item in scope_items:
                self.calculate_item_values(item, scope, ratio)
            
            # Update scope totals
            self.update_scope_totals(scope, scope_items)
        
        # Calculate financial totals
        self.calculate_financial_totals()
    
    def calculate_aluminum_ratio(self, scope, scope_items):
        # Calculate x (sum of VAT amounts)
        x = sum((item.aluminum_price or 0) * (scope.vat or 0) / 100 
                for item in scope_items)
        
        # Calculate y (sum of aluminum_price * qty)
        y = sum((item.aluminum_price or 0) * (item.qty or 0) 
                for item in scope_items)
        
        # Calculate total
        total = ((scope.aluminum_weight or 0) * (scope.sdf or 0)) + y + x
        
        # Calculate ratio and round to 3 decimal places
        ratio = round(total / y, 3) if y > 0 else 1
        return ratio
    
    def calculate_item_values(self, item, scope, ratio):
        # Calculate area and glass values
        if item.width >= 0 and item.height >= 0:
            item.area = (item.width * item.height) / 10000
            
            if item.glass_unit >= 0:
                glass_price = item.glass_unit * item.area * (1 + (scope.vat or 0) / 100)
                item.glass_price = glass_price
                item.total_glass = glass_price * (item.qty or 0)
        
        # Calculate aluminum price
        item.aluminum_price = (
            (item.curtain_wall or 0) +
            (item.insertion_1 or 0) +
            (item.insertion_2 or 0) +
            (item.insertion_3 or 0) +
            (item.insertion_4 or 0)
        )
        
        # Calculate remaining values
        item.aluminum_unit = item.aluminum_price * ratio
        item.total_aluminum = item.aluminum_unit * (item.qty or 0)
        
        # Include labour_charges in actual_unit calculation
        item.actual_unit = item.aluminum_unit + (item.glass_price or 0) + (scope.labour_charges or 0)
        item.total_profit = item.actual_unit * ((item.profit_percentage or 0) / 100)
        item.total_cost = item.actual_unit * (item.qty or 0)
        item.actual_unit_rate = item.total_profit + item.actual_unit
        
        # Calculate overall price with optional rounding
        overall_price = item.actual_unit_rate * (item.qty or 0)
        if scope.rounding == "Round up to nearest 5":
            overall_price = math.ceil(overall_price / 5) * 5
        item.overall_price = overall_price
    
    def update_scope_totals(self, scope, scope_items):
        scope.total_price = sum(item.overall_price or 0 for item in scope_items)
        scope.total_cost = sum(item.total_cost or 0 for item in scope_items)
        scope.total_profit = sum((item.total_profit or 0) * (item.qty or 0) for item in scope_items)
        scope.total_items = sum(item.qty or 0 for item in scope_items)
    
    def calculate_financial_totals(self):
        """Calculate all financial totals for the project"""
        from frappe.utils import flt
        
        # Calculate totals from child tables
        self.total_proformas = sum(flt(d.grand_total) for d in self.proformas)
        self.total_invoices = sum(flt(d.grand_total) for d in self.invoices)
        self.total_expenses = sum(flt(d.grand_total) for d in self.lpos)
        self.total_received = sum(flt(d.amount) for d in self.received_table)
        
        # Calculate total paid including additional expenses
        total_payments = sum(flt(d.amount) for d in self.paid_table)
        self.total_paid = flt(total_payments) + flt(self.total_additional_expenses)
        
        # Calculate receivables and payables
        # Only consider tax invoices for receivables, not proformas
        self.total_receivable = flt(self.total_invoices)
        self.total_payable = flt(self.total_expenses) + flt(self.total_additional_expenses)
        
        # Calculate dues
        self.due_receivables = flt(self.total_receivable) - flt(self.total_received)
        self.due_payables = flt(self.total_payable) - flt(self.total_paid)
        
        # Calculate project value and profit
        self.total_project_value = flt(self.total_receivable) + flt(self.total_payable)
        self.project_profit = flt(self.total_receivable) - flt(self.total_payable)
        
        # Calculate profit percentage
        if self.total_payable:
            self.profit_percentage = (flt(self.project_profit) / flt(self.total_payable)) * 100
        else:
            self.profit_percentage = 0
    #endregion

#region Excel Import

@frappe.whitelist()
def get_import_template(scope):
    scope = json.loads(scope)
    
    # Get project details
    project = frappe.get_doc('Project', scope.get('parent'))
    
    # Create a new workbook and select the active sheet
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Items Import"
    
    # Branding
    ws.merge_cells('A1:L2')
    brand_cell = ws.cell(row=1, column=1, value="Rua Company Aluminum & Glass Works")
    brand_cell.font = Font(size=16, bold=True)
    brand_cell.alignment = Alignment(horizontal='center', vertical='center')
    brand_cell.fill = PatternFill(start_color="FBC418", end_color="FBC418", fill_type="solid")
    
    # Project Info
    project_info_fill = PatternFill(start_color="FFFAE6", end_color="FFFAE6", fill_type="solid")
    
    # Project Name
    ws.merge_cells('A3:L3')
    project_cell = ws.cell(row=3, column=1, 
                          value=f"Project: {project.project_name}")
    project_cell.font = Font(size=12, bold=True)
    project_cell.alignment = Alignment(horizontal='center')
    project_cell.fill = project_info_fill
    
    # Location and Serial Number in the same row
    ws.merge_cells('A4:F4')
    location_cell = ws.cell(row=4, column=1,
                           value=f"Location: {project.location}")
    location_cell.font = Font(size=11)
    location_cell.alignment = Alignment(horizontal='center')
    location_cell.fill = project_info_fill
    
    ws.merge_cells('G4:L4')
    serial_cell = ws.cell(row=4, column=7,
                         value=f"Serial No: {project.serial_number or 'Not Assigned'}")
    serial_cell.font = Font(size=11)
    serial_cell.alignment = Alignment(horizontal='center')
    serial_cell.fill = project_info_fill
    
    # Add spacing
    ws.merge_cells('A5:L5')
    
    # Scope Info
    ws.merge_cells('A6:L6')
    scope_cell = ws.cell(row=6, column=1, 
                        value=f"Scope {scope['scope_number']}{' - ' + scope['description'] if scope.get('description') else ''}")
    scope_cell.font = Font(size=12, bold=True)
    scope_cell.alignment = Alignment(horizontal='center')
    scope_cell.fill = project_info_fill
    
    # Add spacing
    ws.merge_cells('A7:L7')
    
    # Define headers
    headers = [
        'Item*', 'Description', 'Qty*', 'Width*', 'Height*', 'Glass Unit', 
        'Curtain Wall*', 'Insertion 1', 'Insertion 2', 'Insertion 3', 'Insertion 4', 
        'Profit Percentage'
    ]
    
    # Style for headers
    header_fill = PatternFill(start_color="FBC418", end_color="FBC418", fill_type="solid")
    header_font = Font(bold=True, color="000000")  # Black text
    
    # Write headers
    header_row = 8
    for col, header in enumerate(headers, 1):
        cell = ws.cell(row=header_row, column=col, value=header)
        cell.fill = header_fill
        cell.font = header_font
        cell.alignment = Alignment(horizontal='center')
        ws.column_dimensions[get_column_letter(col)].width = 15
    
    # Instructions sheet
    instructions = wb.create_sheet("Instructions")
    notes = [
        ("Required Fields:", "Fields marked with * are mandatory"),
        ("Measurements:", "Width and Height should be in millimeters"),
        ("Glass Unit:", "Will use scope's default value if not provided"),
        ("Profit Percentage:", "Will use scope's default value if not provided"),
        ("Important:", "Only modify the data rows in the 'Items Import' sheet"),
        ("", "Do not modify headers or add rows above the headers")
    ]
    
    # Style for notes sheet
    instructions.merge_cells('A1:D1')
    title_cell = instructions.cell(row=1, column=1, value="Instructions & Notes")
    title_cell.font = Font(size=14, bold=True)
    title_cell.alignment = Alignment(horizontal='center')
    title_cell.fill = PatternFill(start_color="FBC418", end_color="FBC418", fill_type="solid")
    
    # Add notes with better formatting
    for i, (title, content) in enumerate(notes, 3):
        if title:
            title_cell = instructions.cell(row=i, column=1, value=title)
            title_cell.font = Font(bold=True)
            title_cell.fill = PatternFill(start_color="FFFAE6", end_color="FFFAE6", fill_type="solid")
        content_cell = instructions.cell(row=i, column=2, value=content)
        content_cell.alignment = Alignment(wrap_text=True)
    
    # Adjust column widths in notes sheet
    instructions.column_dimensions['A'].width = 20
    instructions.column_dimensions['B'].width = 60
    
    # Save to BytesIO
    excel_file = BytesIO()
    wb.save(excel_file)
    excel_file.seek(0)
    
    # Generate filename
    filename = f"RUA_{project.project_name}_{project.serial_number or 'NO_SERIAL'}_{scope['scope_number']}.xlsx"
    filename = re.sub(r'[^\w\-_.]', '_', filename)  # Replace invalid characters with underscore
    
    # Convert to base64
    content = base64.b64encode(excel_file.getvalue()).decode('utf-8')
    
    return {
        'filename': filename,
        'content': content
    }

@frappe.whitelist()
def import_items_from_excel(file_url, scope):
    try:
        scope = json.loads(scope)
        
        # Get the file document
        file_doc = frappe.get_doc("File", {"file_url": file_url})
        file_path = file_doc.get_full_path()
        
        # Read the Excel file
        wb = openpyxl.load_workbook(filename=file_path, data_only=True)
        ws = wb.active
        
        items = []
        # Start from row 9 (right after headers)
        for row in ws.iter_rows(min_row=9):
            # Skip empty rows
            if not any(cell.value for cell in row):
                continue
                
            try:
                # Get glass unit and profit from scope if not provided in Excel
                excel_glass_unit = row[5].value
                excel_profit = row[11].value
                
                glass_unit = excel_glass_unit if excel_glass_unit not in [None, ''] else scope.get('glass_sqm_price')
                profit_percentage = float(excel_profit) if excel_profit not in [None, ''] else float(scope.get('profit', 0))
                
                item_data = {
                    'doctype': 'Project Items',
                    'parenttype': 'Project',
                    'parentfield': 'items',
                    'parent': scope.get('parent'),
                    'item': row[0].value,
                    'description': row[1].value or '',
                    'qty': float(row[2].value or 0),
                    'width': float(row[3].value or 0),
                    'height': float(row[4].value or 0),
                    'glass_unit': glass_unit,
                    'curtain_wall': row[6].value or 0,
                    'insertion_1': row[7].value or 0,
                    'insertion_2': row[8].value or 0,
                    'insertion_3': row[9].value or 0,
                    'insertion_4': row[10].value or 0,
                    'profit_percentage': profit_percentage,
                    'scope_number': scope.get('scope_number')
                }
                
                # Validate required fields
                if not all([item_data['item'], item_data['qty'], item_data['width'], item_data['height']]):
                    raise ValueError(f"Missing required fields in row {row[0].row}")
                    
                items.append(item_data)
            except (ValueError, TypeError) as e:
                frappe.throw(f"Error in row {row[0].row}: {str(e)}. Please check that all numeric fields contain valid numbers.")
        
        if not items:
            frappe.throw("No valid items found in the Excel file")
            
        # Get the project document
        project = frappe.get_doc('Project', scope.get('parent'))
        
        # Add items to the project
        for item in items:
            project.append('items', item)
        
        # Save the project
        project.save()
        
        return {
            "message": f"Successfully imported {len(items)} items",
            "items": items
        }
    except Exception as e:
        frappe.throw(f"Error processing Excel file: {str(e)}")

#endregion

#region Document Generation

@frappe.whitelist()
def make_project_bill(source_name, target_doc=None):
    args = json.loads(frappe.form_dict.args)
    bill_type = args.get("bill_type")
    scope = args.get("scope", 1)  # Default to 1 if not specified
    send_rfq_link = args.get("send_rfq_link", 0)
    url = args.get("url")
    selected_items = args.get("selected_items", [])
    party = args.get("party")  # Get selected party
    
    source_doc = frappe.get_doc("Project", source_name)
    
    # Create a new Project Bill
    doclist = frappe.new_doc("Project Bill")
    doclist.project = source_doc.name
    doclist.serial_number = source_doc.serial_number
    doclist.date = frappe.utils.nowdate()
    doclist.bill_type = bill_type
    doclist.scope = scope
    
    # Set the selected party as the main party
    if party:
        doclist.party = party
    
    # Handle scope description
    if str(scope) == "0":
        # All Scopes case
        doclist.scope_description = f"Project {source_doc.name}: All Scopes"
    elif source_doc.scopes:
        # Single scope case
        scope_row = next((s for s in source_doc.scopes if str(s.scope_number) == str(scope)), None)
        if scope_row:
            doclist.scope_description = scope_row.description
    
    # Move VAT from the first row of the scopes table
    if source_doc.scopes:
        first_scope_vat = source_doc.scopes[0].vat  # Get VAT from the first scope row
        doclist.vat = first_scope_vat  # Add it to the doclist
    
    
    # Handle items based on bill type
    if bill_type == "Request for Quotation":
        if send_rfq_link:
            # RFQ from link case
            doclist.send_rfq_link = 1
            doclist.url = url
        elif selected_items:
            # RFQ from items case
            for item in selected_items:
                doclist.append("items", {
                    "item": item.get("item"),
                    "description": item.get("description"),
                    "qty": item.get("qty"),
                    "width": item.get("width"),
                    "height": item.get("height")
                })
    elif bill_type == "Purchase Order" and selected_items:
        # Purchase Order case
        for item in selected_items:
            doclist.append("items", {
                "item": item.get("item"),
                "description": item.get("description"),
                "qty": item.get("qty"),
                "width": item.get("width"),
                "height": item.get("height"),
                "rate": item.get("rate")
            })
    elif bill_type == "Quotation" and source_doc.items:
        # Existing Quotation logic
        for item in source_doc.items:
            if str(scope) == "0" or str(item.scope_number) == str(scope):
                doclist.append("items", {
                    "item": item.item,
                    "description": item.description,
                    "qty": item.qty,
                    "width": item.width,
                    "height": item.height,
                    "rate": item.actual_unit_rate
                })
    elif bill_type in ["Proforma", "Tax Invoice"]:
        if str(scope) == "0" and len(source_doc.scopes) > 1:
            # All Scopes case - create an item for each scope
            for scope_row in source_doc.scopes:
                doclist.append("items", {
                    "item": source_doc.name,
                    "description": scope_row.description,
                    "qty": 1,
                    "rate": scope_row.total_price or 0
                })
        else:
            # Single scope case
            description = "Supply & Installation of Glass and Aluminum Works"
            if source_doc.scopes:
                scope_row = next((s for s in source_doc.scopes if str(s.scope_number) == str(scope)), None)
                if scope_row and scope_row.description:
                    description = scope_row.description
                    rate = scope_row.total_price or 0
                else:
                    rate = 0
            else:
                rate = 0
                
            doclist.append("items", {
                "item": source_doc.name,
                "description": description,
                "qty": 1,
                "rate": rate
            })
    
    doclist.calculate_amounts()
    doclist.calculate_totals()
    return doclist

@frappe.whitelist()
def make_payment_voucher(source_name, target_doc=None):
    """Create a Payment Voucher from Project"""
    # Get args from form_dict
    args = frappe.form_dict.get('args')
    if args:
        try:
            args = json.loads(args)
            party = args.get('party')
            outstanding_amount = float(args.get('outstanding_amount', 0))
        except:
            party = None
            outstanding_amount = 0
    else:
        party = None
        outstanding_amount = 0

    if not party:
        frappe.throw("Party is required to create Payment Voucher")

    project = frappe.get_doc("Project", source_name)
    party_doc = project.get_party(party)
    if not party_doc:
        frappe.throw(f"Party {party} not found in project {source_name}")

    target = frappe.new_doc("Payment Voucher")
    target.project = source_name
    target.party = party
    target.type = "Pay" if party_doc.type == "Supplier" else "Receive"
    
    # Set amount based on outstanding
    if outstanding_amount != 0:
        target.amount = abs(outstanding_amount)  # Always use positive amount
        
    return target

@frappe.whitelist()
def get_party_outstanding_amounts(project, parties):
    """Get outstanding amounts for multiple parties"""
    parties = frappe.parse_json(parties)
    result = {}
    
    for party_data in parties:
        party = party_data.get('party')
        party_type = party_data.get('type')
        
        if party_type == 'Client':
            # Get total of submitted Tax Invoices
            total_billed = frappe.db.sql("""
                SELECT COALESCE(SUM(grand_total), 0) as total
                FROM `tabProject Bill`
                WHERE project = %s
                AND party = %s
                AND bill_type = 'Tax Invoice'
                AND docstatus = 1
            """, (project, party))[0][0]
            
            # Get total received payments
            total_paid = frappe.db.sql("""
                SELECT COALESCE(SUM(amount), 0) as total
                FROM `tabPayment Voucher`
                WHERE project = %s
                AND party = %s
                AND type = 'Receive'
                AND docstatus = 1
            """, (project, party))[0][0]
            
        else:  # Supplier
            # Get total of submitted Purchase Orders
            total_billed = frappe.db.sql("""
                SELECT COALESCE(SUM(grand_total), 0) as total
                FROM `tabProject Bill`
                WHERE project = %s
                AND party = %s
                AND bill_type = 'Purchase Order'
                AND docstatus = 1
            """, (project, party))[0][0]
            
            # Get total paid to supplier
            total_paid = frappe.db.sql("""
                SELECT COALESCE(SUM(amount), 0) as total
                FROM `tabPayment Voucher`
                WHERE project = %s
                AND party = %s
                AND type = 'Pay'
                AND docstatus = 1
            """, (project, party))[0][0]
        
        result[party] = total_billed - total_paid
    
    return result

#endregion

@frappe.whitelist()
def refresh_all_tables(project):
    """Clear and repopulate all child tables in the project"""
    doc = frappe.get_doc("Project", project)
    
    # Clear all child tables
    doc.quotation_drafts = []
    doc.quotations = []
    doc.rfq_drafts = []
    doc.rfqs = []
    doc.proforma_drafts = []
    doc.proformas = []
    doc.lpo_drafts = []
    doc.lpos = []
    doc.invoice_drafts = []
    doc.invoices = []
    doc.received_table = []
    doc.paid_table = []
    
    # Save to clear tables
    doc.save()
    
    # Get all project bills sorted by creation date
    bills = frappe.get_all(
        "Project Bill",
        filters={
            "project": project,
            "docstatus": ["in", [0, 1]]  # Get both drafts and submitted
        },
        fields=["name", "docstatus", "creation"],
        order_by="creation asc"  # Sort by creation date, oldest first
    )
    
    # Update project tables for each bill
    for bill in bills:
        bill_doc = frappe.get_doc("Project Bill", bill.name)
        bill_doc.update_project_tables()
    
    # Get all payment vouchers sorted by creation date
    vouchers = frappe.get_all(
        "Payment Voucher",
        filters={
            "project": project,
            "docstatus": 1  # Only get submitted vouchers
        },
        fields=["name", "creation"],
        order_by="creation asc"  # Sort by creation date, oldest first
    )
    
    # Update project tables for each voucher
    for voucher in vouchers:
        voucher_doc = frappe.get_doc("Payment Voucher", voucher.name)
        voucher_doc.update_project_tables()
    
    return True
