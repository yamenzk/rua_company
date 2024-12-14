# Copyright (c) 2024, Yamen Zakhour and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document
from frappe.utils import flt
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
        """Optimized calculation of all values"""
        # Create lookup dictionaries to avoid repeated searches
        scope_dict = {s.scope_number: s for s in self.scopes}
        items_by_scope = {}
        
        # Group items by scope in a single pass
        for item in self.items:
            if item.scope_number:
                items_by_scope.setdefault(item.scope_number, []).append(item)
        
        # Pre-calculate common values used across scopes
        for scope_number, scope_items in items_by_scope.items():
            scope = scope_dict.get(scope_number)
            if not scope:
                continue

            # Pre-calculate scope-level values
            vat = scope.vat or 0
            vat_inclusive = scope.vat_inclusive
            vat_factor = 1 + (vat / 100)
            labour_charges = scope.labour_charges or 0
            
            # Calculate ratio once per scope
            ratio = self.calculate_aluminum_ratio_optimized(scope, scope_items, vat_factor, vat_inclusive)
            scope.ratio = ratio
            
            # Bulk calculate items with pre-calculated values
            self.calculate_items_batch(scope_items, scope, ratio, vat, vat_inclusive, vat_factor, labour_charges)
            
            # Update scope totals with pre-calculated values
            self.update_scope_totals_optimized(scope, scope_items, vat_factor, vat_inclusive)
        
        # Calculate financial totals
        self.calculate_financial_totals_optimized()

    def calculate_aluminum_ratio_optimized(self, scope, scope_items, vat_factor, vat_inclusive):
        """Optimized aluminum ratio calculation"""
        aluminum_prices = [(item.aluminum_price or 0) for item in scope_items]
        quantities = [(item.qty or 0) for item in scope_items]
        
        # Calculate VAT amounts in bulk
        if vat_inclusive:
            x = sum(price - (price / vat_factor) for price in aluminum_prices)
        else:
            x = sum(price * (vat_factor - 1) for price in aluminum_prices)
        
        # Calculate y in bulk
        y = sum(price * qty for price, qty in zip(aluminum_prices, quantities))
        
        # Calculate total
        total = ((scope.aluminum_weight or 0) * (scope.sdf or 0)) + y + x
        
        return round(total / y, 3) if y > 0 else 1

    def calculate_items_batch(self, items, scope, ratio, vat, vat_inclusive, vat_factor, labour_charges):
        """Calculate values for a batch of items"""
        for item in items:
            # Calculate area only if needed
            if item.width >= 0 and item.height >= 0:
                area = (item.width * item.height) / 10000
                item.area = area
                
                if item.glass_unit >= 0:
                    vat_multiplier = 0 if vat_inclusive else vat
                    glass_price = item.glass_unit * area * (1 + (vat_multiplier / 100))
                    item.glass_price = glass_price
                    item.total_glass = glass_price * (item.qty or 0)
            
            # Calculate aluminum price in one operation
            item.aluminum_price = sum(
                getattr(item, field) or 0 
                for field in ['curtain_wall', 'insertion_1', 'insertion_2', 'insertion_3', 'insertion_4']
            )
            
            # Calculate remaining values in sequence to minimize recalculations
            qty = item.qty or 0
            aluminum_unit = item.aluminum_price * ratio
            item.aluminum_unit = aluminum_unit
            item.total_aluminum = aluminum_unit * qty
            
            actual_unit = aluminum_unit + (item.glass_price or 0) + labour_charges
            item.actual_unit = actual_unit
            
            profit_factor = (item.profit_percentage or 0) / 100
            item.total_profit = actual_unit * profit_factor
            item.total_cost = actual_unit * qty
            
            actual_unit_rate = item.total_profit + actual_unit
            item.actual_unit_rate = actual_unit_rate
            
            overall_price = actual_unit_rate * qty
            if scope.rounding == "Round up to nearest 5":
                overall_price = math.ceil(overall_price / 5) * 5
            item.overall_price = overall_price

    def update_scope_totals_optimized(self, scope, scope_items, vat_factor, vat_inclusive):
        """Optimized scope totals calculation"""
        # Calculate basic totals in bulk
        overall_prices = [item.overall_price or 0 for item in scope_items]
        total_costs = [item.total_cost or 0 for item in scope_items]
        quantities = [item.qty or 0 for item in scope_items]
        
        scope.total_price = sum(overall_prices)
        scope.total_cost = sum(total_costs)
        scope.total_profit = scope.total_price - scope.total_cost
        scope.total_items = sum(quantities)
        
        # Calculate VAT amount in bulk
        if vat_inclusive:
            total_vat = sum(price - (price / vat_factor) for price in overall_prices)
        else:
            total_vat = sum(price * (vat_factor - 1) for price in overall_prices)
        scope.total_vat_amount = total_vat
        
        # Calculate remaining values
        total_price_excluding_vat = scope.total_price - total_vat
        scope.total_price_excluding_vat = total_price_excluding_vat
        
        retention_factor = 1 - ((scope.retention or 0) / 100)
        price_after_retention = total_price_excluding_vat * retention_factor
        
        scope.price_after_retention = price_after_retention
        scope.vat_after_retention = price_after_retention * (scope.vat / 100)
        scope.total_price_after_retention = price_after_retention + scope.vat_after_retention

    def calculate_financial_totals_optimized(self):
        """Optimized financial totals calculation"""
        
        
        # Calculate all sums in one pass per table
        self.total_proformas = sum(flt(d.grand_total) for d in self.proformas)
        self.total_invoices = sum(flt(d.grand_total) for d in self.invoices)
        self.total_expenses = sum(flt(d.grand_total) for d in self.lpos)
        self.total_received = sum(flt(d.amount) for d in self.received_table)
        self.total_additional_expenses = sum(flt(d.amount) for d in self.additional_items)
        
        # Calculate derived values
        total_payments = sum(flt(d.amount) for d in self.paid_table)
        self.total_paid = flt(total_payments) + flt(self.total_additional_expenses)
        
        self.total_receivable = flt(self.total_invoices)
        self.total_payable = flt(self.total_expenses) + flt(self.total_additional_expenses)
        
        self.due_receivables = flt(self.total_receivable) - flt(self.total_received)
        self.due_payables = flt(self.total_payable) - flt(self.total_paid)
        
        self.total_project_value = flt(self.total_receivable) + flt(self.total_payable)
        self.project_profit = flt(self.total_receivable) - flt(self.total_payable)
        
        self.profit_percentage = (flt(self.project_profit) / flt(self.total_payable) * 100) if self.total_payable else 0
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
        
        # Calculate values before saving to ensure new items are included
        project.calculate_all_values()
        
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
    doclist.vat = frappe.db.get_single_value('Rua', 'vat')
    
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
    # Clear all child tables using SQL
    child_tables = ['Project Bills', 'Payments']
    
    for table in child_tables:
        frappe.db.sql("""
            DELETE FROM `tab{0}`
            WHERE parent = %s
        """.format(table), (project,))
    
    # Get all project bills sorted by creation date
    bills = frappe.db.sql("""
        SELECT 
            pb.name,
            pb.docstatus,
            pb.bill_type,
            pb.scope as scope,
            pb.date,
            pb.grand_total,
            pb.status,
            pb.party
        FROM `tabProject Bill` pb
        WHERE pb.project = %s
        AND pb.docstatus IN (0, 1)
        ORDER BY pb.creation
    """, (project,), as_dict=1)
    
    # Prepare bill data
    draft_table = {
        "Quotation": "quotation_drafts",
        "Request for Quotation": "rfq_drafts",
        "Proforma": "proforma_drafts",
        "Purchase Order": "lpo_drafts",
        "Tax Invoice": "invoice_drafts"
    }
    final_table = {
        "Quotation": "quotations",
        "Request for Quotation": "rfqs",
        "Proforma": "proformas",
        "Purchase Order": "lpos",
        "Tax Invoice": "invoices"
    }

    # Insert bill entries one by one
    for bill in bills:
        if bill.bill_type not in draft_table:
            continue
            
        table_field = draft_table[bill.bill_type] if bill.docstatus == 0 else final_table[bill.bill_type]
        frappe.db.sql("""
            INSERT INTO `tabProject Bills`
            (name, parent, parentfield, parenttype, bill, scope, bill_type, date, grand_total, status, party)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """, (
            frappe.generate_hash(),
            project,
            table_field,
            'Project',
            bill.name,
            bill.scope,
            bill.bill_type,
            bill.date,
            bill.grand_total,
            bill.status,
            bill.party
        ))

    # Get all payment vouchers
    vouchers = frappe.db.sql("""
        SELECT 
            name,
            date,
            type,
            amount
        FROM `tabPayment Voucher`
        WHERE project = %s
        AND docstatus = 1
        AND is_petty_cash = 0
        ORDER BY creation
    """, (project,), as_dict=1)

    # Insert voucher entries one by one
    for voucher in vouchers:
        table_name = "received_table" if voucher.type == "Receive" else "paid_table"
        frappe.db.sql("""
            INSERT INTO `tabPayments`
            (name, parent, parentfield, parenttype, voucher, date, type, amount)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        """, (
            frappe.generate_hash(),
            project,
            table_name,
            'Project',
            voucher.name,
            voucher.date,
            voucher.type,
            voucher.amount
        ))

    # Recalculate project totals
    project_doc = frappe.get_doc("Project", project)
    project_doc.calculate_financial_totals_optimized()

    # Update project fields
    frappe.db.sql("""
        UPDATE `tabProject`
        SET 
            total_proformas = %s,
            total_invoices = %s,
            total_expenses = %s,
            total_received = %s,
            total_additional_expenses = %s,
            total_paid = %s,
            total_receivable = %s,
            total_payable = %s,
            due_receivables = %s,
            due_payables = %s,
            total_project_value = %s,
            project_profit = %s,
            profit_percentage = %s
        WHERE name = %s
    """, (
        project_doc.total_proformas,
        project_doc.total_invoices,
        project_doc.total_expenses,
        project_doc.total_received,
        project_doc.total_additional_expenses,
        project_doc.total_paid,
        project_doc.total_receivable,
        project_doc.total_payable,
        project_doc.due_receivables,
        project_doc.due_payables,
        project_doc.total_project_value,
        project_doc.project_profit,
        project_doc.profit_percentage,
        project
    ))

    frappe.db.commit()
    return True