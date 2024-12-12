import frappe
from frappe import _

def execute(filters=None):
    columns = get_columns()
    data = get_data(filters)
    return columns, data

def get_columns():
    return [
        {
            "fieldname": "date",
            "label": _("Date"),
            "fieldtype": "Date",
            "width": 100
        },
        {
            "fieldname": "document_type",
            "label": _("Document Type"),
            "fieldtype": "Data",
            "width": 120
        },
        {
            "fieldname": "document",
            "label": _("Document"),
            "fieldtype": "Dynamic Link",
            "options": "document_type",
            "width": 180
        },
        {
            "fieldname": "party",
            "label": _("Party"),
            "fieldtype": "Link",
            "options": "Party",
            "width": 120
        },
        {
            "fieldname": "project",
            "label": _("Project"),
            "fieldtype": "Link",
            "options": "Project",
            "width": 120
        },
        {
            "fieldname": "description",
            "label": _("Description"),
            "fieldtype": "Data",
            "width": 200
        },
        {
            "fieldname": "debit",
            "label": _("Debit"),
            "fieldtype": "Currency",
            "width": 120
        },
        {
            "fieldname": "credit",
            "label": _("Credit"),
            "fieldtype": "Currency",
            "width": 120
        },
        {
            "fieldname": "vat_account",
            "label": _("VAT Account"),
            "fieldtype": "Data",
            "width": 120
        },
        {
            "fieldname": "vat_debit",
            "label": _("VAT Debit"),
            "fieldtype": "Currency",
            "width": 120
        },
        {
            "fieldname": "vat_credit",
            "label": _("VAT Credit"),
            "fieldtype": "Currency",
            "width": 120
        }
    ]

def get_data(filters):
    data = []
    
    # Get Project Bills - always included as they are party/project specific
    bills = get_project_bills(filters)
    data.extend(bills)
    
    # Get Payment Vouchers - always included as they are party/project specific
    vouchers = get_payment_vouchers(filters)
    data.extend(vouchers)
    
    # Get Project Additional Items - only if no party filter is set
    if not filters.get("party"):
        project_items = get_project_additional_items(filters)
        data.extend(project_items)
    
    # Get RUA Additional Items - only if no party and no project filter is set
    if not filters.get("party") and not filters.get("project"):
        rua_items = get_rua_additional_items(filters)
        data.extend(rua_items)
    
    return data

def get_project_bills(filters):
    conditions = get_conditions(filters)
    
    bills = frappe.db.sql("""
        SELECT 
            DATE(date) as date,
            'Project Bill' as document_type,
            name as document,
            party,
            project,
            CONCAT(bill_type, ' - ', scope_description) as description,
            total,
            vat_amount,
            bill_type
        FROM `tabProject Bill`
        WHERE docstatus = 1
        AND bill_type IN ('Tax Invoice', 'Purchase Order')
        {conditions}
    """.format(conditions=conditions), filters, as_dict=1)
    
    processed_bills = []
    for bill in bills:
        # For Tax Invoice (Income)
        if bill.bill_type == 'Tax Invoice':
            processed_bills.append({
                'date': bill.date,
                'document_type': bill.document_type,
                'document': bill.document,
                'party': bill.party,
                'project': bill.project,
                'description': bill.description,
                'debit': bill.total + bill.vat_amount,  # Accounts Receivable
                'credit': 0,
                'vat_account': 'Output VAT',
                'vat_debit': 0,
                'vat_credit': bill.vat_amount
            })
            # Revenue entry
            processed_bills.append({
                'date': bill.date,
                'document_type': bill.document_type,
                'document': bill.document,
                'party': bill.party,
                'project': bill.project,
                'description': f"{bill.description} (Revenue)",
                'debit': 0,
                'credit': bill.total,  # Revenue amount excluding VAT
                'vat_account': None,
                'vat_debit': 0,
                'vat_credit': 0
            })
        # For Purchase Order (Expense)
        else:
            processed_bills.append({
                'date': bill.date,
                'document_type': bill.document_type,
                'document': bill.document,
                'party': bill.party,
                'project': bill.project,
                'description': bill.description,
                'debit': bill.total,  # Expense amount excluding VAT
                'credit': 0,
                'vat_account': 'Input VAT',
                'vat_debit': bill.vat_amount,
                'vat_credit': 0
            })
            # Accounts Payable entry
            processed_bills.append({
                'date': bill.date,
                'document_type': bill.document_type,
                'document': bill.document,
                'party': bill.party,
                'project': bill.project,
                'description': f"{bill.description} (Payable)",
                'debit': 0,
                'credit': bill.total + bill.vat_amount,
                'vat_account': None,
                'vat_debit': 0,
                'vat_credit': 0
            })
    
    return processed_bills

def get_payment_vouchers(filters):
    conditions = get_conditions(filters)
    
    vouchers = frappe.db.sql("""
        SELECT 
            DATE(date) as date,
            'Payment Voucher' as document_type,
            name as document,
            party,
            project,
            CONCAT(type, ' - ', IFNULL(ref, '')) as description,
            type,
            amount
        FROM `tabPayment Voucher`
        WHERE docstatus = 1
        {conditions}
    """.format(conditions=conditions), filters, as_dict=1)
    
    processed_vouchers = []
    for voucher in vouchers:
        if voucher.type == 'Receive':
            # Cash/Bank Entry
            processed_vouchers.append({
                'date': voucher.date,
                'document_type': voucher.document_type,
                'document': voucher.document,
                'party': voucher.party,
                'project': voucher.project,
                'description': f"{voucher.description} (Cash/Bank)",
                'debit': voucher.amount,
                'credit': 0,
                'vat_account': None,
                'vat_debit': 0,
                'vat_credit': 0
            })
            # Accounts Receivable Entry
            processed_vouchers.append({
                'date': voucher.date,
                'document_type': voucher.document_type,
                'document': voucher.document,
                'party': voucher.party,
                'project': voucher.project,
                'description': f"{voucher.description} (Receivable)",
                'debit': 0,
                'credit': voucher.amount,
                'vat_account': None,
                'vat_debit': 0,
                'vat_credit': 0
            })
        else:  # Pay
            # Accounts Payable Entry
            processed_vouchers.append({
                'date': voucher.date,
                'document_type': voucher.document_type,
                'document': voucher.document,
                'party': voucher.party,
                'project': voucher.project,
                'description': f"{voucher.description} (Payable)",
                'debit': voucher.amount,
                'credit': 0,
                'vat_account': None,
                'vat_debit': 0,
                'vat_credit': 0
            })
            # Cash/Bank Entry
            processed_vouchers.append({
                'date': voucher.date,
                'document_type': voucher.document_type,
                'document': voucher.document,
                'party': voucher.party,
                'project': voucher.project,
                'description': f"{voucher.description} (Cash/Bank)",
                'debit': 0,
                'credit': voucher.amount,
                'vat_account': None,
                'vat_debit': 0,
                'vat_credit': 0
            })
    
    return processed_vouchers

def get_project_additional_items(filters):
    conditions = get_conditions(filters, "p")
    
    items = frappe.db.sql("""
        SELECT 
            DATE(i.creation) as date,
            'Project' as document_type,
            p.name as document,
            NULL as party,
            p.name as project,
            i.item,
            i.description,
            i.amount,
            COALESCE(NULLIF(i.vat, 0), 5) as vat
        FROM `tabProject` p
        JOIN `tabItems` i ON i.parent = p.name 
            AND i.parenttype = 'Project'
            AND i.parentfield = 'additional_items'
        WHERE 1=1
        {conditions}
    """.format(conditions=conditions), filters, as_dict=1)
    
    processed_items = []
    for item in items:
        vat_percent = item.vat
        total_amount = item.amount
        # For tax inclusive amounts, we need to extract the VAT
        base_amount = total_amount / (1 + (vat_percent / 100))
        vat = total_amount - base_amount
        
        # Expense Entry
        processed_items.append({
            'date': item.date,
            'document_type': item.document_type,
            'document': item.document,
            'party': item.party,
            'project': item.project,
            'description': f"{item.item}: {item.description}" if item.description else item.item,
            'debit': base_amount,
            'credit': 0,
            'vat_account': 'Input VAT',
            'vat_debit': vat,
            'vat_credit': 0
        })
        
        # Cash/Bank Entry (assuming direct payment)
        processed_items.append({
            'date': item.date,
            'document_type': item.document_type,
            'document': item.document,
            'party': item.party,
            'project': item.project,
            'description': f"{item.item}: {item.description} (Payment)" if item.description else f"{item.item} (Payment)",
            'debit': 0,
            'credit': total_amount,
            'vat_account': None,
            'vat_debit': 0,
            'vat_credit': 0
        })
    
    return processed_items

def get_rua_additional_items(filters):
    conditions = get_conditions(filters, "r")
    
    items = frappe.db.sql("""
        SELECT 
            DATE(i.creation) as date,
            'RUA' as document_type,
            'RUA Company' as document,
            NULL as party,
            NULL as project,
            i.description,
            i.amount as total_amount,
            COALESCE(NULLIF(i.vat, 0), 5) as vat
        FROM `tabItems` i 
        WHERE i.parent = 'Rua' 
        AND i.parenttype = 'Rua'
        {conditions}
    """.format(conditions=conditions), filters, as_dict=1)
    
    processed_items = []
    for item in items:
        vat_percent = item.vat
        total_amount = item.total_amount
        # For tax inclusive amounts, we need to extract the VAT
        base_amount = total_amount / (1 + (vat_percent / 100))
        vat = total_amount - base_amount
        
        # Expense Entry
        processed_items.append({
            'date': item.date,
            'document_type': item.document_type,
            'document': item.document,
            'party': item.party,
            'project': item.project,
            'description': item.description,
            'debit': base_amount,
            'credit': 0,
            'vat_account': 'Input VAT',
            'vat_debit': vat,
            'vat_credit': 0
        })
        
        # Cash/Bank Entry (assuming direct payment)
        processed_items.append({
            'date': item.date,
            'document_type': item.document_type,
            'document': item.document,
            'party': item.party,
            'project': item.project,
            'description': f"{item.description} (Payment)",
            'debit': 0,
            'credit': total_amount,
            'vat_account': None,
            'vat_debit': 0,
            'vat_credit': 0
        })
    
    return processed_items

def get_conditions(filters, table_alias=None):
    conditions = []
    prefix = f"{table_alias}." if table_alias else ""
    
    if filters.get("from_date"):
        if table_alias in ['p', 'r']:
            conditions.append(f"i.creation >= %(from_date)s")
        else:
            conditions.append(f"{prefix}date >= %(from_date)s")
            
    if filters.get("to_date"):
        if table_alias in ['p', 'r']:
            conditions.append(f"i.creation <= %(to_date)s")
        else:
            conditions.append(f"{prefix}date <= %(to_date)s")
            
    if filters.get("party"):
        if table_alias == 'p':
            # Skip party filter for project additional items
            pass
        elif table_alias == 'r':
            pass
        else:
            conditions.append(f"{prefix}party = %(party)s")
            
    if filters.get("project"):
        if table_alias == 'r':
            pass
        elif table_alias == 'p':
            conditions.append("p.name = %(project)s")
        else:
            conditions.append(f"{prefix}project = %(project)s")
        
    return " AND " + " AND ".join(conditions) if conditions else ""