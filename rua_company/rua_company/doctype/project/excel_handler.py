import frappe
from frappe.utils import cstr, flt
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side, Color
from openpyxl.utils import get_column_letter
import json

@frappe.whitelist()
def get_items_template(project_name):
    project = frappe.get_doc("Project", project_name)
    wb = openpyxl.Workbook()
    
    # Remove default sheet
    wb.remove(wb.active)
    
    # Style definitions
    header_fill = PatternFill(start_color="1F497D", end_color="1F497D", fill_type="solid")
    header_font = Font(color="FFFFFF", bold=True)
    header_alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
    settings_fill = PatternFill(start_color="E6E6E6", end_color="E6E6E6", fill_type="solid")
    settings_font = Font(bold=True)
    settings_border = Border(
        left=Side(style='thin'),
        right=Side(style='thin'),
        top=Side(style='thin'),
        bottom=Side(style='thin')
    )
    border = Border(
        left=Side(style='thin'),
        right=Side(style='thin'),
        top=Side(style='thin'),
        bottom=Side(style='thin')
    )

    # Group items by scope
    items_by_scope = {}
    for item in project.items:
        items_by_scope.setdefault(str(item.scope_number), []).append(item)

    # Create a sheet for each scope
    for scope in project.scopes:
        ws = wb.create_sheet(title=f"Scope {scope.scope_number}")
        
        # Add scope settings section
        ws.merge_cells('A1:B1')
        header_cell = ws.cell(row=1, column=1, value="Scope Settings")
        header_cell.fill = header_fill
        header_cell.font = header_font
        header_cell.alignment = header_alignment
        header_cell.border = border

        current_row = 2
        settings = [
            ("Type", scope.type),
            ("VAT %", flt(scope.vat, 2)),
            ("Labour Charges", flt(scope.labour_charges, 2)),
            ("Retention %", flt(scope.retention, 2)),
            ("Rounding", scope.rounding or "None"),
        ]

        # Add type-specific settings for Openings/Skylights
        if scope.type in ["Openings", "Skylights"]:
            settings.extend([
                ("Glass SQM Price", flt(scope.glass_sqm_price, 2)),
                ("Aluminum Weight", flt(scope.aluminum_weight, 2)),
                ("Powder Coating (SDF)", flt(scope.sdf, 2)),
            ])

        # Write settings
        for setting in settings:
            label_cell = ws.cell(row=current_row, column=1, value=setting[0])
            value_cell = ws.cell(row=current_row, column=2, value=setting[1])
            
            for cell in [label_cell, value_cell]:
                cell.fill = settings_fill
                cell.font = settings_font
                cell.border = settings_border
                cell.alignment = Alignment(horizontal="left")
            
            current_row += 1

        # Add a blank row for spacing
        current_row += 1
        
        # Common columns for all types
        base_columns = ["Item", "Description", "Quantity", "Actual Unit Rate", "Profit %"]
        
        # Define columns based on scope type
        if scope.type in ["Openings", "Skylights"]:
            columns = [
                *base_columns,
                "Width (cm)", "Height (cm)", 
                "Manual Area", "Area", "Glass Unit",
                "Curtain Wall", "Insertion 1", "Insertion 2", 
                "Insertion 3", "Insertion 4"
            ]
        elif scope.type in ["Handrails", "Cladding"]:
            columns = base_columns
        else:
            columns = [*base_columns, "Area"]

        # Write column headers
        header_row = current_row
        for col, header in enumerate(columns, 1):
            cell = ws.cell(row=header_row, column=col, value=header)
            cell.fill = header_fill
            cell.font = header_font
            cell.alignment = header_alignment
            cell.border = border
            ws.column_dimensions[get_column_letter(col)].width = 15

        # Write existing items
        current_row = header_row + 1
        scope_items = items_by_scope.get(str(scope.scope_number), [])
        
        for item in scope_items:
            col = 1
            # Write base columns
            ws.cell(row=current_row, column=col, value=item.item).border = border; col += 1
            ws.cell(row=current_row, column=col, value=item.description).border = border; col += 1
            ws.cell(row=current_row, column=col, value=item.qty).border = border; col += 1
            ws.cell(row=current_row, column=col, value=item.actual_unit_rate).border = border; col += 1
            ws.cell(row=current_row, column=col, value=item.profit_percentage).border = border; col += 1
            
            # Write type-specific columns
            if scope.type in ["Openings", "Skylights"]:
                ws.cell(row=current_row, column=col, value=item.width).border = border; col += 1
                ws.cell(row=current_row, column=col, value=item.height).border = border; col += 1
                ws.cell(row=current_row, column=col, value=1 if item.manual_area else 0).border = border; col += 1
                ws.cell(row=current_row, column=col, value=item.area).border = border; col += 1
                ws.cell(row=current_row, column=col, value=item.glass_unit).border = border; col += 1
                ws.cell(row=current_row, column=col, value=item.curtain_wall).border = border; col += 1
                ws.cell(row=current_row, column=col, value=item.insertion_1).border = border; col += 1
                ws.cell(row=current_row, column=col, value=item.insertion_2).border = border; col += 1
                ws.cell(row=current_row, column=col, value=item.insertion_3).border = border; col += 1
                ws.cell(row=current_row, column=col, value=item.insertion_4).border = border; col += 1
            elif scope.type not in ["Handrails", "Cladding"]:
                ws.cell(row=current_row, column=col, value=item.area).border = border; col += 1
            
            current_row += 1

        # Freeze the header row
        ws.freeze_panes = ws.cell(row=header_row+1, column=1)

    return save_workbook_and_get_url(wb, project_name)

def save_workbook_and_get_url(wb, project_name):
    file_name = f"project_items_template_{project_name}.xlsx"
    file_path = frappe.get_site_path('private', 'files', file_name)
    
    wb.save(file_path)
    
    # Create a File document
    file_doc = frappe.get_doc({
        "doctype": "File",
        "file_name": file_name,
        "folder": "Home/Attachments",
        "is_private": 1,
        "file_url": f"/private/files/{file_name}"
    })
    file_doc.insert(ignore_permissions=True)
    
    return file_doc.file_url

@frappe.whitelist()
def import_items_from_excel(project_name, file_url):
    project = frappe.get_doc("Project", project_name)
    file_doc = frappe.get_doc("File", {"file_url": file_url})
    file_path = file_doc.get_full_path()
    
    wb = openpyxl.load_workbook(file_path, data_only=True)
    
    # Clear existing items
    project.items = []
    
    items_to_add = []
    for sheet in wb.worksheets:
        scope_number = sheet.title.replace("Scope ", "")
        scope = next((s for s in project.scopes if str(s.scope_number) == scope_number), None)
        if not scope:
            continue
            
        # Skip settings rows and get headers
        data_start_row = 1
        for row_idx in range(1, sheet.max_row + 1):
            if sheet.cell(row=row_idx, column=1).value == "Item":
                data_start_row = row_idx
                break
        
        headers = [cell.value for cell in sheet[data_start_row]]
        
        for row in sheet.iter_rows(min_row=data_start_row + 1):
            if not any(cell.value for cell in row):  # Skip empty rows
                continue
                
            item_dict = {
                "doctype": "Project Item",
                "scope_number": scope_number,
                "parenttype": "Project",
                "parentfield": "items",
                "parent": project_name
            }
            
            for idx, cell in enumerate(row):
                header = headers[idx]
                if header == "Item" and cell.value:
                    item_dict["item"] = cell.value
                elif header == "Description" and cell.value:
                    item_dict["description"] = cell.value
                elif header == "Quantity" and cell.value:
                    item_dict["qty"] = float(cell.value)
                elif header == "Actual Unit Rate" and cell.value:
                    item_dict["actual_unit_rate"] = float(cell.value)
                elif header == "Profit %" and cell.value:
                    item_dict["profit_percentage"] = float(cell.value)
                elif header == "Width (cm)" and cell.value:
                    item_dict["width"] = float(cell.value)
                elif header == "Height (cm)" and cell.value:
                    item_dict["height"] = float(cell.value)
                elif header == "Manual Area" and cell.value:
                    item_dict["manual_area"] = int(cell.value)
                elif header == "Area" and cell.value:
                    item_dict["area"] = float(cell.value)
                elif header == "Glass Unit" and cell.value:
                    item_dict["glass_unit"] = float(cell.value)
                elif header == "Curtain Wall" and cell.value:
                    item_dict["curtain_wall"] = float(cell.value)
                elif header == "Insertion 1" and cell.value:
                    item_dict["insertion_1"] = float(cell.value)
                elif header == "Insertion 2" and cell.value:
                    item_dict["insertion_2"] = float(cell.value)
                elif header == "Insertion 3" and cell.value:
                    item_dict["insertion_3"] = float(cell.value)
                elif header == "Insertion 4" and cell.value:
                    item_dict["insertion_4"] = float(cell.value)
            
            if item_dict.get("item"):  # Only add if we have at least an item name
                items_to_add.append(item_dict)
    
    if items_to_add:
        project.extend("items", items_to_add)
        project.save()
        
    return {"message": f"Successfully imported {len(items_to_add)} items"}
