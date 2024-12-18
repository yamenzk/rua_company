import frappe
from frappe.utils import flt
import math


def calculate_all_values(doc):
    """Optimized calculation of all values"""
    # Create lookup dictionaries to avoid repeated searches
    scope_dict = {s.scope_number: s for s in doc.scopes}
    items_by_scope = {}

    # Group items by scope in a single pass
    for item in doc.items:
        if item.scope_number:
            items_by_scope.setdefault(item.scope_number, []).append(item)

    # Pre-calculate common values used across scopes
    for scope_number, scope_items in items_by_scope.items():
        scope = scope_dict.get(scope_number)
        if not scope:
            continue

        # Pre-calculate scope-level values
        vat = scope.vat or 0
        scope_type = scope.type
        vat_factor = 1 + (vat / 100)
        labour_charges = scope.labour_charges or 0

        # Calculate ratio once per scope
        ratio = calculate_aluminum_ratio_optimized(
            scope, scope_items, vat_factor)
        scope.ratio = ratio

        # Bulk calculate items with pre-calculated values
        calculate_items_batch(scope_items, scope, ratio,
                                vat, vat_factor, labour_charges)

        update_scope_totals_optimized(
            scope, scope_items, vat_factor)

    # Calculate financial totals
    calculate_financial_totals_optimized(doc)


def calculate_aluminum_ratio_optimized(scope, scope_items, vat_factor):
    """Optimized aluminum ratio calculation"""
    aluminum_prices = [(item.aluminum_price or 0) for item in scope_items]
    quantities = [(item.qty or 0) for item in scope_items]

    # Calculate VAT amounts in bulk
    x = sum(price * (vat_factor - 1) for price in aluminum_prices)

    # Calculate y in bulk
    y = sum(price * qty for price, qty in zip(aluminum_prices, quantities))

    # Calculate total
    total = ((scope.aluminum_weight or 0) * (scope.sdf or 0)) + y + x

    return round(total / y, 3) if y > 0 else 1


def calculate_items_batch(items, scope, ratio, vat, vat_factor, labour_charges):
    """Calculate values for a batch of items"""
    for item in items:
        # Calculate area based on manual flag
        if hasattr(item, 'manual_area') and item.manual_area:
            area = flt(item.area)
        elif hasattr(item, 'width') and hasattr(item, 'height') and item.width >= 0 and item.height >= 0:
            area = (item.width * item.height) / 10000
        else:
            area = 0
            
        item.area = area

        if hasattr(item, 'glass_unit') and item.glass_unit >= 0:
            vat_multiplier = vat
            glass_price = item.glass_unit * \
                area * (1 + (vat_multiplier / 100))
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


def update_scope_totals_optimized(scope, scope_items, vat_factor):
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
    total_vat = sum(price * (vat_factor - 1) for price in overall_prices)
    scope.total_vat_amount = total_vat

    # Calculate total price excluding VAT
    total_price_excluding_vat = scope.total_price - total_vat
    scope.total_price_excluding_vat = total_price_excluding_vat

    # Update total price for VAT exclusive case
    scope.total_price = total_price_excluding_vat + total_vat

    # Calculate retention and final VAT
    retention_factor = 1 - ((scope.retention or 0) / 100)
    price_after_retention = total_price_excluding_vat * retention_factor

    scope.price_after_retention = price_after_retention
    scope.vat_after_retention = price_after_retention * (vat_factor - 1)
    scope.total_price_after_retention = price_after_retention + scope.vat_after_retention


def calculate_financial_totals_optimized(doc):
    """Optimized financial totals calculation"""
    # Calculate all sums in one pass per table
    doc.total_proformas = sum(flt(d.grand_total) for d in doc.proformas)
    doc.total_invoices = sum(flt(d.grand_total) for d in doc.invoices)
    doc.total_expenses = sum(flt(d.grand_total) for d in doc.lpos)
    doc.total_received = sum(flt(d.amount) for d in doc.received_table)
    doc.total_additional_expenses = sum(
        flt(d.amount) for d in doc.additional_items)

    # Calculate derived values
    total_payments = sum(flt(d.amount) for d in doc.paid_table)
    doc.total_paid = flt(total_payments) + flt(doc.total_additional_expenses)

    doc.total_receivable = flt(doc.total_invoices)
    doc.total_payable = flt(doc.total_expenses) + \
        flt(doc.total_additional_expenses)

    doc.due_receivables = flt(doc.total_receivable) - flt(doc.total_received)
    doc.due_payables = flt(doc.total_payable) - flt(doc.total_paid)

    doc.total_project_value = flt(
        doc.total_receivable) - flt(doc.total_payable)
    doc.project_profit = flt(doc.total_receivable) - flt(doc.total_payable)

    doc.profit_percentage = (flt(
        doc.project_profit) / flt(doc.total_payable) * 100) if doc.total_payable else 0


def allocate_project_payments(project, payment_type, party=None):
    """Allocate payments to bills and update their statuses"""
    if payment_type == "Receive":
        # Get all submitted Tax Invoices for this project
        bills = frappe.db.sql("""
            SELECT name, grand_total, status
            FROM `tabProject Bill`
            WHERE project = %s
            AND bill_type = 'Tax Invoice'
            AND docstatus = 1
            ORDER BY creation
        """, (project,), as_dict=1)

        total_payments = frappe.db.sql("""
            SELECT COALESCE(SUM(amount), 0) as total
            FROM `tabPayment Voucher`
            WHERE project = %s
            AND type = 'Receive'
            AND docstatus = 1
        """, (project,))[0][0]
    else:  # Pay
        # Get all submitted Purchase Orders for this project and supplier
        bills = frappe.db.sql("""
            SELECT name, grand_total, status
            FROM `tabProject Bill`
            WHERE project = %s
            AND party = %s
            AND bill_type = 'Purchase Order'
            AND docstatus = 1
            ORDER BY creation
        """, (project, party), as_dict=1)

        total_payments = frappe.db.sql("""
            SELECT COALESCE(SUM(amount), 0) as total
            FROM `tabPayment Voucher`
            WHERE project = %s
            AND party = %s
            AND type = %s
            AND docstatus = 1
        """, (project, party, payment_type))[0][0]

    # Update statuses one by one
    remaining_payment = total_payments
    for bill in bills:
        if remaining_payment <= 0:
            status = "Unpaid"
        elif remaining_payment >= bill.grand_total:
            status = "Paid"
        else:
            status = "Partially Paid"

        frappe.db.sql("""
            UPDATE `tabProject Bill` 
            SET status = %s 
            WHERE name = %s
        """, (status, bill.name))

        remaining_payment -= bill.grand_total

    frappe.db.commit()


def handle_project_bill_deletion(bill_doc):
    """Handle cleanup when a project bill is deleted"""
    if not bill_doc.project:
        return

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

    if bill_doc.bill_type in draft_table:
        draft_table_name = draft_table[bill_doc.bill_type]
        final_table_name = final_table[bill_doc.bill_type]

        # Remove from both tables using SQL
        frappe.db.sql("""
            DELETE FROM `tabProject Bills`
            WHERE parent = %s AND bill = %s AND parentfield = %s
        """, (bill_doc.project, bill_doc.name, draft_table_name))

        frappe.db.sql("""
            DELETE FROM `tabProject Bills`
            WHERE parent = %s AND bill = %s AND parentfield = %s
        """, (bill_doc.project, bill_doc.name, final_table_name))

        # Get project doc and recalculate totals
        project = frappe.get_doc("Project", bill_doc.project)
        calculate_financial_totals_optimized(project)

        # Update only the calculated fields using SQL
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
            project.total_proformas,
            project.total_invoices,
            project.total_expenses,
            project.total_received,
            project.total_additional_expenses,
            project.total_paid,
            project.total_receivable,
            project.total_payable,
            project.due_receivables,
            project.due_payables,
            project.total_project_value,
            project.project_profit,
            project.profit_percentage,
            bill_doc.project
        ))
        frappe.db.commit()


def update_project_bill_tables(bill_doc):
    """Update the corresponding child tables in the Project document"""
    if not bill_doc.project:
        return

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

    if not bill_doc.bill_type in draft_table:
        return

    draft_table_name = draft_table[bill_doc.bill_type]
    final_table_name = final_table[bill_doc.bill_type]

    # Remove existing entries from both tables
    frappe.db.sql("""
            DELETE FROM `tabProject Bills`
            WHERE parent = %s AND bill = %s AND parentfield = %s
        """, (bill_doc.project, bill_doc.name, draft_table_name))

    frappe.db.sql("""
            DELETE FROM `tabProject Bills`
            WHERE parent = %s AND bill = %s AND parentfield = %s
        """, (bill_doc.project, bill_doc.name, final_table_name))

    # Add new entry to appropriate table based on docstatus
    if bill_doc.docstatus in [0, 1]:  # Draft or Submitted
        table_field = draft_table_name if bill_doc.docstatus == 0 else final_table_name

        frappe.db.sql("""
            INSERT INTO `tabProject Bills` 
            (
                name, 
                parent, 
                parentfield, 
                parenttype, 
                bill,
                scope,
                bill_type,
                date,
                grand_total,
                status,
                party
            )
            VALUES (%s, %s, %s, 'Project', %s, %s, %s, %s, %s, %s, %s)
            """, (
            frappe.generate_hash(),
            bill_doc.project,
            table_field,
            bill_doc.name,
            bill_doc.scope,
            bill_doc.bill_type,
            bill_doc.date,
            bill_doc.grand_total,
            bill_doc.status,
            bill_doc.party
        ))

    # Get project doc and recalculate totals
    project = frappe.get_doc("Project", bill_doc.project)
    calculate_financial_totals_optimized(project)

    # Update only the calculated fields using SQL
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
        project.total_proformas,
        project.total_invoices,
        project.total_expenses,
        project.total_received,
        project.total_additional_expenses,
        project.total_paid,
        project.total_receivable,
        project.total_payable,
        project.due_receivables,
        project.due_payables,
        project.total_project_value,
        project.project_profit,
        project.profit_percentage,
        bill_doc.project
    ))
    frappe.db.commit()


def update_payment_voucher_tables(voucher_doc):
    """Update the corresponding payment tables in the Project document"""
    if not voucher_doc.project:
        return
            
    if voucher_doc.is_petty_cash:
        # Only delete if cancelled
        if voucher_doc.docstatus == 2:  # 2 means cancelled
            frappe.db.sql("""
                DELETE FROM `tabItems`
                WHERE parent = %s 
                AND payment_voucher = %s 
                AND parentfield = 'additional_items'
            """, (voucher_doc.project, voucher_doc.name))
    else:
        table_name = "received_table" if voucher_doc.type == "Receive" else "paid_table"
        
        # Always delete existing entries for regular payments
        frappe.db.sql("""
            DELETE FROM `tabPayments`
            WHERE parent = %s AND voucher = %s AND parentfield = %s
        """, (voucher_doc.project, voucher_doc.name, table_name))
        
        # Add new entry if submitted
        if voucher_doc.docstatus == 1:
            frappe.db.sql("""
                INSERT INTO `tabPayments` 
                (
                    name, 
                    parent, 
                    parentfield, 
                    parenttype, 
                    voucher,
                    date,
                    type,
                    amount
                )
                VALUES (%s, %s, %s, 'Project', %s, %s, %s, %s)
            """, (
                frappe.generate_hash(),
                voucher_doc.project,
                table_name,
                voucher_doc.name,
                voucher_doc.date,
                voucher_doc.type,
                voucher_doc.amount
            ))

    # Get project doc and recalculate totals
    project = frappe.get_doc("Project", voucher_doc.project)
    calculate_financial_totals_optimized(project)

    # Update only the calculated fields using SQL
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
        project.total_proformas,
        project.total_invoices,
        project.total_expenses,
        project.total_received,
        project.total_additional_expenses,
        project.total_paid,
        project.total_receivable,
        project.total_payable,
        project.due_receivables,
        project.due_payables,
        project.total_project_value,
        project.project_profit,
        project.profit_percentage,
        voucher_doc.project
    ))
    frappe.db.commit()


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
    calculate_financial_totals_optimized(project_doc)

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


@frappe.whitelist()
def get_payment_due_amount(project, party, payment_type):
    """Calculate due amount for the selected project and party"""
    if not (project and party):
        return 0
            
    if payment_type == "Receive":
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
        
    else:  # Pay
        # Get total of submitted Purchase Orders
        total_billed = frappe.db.sql("""
            SELECT COALESCE(SUM(grand_total), 0) as total
            FROM `tabProject Bill`
            WHERE project = %s
            AND party = %s
            AND bill_type = 'Purchase Order'
            AND docstatus = 1
        """, (project, party))[0][0]
        
        # Get total paid amount
        total_paid = frappe.db.sql("""
            SELECT COALESCE(SUM(amount), 0) as total
            FROM `tabPayment Voucher`
            WHERE project = %s
            AND party = %s
            AND type = %s
            AND docstatus = 1
        """, (project, party, payment_type))[0][0]
    
    return total_billed - total_paid
