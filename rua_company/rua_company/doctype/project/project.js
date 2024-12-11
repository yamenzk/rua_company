// Copyright (c) 2024, Yamen Zakhour and contributors
// For license information, please see license.txt

frappe.ui.form.on("Project", {
	refresh(frm) {
        if (frm.doc.__islocal) {
            frappe.prompt({
                label: 'Project Name',
                fieldname: 'project_name',
                fieldtype: 'Data',
                reqd: 1
            }, function(values) {
                frappe.model.set_value(frm.doctype, frm.docname, 'project_name', values.project_name);
                frm.save()
            }, 'Enter Project Name', 'Continue');
        }
		frm.page.clear_actions_menu();

        // Add Generate dropdown items with icons
        frm.add_custom_button(__('<i class="fa fa-file-text-o"></i> Request for Quotation'), function() {
            create_project_bill(frm, 'Request for Quotation');
        }, __('Generate'));

        frm.add_custom_button(__('<i class="fa fa-shopping-cart"></i> Purchase Order'), function() {
            create_project_bill(frm, 'Purchase Order');
        }, __('Generate'));

        frm.add_custom_button(__('<i class="fa fa-quote-left"></i> Quotation'), function() {
            create_project_bill(frm, 'Quotation');
        }, __('Generate'));

        frm.add_custom_button(__('<i class="fa fa-file"></i> Proforma'), function() {
            create_project_bill(frm, 'Proforma');
        }, __('Generate'));

        frm.add_custom_button(__('<i class="fa fa-file-text"></i> Tax Invoice'), function() {
            create_project_bill(frm, 'Tax Invoice');
        }, __('Generate'));

        frm.add_custom_button(__('<i class="fa fa-money"></i> Payment Voucher'), function() {
            create_project_bill(frm, 'Payment Voucher');
        }, __('Generate'));

        // Style the Generate parent button
        $('.inner-group-button[data-label="Generate"] .btn-default')
            .removeClass('btn-default')
            .addClass('btn-warning');
            
        // Add refresh button
        frm.add_custom_button(__('<i class="fa fa-refresh"></i>'), function() {
            frappe.confirm(
                __('This will clear and repopulate all child tables. Continue?'),
                function() {
                    frappe.call({
                        method: 'rua_company.rua_company.doctype.project.project.refresh_all_tables',
                        args: {
                            project: frm.doc.name
                        },
                        freeze: true,
                        freeze_message: __('Refreshing all tables...'),
                        callback: function(r) {
                            frm.reload_doc();
                            frappe.show_alert({
                                message: __('All tables refreshed successfully'),
                                indicator: 'green'
                            });
                        }
                    });
                }
            );
        });
        
        // Initialize and populate the billing dashboard
let dashboardContainer = document.getElementById('actual_billing_dash');
if (!dashboardContainer) {
    dashboardContainer = document.createElement('div');
    dashboardContainer.id = 'actual_billing_dash';
    // Add it after the form-dashboard section
    const formDashboard = frm.dashboard.wrapper;
    formDashboard.parentNode.insertBefore(dashboardContainer, formDashboard.nextSibling);
}

// Helper function to format currency
const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-AE', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(amount || 0) + ' AED';
};

// Helper function to format date
const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: '2-digit'
    });
};

const dashboardHTML = `
<style>
.finance-dashboard {
    max-width: 1200px;
    margin: auto;
    font-size: var(--text-base);
}

/* Project Overview Cards */
.project-overview {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: var(--padding-lg);
    margin-bottom: var(--padding-xl);
}

.overview-card {
    background: var(--card-bg);
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius-lg);
    padding: var(--padding-lg);
    position: relative;
    overflow: hidden;
}

.overview-card::after {
    content: '';
    position: absolute;
    top: 0;
    right: 0;
    width: 4px;
    height: 100%;
    background: var(--primary);
    opacity: 0.8;
}

.overview-card.profit::after {
    background: var(--green);
}

.overview-card.value::after {
    background: var(--yellow);
}

.overview-card.net::after {
    background: var(--blue);
}

.overview-card .label {
    color: var(--text-muted);
    font-size: var(--text-sm);
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: var(--padding-sm);
}

.overview-card .amount {
    font-size: var(--text-2xl);
    font-weight: 600;
    color: var(--text-color);
    margin-bottom: var(--padding-xs);
}

.overview-card .metric {
    font-size: var(--text-sm);
    color: var(--text-muted);
    display: flex;
    align-items: center;
    gap: var(--padding-xs);
}

.metric-positive { color: var(--green-600); }
.metric-negative { color: var(--red-600); }

/* Financial Sections */
.finance-section {
    background: var(--card-bg);
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius-lg);
    margin-bottom: var(--padding-xl);
    position: relative;
}

.draft-financing {
    background: var(--subtle-fg);
}

.draft-financing .summary-card {
    background: var(--subtle-accent);
}

.section-header {
    padding: var(--padding-lg);
    border-bottom: 1px solid var(--border-color);
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.section-header h2 {
    color: var(--heading-color);
    font-size: var(--text-xl);
    font-weight: 600;
    margin: 0;
    display: flex;
    align-items: center;
    gap: var(--padding-sm);
}

.section-header .total-badge {
    background: var(--bg-purple);
    color: var(--text-on-purple);
    padding: var(--padding-xs) var(--padding-sm);
    border-radius: var(--border-radius);
    font-size: var(--text-sm);
    font-weight: 500;
}

.section-content {
    padding: var(--padding-lg);
}

.scope {
    padding: var(--padding-sm);
    border-radius: 50%;
    width: 30px;
    height: 30px;
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: var(--subtle-fg);
    color: var(--text-muted);
}

/* Summary Grid */
.summary-grid-3 {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: var(--padding-lg);
}

.summary-grid-2 {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: var(--padding-lg);
}

.summary-block {
    background: var(--card-bg);
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius-lg);
    overflow: hidden;
}

.summary-card {
    background: var(--subtle-fg);
    border-radius: 0;
    border-bottom: 1px solid var(--border-color);
    padding: var(--padding-md);
    display: flex;
    align-items: center;
    justify-content: space-between;
}


.summary-card .title {
    color: var(--text-muted);
    font-size: var(--text-sm);
}

.summary-card .value {
    color: var(--text-color);
    font-size: var(--text-lg);
    font-weight: 600;
}

/* Document Lists */
.doc-list {
    background: transparent;
    border: none;
}

.doc-list-item {
    padding: var(--padding-md);
    display: grid;
    grid-template-columns: 1fr 2fr 0.8fr;
    gap: var(--padding-sm);
    align-items: center;
    border-bottom: 1px solid var(--border-color);
    transition: background-color 0.2s;
}

.doc-list-item:last-child {
    border-bottom: none;
}

.doc-list-item:hover {
    background: var(--fg-hover);
}

.doc-info {
    display: flex;
    flex-direction: column;
    gap: 4px;
}

.doc-info .bill {
    color: var(--text-color);
    text-decoration: none;
    font-weight: 500;
}

.doc-info .amount {
    color: var(--text-muted);
    font-size: var(--text-sm);
}

/* Payment Lists */
.payment-list-item {
    padding: var(--padding-md);
    display: grid;
    grid-template-columns: 1fr 2fr 0.5fr;
    gap: var(--padding-sm);
    align-items: center;
    border-bottom: 1px solid var(--border-color);
    transition: background-color 0.2s;
}

.payment-list-item:hover {
    background: var(--fg-hover);
}

.payment-info {
    display: flex;
    flex-direction: column;
    gap: 4px;
}

.payment-info .voucher {
    color: var(--text-color);
    text-decoration: none;
    font-weight: 500;
}

.payment-info .amount {
    color: var(--text-muted);
    font-size: var(--text-sm);
}

.payment-arrow {
    display: flex;
    justify-content: center;
    align-items: center;
    font-size: var(--text-lg);
}

.arrow-incoming {
    color: var(--green-600);
}

.arrow-outgoing {
    color: var(--red-600);
}

/* Status Chips */
.status-chip {
    display: inline-flex;
    align-items: center;
    padding: 4px 12px;
    border-radius: 20px;
    font-size: var(--text-xs);
    font-weight: 500;
    justify-self: end;
}

.status-paid {
    background: var(--bg-green);
    color: var(--green-600);
    border: 1px solid var(--green-600);
}

.status-unpaid {
    background: var(--bg-red);
    color: var(--text-on-red);
    border: 1px solid var(--red-600);
}

.status-partially-paid {
    background: var(--bg-yellow);
    color: var(--text-on-yellow);
    border: 1px solid var(--yellow-600);
}

.status-not-billable {
    background: var(--bg-gray);
    color: var(--text-on-gray);
    border: 1px solid var(--gray-600);
}

.status-submitted {
    background: var(--bg-green);
    color: var(--green-600);
    border: 1px solid var(--green-600);
}

/* Draft Financing Styles */
.section-divider {
    margin: var(--padding-xl) 0;
    border-top: 1px solid var(--border-color);
    position: relative;
}

.section-divider::before {
    content: '';
    position: absolute;
    top: -1px;
    left: 0;
    width: 50px;
    height: 2px;
    background: var(--primary);
}

.draft-badge {
    display: inline-flex;
    align-items: center;
    padding: 4px 12px;
    border-radius: 20px;
    font-size: var(--text-xs);
    font-weight: 500;
    justify-self: end;
    background: var(--bg-blue);
    color: var(--blue-600);
    border: 1px solid var(--blue-200);
}

.doc-category {
    padding: var(--padding-sm) var(--padding-md);
    color: var(--text-muted);
    font-size: var(--text-sm);
    font-weight: 500;
    border-bottom: 1px solid var(--border-color);
}

.empty-state {
    padding: var(--padding-lg);
    text-align: center;
    color: var(--text-muted);
    font-size: var(--text-sm);
}

/* Responsive Design */
@media (max-width: 1200px) {
    .summary-grid-3 {
        grid-template-columns: repeat(2, 1fr);
    }
}

@media (max-width: 768px) {
    .project-overview,
    .summary-grid-3,
    .summary-grid-2 {
        grid-template-columns: 1fr;
    }
    
    .doc-list-item,
    .payment-list-item {
        gap: var(--padding-xs);
    }
    
    .status-chip {
        justify-self: start;
    }
    
    .doc-info,
    .payment-info {
        gap: var(--padding-xs);
    }
    
    .payment-arrow {
        justify-content: flex-start;
        padding-top: var(--padding-xs);
    }
}

.project-header {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: var(--padding-lg);
    margin-bottom: var(--padding-xl);
    background: var(--card-bg);
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius-lg);
    padding: var(--padding-lg);
}

.project-image {
    width: 180px;
    height: 180px;
    border-radius: var(--border-radius);
    background-color: var(--fg-color);
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
}

.project-image img {
    width: 100%;
    height: 100%;
    object-fit: cover;
}

.project-details {
    display: flex;
    flex-direction: column;
    gap: var(--padding-sm);
}

.project-name {
    font-size: var(--text-2xl);
    font-weight: 600;
    color: var(--text-color);
    line-height: 1.2;
}

.project-location {
    color: var(--text-muted);
    display: flex;
    align-items: center;
    gap: var(--padding-xs);
    font-size: var(--text-base);
}

.project-location i {
    font-size: var(--text-base);
}

.party-tags {
    display: flex;
    flex-wrap: wrap;
    gap: var(--padding-xs);
    margin-top: var(--padding-sm);
}

.party-tag {
    display: inline-flex;
    align-items: center;
    padding: var(--padding-xs) var(--padding-sm);
    border-radius: var(--border-radius-full);
    font-size: var(--text-sm);
    gap: 6px;
    cursor: pointer;
    transition: all 0.2s;
}
.party-tag:not(.add-party):hover {
    filter: brightness(0.95);
    transform: translateY(-1px);
}

.party-tag.client {
    background: var(--bg-blue);
    color: var(--text-on-blue);
    border: 1px solid var(--blue-600);
}

.party-tag.supplier {
    background: var(--bg-orange);
    color: var(--text-on-orange);
    border: 1px solid var(--orange-600);
}

.party-tag.consultant {
    background: var(--bg-purple);
    color: var(--text-on-purple);
    border: 1px solid var(--purple-600);
}

.party-tag.add-party {
    background: var(--bg-gray);
    color: var(--text-muted);
    border: 1px solid var(--border-color);
    cursor: pointer;
    transition: all 0.2s;
    padding: var(--padding-xs) var(--padding-sm);
}

.party-tag.add-party:hover {
    background: var(--fg-color);
    color: var(--text-color);
    border-color: var(--text-muted);
}

.party-section {
    font-size: var(--text-xs);
    opacity: 0.8;
}

.project-name, .project-location, .project-image {
    cursor: pointer;
}

.project-name:hover, .project-location:hover {
    text-decoration: underline;
}

.project-meta {
    display: flex;
    align-items: center;
    gap: var(--padding-md);
    margin-bottom: var(--padding-sm);
}

.project-serial {
    color: var(--text-muted);
    font-size: var(--text-sm);
    background: var(--bg-gray);
    padding: 2px 8px;
    border-radius: var(--border-radius-sm);
    border: 1px solid var(--border-color);
}

.status-chip {
    display: inline-flex;
    align-items: center;
    padding: 4px 12px;
    border-radius: var(--border-radius-full);
    font-size: var(--text-xs);
    font-weight: 500;
}

.status-open {
    background: var(--bg-blue);
    color: var(--text-on-blue);
}

.status-tender {
    background: var(--bg-purple);
    color: var(--text-on-purple);
}

.status-job-in-hand {
    background: var(--bg-orange);
    color: var(--text-on-orange);
}

.status-in-progress {
    background: var(--bg-cyan);
    color: var(--text-on-cyan);
}

.status-completed {
    background: var(--bg-green);
    color: var(--text-on-green);
}

.status-cancelled {
    background: var(--bg-gray);
    color: var(--text-on-gray);
}

@media (max-width: 768px) {
    .project-header {
        grid-template-columns: 1fr;
    }
    
    .project-image {
        width: 100%;
        height: 200px;
    }
}
</style>

<div class="finance-dashboard">
<div class="project-header">
    <div class="project-image">
        ${frm.doc.image ? 
            `<img src="${frm.doc.image}" alt="${frm.doc.name}"/>` : 
            `<i class="fa fa-building-o fa-3x text-muted"></i>`
        }
    </div>
    <div class="project-details">
        <div class="project-meta">
            <div class="project-name">${frm.doc.name}</div>
            <div class="project-serial">#${frm.doc.serial_number || ''}</div>
            <div class="status-chip status-${(frm.doc.status || '').toLowerCase().replace(' ', '-')}">
                ${frm.doc.status || ''}
            </div>
        </div>
        <div class="project-location">
            <i class="fa fa-map-marker"></i>
            ${frm.doc.location || 'Location not specified'}
        </div>
        <div class="party-tags">
            ${(frm.doc.parties || []).map(party => `
                <div class="party-tag ${party.type.toLowerCase()}" data-party="${encodeURIComponent(party.party)}">
                    <i class="fa fa-${party.type === 'Client' ? 'user' : 
                                    party.type === 'Supplier' ? 'truck' : 
                                    'briefcase'}"></i>
                    ${party.party}
                    ${party.type === 'Supplier' && party.section ? 
                        `<span class="party-section">(${party.section})</span>` : 
                        ''}
                </div>
            `).join('')}
            <div class="party-tag add-party">
                <i class="fa fa-plus"></i>
            </div>
        </div>
    </div>
</div>
    <!-- Project Overview -->
    <div class="project-overview">
        <div class="overview-card value">
            <div class="label">Project Value</div>
            <div class="amount">${formatCurrency(frm.doc.total_project_value)}</div>
            <div class="metric">Total Contract Value</div>
        </div>
        
        <div class="overview-card profit">
            <div class="label">Project Profit</div>
            <div class="amount ${(frm.doc.project_profit || 0) >= 0 ? 'metric-positive' : 'metric-negative'}">
                ${formatCurrency(frm.doc.project_profit)}
            </div>
            <div class="metric">
                <span class="${(frm.doc.profit_percentage || 0) >= 0 ? 'metric-positive' : 'metric-negative'}">
                    ${frm.doc.profit_percentage || 0}% Margin
                </span>
            </div>
        </div>
        
        <div class="overview-card net">
            <div class="label">Net Position</div>
            <div class="amount">${formatCurrency((frm.doc.due_receivables || 0) - (frm.doc.due_payables || 0))}</div>
            <div class="metric">Current Balance</div>
        </div>
    </div>

    <!-- Receivables Section -->
    <div class="finance-section">
        <div class="section-header">
            <h2>Receivables</h2>
            <span class="total-badge">Due: ${formatCurrency(frm.doc.due_receivables)}</span>
        </div>
        
        <div class="section-content">
            <div class="summary-grid-3">
                <!-- Proformas Block -->
                <div class="summary-block">
                    <div class="summary-card">
                        <div class="title">Total Proformas</div>
                        <div class="value">${formatCurrency(frm.doc.total_proformas)}</div>
                    </div>
                    ${(frm.doc.proformas || []).length ? 
                        (frm.doc.proformas || []).map(row => `
                            <div class="doc-list-item">
                                <div class="scope">${row.scope || ''}</div>
                                <div class="doc-info">
                                    <a href="/app/project-bill/${row.bill}" class="bill">${row.bill}</a>
                                    <div class="amount">${formatCurrency(row.grand_total)}</div>
                                </div>
                                <span class="status-chip status-${(row.status || '').toLowerCase().replace(' ', '-')}">
                                     ${row.status === 'Not Billable' ? 'N/B' : row.status === 'Partially Paid' ? 'Partial' : row.status || ''}
                                </span>
                            </div>
                        `).join('') : 
                        '<div class="empty-state">No proformas found</div>'
                    }
                </div>

                <!-- Invoices Block -->
                <div class="summary-block">
                    <div class="summary-card">
                        <div class="title">Total Invoices</div>
                        <div class="value">${formatCurrency(frm.doc.total_invoices)}</div>
                    </div>
                    ${(frm.doc.invoices || []).length ? 
                        (frm.doc.invoices || []).map(row => `
                            <div class="doc-list-item">
                                <div class="scope">${row.scope || ''}</div>
                                <div class="doc-info">
                                    <a href="/app/project-bill/${row.bill}" class="bill">${row.bill}</a>
                                    <div class="amount">${formatCurrency(row.grand_total)}</div>
                                </div>
                                <span class="status-chip status-${(row.status || '').toLowerCase().replace(' ', '-')}">
                                     ${row.status === 'Not Billable' ? 'N/B' : row.status === 'Partially Paid' ? 'Partial' : row.status || ''}
                                </span>
                            </div>
                        `).join('') : 
                        '<div class="empty-state">No invoices found</div>'
                    }
                </div>

                <!-- Received Payments Block -->
                <div class="summary-block">
                    <div class="summary-card">
                        <div class="title">Total Received</div>
                        <div class="value">${formatCurrency(frm.doc.total_received)}</div>
                    </div>
                    ${(frm.doc.received_table || []).length ? 
                        (frm.doc.received_table || []).map(row => `
                            <div class="payment-list-item">
                                <div class="date">${formatDate(row.date)}</div>
                                <div class="payment-info">
                                    <a href="/app/payment-voucher/${row.voucher}" class="voucher">${row.voucher}</a>
                                    <div class="amount">${formatCurrency(row.amount)}</div>
                                </div>
                                <div class="payment-arrow arrow-incoming">↓</div>
                            </div>
                        `).join('') : 
                        '<div class="empty-state">No payments received</div>'
                    }
                </div>
            </div>
        </div>
    </div>

    <!-- Payables Section -->
    <div class="finance-section">
        <div class="section-header">
            <h2>Payables</h2>
            <span class="total-badge">Due: ${formatCurrency(frm.doc.due_payables)}</span>
        </div>
        
        <div class="section-content">
            <div class="summary-grid-2">
                <!-- Purchase Orders Block -->
                <div class="summary-block">
                    <div class="summary-card">
                        <div class="title">Total Purchase Orders</div>
                        <div class="value">${formatCurrency(frm.doc.total_expenses)}</div>
                    </div>
                    ${(frm.doc.lpos || []).length ? 
                        (frm.doc.lpos || []).map(row => `
                            <div class="doc-list-item">
                                <div class="scope">${row.scope || ''}</div>
                                <div class="doc-info">
                                    <a href="/app/project-bill/${row.bill}" class="bill">${row.bill}</a>
                                    <div class="amount">${formatCurrency(row.grand_total)}</div>
                                </div>
                                <span class="status-chip status-${(row.status || '').toLowerCase().replace(' ', '-')}">
                                     ${row.status === 'Not Billable' ? 'N/B' : row.status === 'Partially Paid' ? 'Partial' : row.status || ''}
                                </span>
                            </div>
                        `).join('') : 
                        '<div class="empty-state">No purchase orders found</div>'
                    }
                </div>

                <!-- Paid Payments Block -->
                <div class="summary-block">
                    <div class="summary-card">
                        <div class="title">Total Paid</div>
                        <div class="value">${formatCurrency(frm.doc.total_paid)}</div>
                    </div>
                    ${(frm.doc.paid_table || []).length ? 
                        (frm.doc.paid_table || []).map(row => `
                            <div class="payment-list-item">
                                <div class="date">${formatDate(row.date)}</div>
                                <div class="payment-info">
                                    <a href="/app/payment-voucher/${row.voucher}" class="voucher">${row.voucher}</a>
                                    <div class="amount">${formatCurrency(row.amount)}</div>
                                </div>
                                <div class="payment-arrow arrow-outgoing">↑</div>
                            </div>
                        `).join('') : 
                        '<div class="empty-state">No payments made</div>'
                    }
                </div>
            </div>
        </div>
    </div>

    <!-- Draft Financing Section -->
    <div class="section-divider"></div>
    <div class="finance-section draft-financing">
        <div class="section-header">
            <h2>Draft Financing</h2>
        </div>
        
        <div class="section-content">
            <!-- First Row: Proforma, LPO, Invoice Drafts -->
            <div class="summary-grid-3">
                <!-- Proforma Drafts -->
                <div class="summary-block">
                    <div class="summary-card">
                        <div class="title">Proforma Drafts</div>
                    </div>
                    ${(frm.doc.proforma_drafts || []).length ? 
                        (frm.doc.proforma_drafts || []).map(row => `
                            <div class="doc-list-item">
                                <div class="scope">${row.scope || ''}</div>
                                <div class="doc-info">
                                    <a href="/app/project-bill/${row.bill}" class="bill">${row.bill}</a>
                                    <div class="amount">${formatCurrency(row.grand_total)}</div>
                                </div>
                                <span class="draft-badge">Draft</span>
                            </div>
                        `).join('') : 
                        '<div class="empty-state">No draft proformas</div>'
                    }
                </div>

                <!-- LPO Drafts -->
                <div class="summary-block">
                    <div class="summary-card">
                        <div class="title">Purchase Order Drafts</div>
                    </div>
                    ${(frm.doc.lpo_drafts || []).length ? 
                        (frm.doc.lpo_drafts || []).map(row => `
                            <div class="doc-list-item">
                                <div class="scope">${row.scope || ''}</div>
                                <div class="doc-info">
                                    <a href="/app/project-bill/${row.bill}" class="bill">${row.bill}</a>
                                    <div class="amount">${formatCurrency(row.grand_total)}</div>
                                </div>
                                <span class="draft-badge">Draft</span>
                            </div>
                        `).join('') : 
                        '<div class="empty-state">No draft purchase orders</div>'
                    }
                </div>

                <!-- Invoice Drafts -->
                <div class="summary-block">
                    <div class="summary-card">
                        <div class="title">Invoice Drafts</div>
                    </div>
                    ${(frm.doc.invoice_drafts || []).length ? 
                        (frm.doc.invoice_drafts || []).map(row => `
                            <div class="doc-list-item">
                                <div class="scope">${row.scope || ''}</div>
                                <div class="doc-info">
                                    <a href="/app/project-bill/${row.bill}" class="bill">${row.bill}</a>
                                    <div class="amount">${formatCurrency(row.grand_total)}</div>
                                </div>
                                <span class="draft-badge">Draft</span>
                            </div>
                        `).join('') : 
                        '<div class="empty-state">No draft invoices</div>'
                    }
                </div>
            </div>

            <!-- Second Row: Quotations and RFQs -->
            <div class="summary-grid-2" style="margin-top: var(--padding-lg);">
                <!-- Quotations Block -->
                <div class="summary-block">
                    <div class="summary-card">
                        <div class="title">Quotations</div>
                    </div>
                    
                    <!-- Submitted Quotations -->
                    ${(frm.doc.quotations || []).length ? `
                        <div class="doc-category">Submitted Quotations</div>
                        ${(frm.doc.quotations || []).map(row => `
                            <div class="doc-list-item">
                                <div class="scope">${row.scope || ''}</div>
                                <div class="doc-info">
                                    <a href="/app/project-bill/${row.bill}" class="bill">${row.bill}</a>
                                    <div class="amount">${formatCurrency(row.grand_total)}</div>
                                </div>
                                <span class="status-chip status-submitted">Submitted</span>
                            </div>
                        `).join('')}
                    ` : ''}

                    <!-- Draft Quotations -->
                    ${(frm.doc.quotation_drafts || []).length ? `
                        <div class="doc-category">Draft Quotations</div>
                        ${(frm.doc.quotation_drafts || []).map(row => `
                            <div class="doc-list-item">
                                <div class="scope">${row.scope || ''}</div>
                                <div class="doc-info">
                                    <a href="/app/project-bill/${row.bill}" class="bill">${row.bill}</a>
                                    <div class="amount">${formatCurrency(row.grand_total)}</div>
                                </div>
                                <span class="draft-badge">Draft</span>
                            </div>
                        `).join('')}
                    ` : ''}
                    
                    ${(!frm.doc.quotations?.length && !frm.doc.quotation_drafts?.length) ? 
                        '<div class="empty-state">No quotations found</div>' : ''
                    }
                </div>

                <!-- RFQs Block -->
                <div class="summary-block">
                    <div class="summary-card">
                        <div class="title">RFQs</div>
                    </div>
                    
                    <!-- Submitted RFQs -->
                    ${(frm.doc.rfqs || []).length ? `
                        <div class="doc-category">Submitted RFQs</div>
                        ${(frm.doc.rfqs || []).map(row => `
                            <div class="doc-list-item">
                                <div class="scope">${row.scope || ''}</div>
                                <div class="doc-info">
                                    <a href="/app/project-bill/${row.bill}" class="bill">${row.bill}</a>
                                    <div class="amount">${formatCurrency(row.grand_total)}</div>
                                </div>
                                <span class="status-chip status-submitted">Submitted</span>
                            </div>
                        `).join('')}
                    ` : ''}

                    <!-- Draft RFQs -->
                    ${(frm.doc.rfq_drafts || []).length ? `
                        <div class="doc-category">Draft RFQs</div>
                        ${(frm.doc.rfq_drafts || []).map(row => `
                            <div class="doc-list-item">
                                <div class="scope">${row.scope || ''}</div>
                                <div class="doc-info">
                                    <a href="/app/project-bill/${row.bill}" class="bill">${row.bill}</a>
                                    <div class="amount">${formatCurrency(row.grand_total)}</div>
                                </div>
                                <span class="draft-badge">Draft</span>
                            </div>
                        `).join('')}
                    ` : ''}
                    
                    ${(!frm.doc.rfqs?.length && !frm.doc.rfq_drafts?.length) ? 
                        '<div class="empty-state">No RFQs found</div>' : ''
                    }
                </div>
            </div>
        </div>
    </div>
</div>`;

// Inject the HTML
dashboardContainer.innerHTML = dashboardHTML;

// Attach click handlers
const $container = $(dashboardContainer);

// Add party button
$container.find('.add-party').on('click', function() {
    show_manage_parties_dialog(frm);
});

// Party tags
$container.find('.party-tag:not(.add-party)').on('click', function() {
    const party = $(this).attr('data-party'); // Changed from data() to attr()
    if (party) {
        window.open(`/app/party/${encodeURIComponent(party)}`, '_blank');
    }
});

// Project image
$container.find('.project-image').on('click', function() {
    const d = new frappe.ui.Dialog({
        title: 'Update Project Image',
        fields: [
            {
                label: 'Image',
                fieldname: 'image',
                fieldtype: 'Attach Image',
                reqd: 1,
                onchange: function() {
                    // Auto submit when image is selected
                    const image = d.get_value('image');
                    if (image) {
                        frappe.model.set_value(frm.doctype, frm.docname, 'image', image);
                        frm.save();
                        d.hide();
                    }
                }
            }
        ]
    });
    d.show();
});

// Project location
$container.find('.project-location').on('click', function() {
    const d = new frappe.ui.Dialog({
        title: 'Update Project Location',
        fields: [
            {
                label: 'Location',
                fieldname: 'location',
                fieldtype: 'Data',
                reqd: 1,
                default: frm.doc.location
            }
        ],
        primary_action_label: 'Update',
        primary_action(values) {
            frappe.model.set_value(frm.doctype, frm.docname, 'location', values.location);
            frm.save();
            d.hide();
        }
    });
    d.show();
});

// Project name
$container.find('.project-name').on('click', function() {
    const d = new frappe.ui.Dialog({
        title: 'Update Project Name',
        fields: [
            {
                label: 'Project Name',
                fieldname: 'project_name',
                fieldtype: 'Data',
                reqd: 1,
                default: frm.doc.project_name || frm.doc.name
            }
        ],
        primary_action_label: 'Update',
        primary_action(values) {
            frappe.model.set_value(frm.doctype, frm.docname, 'project_name', values.project_name);
            frm.save();
            d.hide();
        }
    });
    d.show();
});
        // Add import button to grid
        if (!frm.doc.__islocal) {
            frm.fields_dict['items'].grid.add_custom_button(
                __('Import from Excel'),
                function() {
                    show_import_dialog(frm);
                }
            );
            frm.fields_dict["items"].grid.grid_buttons.find('.btn-custom').removeClass('btn-default btn-secondary').addClass('btn-success');
            frm.fields_dict['scopes'].grid.add_custom_button(
                __('Manage Scopes'),
                function() {
                    show_manage_scopes_dialog(frm);
                }
            );
            frm.fields_dict["scopes"].grid.grid_buttons.find('.btn-custom').removeClass('btn-default btn-secondary').addClass('btn-info');
            
            // Show the grid footer in scopes section
            $(frm.fields_dict['scopes'].grid.wrapper).find('.grid-footer').css('display', 'flex');
        }
        
		if (frm.doc.docstatus === 0) {
			// For Open status
			if (frm.doc.status === "Open" && !frm.doc.__islocal) {
				frm.page.add_action_item(__('<i class="fa fa-file-text-o"></i> Set as Tender'), function() {
					frappe.confirm(
						__('Set this project as Tender?'),
						function() {
							frm.set_value('status', 'Tender');
							frm.save();
						}
					);
				});

				frm.page.add_action_item(__('<i class="fa fa-briefcase"></i> Set as Job In Hand'), function() {
					frappe.confirm(
						__('Set this project as Job In Hand?'),
						function() {
							frm.set_value('status', 'Job In Hand');
							frm.save();
						}
					);
				});

				frm.page.add_action_item(__('<i class="fa fa-ban"></i> Cancel Project'), function() {
					frappe.confirm(
						__('Are you sure you want to cancel this project? This action cannot be undone.'),
						function() {
							frm.set_value('status', 'Cancelled');
							frm.save();
						}
					);
				});
			}
			
			// For Tender status
			if (frm.doc.status === "Tender") {
				frm.page.add_action_item(__('<i class="fa fa-play"></i> Start Progress'), function() {
					frappe.confirm(
						__('Start progress on this project?'),
						function() {
							frm.set_value('status', 'In Progress');
							frm.save();
						}
					);
				});

				frm.page.add_action_item(__('<i class="fa fa-ban"></i> Cancel Project'), function() {
					frappe.confirm(
						__('Are you sure you want to cancel this project? This action cannot be undone.'),
						function() {
							frm.set_value('status', 'Cancelled');
							frm.save();
						}
					);
				});
			}
			
			// For Job In Hand status
			if (frm.doc.status === "Job In Hand") {
				frm.page.add_action_item(__('<i class="fa fa-play"></i> Start Progress'), function() {
					frappe.confirm(
						__('Start progress on this project?'),
						function() {
							frm.set_value('status', 'In Progress');
							frm.save();
						}
					);
				});

				frm.page.add_action_item(__('<i class="fa fa-ban"></i> Cancel Project'), function() {
					frappe.confirm(
						__('Are you sure you want to cancel this project? This action cannot be undone.'),
						function() {
							frm.set_value('status', 'Cancelled');
							frm.save();
						}
					);
				});
			}
			
			// For In Progress status
			if (frm.doc.status === "In Progress") {
				frm.page.add_action_item(__('<i class="fa fa-check-circle"></i> Mark Complete'), function() {
					frappe.confirm(
						__('Mark this project as completed?'),
						function() {
							frm.set_value('status', 'Completed');
							frm.save();
						}
					);
				});

				frm.page.add_action_item(__('<i class="fa fa-ban"></i> Cancel Project'), function() {
					frappe.confirm(
						__('Are you sure you want to cancel this project? This action cannot be undone.'),
						function() {
							frm.set_value('status', 'Cancelled');
							frm.save();
						}
					);
				});
			}
		}
		frm.set_query('scope_number', 'items', function() {
            return {
                filters: {
                    'parent': frm.doc.name
                }
            };
        });
        
        // Apply color coding to scopes and items grids
        if (frm.doc.scopes && frm.doc.scopes.length > 1) {
            apply_color_coding(frm);
        }

        

	},
    
    after_save: function(frm) {
        // Ensure button is added after save
        setTimeout(() => {
            const grid = frm.fields_dict.items.grid;
            if (grid && grid.$wrapper) {
                if (!grid.$wrapper.find('.import-from-excel').length) {
                    const import_btn = $(`
                        <button class="btn btn-sm btn-warning import-from-excel ml-2">
                            Import from Excel
                        </button>
                    `);
                    import_btn.on('click', () => show_import_dialog(frm));
                    grid.$wrapper.find('.grid-footer .grid-footer-toolbar').append(import_btn);
                }
            }
        }, 1000);
    },
    
    download_import_template: function(frm, scope) {
        frappe.call({
            method: 'rua_company.rua_company.doctype.project.project.get_import_template',
            args: {
                scope: JSON.stringify(scope)
            },
            callback: function(r) {
                if (r.message) {
                    const blob = b64toBlob(r.message.content, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.style.display = 'none';
                    a.href = url;
                    a.download = r.message.filename;
                    document.body.appendChild(a);
                    a.click();
                    window.URL.revokeObjectURL(url);
                    a.remove();
                }
            }
        });
    },

});

// Define scope colors for light and dark modes
const SCOPE_COLORS = {
    light: [
        '#fff3e0', // Light Orange
        '#e3f2fd', // Light Blue
        '#f3e5f5', // Light Purple
        '#e8f5e9', // Light Green
        '#fff9c4', // Light Yellow
        '#e0f7fa', // Light Cyan
        '#fce4ec', // Light Pink
        '#f1f8e9'  // Light Lime
    ],
    dark: [
        '#4a3000', // Dark Orange
        '#002f5c', // Dark Blue
        '#3f2150', // Dark Purple
        '#1b4d2e', // Dark Green
        '#4d4000', // Dark Yellow
        '#006064', // Dark Cyan
        '#4a1f2f', // Dark Pink
        '#2c4c00'  // Dark Lime
    ]
};

// Function to get current theme mode
function getCurrentThemeMode() {
    return document.documentElement.getAttribute('data-theme-mode') === 'dark' || 
           document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
}

// Function to apply color coding
function apply_color_coding(frm) {
    // Only proceed if we have more than one scope
    if (!frm.doc.scopes || frm.doc.scopes.length <= 1) {
        // Clear any existing colors
        frm.fields_dict['scopes'].grid.grid_rows.forEach(row => {
            const $row = $(row.row).length ? $(row.row) : 
                      $(row.wrapper).find('.grid-row').length ? $(row.wrapper).find('.grid-row') :
                      $(row.wrapper).find('[data-name="'+row.doc.name+'"]');
            $row.css({
                'background-color': '',
            });
        });
        
        frm.fields_dict['items'].grid.grid_rows.forEach(row => {
            const $row = $(row.row).length ? $(row.row) : 
                      $(row.wrapper).find('.grid-row').length ? $(row.wrapper).find('.grid-row') :
                      $(row.wrapper).find('[data-name="'+row.doc.name+'"]');
            $row.css({
                'background-color': '',
            });
        });
        return;
    }

    setTimeout(() => {
        const themeMode = getCurrentThemeMode();
        const colors = SCOPE_COLORS[themeMode];

        // Color the scopes grid
        if (frm.fields_dict['scopes'].grid.grid_rows) {
            frm.fields_dict['scopes'].grid.grid_rows.forEach((row, index) => {
                const scopeNum = row.doc.scope_number;
                if (scopeNum) {
                    const color = colors[(scopeNum - 1) % colors.length];
                    const $row = $(row.row).length ? $(row.row) : 
                               $(row.wrapper).find('.grid-row').length ? $(row.wrapper).find('.grid-row') :
                               $(row.wrapper).find('[data-name="'+row.doc.name+'"]');
                               
                    $row.css({
                        'background-color': color,
                    });
                }
            });
        }

        // Color the items grid
        if (frm.fields_dict['items'].grid.grid_rows) {
            frm.fields_dict['items'].grid.grid_rows.forEach(row => {
                const scopeNum = row.doc.scope_number;
                if (scopeNum) {
                    const color = colors[(scopeNum - 1) % colors.length];
                    const $row = $(row.row).length ? $(row.row) : 
                               $(row.wrapper).find('.grid-row').length ? $(row.wrapper).find('.grid-row') :
                               $(row.wrapper).find('[data-name="'+row.doc.name+'"]');
                               
                    $row.css({
                        'background-color': color,
                    });
                }
            });
        }
    }, 100);
}

// Add theme change listener
$(document).ready(function() {
    const observer = new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
            if (mutation.attributeName === 'data-theme-mode' || mutation.attributeName === 'data-theme') {
                // Re-apply color coding to all visible forms
                cur_frm && cur_frm.doc && apply_color_coding(cur_frm);
            }
        });
    });

    observer.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['data-theme-mode', 'data-theme']
    });
});

// Function to refresh existing scopes
function refresh_existing_scopes(dialog, frm) {
    const wrapper = dialog.fields_dict.existing_scopes_html.$wrapper;
    wrapper.empty();
    
    if (!frm.doc.scopes || frm.doc.scopes.length === 0) {
        wrapper.append('<div class="text-muted">No scopes added yet</div>');
        return;
    }
    
    const table = $(`
        <table class="table table-bordered">
            <thead>
                <tr>
                    <th>Scope</th>
                    <th>Description</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody></tbody>
        </table>
    `);
    
    const themeMode = getCurrentThemeMode();
    const colors = SCOPE_COLORS[themeMode];
    
    frm.doc.scopes.forEach(scope => {
        const color = colors[(scope.scope_number - 1) % colors.length];
        const row = $(`
            <tr>
                <td>${scope.scope_number}</td>
                <td>${scope.description || ''}</td>
                <td>
                    <button class="btn btn-warning btn-xs btn-edit-scope mr-2" 
                            data-scope-number="${scope.scope_number}">
                        Edit
                    </button>
                    <button class="btn btn-danger btn-xs btn-delete-scope" 
                            data-scope-number="${scope.scope_number}">
                        Delete
                    </button>
                </td>
            </tr>
        `);
        
        // Apply color coding to the row
        row.css({
            'background-color': color,
        });
        
        // Edit button handler
        row.find('.btn-edit-scope').on('click', () => {
            dialog.hide();
            show_manage_scopes_dialog(frm, scope);
        });
        
        // Delete button handler
        row.find('.btn-delete-scope').on('click', () => {
            // Check if scope is in use
            const items_with_scope = frm.doc.items ? 
                frm.doc.items.filter(item => item.scope_number === scope.scope_number) : [];
            
            if (items_with_scope.length > 0) {
                frappe.msgprint(__('Cannot delete scope {0} as it is being used by {1} items', 
                    [scope.scope_number, items_with_scope.length]));
                return;
            }
            
            frappe.confirm(
                __('Are you sure you want to delete scope {0}?', [scope.scope_number]),
                () => {
                    frm.doc.scopes = frm.doc.scopes.filter(s => s.scope_number !== scope.scope_number);
                    frm.refresh_field('scopes');
                    frm.dirty();
                    dialog.hide();
                    apply_color_coding(frm);
                    frm.save();
                    frappe.show_alert({
                        message: __('Scope {0} removed.', [scope.scope_number]),
                        indicator: 'green'
                    });
                }
            );
        });
        
        table.find('tbody').append(row);
    });
    
    wrapper.append(table);
}

// Calculate area and basic glass calculations
function calculate_glass_values(frm, row, scope) {
    // Calculate area
    if (row.width && row.height) {
        const area = (row.width * row.height) / 10000;
        frappe.model.set_value(row.doctype, row.name, 'area', area);
        
        // Calculate glass price and total glass
        if (row.glass_unit && scope) {
            const glass_price = row.glass_unit * area * (1 + (scope.vat / 100));
            frappe.model.set_value(row.doctype, row.name, 'glass_price', glass_price);
            
            if (row.qty) {
                frappe.model.set_value(row.doctype, row.name, 'total_glass', glass_price * row.qty);
            }
        }
    }
}

// Calculate aluminum price
function calculate_aluminum_price(frm, row) {
    const aluminum_price = (row.curtain_wall || 0) + 
                         (row.insertion_1 || 0) + 
                         (row.insertion_2 || 0) + 
                         (row.insertion_3 || 0) + 
                         (row.insertion_4 || 0);
    
    return frappe.model.set_value(row.doctype, row.name, 'aluminum_price', aluminum_price)
        .then(() => aluminum_price);
}

// Calculate aluminum ratio for a specific scope
function calculate_aluminum_ratio(frm, scope_number) {
    const items = frm.doc.items || [];
    const scope = (frm.doc.scopes || []).find(s => s.scope_number === scope_number);
    
    if (!scope) return 1;
    
    // Get all items for this scope
    const scope_items = items.filter(item => item.scope_number === scope_number);
    
    // Calculate x (sum of VAT amounts)
    const x = scope_items.reduce((sum, item) => {
        return sum + ((item.aluminum_price || 0) * (scope.vat / 100));
    }, 0);
    
    // Calculate y (sum of aluminum_price * qty)
    const y = scope_items.reduce((sum, item) => {
        return sum + ((item.aluminum_price || 0) * (item.qty || 0));
    }, 0);
    
    // Calculate total
    const total = ((scope.aluminum_weight || 0) * (scope.sdf || 0)) + y + x;
    
    // Calculate ratio and round to 3 decimal places
    const ratio = y > 0 ? Number((total / y).toFixed(3)) : 1;
    
    // Store the ratio in the scope
    frappe.model.set_value(scope.doctype, scope.name, 'ratio', ratio);
    
    return ratio;
}

// Calculate remaining values
function calculate_remaining_values(frm, row, ratio) {
    if (row.aluminum_price) {
        // Calculate aluminum unit and total
        const aluminum_unit = row.aluminum_price * ratio;
        return frappe.model.set_value(row.doctype, row.name, 'aluminum_unit', aluminum_unit)
            .then(() => {
                if (row.qty) {
                    return frappe.model.set_value(row.doctype, row.name, 'total_aluminum', aluminum_unit * row.qty);
                }
            })
            .then(() => {
                // Calculate actual unit
                if (row.glass_price) {
                    // Find the corresponding scope to get labour_charges
                    const scope = frm.doc.scopes.find(s => s.scope_number === row.scope_number);
                    const labour_charges = scope ? (scope.labour_charges || 0) : 0;
                    
                    const actual_unit = aluminum_unit + row.glass_price + labour_charges;
                    return frappe.model.set_value(row.doctype, row.name, 'actual_unit', actual_unit)
                        .then(() => {
                            // Calculate profit and costs
                            if (row.profit_percentage) {
                                const total_profit = actual_unit * (row.profit_percentage / 100);
                                return frappe.model.set_value(row.doctype, row.name, 'total_profit', total_profit)
                                    .then(() => {
                                        if (row.qty) {
                                            return frappe.model.set_value(row.doctype, row.name, 'total_cost', actual_unit * row.qty);
                                        }
                                    })
                                    .then(() => {
                                        const actual_unit_rate = total_profit + actual_unit;
                                        return frappe.model.set_value(row.doctype, row.name, 'actual_unit_rate', actual_unit_rate)
                                            .then(() => {
                                                if (row.qty) {
                                                    let overall_price = actual_unit_rate * row.qty;
                                                    
                                                    // Find the corresponding scope
                                                    const scope = frm.doc.scopes.find(s => s.scope_number === row.scope_number);
                                                    
                                                    // Apply rounding if specified in scope
                                                    if (scope && scope.rounding === "Round up to nearest 5") {
                                                        overall_price = roundToNearest5(overall_price);
                                                    }
                                                    
                                                    return frappe.model.set_value(row.doctype, row.name, 'overall_price', overall_price);
                                                }
                                            });
                                    });
                            }
                        });
                }
            });
    }
    return Promise.resolve();
}

// Calculate scope totals
function update_scope_totals(frm, scope_number) {
    const scope = (frm.doc.scopes || []).find(s => s.scope_number === scope_number);
    if (!scope) return;

    const scope_items = (frm.doc.items || []).filter(item => item.scope_number === scope_number);
    
    // Calculate totals
    const totals = scope_items.reduce((acc, item) => {
        return {
            total_price: acc.total_price + (item.overall_price || 0),
            total_cost: acc.total_cost + (item.total_cost || 0),
            total_profit: acc.total_profit + (item.total_profit * item.qty || 0),
            total_items: acc.total_items + (item.qty || 0)
        };
    }, { total_price: 0, total_cost: 0, total_profit: 0, total_items: 0 });

    // Update scope with new totals
    frappe.model.set_value(scope.doctype, scope.name, 'total_price', totals.total_price);
    frappe.model.set_value(scope.doctype, scope.name, 'total_cost', totals.total_cost);
    frappe.model.set_value(scope.doctype, scope.name, 'total_profit', totals.total_profit);
    frappe.model.set_value(scope.doctype, scope.name, 'total_items', totals.total_items);
}

// Main calculation function
function trigger_calculations(frm, row) {
    const scope = (frm.doc.scopes || []).find(s => s.scope_number === row.scope_number);
    if (!scope) return;
    
    calculate_glass_values(frm, row, scope);
    calculate_aluminum_price(frm, row)
        .then(aluminum_price => {
            // Calculate ratio for all items with the same scope
            const ratio = calculate_aluminum_ratio(frm, row.scope_number);
            
            // Update all items with the same scope number
            const promises = (frm.doc.items || []).map(item => {
                if (item.scope_number === row.scope_number) {
                    return calculate_remaining_values(frm, item, ratio);
                }
                return Promise.resolve();
            });

            // After all calculations are done, update scope totals
            Promise.all(promises).then(() => {
                update_scope_totals(frm, row.scope_number);
            });
        });
}

// Handle items table scope number and read-only state
frappe.ui.form.on('Project Items', {
    items_add: function(frm, cdt, cdn) {
        let scopes = frm.doc.scopes || [];
        if (scopes.length === 0) {
            frappe.throw(__('Please add at least one scope before adding items'));
            return false;
        }
        
        let row = frappe.get_doc(cdt, cdn);
        
        // Get the scope number from the grid row's index
        let grid_row = frm.fields_dict.items.grid.grid_rows.find(r => r.doc.name === cdn);
        let scope_number = grid_row.doc.scope_number;
        
        // If no scope number is set (new row), use the latest scope
        if (!scope_number) {
            let latest_scope = scopes[scopes.length - 1];
            scope_number = latest_scope.scope_number;
        }
        
        // Find the matching scope
        let matching_scope = scopes.find(scope => scope.scope_number === scope_number);
        if (matching_scope) {
            row.scope_number = matching_scope.scope_number;
            row.glass_unit = matching_scope.glass_sqm_price;
            row.profit_percentage = matching_scope.profit;
        }
        
        frm.fields_dict.items.grid.refresh();
        apply_color_coding(frm);
        trigger_calculations(frm, row);
    },
    
    items_remove: function(frm) {
        apply_color_coding(frm);
    },
    
    scope_number: function(frm, cdt, cdn) {
        let row = frappe.get_doc(cdt, cdn);
        let scopes = frm.doc.scopes || [];
        
        // Find the matching scope
        let matching_scope = scopes.find(scope => scope.scope_number === row.scope_number);
        if (matching_scope) {
            frappe.model.set_value(cdt, cdn, 'glass_unit', matching_scope.glass_sqm_price);
            frappe.model.set_value(cdt, cdn, 'profit_percentage', matching_scope.profit);
        }
        apply_color_coding(frm);
        trigger_calculations(frm, row);
    },

    width: function(frm, cdt, cdn) {
        const row = locals[cdt][cdn];
        trigger_calculations(frm, row);
    },
    height: function(frm, cdt, cdn) {
        const row = locals[cdt][cdn];
        trigger_calculations(frm, row);
    },
    qty: function(frm, cdt, cdn) {
        const row = locals[cdt][cdn];
        trigger_calculations(frm, row);
    },
    glass_unit: function(frm, cdt, cdn) {
        const row = locals[cdt][cdn];
        trigger_calculations(frm, row);
    },
    curtain_wall: function(frm, cdt, cdn) {
        const row = locals[cdt][cdn];
        trigger_calculations(frm, row);
    },
    insertion_1: function(frm, cdt, cdn) {
        const row = locals[cdt][cdn];
        trigger_calculations(frm, row);
    },
    insertion_2: function(frm, cdt, cdn) {
        const row = locals[cdt][cdn];
        trigger_calculations(frm, row);
    },
    insertion_3: function(frm, cdt, cdn) {
        const row = locals[cdt][cdn];
        trigger_calculations(frm, row);
    },
    insertion_4: function(frm, cdt, cdn) {
        const row = locals[cdt][cdn];
        trigger_calculations(frm, row);
    },
    profit_percentage: function(frm, cdt, cdn) {
        const row = locals[cdt][cdn];
        trigger_calculations(frm, row);
    }
});

// Function to show import dialog
function show_import_dialog(frm) {
    let selected_scope = null;
    
    // Create a dialog for scope selection and file upload
    const dialog = new frappe.ui.Dialog({
        title: 'Import Items from Excel',
        fields: [
            {
                fieldname: 'scope_select_html',
                fieldtype: 'HTML',
                options: `<div class="scope-select mb-4"></div>`
            },
            {
                fieldname: 'upload_file',
                fieldtype: 'Attach',
                label: 'Upload Excel File',
                reqd: 1,
                onchange: function() {
                    const file = dialog.get_value('upload_file');
                    if (file && selected_scope) {
                        import_excel_data(file, selected_scope, dialog, frm);
                    } else if (!selected_scope) {
                        frappe.msgprint('Please select a scope first');
                        dialog.set_value('upload_file', '');
                    }
                }
            }
        ]
    });

    // Function to handle the import
    function import_excel_data(file_url, scope, dialog, frm) {
        frappe.call({
            method: 'rua_company.rua_company.doctype.project.project.import_items_from_excel',
            args: {
                file_url: file_url,
                scope: JSON.stringify(scope)
            },
            freeze: true,
            freeze_message: __('Importing items from Excel...'),
            callback: function(r) {
                if (!r.exc) {
                    dialog.hide();
                    frappe.show_alert({
                        message: __('Successfully imported {0} items', [r.message.items.length]),
                        indicator: 'green'
                    });
                    frm.reload_doc();
                }
            }
        });
    }

    // Create scope selection buttons
    const scope_container = dialog.fields_dict.scope_select_html.$wrapper.find('.scope-select');
    scope_container.empty();
    
    // Add instruction text with better styling
    scope_container.append(`
        <div class="scope-instruction mb-3" style="font-size: 14px; color: var(--text-muted);">
            Select a scope to import items into:
        </div>
        <div class="scope-buttons d-flex flex-wrap gap-2" style="margin: -4px;">
        </div>
    `);
    
    const buttons_container = scope_container.find('.scope-buttons');
    
    // Create buttons for each scope
    frm.doc.scopes.forEach(scope => {
        const themeMode = getCurrentThemeMode();
        const color = SCOPE_COLORS[themeMode][(scope.scope_number - 1) % SCOPE_COLORS[themeMode].length];
        
        const btn = $(`
            <div class="scope-button-wrapper" style="margin: 4px;">
                <button class="btn btn-default btn-scope" 
                        data-scope='${JSON.stringify(scope)}'
                        style="min-width: 150px; height: auto; white-space: normal; padding: 8px 15px;">
                    Scope ${scope.scope_number}${scope.description ? `<br><span style="font-size: 0.9em;">${scope.description}</span>` : ''}
                </button>
            </div>
        `);
        
        const $button = btn.find('.btn-scope');
        
        $button.on('click', function() {
            // Remove active class from all buttons
            buttons_container.find('.btn-scope').removeClass('btn-primary').addClass('btn-default')
                .css({
                    'background-color': '',
                });
            
            // Add active class to clicked button
            $(this).removeClass('btn-default')
                .css({
                    'background-color': color,
                });
                
            // Store selected scope
            selected_scope = scope;
            
            // Show download template button
            if (!dialog.$wrapper.find('.download-template').length) {
                const download_btn = $(`
                    <button class="btn btn-sm btn-warning download-template" 
                            style="margin-right: 15px;">
                        Download Template
                    </button>
                `);
                download_btn.on('click', () => {
                    download_import_template(frm, selected_scope);
                });
                dialog.$wrapper.find('.modal-header').append(download_btn);
            }

            // If file is already uploaded, trigger import
            const file = dialog.get_value('upload_file');
            if (file) {
                import_excel_data(file, scope, dialog, frm);
            }
        });
        
        buttons_container.append(btn);
    });

    dialog.show();
}

function download_import_template(frm, scope) {
    frappe.call({
        method: 'rua_company.rua_company.doctype.project.project.get_import_template',
        args: {
            scope: JSON.stringify(scope)
        },
        callback: function(r) {
            if (r.message) {
                const blob = b64toBlob(r.message.content, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.style.display = 'none';
                a.href = url;
                a.download = r.message.filename;
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
                a.remove();
            }
        }
    });
}

function create_project_bill(frm, bill_type) {
    // Get filtered parties based on bill type
    let party_type;
    if (bill_type === 'Purchase Order' || bill_type === 'Request for Quotation') {
        party_type = 'Supplier';
    } else if (bill_type === 'Payment Voucher') {
        party_type = null; // All parties allowed
    } else {
        party_type = 'Client';
    }

    let parties = frm.doc.parties.filter(p => !party_type || p.type === party_type);
    if (!parties.length) {
        frappe.msgprint(__(`No ${party_type || ''} parties found in the project`));
        return;
    }

    // If it's a payment voucher, get outstanding amounts for all parties
    if (bill_type === 'Payment Voucher') {
        frappe.call({
            method: "rua_company.rua_company.doctype.project.project.get_party_outstanding_amounts",
            args: {
                project: frm.doc.name,
                parties: parties.map(p => ({
                    party: p.party,
                    type: p.type
                }))
            },
            callback: function(r) {
                if (r.message) {
                    show_party_dialog(r.message);
                }
            }
        });
    } else {
        show_party_dialog({});
    }

    function show_party_dialog(outstanding_amounts) {
        // Format party labels based on type and section
        let party_options = parties.map(p => {
            let label;
            if (bill_type === 'Payment Voucher') {
                let amount = outstanding_amounts[p.party] || 0;
                let formatted_amount = format_currency(Math.abs(amount), frm.doc.currency);
                let direction;
                if (p.type === 'Supplier') {
                    direction = amount > 0 ? 'To Pay' : amount < 0 ? 'To Receive' : 'No Balance';
                } else {
                    direction = amount > 0 ? 'To Receive' : amount < 0 ? 'To Pay' : 'No Balance';
                }
                if (p.type === 'Supplier' && p.section) {
                    label = `${p.party} (${p.type} - ${p.section}) [${direction}: ${formatted_amount}]`;
                } else {
                    label = `${p.party} (${p.type}) [${direction}: ${formatted_amount}]`;
                }
            } else {
                if (p.type === 'Supplier' && p.section) {
                    label = `${p.party} (${p.type} - ${p.section})`;
                } else {
                    label = `${p.party} (${p.type})`;
                }
            }
            return {
                label: label,
                value: p.party
            };
        });

        // For non-supplier documents, auto-select the client if there's only one
        let default_party = null;
        if (party_type === 'Client') {
            let clients = parties.filter(p => p.type === 'Client');
            if (clients.length === 1) {
                default_party = clients[0].party;
            }
        }

        let fields = [
            {
                fieldtype: 'Select',
                fieldname: 'party',
                label: __('Select Party'),
                reqd: 1,
                options: party_options,
                default: default_party
            }
        ];

        // Add scope selection if there are scopes (except for Payment Vouchers)
        if (bill_type !== 'Payment Voucher' && frm.doc.scopes && frm.doc.scopes.length > 1) {
            let scope_options = [
                {
                    label: __('All Scopes'),
                    value: '0'
                },
                ...frm.doc.scopes.map(scope => ({
                    label: `Scope ${scope.scope_number}: ${scope.description || ''}`,
                    value: scope.scope_number
                }))
            ];

            fields.push({
                fieldtype: 'Select',
                fieldname: 'scope',
                label: __('Select Scope'),
                reqd: 1,
                options: scope_options
            });
        }

        // Add RFQ specific fields
        if (bill_type === 'Request for Quotation') {
            fields.push({
                fieldtype: 'Select',
                fieldname: 'rfq_type',
                label: __('RFQ Type'),
                reqd: 1,
                options: [
                    { label: 'RFQ from Items', value: 'items' },
                    { label: 'RFQ from Link', value: 'link' }
                ]
            }, {
                fieldtype: 'Data',
                fieldname: 'url',
                label: __('RFQ URL'),
                depends_on: "eval:doc.rfq_type=='link'"
            });
        }

        let d = new frappe.ui.Dialog({
            title: __(bill_type === 'Payment Voucher' ? 'Create Payment Voucher' : 'Create Project Bill'),
            fields: fields,
            primary_action_label: bill_type === 'Payment Voucher' ? __('Create') : __('Next'),
            primary_action(values) {
                // Get selected items
                d.hide();
                
                if (bill_type === 'Payment Voucher') {
                    frappe.model.open_mapped_doc({
                        method: "rua_company.rua_company.doctype.project.project.make_payment_voucher",
                        frm: frm,
                        args: {
                            party: values.party,
                            outstanding_amount: outstanding_amounts[values.party] || 0
                        },
                        freeze: true,
                        freeze_message: __("Creating Payment Voucher...")
                    });
                } else if (bill_type === 'Request for Quotation' && values.rfq_type === 'link') {
                    // Create RFQ directly with link
                    create_bill_with_scope(frm, bill_type, values.scope || 1, {
                        send_rfq_link: 1,
                        url: values.url,
                        party: values.party
                    });
                } else if (bill_type === 'Request for Quotation' || bill_type === 'Purchase Order') {
                    // Show item selection dialog
                    show_item_selection_dialog(frm, bill_type, values.scope || 1, values.party);
                } else {
                    create_bill_with_scope(frm, bill_type, values.scope || 1, {
                        party: values.party
                    });
                }
            }
        });

        d.show();
    }
}

function show_item_selection_dialog(frm, bill_type, scope, party) {
    // Get items for the selected scope
    let items = frm.doc.items.filter(item => 
        scope === '0' || String(item.scope_number) === String(scope)
    );

    if (!items.length) {
        frappe.msgprint(__('No items found for the selected scope'));
        return;
    }

    // Create HTML table for item selection
    let table_html = `
        <div style="max-height: 500px; overflow-y: auto;">
            <table class="table table-bordered">
                <thead>
                    <tr>
                        <th style="width: 30px;">
                            <input type="checkbox" class="select-all" title="Select All">
                        </th>
                        <th>${__('Item')}</th>
                        <th>${__('Description')}</th>
                        <th>${__('Qty')}</th>
                        <th>${__('Width')}</th>
                        <th>${__('Height')}</th>
                        ${bill_type === 'Purchase Order' ? `<th>${__('Rate')}</th>` : ''}
                    </tr>
                </thead>
                <tbody>
                    ${items.map((item, idx) => `
                        <tr>
                            <td>
                                <input type="checkbox" class="item-select" data-idx="${idx}">
                            </td>
                            <td>${item.item || ''}</td>
                            <td>${item.description || ''}</td>
                            <td>${item.qty || ''}</td>
                            <td>${item.width || ''}</td>
                            <td>${item.height || ''}</td>
                            ${bill_type === 'Purchase Order' ? 
                                `<td>${format_currency(item.actual_unit_rate || 0, frm.doc.currency)}</td>` : 
                                ''}
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;

    let d = new frappe.ui.Dialog({
        title: __('Select Items'),
        fields: [{
            fieldtype: 'HTML',
            fieldname: 'items_html',
            options: table_html
        }],
        primary_action_label: __('Create'),
        primary_action(values) {
            // Get selected items
            let selected_items = [];
            d.$wrapper.find('.item-select:checked').each(function() {
                let idx = $(this).data('idx');
                let item = items[idx];
                selected_items.push({
                    item: item.item,
                    description: item.description,
                    qty: item.qty,
                    width: item.width,
                    height: item.height,
                    rate: bill_type === 'Purchase Order' ? item.actual_unit_rate : undefined
                });
            });

            d.hide();
            create_bill_with_scope(frm, bill_type, scope, {
                selected_items: selected_items,
                party: party
            });
        }
    });

    // Handle select all checkbox
    d.$wrapper.find('.select-all').on('change', function() {
        let checked = $(this).prop('checked');
        d.$wrapper.find('.item-select').prop('checked', checked);
    });

    d.show();
}

function create_bill_with_scope(frm, bill_type, scope, args = {}) {
    frappe.model.open_mapped_doc({
        method: "rua_company.rua_company.doctype.project.project.make_project_bill",
        frm: frm,
        args: {
            bill_type: bill_type,
            scope: scope,
            ...args
        },
        freeze: true,
        freeze_message: __("Creating {0} for Scope {1}...", [__(bill_type), scope])
    });
}


// Utility function to convert base64 to blob
function b64toBlob(b64Data, contentType = '', sliceSize = 512) {
    const byteCharacters = atob(b64Data);
    const byteArrays = [];

    for (let offset = 0; offset < byteCharacters.length; offset += sliceSize) {
        const slice = byteCharacters.slice(offset, offset + sliceSize);
        const byteNumbers = new Array(slice.length);
        
        for (let i = 0; i < slice.length; i++) {
            byteNumbers[i] = slice.charCodeAt(i);
        }
        
        const byteArray = new Uint8Array(byteNumbers);
        byteArrays.push(byteArray);
    }

    return new Blob(byteArrays, { type: contentType });
}

function show_manage_scopes_dialog(frm, edit_scope = null) {
    const dialog = new frappe.ui.Dialog({
        title: edit_scope ? `Edit Scope ${edit_scope.scope_number}` : 'Manage Scopes',
        fields: [
            {
                fieldname: 'existing_scopes_section',
                fieldtype: 'Section Break',
                label: 'Existing Scopes',
                hidden: !!edit_scope
            },
            {
                fieldname: 'existing_scopes_html',
                fieldtype: 'HTML',
                hidden: !!edit_scope
            },
            {
                fieldname: 'new_scope_section',
                fieldtype: 'Section Break',
                label: edit_scope ? '' : 'Add New Scope'
            },
            {
                fieldname: 'description',
                fieldtype: 'Data',
                label: 'Description',
                mandatory_depends_on: 'eval:1'
            },
            {
                fieldname: 'glass_sqm_price',
                fieldtype: 'Currency',
                label: 'Glass SQM Price',
                mandatory_depends_on: 'eval:1'
            },
            {
                fieldname: 'labour_charges',
                fieldtype: 'Currency',
                label: 'Labour Charges',
                mandatory_depends_on: 'eval:1'
            },
            {
                fieldname: 'aluminum_weight',
                fieldtype: 'Float',
                label: 'Aluminum Weight',
                mandatory_depends_on: 'eval:1'
            },
            {
                fieldname: 'col_break_1',
                fieldtype: 'Column Break'
            },
            {
                fieldname: 'sdf',
                fieldtype: 'Float',
                label: 'SDF',
                mandatory_depends_on: 'eval:1'
            },
            {
                fieldname: 'profit',
                fieldtype: 'Percent',
                label: 'Profit',
                mandatory_depends_on: 'eval:1',
                default: 35
            },
            {
                fieldname: 'vat',
                fieldtype: 'Percent',
                label: 'VAT',
                default: 5,
                read_only: 1
            },
            {
                fieldname: 'rounding',
                fieldtype: 'Select',
                label: 'Rounding',
                options: [
                    'No Rounding',
                    'Round up to nearest 5'
                ],
                default: 'Round up to nearest 5'
            }
        ],
        primary_action_label: edit_scope ? 'Save Changes' : 'Add Scope',
        primary_action(values) {
            if (edit_scope) {
                // Check if there are items using this scope
                const items_with_scope = frm.doc.items ? 
                    frm.doc.items.filter(item => item.scope_number === edit_scope.scope_number) : [];
                
                const update_scope = () => {
                    // Update existing scope
                    const scope_idx = frm.doc.scopes.findIndex(s => s.scope_number === edit_scope.scope_number);
                    if (scope_idx !== -1) {
                        Object.assign(frm.doc.scopes[scope_idx], {
                            description: values.description,
                            glass_sqm_price: values.glass_sqm_price,
                            labour_charges: values.labour_charges,
                            aluminum_weight: values.aluminum_weight,
                            sdf: values.sdf,
                            profit: values.profit,
                            vat: values.vat,
                            rounding: values.rounding
                        });
                        
                        // Update all items using this scope
                        if (frm.doc.items) {
                            frm.doc.items.forEach(item => {
                                if (item.scope_number === edit_scope.scope_number) {
                                    item.glass_unit = values.glass_sqm_price;
                                    item.profit_percentage = values.profit;
                                }
                            });
                            frm.refresh_field('items');
                        }
                        
                        frm.refresh_field('scopes');
                        frm.dirty();
                        dialog.hide();
                        frm.save();
                        frappe.show_alert({
                            message: __('Scope {0} updated.', [edit_scope.scope_number]),
                            indicator: 'green'
                        });
                    }
                };
                
                if (items_with_scope.length > 0) {
                    frappe.confirm(
                        __('This scope is being used by {0} items. Updating this scope will also update these items. Are you sure you want to continue?', [items_with_scope.length]),
                        () => {
                            update_scope();
                        }
                    );
                } else {
                    update_scope();
                }
            } else {
                // Add new scope
                if (!frm.doc.scopes) {
                    frm.doc.scopes = [];
                }
                
                const next_scope_number = frm.doc.scopes.length > 0 
                    ? Math.max(...frm.doc.scopes.map(s => s.scope_number)) + 1 
                    : 1;
                
                let row = frappe.model.add_child(frm.doc, 'Project Scope', 'scopes');
                row.scope_number = next_scope_number;
                row.description = values.description;
                row.glass_sqm_price = values.glass_sqm_price;
                row.labour_charges = values.labour_charges;
                row.aluminum_weight = values.aluminum_weight;
                row.sdf = values.sdf;
                row.profit = values.profit;
                row.vat = values.vat;
                row.rounding = values.rounding;
                
                frm.refresh_field('scopes');
                frm.dirty();
                dialog.hide();
                apply_color_coding(frm);
                frm.save();
                frappe.show_alert({
                    message: __('Scope {0} added.', [next_scope_number]),
                    indicator: 'green'
                });
            }
        }
    });
    
    // If editing, populate the fields with existing scope data
    if (edit_scope) {
        dialog.set_values({
            description: edit_scope.description,
            glass_sqm_price: edit_scope.glass_sqm_price,
            labour_charges: edit_scope.labour_charges,
            aluminum_weight: edit_scope.aluminum_weight,
            sdf: edit_scope.sdf,
            profit: edit_scope.profit,
            vat: edit_scope.vat,
            rounding: edit_scope.rounding || 'Round up to nearest 5'
        });
    }
    
    function refresh_existing_scopes(dialog, frm) {
        const wrapper = dialog.fields_dict.existing_scopes_html.$wrapper;
        wrapper.empty();
        
        if (!frm.doc.scopes || frm.doc.scopes.length === 0) {
            wrapper.append('<div class="text-muted">No scopes added yet</div>');
            return;
        }
        
        const table = $(`
            <table class="table table-bordered">
                <thead>
                    <tr>
                        <th>Scope</th>
                        <th>Description</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody></tbody>
            </table>
        `);
        
        const themeMode = getCurrentThemeMode();
        const colors = SCOPE_COLORS[themeMode];
        
        frm.doc.scopes.forEach(scope => {
            const color = colors[(scope.scope_number - 1) % colors.length];
            const row = $(`
                <tr>
                    <td>${scope.scope_number}</td>
                    <td>${scope.description || ''}</td>
                    <td>
                        <button class="btn btn-warning btn-xs btn-edit-scope mr-2" 
                                data-scope-number="${scope.scope_number}">
                            Edit
                        </button>
                        <button class="btn btn-danger btn-xs btn-delete-scope" 
                                data-scope-number="${scope.scope_number}">
                            Delete
                        </button>
                    </td>
                </tr>
            `);
            
            // Apply color coding to the row
            row.css({
                'background-color': color,
            });
            
            // Edit button handler
            row.find('.btn-edit-scope').on('click', () => {
                dialog.hide();
                show_manage_scopes_dialog(frm, scope);
            });
            
            // Delete button handler
            row.find('.btn-delete-scope').on('click', () => {
                // Check if scope is in use
                const items_with_scope = frm.doc.items ? 
                    frm.doc.items.filter(item => item.scope_number === scope.scope_number) : [];
                
                if (items_with_scope.length > 0) {
                    frappe.msgprint(__('Cannot delete scope {0} as it is being used by {1} items', 
                        [scope.scope_number, items_with_scope.length]));
                    return;
                }
                
                frappe.confirm(
                    __('Are you sure you want to delete scope {0}?', [scope.scope_number]),
                    () => {
                        frm.doc.scopes = frm.doc.scopes.filter(s => s.scope_number !== scope.scope_number);
                        frm.refresh_field('scopes');
                        frm.dirty();
                        dialog.hide();
                        apply_color_coding(frm);
                        frm.save();
                        frappe.show_alert({
                            message: __('Scope {0} removed.', [scope.scope_number]),
                            indicator: 'green'
                        });
                    }
                );
            });
            
            table.find('tbody').append(row);
        });
        
        wrapper.append(table);
    }
    
    if (!edit_scope) {
        refresh_existing_scopes(dialog, frm);
    }
    dialog.show();
}

// Handle section field read-only state
function handle_section_readonly(frm, cdt, cdn) {
    let row = locals[cdt][cdn];
    let grid_row = frm.fields_dict.parties.grid.grid_rows_by_docname[cdn];
    
    // Find the section field index
    let section_field_idx = grid_row.docfields.findIndex(field => field.fieldname === 'section');
    
    if (row.type !== 'Supplier') {
        frappe.model.set_value(cdt, cdn, 'section', '');
        grid_row.docfields[section_field_idx].read_only = 1;
    } else {
        grid_row.docfields[section_field_idx].read_only = 0;
    }
    
    frm.fields_dict.parties.grid.refresh();
}

// Handle section field in parties table
frappe.ui.form.on('Parties', {
    party: function(frm, cdt, cdn) {
        let row = locals[cdt][cdn];
        if (row.party) {
            frappe.db.get_value('Party', row.party, ['default_type', 'default_section'])
                .then(r => {
                    if (r.message) {
                        if (r.message.default_type) {
                            frappe.model.set_value(cdt, cdn, 'type', r.message.default_type);
                            // If it's a supplier and has default section, set it
                            if (r.message.default_type === 'Supplier' && r.message.default_section) {
                                frappe.model.set_value(cdt, cdn, 'section', r.message.default_section);
                            }
                        }
                    }
                });
        }
    },
    
    type: function(frm, cdt, cdn) {
        handle_section_readonly(frm, cdt, cdn);
    },

    parties_add: function(frm, cdt, cdn) {
        handle_section_readonly(frm, cdt, cdn);
    },

    form_render: function(frm, cdt, cdn) {
        handle_section_readonly(frm, cdt, cdn);
    }
});

// Handle scope number auto-population
frappe.ui.form.on('Scopes', {
    
    vat: function(frm, cdt, cdn) {
        const scope = locals[cdt][cdn];
        (frm.doc.items || []).forEach(item => {
            if (item.scope_number === scope.scope_number) {
                trigger_calculations(frm, item);
            }
        });
    },
    
    aluminum_weight: function(frm, cdt, cdn) {
        const scope = locals[cdt][cdn];
        (frm.doc.items || []).forEach(item => {
            if (item.scope_number === scope.scope_number) {
                trigger_calculations(frm, item);
            }
        });
    },
    
    sdf: function(frm, cdt, cdn) {
        const scope = locals[cdt][cdn];
        (frm.doc.items || []).forEach(item => {
            if (item.scope_number === scope.scope_number) {
                trigger_calculations(frm, item);
            }
        });
    },

    rounding: function(frm, cdt, cdn) {
        const scope = locals[cdt][cdn];
        (frm.doc.items || []).forEach(item => {
            if (item.scope_number === scope.scope_number) {
                trigger_calculations(frm, item);
            }
        });
    }, 

    labour_charges: function(frm, cdt, cdn) {
        const scope = locals[cdt][cdn];
        (frm.doc.items || []).forEach(item => {
            if (item.scope_number === scope.scope_number) {
                trigger_calculations(frm, item);
            }
        });
    }
});

function roundToNearest5(num) {
    return Math.ceil(num / 5) * 5;
}

function show_manage_parties_dialog(frm) {
    const dialog = new frappe.ui.Dialog({
        title: 'Manage Project Parties',
        fields: [
            {
                fieldname: 'existing_parties_section',
                fieldtype: 'Section Break',
                label: 'Current Parties'
            },
            {
                fieldname: 'parties_html',
                fieldtype: 'HTML'
            },
            {
                fieldname: 'add_party_section',
                fieldtype: 'Section Break',
                label: 'Add New Party'
            },
            {
                fieldname: 'party',
                fieldtype: 'Link',
                options: 'Party',
                label: 'Select Party',
                get_query: () => {
                    return {
                        filters: {
                            name: ['not in', (frm.doc.parties || []).map(p => p.party)]
                        }
                    };
                }
            },
            {
                fieldname: 'type',
                fieldtype: 'Select',
                label: 'Type',
                options: '\nClient\nSupplier\nConsultant',
                depends_on: 'eval:doc.party'
            },
            {
                fieldname: 'section',
                fieldtype: 'Select',
                label: 'Section',
                options: '\nAluminum\nGlass\nCladding',
                depends_on: 'eval:doc.type=="Supplier"'
            }
        ],
        primary_action_label: 'Add Party',
        primary_action(values) {
            if (!values.party || !values.type) {
                frappe.throw(__('Please select both Party and Type'));
                return;
            }

            let row = frappe.model.add_child(frm.doc, 'Parties', 'parties');
            row.party = values.party;
            row.type = values.type;
            if (values.type === 'Supplier' && values.section) {
                row.section = values.section;
            }

            frm.refresh_field('parties');
            frm.dirty();
            dialog.clear();
            dialog.hide();
            refresh_parties_list(dialog, frm);
            frm.save();
        }
    });

    function refresh_parties_list(dialog, frm) {
        const wrapper = dialog.fields_dict.parties_html.$wrapper;
        wrapper.empty();

        if (!frm.doc.parties || frm.doc.parties.length === 0) {
            wrapper.append('<div class="text-muted">No parties added yet</div>');
            return;
        }

        const table = $(`
            <div class="table-responsive">
                <table class="table table-bordered">
                    <thead>
                        <tr>
                            <th>Party</th>
                            <th>Type</th>
                            <th>Section</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody></tbody>
                </table>
            </div>
        `);

        frm.doc.parties.forEach(party => {
            const row = $(`
                <tr>
                    <td>${party.party}</td>
                    <td>${party.type}</td>
                    <td>${party.section || ''}</td>
                    <td>
                        <button class="btn btn-danger btn-xs btn-remove-party" 
                                data-party="${party.party}">
                            Remove
                        </button>
                    </td>
                </tr>
            `);

            // Remove button handler
            row.find('.btn-remove-party').on('click', () => {
                frappe.confirm(
                    __('Are you sure you want to remove {0}?', [party.party]),
                    () => {
                        frm.doc.parties = frm.doc.parties.filter(p => p.party !== party.party);
                        frm.refresh_field('parties');
                        frm.dirty();
                        refresh_parties_list(dialog, frm);
                        frm.save();
                    }
                );
            });

            table.find('tbody').append(row);
        });

        wrapper.append(table);
    }

    // Initial refresh of parties list
    refresh_parties_list(dialog, frm);

    dialog.show();
}