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

// Function to generate dashboard HTML
function generateDashboardHTML(frm) {
    const dashboardContainer = document.getElementById('actual_billing_dash') || createDashboardContainer(frm);
    
    const dashboardHTML = `
<style>
.clickable {
    cursor: pointer;
}
.clickable:hover {
    opacity: 0.8;
}
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
.notice-container {
}

.notice {
  border: 1px solid var(--border-color);;
  border-radius: var(--border-radius);
  padding: var(--padding-md);
  position: relative;
  overflow: hidden;
}

.notice::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  width: 4px;
  height: 100%;
  background: #FBC418;
}

.notice h2 {
  color: var(--heading-color);
  font-size: var(--text-lg);
  font-weight: 600;
  margin: 0 0 12px 0;
  letter-spacing: -0.02em;
}

.notice p {
  color: var(--text-muted);
  line-height: 1.7;
  margin: 0 0 6px 0;
  font-size: var(--text-base);
}

.notice .highlighted {
  color: var(--red);
  font-weight: 600;
}

.notice .info-panel {
  background: var(--subtle-fg);
  border: 1px solid var(--border-color);
  border-radius: var(--border-radius);
  padding: var(--padding-sm);
}

.notice .info-panel p {
  color: var(--gray-600);
  font-size: var(--text-sm);
  margin: 0;
  line-height: 1.6;
}

[data-theme="dark"] .notice .highlighted,
[data-theme-mode="dark"] .notice .highlighted {
  color: var(--dt-light-red);
}
</style>
<div class="finance-dashboard">
<div class="project-header">
    <div class="project-image clickable">
        ${frm.doc.image ? 
            `<img src="${frm.doc.image}" alt="${frm.doc.name}"/>` : 
            `<i class="fa fa-building-o fa-3x text-muted"></i>`
        }
    </div>
    <div class="project-details">
        <div class="project-meta">
            <div class="project-name clickable">${frm.doc.name}</div>
            <div class="project-serial">#${frm.doc.serial_number || ''}</div>
            <div class="status-chip status-${(frm.doc.status || '').toLowerCase().replace(' ', '-')}">
                ${frm.doc.status || ''}
            </div>
        </div>
        <div class="project-location clickable">
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
            <div class="party-tag add-party clickable">
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


    dashboardContainer.innerHTML = dashboardHTML;
}

// Function to create dashboard container
function createDashboardContainer(frm) {
    const dashboardContainer = document.createElement('div');
    dashboardContainer.id = 'actual_billing_dash';
    // Add it after the form-dashboard section
    const formDashboard = frm.dashboard.wrapper;
    formDashboard.parentNode.insertBefore(dashboardContainer, formDashboard.nextSibling);
    return dashboardContainer;
}

// Function to attach event listeners to dashboard elements
function attachDashboardEventListeners(frm) {
    setTimeout(() => {
        // Project image click handler
        const projectImage = document.querySelector('.project-image');
        if (projectImage) {
            projectImage.addEventListener('click', () => {
                new frappe.ui.Dialog({
                    title: 'Project Image',
                    fields: [
                        {
                            label: 'Project Image',
                            fieldname: 'image',
                            fieldtype: 'Attach Image',
                            default: frm.doc.image || ''
                        }
                    ],
                    primary_action_label: 'Update',
                    primary_action(values) {
                        if (values.image) {
                            frm.set_value('image', values.image);
                            frm.save();
                        }
                        this.hide();
                    }
                }).show();
            });
        }

        // Project name click handler
        const projectName = document.querySelector('.project-name');
        if (projectName) {
            projectName.addEventListener('click', () => {
                new frappe.ui.Dialog({
                    title: 'Edit Project Name',
                    fields: [
                        {
                            label: 'Project Name',
                            fieldname: 'project_name',
                            fieldtype: 'Data',
                            default: frm.doc.project_name || ''
                        }
                    ],
                    primary_action_label: 'Update',
                    primary_action(values) {
                        if (values.project_name) {
                            frm.set_value('project_name', values.project_name);
                            frm.save();
                        }
                        this.hide();
                    }
                }).show();
            });
        }

        // Project location click handler
        const projectLocation = document.querySelector('.project-location');
        if (projectLocation) {
            projectLocation.addEventListener('click', () => {
                new frappe.ui.Dialog({
                    title: 'Edit Location',
                    fields: [
                        {
                            label: 'Location',
                            fieldname: 'location',
                            fieldtype: 'Data',
                            default: frm.doc.location || ''
                        }
                    ],
                    primary_action_label: 'Update',
                    primary_action(values) {
                        if (values.location) {
                            frm.set_value('location', values.location);
                            frm.save();
                        }
                        this.hide();
                    }
                }).show();
            });
        }

        // Add party button click handler
        const addPartyButton = document.querySelector('.party-tag.add-party');
        if (addPartyButton) {
            addPartyButton.addEventListener('click', () => {
                show_manage_parties_dialog(frm);
            });
        }
    }, 100);
}

// Manage parties dialog
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

// Export the main function
frappe.provide('rua_company.project_dashboard');

// Track attached listeners to prevent duplicates
let listenersAttached = false;

// Function to remove existing event listeners
function removeExistingListeners() {
    const elements = [
        '.project-image',
        '.project-name',
        '.project-location',
        '.party-tag.add-party'
    ];
    
    elements.forEach(selector => {
        const element = document.querySelector(selector);
        if (element) {
            element.replaceWith(element.cloneNode(true));
        }
    });
    
    listenersAttached = false;
}

rua_company.project_dashboard = {
    render: function(frm) {
        // Remove any existing listeners before generating new HTML
        removeExistingListeners();
        
        // Generate dashboard HTML
        generateDashboardHTML(frm);
        
        // Attach event listeners
        setTimeout(() => {
            attachDashboardEventListeners(frm);
            listenersAttached = true;
        }, 500);
    }
};

// Initialize the dashboard
frappe.ui.form.on('Project', {
    refresh: function(frm) {
        rua_company.project_dashboard.render(frm);
    }
});
