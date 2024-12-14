// Initialize rua_company namespace if it doesn't exist
frappe.provide('rua_company');
frappe.provide('rua_company.project_dashboard');

// Define the dashboard object first
rua_company.project_dashboard = {
    render: function(frm) {
        // Remove any existing listeners before generating new HTML
        removeExistingListeners();
        
        // Generate dashboard HTML
        generateDashboardHTML(frm);
        
        // Attach event listeners
        attachDashboardEventListeners(frm);
        listenersAttached = true;
    },
    showAddExpenseDialog: function(frm) {
        const dialog = new frappe.ui.Dialog({
            title: 'Add Expense',
            fields: [
                {
                    fieldtype: 'Section Break',
                    label: 'Expense Details'
                },
                {
                    fieldname: 'party',
                    fieldtype: 'Link',
                    options: 'Party',
                    label: 'Party',
                    mandatory_depends_on: 'eval:1'
                },
                {
                    fieldname: 'item',
                    fieldtype: 'Data',
                    label: 'Item',
                    mandatory_depends_on: 'eval:1'
                },
                {
                    fieldname: 'description',
                    fieldtype: 'Small Text',
                    label: 'Description'
                },
                {
                    fieldtype: 'Column Break'
                },
                {
                    fieldname: 'width',
                    fieldtype: 'Float',
                    label: 'Width (cm)'
                },
                {
                    fieldname: 'height',
                    fieldtype: 'Float',
                    label: 'Height (cm)'
                },
                {
                    fieldtype: 'Section Break',
                    label: 'Pricing'
                },
                {
                    fieldname: 'qty',
                    fieldtype: 'Float',
                    label: 'Quantity',
                    mandatory_depends_on: 'eval:1',
                    default: 1
                },
                {
                    fieldname: 'rate',
                    fieldtype: 'Currency',
                    label: 'Rate (VAT Inclusive)',
                    mandatory_depends_on: 'eval:1',
                    description: 'Please ensure the rate includes VAT'
                },
                {
                    fieldtype: 'HTML',
                    options: `
                        <div class="alert alert-info">
                            <i class="fa fa-info-circle"></i>
                            <strong>Note:</strong> The rate should be VAT inclusive.
                        </div>
                    `
                }
            ],
            primary_action_label: 'Add Expense',
            primary_action(values) {
                if (!frm.doc.additional_items) {
                    frm.doc.additional_items = [];
                }

                const amount = values.qty * values.rate; 
                
                // Create Payment Voucher
                frappe.call({
                    method: 'frappe.client.insert',
                    args: {
                        doc: {
                            doctype: 'Payment Voucher',
                            project: frm.doc.name,
                            type: 'Pay',
                            party: values.party,
                            amount: amount,
                            is_petty_cash: 1
                        }
                    },
                    callback: function(r) {
                        if (!r.exc) {
                            let row = frappe.model.add_child(frm.doc, 'Additional Items', 'additional_items');
                            Object.assign(row, {
                                ...values,
                                amount: amount,
                                payment_voucher: r.message.name
                            });
                            
                            frm.refresh_field('additional_items');
                            frm.dirty();
                            dialog.hide();
                            
                            // Save the project first
                            frm.save().then(() => {
                                // Then submit the Payment Voucher
                                frappe.call({
                                    method: 'frappe.client.submit',
                                    args: {
                                        doc: r.message
                                    },
                                    callback: function(r2) {
                                        if (!r2.exc) {
                                            rua_company.project_dashboard.render(frm);
                                            frappe.show_alert({
                                                message: __('Expense added successfully'),
                                                indicator: 'green'
                                            });
                                        }
                                    }
                                });
                            });
                        }
                    }
                });
            }
        });
        
        dialog.show();
    },
    showExpenseDetailsDialog: function(frm, idx) {
        // Function to show expense details dialog
        const expense = frm.doc.additional_items.find(item => item.idx === idx);
        if (!expense) return;

        const dialog = new frappe.ui.Dialog({
            title: 'Expense Details',
            fields: [
                {
                    fieldtype: 'Section Break',
                    label: 'Expense Details'
                },
                {
                    fieldname: 'party',
                    fieldtype: 'Link',
                    options: 'Party',
                    label: 'Party',
                    read_only: 1,
                    default: expense.party
                },
                {
                    fieldname: 'item',
                    fieldtype: 'Data',
                    label: 'Item',
                    read_only: 1,
                    default: expense.item
                },
                {
                    fieldname: 'description',
                    fieldtype: 'Small Text',
                    label: 'Description',
                    read_only: 1,
                    default: expense.description
                },
                {
                    fieldtype: 'Column Break'
                },
                {
                    fieldname: 'width',
                    fieldtype: 'Float',
                    label: 'Width (cm)',
                    read_only: 1,
                    default: expense.width
                },
                {
                    fieldname: 'height',
                    fieldtype: 'Float',
                    label: 'Height (cm)',
                    read_only: 1,
                    default: expense.height
                },
                {
                    fieldtype: 'Section Break',
                    label: 'Pricing'
                },
                {
                    fieldname: 'qty',
                    fieldtype: 'Float',
                    label: 'Quantity',
                    read_only: 1,
                    default: expense.qty
                },
                {
                    fieldname: 'rate',
                    fieldtype: 'Currency',
                    label: 'Rate (VAT Inclusive)',
                    read_only: 1,
                    default: expense.rate
                },
                {
                    fieldname: 'amount',
                    fieldtype: 'Currency',
                    label: 'Total Amount',
                    read_only: 1,
                    default: expense.amount
                }
            ],
            primary_action_label: 'Delete Expense',
            primary_action() {
                frappe.confirm(
                    'Are you sure you want to delete this expense?',
                    () => {
                        // First cancel and then delete the Payment Voucher if it exists
                        if (expense.payment_voucher) {
                            frappe.call({
                                method: 'frappe.client.cancel',
                                args: {
                                    doctype: 'Payment Voucher',
                                    name: expense.payment_voucher
                                },
                                callback: function(r) {
                                    if (!r.exc) {
                                        // Refresh the form to reflect the changes
                                        frm.reload_doc();
                                        dialog.hide();
                                    }
                                }
                            });
                        }
                    }
                );
            }
        });

        dialog.show();
    }
};

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
    
    // Generate scopes HTML
    const scopesHTML = frm.doc.scopes ? frm.doc.scopes.map((scope, index) => {
        const colorSet = SCOPE_COLORS[index % SCOPE_COLORS.length];
        const scopeItems = frm.doc.items.filter(item => item.scope_number === scope.scope_number);
        const totalAmount = scopeItems.reduce((sum, item) => sum + (item.overall_price || 0), 0);
        const itemCount = scopeItems.length;
        
        return `
            <div class="scope-item clickable" data-scope-number="${scope.scope_number}" style="background-color: ${colorSet.bg}; color: ${colorSet.text}">
                <div class="scope-number" style="background-color: ${colorSet.text}; color: ${colorSet.bg}">
                    ${scope.scope_number}
                </div>
                <div class="scope-details">
                    <div class="scope-name">${scope.description || 'Untitled Scope'}</div>
                    <div class="scope-stats">
                        <div class="scope-stat">
                            <i class="fa fa-cube"></i>
                            ${itemCount} items
                        </div>
                        <div class="scope-stat">
                            <i class="fa fa-money"></i>
                            ${formatCurrency(totalAmount)}
                        </div>
                    </div>
                </div>
            </div>
        `;
    }).join('') : '';

    const addScopeCard = `
        <div class="scope-item add-scope clickable" style="background: var(--fg-color); border: 1px dashed var(--gray-400);">
            <div class="scope-add-content">
                <i class="fa fa-plus" style="font-size: 20px; color: var(--text-muted);"></i>
                <div style="color: var(--text-muted);">Add Scope</div>
            </div>
        </div>
    `;

    const projectImage = frm.doc.image ? 
        `<img src="${frm.doc.image}" alt="${frm.doc.name}"/>` : 
        `<i class="fa fa-building-o fa-3x text-muted"></i>`;

    // Project Image Section
    const projectImageSection = `
        <div class="project-image-section">
            <div class="project-image clickable">
                ${projectImage}
            </div>
            <button class="btn btn-default btn-sm btn-block mt-2 view-items-btn">
                <i class="fa fa-list"></i> View Items
            </button>
            <button class="btn btn-default btn-sm btn-block mt-2 project-financials-btn">
                <i class="fa fa-money"></i> Project Financials
            </button>
        </div>
    `;

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

.overview-card.expenses::after {
    background: var(--red);
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
    width: 30px;
    height: 30px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
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

.grid-body input.form-control{
    background-color: unset;
    color: unset;
}

.summary-card {
    background: var(--subtle-fg);
    border-radius: 0;
    border-bottom: 1px solid var(--border-color);
    padding: var(--padding-lg);
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
    color: var(--text-on-blue);
    border: 1px solid var(--blue-600);
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
    grid-template-columns: auto 1fr auto;
    gap: var(--padding-lg);
    margin-bottom: var(--padding-xl);
    background: var(--card-bg);
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius-lg);
    padding: var(--padding-lg);
}

.project-image-section {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--padding-sm);
    margin-bottom: var(--padding-lg);
}

.project-image {
    width: 180px;
    height: 180px;
    border-radius: var(--border-radius);
    background: var(--card-bg);
    border: 1px solid var(--border-color);
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

.view-items-btn, .project-financials-btn {
    width: 180px;
    margin-top: var(--padding-xs);
}

@media (max-width: 991px) {
    .project-image-section {
        width: 100%;
        margin-bottom: var(--padding-lg);
    }
    
    .project-image {
        width: 100%;
        max-width: 300px;
        height: 200px;
    }

    .view-items-btn, .project-financials-btn  {
        width: 100%;
        max-width: 300px;
    }
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

.project-name, .project-location, .project-image-section {
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
    color: var(--green-600);
}

.status-cancelled {
    background: var(--bg-gray);
    color: var(--text-on-gray);
}

@media (max-width: 768px) {
    .project-header {
        grid-template-columns: 1fr;
    }
    
    .project-image-section {
        width: 100%;
        height: 200px;
    }
}

.project-scopes {
    border-left: 1px solid var(--border-color);
    padding-left: var(--padding-lg);
}

.scopes-title {
    font-size: var(--text-lg);
    font-weight: 600;
    color: var(--text-color);
    margin-bottom: var(--padding-md);
}

.scopes-list {
    display: flex;
    flex-direction: column;
    gap: var(--padding-sm);
}

.scope-item {
    display: flex;
    align-items: center;
    gap: var(--padding-sm);
    padding: var(--padding-md);
    border-radius: var(--border-radius-lg);
    transition: all 0.2s;
}

.scope-number {
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: var(--border-radius-full);
    font-weight: 600;
    font-size: var(--text-sm);
}

.add-scope{
    justify-content: center;
    align-items: center;
    text-align: center;
}

.scope-details {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 2px;
}

.scope-name {
    font-weight: 500;
    font-size: var(--text-base);
}

.scope-stats {
    display: flex;
    gap: var(--padding-md);
    font-size: var(--text-sm);
}

.scope-stat {
    display: flex;
    align-items: center;
    gap: 4px;
}

.scope-stat i {
    font-size: var(--text-sm);
}



/* Finance Section Styles */
.finance-section {
    margin-bottom: 2rem;
    padding: 1.5rem;
    background: var(--card-bg);
    border-radius: var(--border-radius-lg);
    box-shadow: var(--card-shadow);
}

.section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
}

.section-header h2 {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--text-color);
}

/* Additional Expenses Styles */
.info-panel {
    background: var(--subtle-fg);
    padding: 1rem;
    border-radius: var(--border-radius);
}

.info-panel p {
    margin: 0;
    color: var(--text-muted);
    font-size: var(--text-xs)
}

.info-panel i {
    color: var(--text-muted);
    margin-right: 0.5rem;
}

.expenses-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 1rem;
    margin-top: 1rem;
}

.expense-card {
    background: var(--card-bg);
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius);
    padding: 1rem;
    transition: all 0.2s ease;
}

.expense-card:hover {
    transform: translateY(-2px);
    box-shadow: var(--shadow-base);
}

.expense-title {
    font-weight: 600;
    color: var(--text-color);
    margin-bottom: 0.5rem;
}

.expense-description {
    color: var(--text-muted);
    font-size: 0.875rem;
    margin-bottom: 0.75rem;
    line-height: 1.4;
}

.expense-amount {
    color: var(--text-color);
    font-weight: 500;
    font-size: 1.125rem;
}
</style>
<div class="finance-dashboard">
<div class="project-header">
    ${projectImageSection}
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
    <div class="project-scopes">
        <div class="scopes-title">Project Scopes</div>
        <div class="scopes-list">
            ${scopesHTML}
            ${addScopeCard}
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
                    ${(frm.doc.profit_percentage || 0).toFixed(0)}%
                </span>
            </div>
        </div>
        
        <div class="overview-card net">
            <div class="label">Net Position</div>
            <div class="amount">${formatCurrency((frm.doc.due_receivables || 0) - (frm.doc.due_payables || 0))}</div>
            <div class="metric">Current Balance</div>
        </div>
        
        <div class="overview-card expenses">
            <div class="label">Additional Expenses</div>
            <div class="amount">${formatCurrency(frm.doc.total_additional_expenses || 0)}</div>
            <div class="metric">Auto-processed as paid</div>
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
                                <div class="scope" style="
                                    background: ${row.scope ? SCOPE_COLORS[(parseInt(row.scope) - 1) % SCOPE_COLORS.length].bg : 'var(--fg-color)'};
                                    color: ${row.scope ? SCOPE_COLORS[(parseInt(row.scope) - 1) % SCOPE_COLORS.length].text : 'var(--text-muted)'};
                                ">${row.scope || ''}</div>
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
                                <div class="scope" style="
                                    background: ${row.scope ? SCOPE_COLORS[(parseInt(row.scope) - 1) % SCOPE_COLORS.length].bg : 'var(--fg-color)'};
                                    color: ${row.scope ? SCOPE_COLORS[(parseInt(row.scope) - 1) % SCOPE_COLORS.length].text : 'var(--text-muted)'};
                                ">${row.scope || ''}</div>
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
                                <div class="scope" style="
                                    background: ${row.scope ? SCOPE_COLORS[(parseInt(row.scope) - 1) % SCOPE_COLORS.length].bg : 'var(--fg-color)'};
                                    color: ${row.scope ? SCOPE_COLORS[(parseInt(row.scope) - 1) % SCOPE_COLORS.length].text : 'var(--text-muted)'};
                                ">${row.scope || ''}</div>
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
                    ${frm.doc.total_additional_expenses > 0 ? `
                        <div class="payment-list-item">
                            <div class="date" style="font-weight: bold;">AUTO</div>
                            <div class="payment-info">
                                <p class="voucher" style="margin: 0">Additional expenses</p>
                                <div class="amount">${formatCurrency(frm.doc.total_additional_expenses)}</div>
                            </div>
                            <div class="payment-arrow arrow-outgoing">↑</div>
                        </div>
                    ` : ''}
                </div>
            </div>
        </div>
    </div>

    <!-- Draft Financing Section -->
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
                                <div class="scope" style="
                                    background: ${row.scope ? SCOPE_COLORS[(parseInt(row.scope) - 1) % SCOPE_COLORS.length].bg : 'var(--fg-color)'};
                                    color: ${row.scope ? SCOPE_COLORS[(parseInt(row.scope) - 1) % SCOPE_COLORS.length].text : 'var(--text-muted)'};
                                ">${row.scope || ''}</div>
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
                                <div class="scope" style="
                                    background: ${row.scope ? SCOPE_COLORS[(parseInt(row.scope) - 1) % SCOPE_COLORS.length].bg : 'var(--fg-color)'};
                                    color: ${row.scope ? SCOPE_COLORS[(parseInt(row.scope) - 1) % SCOPE_COLORS.length].text : 'var(--text-muted)'};
                                ">${row.scope || ''}</div>
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
                                <div class="scope" style="
                                    background: ${row.scope ? SCOPE_COLORS[(parseInt(row.scope) - 1) % SCOPE_COLORS.length].bg : 'var(--fg-color)'};
                                    color: ${row.scope ? SCOPE_COLORS[(parseInt(row.scope) - 1) % SCOPE_COLORS.length].text : 'var(--text-muted)'};
                                ">${row.scope || ''}</div>
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
                                <div class="scope" style="
                                    background: ${row.scope ? SCOPE_COLORS[(parseInt(row.scope) - 1) % SCOPE_COLORS.length].bg : 'var(--fg-color)'};
                                    color: ${row.scope ? SCOPE_COLORS[(parseInt(row.scope) - 1) % SCOPE_COLORS.length].text : 'var(--text-muted)'};
                                ">${row.scope || ''}</div>
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
                                <div class="scope" style="
                                    background: ${row.scope ? SCOPE_COLORS[(parseInt(row.scope) - 1) % SCOPE_COLORS.length].bg : 'var(--fg-color)'};
                                    color: ${row.scope ? SCOPE_COLORS[(parseInt(row.scope) - 1) % SCOPE_COLORS.length].text : 'var(--text-muted)'};
                                ">${row.scope || ''}</div>
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
                                <div class="scope" style="
                                    background: ${row.scope ? SCOPE_COLORS[(parseInt(row.scope) - 1) % SCOPE_COLORS.length].bg : 'var(--fg-color)'};
                                    color: ${row.scope ? SCOPE_COLORS[(parseInt(row.scope) - 1) % SCOPE_COLORS.length].text : 'var(--text-muted)'};
                                ">${row.scope || ''}</div>
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
                                <div class="scope" style="
                                    background: ${row.scope ? SCOPE_COLORS[(parseInt(row.scope) - 1) % SCOPE_COLORS.length].bg : 'var(--fg-color)'};
                                    color: ${row.scope ? SCOPE_COLORS[(parseInt(row.scope) - 1) % SCOPE_COLORS.length].text : 'var(--text-muted)'};
                                ">${row.scope || ''}</div>
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

    <!-- Additional Expenses Section -->
    <div class="finance-section additional-expenses">
        <div class="section-header">
            <h2>Additional Expenses</h2>
            <span class="total-badge">Total: ${formatCurrency(frm.doc.total_additional_expenses || 0)}</span>
        </div>
        <div class="info-panel mb-3">
            <p><i class="fa fa-info-circle"></i> Expenses listed here are automatically processed as paid. The total amount is incorporated into the final payable sum and adjusted in the balance calculation.</p>
        </div>
        <div class="expenses-grid">
            ${(frm.doc.additional_items || []).map(item => `
                <div class="expense-card clickable" data-item-idx="${item.idx}">
                    <div class="expense-title">${item.item || 'Untitled'}</div>
                    ${item.description ? `<div class="expense-description">${item.description}</div>` : ''}
                    <div class="expense-amount">${formatCurrency(item.amount || 0)}</div>
                </div>
            `).join('')}
            <div class="expense-card add-expense clickable" style="background: var(--fg-color); border: 1px dashed var(--gray-400);">
                <div class="expense-add-content" style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%;">
                    <i class="fa fa-plus" style="font-size: 20px; color: var(--text-muted);"></i>
                    <div style="color: var(--text-muted); margin-top: 8px;">Add Expense</div>
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

    // Scope click handlers
    $('.scope-item:not(.add-scope)').on('click', function(e) {
        if (!$(e.target).closest('.scope-actions').length) {
            const scopeNumber = parseInt($(this).data('scope-number'));
            showScopeDetailsDialog(frm, scopeNumber);
        }
    });

    // Add scope handler
    $('.add-scope').on('click', function() {
        showScopeEditDialog(frm);
    });

    // View items button handler
    $('.view-items-btn').on('click', function() {
        showItemsDialog(frm);
    });

    // Project financials button handler
    $('.project-financials-btn').on('click', function() {
        showProjectFinancialsDialog(frm);
    });

    // Add expense handler
    $('.add-expense').on('click', function() {
        rua_company.project_dashboard.showAddExpenseDialog(frm);
    });

    // Expense card click handler
    $('.expense-card:not(.add-expense)').on('click', function() {
        const idx = parseInt($(this).data('item-idx'));
        rua_company.project_dashboard.showExpenseDetailsDialog(frm, idx);
    });
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
                },
                onchange: function() {
                    const party = this.get_value();
                    if (party) {
                        frappe.db.get_value('Party', party, ['default_type', 'default_section'], (r) => {
                            if (r.default_type) {
                                dialog.set_value('type', r.default_type);
                            }
                            if (r.default_type === 'Supplier' && r.default_section) {
                                dialog.set_value('section', r.default_section);
                            }
                        });
                    }
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

// Function to show scope details dialog
function showScopeDetailsDialog(frm, scopeNumber) {
    const scope = frm.doc.scopes.find(s => s.scope_number === scopeNumber);
    if (!scope) return;

    const colorSet = SCOPE_COLORS[(scopeNumber - 1) % SCOPE_COLORS.length];
    const dialog = new frappe.ui.Dialog({
        title: `Scope ${scope.scope_number} Details`,
        fields: [
            {
                fieldtype: 'HTML',
                fieldname: 'scope_details',
                options: `
                    <div class="scope-details-container">
                        <!-- Header Section -->
                        <div class="scope-header" style="
                            background: ${colorSet.bg}; 
                            color: ${colorSet.text};
                            padding: var(--padding-lg);
                            border-radius: var(--border-radius-lg);
                            margin-bottom: var(--padding-lg);
                            display: flex;
                            justify-content: space-between;
                            align-items: flex-start;
                        ">
                            <div>
                                <h3 style="margin-bottom: var(--padding-sm); font-size: var(--text-xl);">
                                    ${scope.description || 'Untitled Scope'}
                                </h3>
                                <div>Scope Number: ${scope.scope_number}</div>
                            </div>
                            <div class="dialog-actions" style="display: flex; gap: var(--padding-xs);">
                                <button class="btn btn-default btn-xs btn-edit-scope" 
                                    style="background: ${colorSet.text}; color: ${colorSet.bg};">
                                    <i class="fa fa-pencil"></i> Edit
                                </button>
                                <button class="btn btn-default btn-xs btn-delete-scope"
                                    style="background: ${colorSet.text}; color: ${colorSet.bg};">
                                    <i class="fa fa-trash"></i> Delete
                                </button>
                            </div>
                        </div>

                        <!-- Base Parameters Section -->
                        <div class="section-container">
                            <h4 class="section-title">Base Parameters</h4>
                            <div class="parameters-grid">
                                <div class="scope-detail-card">
                                    <div class="detail-label">Glass SQM Price</div>
                                    <div class="detail-value">${formatCurrency(scope.glass_sqm_price)}</div>
                                </div>
                                <div class="scope-detail-card">
                                    <div class="detail-label">Labour Charges</div>
                                    <div class="detail-value">${formatCurrency(scope.labour_charges)}</div>
                                </div>
                                <div class="scope-detail-card">
                                    <div class="detail-label">Aluminum Weight</div>
                                    <div class="detail-value">${scope.aluminum_weight || 0} kg</div>
                                </div>
                                <div class="scope-detail-card">
                                    <div class="detail-label">SDF</div>
                                    <div class="detail-value">${scope.sdf || 0}</div>
                                </div>
                            </div>
                        </div>

                        <!-- Financial Parameters Section -->
                        <div class="section-container">
                            <h4 class="section-title">Financial Parameters</h4>
                            <div class="parameters-grid">
                                <div class="scope-detail-card">
                                    <div class="detail-label">Profit Percentage</div>
                                    <div class="detail-value highlighted">${scope.profit || 0}%</div>
                                </div>
                                <div class="scope-detail-card">
                                    <div class="detail-label">Retention Percentage</div>
                                    <div class="detail-value">${scope.retention || 0}%</div>
                                </div>
                                <div class="scope-detail-card">
                                    <div class="detail-label">VAT Rate</div>
                                    <div class="detail-value">${scope.vat || 0}%</div>
                                </div>
                                <div class="scope-detail-card">
                                    <div class="detail-label">VAT Inclusive</div>
                                    <div class="detail-value ${scope.vat_inclusive ? 'highlighted' : ''}">${scope.vat_inclusive ? 'Yes' : 'No'}</div>
                                </div>
                            </div>
                        </div>

                        <!-- Financial Calculations Section -->
                        <div class="section-container">
                            <h4 class="section-title">Financial Summary</h4>
                            
                            <div class="financial-flow-chart">
                                <!-- Starting Point -->
                                <div class="flow-row">
                                    <div class="flow-card main">
                                        <div class="flow-label">Total Price (Excl. VAT)</div>
                                        <div class="flow-value">${formatCurrency(scope.total_price_excluding_vat)}</div>
                                    </div>
                                </div>

                                <!-- Connector Lines -->
                                <div class="flow-connector">
                                    <div class="connector-line left"></div>
                                    <div class="connector-line right"></div>
                                </div>

                                <!-- Split Paths -->
                                <div class="flow-split">
                                    <!-- Left Side - VAT Path -->
                                    <div class="flow-column">
                                        <div class="flow-card">
                                            <div class="flow-label">+ VAT Amount</div>
                                            <div class="flow-value">${formatCurrency(scope.total_vat_amount)}</div>
                                        </div>
                                        <div class="flow-arrow"></div>
                                        <div class="flow-card highlighted">
                                            <div class="flow-label">Total Price (Incl. VAT)</div>
                                            <div class="flow-value positive">${formatCurrency(scope.total_price)}</div>
                                        </div>
                                        <div class="flow-connector">
                                            <div class="connector-line left"></div>
                                            <div class="connector-line right"></div>
                                        </div>
                                        <div class="flow-row space-between">
                                            <div class="flow-card small">
                                                <div class="flow-label">Total Cost</div>
                                                <div class="flow-value">${formatCurrency(scope.total_cost)}</div>
                                            </div>
                                            <div class="flow-card small positive">
                                                <div class="flow-label">Total Profit</div>
                                                <div class="flow-value">${formatCurrency(scope.total_profit)}</div>
                                            </div>
                                        </div>
                                    </div>

                                    <!-- Right Side - Retention Path -->
                                    <div class="flow-column">
                                        <div class="flow-card">
                                            <div class="flow-label">Price After Retention</div>
                                            <div class="flow-value">${formatCurrency(scope.price_after_retention)}</div>
                                        </div>
                                        <div class="flow-arrow"></div>
                                        <div class="flow-card">
                                            <div class="flow-label">+ VAT After Retention</div>
                                            <div class="flow-value">${formatCurrency(scope.vat_after_retention)}</div>
                                        </div>
                                        <div class="flow-arrow"></div>
                                        <div class="flow-card highlighted">
                                            <div class="flow-label">Total After Retention</div>
                                            <div class="flow-value positive">${formatCurrency(scope.total_price_after_retention)}</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                `
            }
        ],
        size: 'large'
    });

    dialog.$wrapper.find('.modal-dialog').css('max-width', '800px');
    
    // Add custom styles to the dialog
    dialog.$wrapper.append(`
        <style>
            .scope-details-container {
                padding: var(--padding-lg);
            }
            
            .section-container {
                margin-bottom: var(--padding-xl);
                background: var(--card-bg);
                border-radius: var(--border-radius-lg);
                padding: var(--padding-lg);
                box-shadow: var(--card-shadow);
            }
            
            .section-title {
                font-size: var(--text-lg);
                font-weight: 600;
                color: var(--heading-color);
                margin-bottom: var(--padding-md);
                padding-bottom: var(--padding-xs);
            }
            
            .parameters-grid {
                display: grid;
                grid-template-columns: repeat(4, 1fr);
                gap: var(--padding-md);
            }
            
            .scope-detail-card {
                background: var(--fg-color);
                border: 1px solid var(--border-color);
                border-radius: var(--border-radius-md);
                padding: var(--padding-sm);
            }
            
            .detail-label {
                font-size: var(--text-sm);
                color: var(--text-muted);
                margin-bottom: 2px;
            }
            
            .detail-value {
                font-size: var(--text-base);
                font-weight: 500;
            }
            
            .detail-value.highlighted {
                font-weight: bold;
            }

            /* Flow Chart Styles */
            .financial-flow-chart {
                padding: var(--padding-xl) var(--padding-sm);
                position: relative;
            }

            .flow-row {
                display: flex;
                justify-content: center;
                align-items: center;
                margin-bottom: var(--padding-lg);
            }

            .flow-row.space-between {
                justify-content: space-around;
                width: 100%;
            }

            .flow-card {
                background: var(--fg-color);
                border: 1px solid var(--border-color);
                border-radius: var(--border-radius-md);
                padding: var(--padding-md);
                min-width: 200px;
                text-align: center;
                position: relative;
                z-index: 2;
            }

            .flow-card.main {
                background: var(--bg-blue-100);
                border-color: var(--bg-blue-200);
            }

            .flow-card.highlighted {
                background: var(--bg-green-50);
                border-color: var(--bg-green-200);
            }

            .flow-card.small {
                min-width: 150px;
                padding: var(--padding-sm);
            }

            .flow-card.positive {
                background: var(--bg-green);
                color: var(--text-on-green);
                border-color: var(--green-600);
            }

            .flow-label {
                font-size: var(--text-sm);
                color: var(--text-muted);
                margin-bottom: 4px;
            }

            .flow-value {
                font-size: var(--text-base);
                font-weight: 600;
            }

            .flow-value.positive {
                color: var(--text-on-green);
            }

            .flow-split {
                display: flex;
                justify-content: space-around;
                margin-top: var(--padding-lg);
            }

            .flow-column {
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: var(--padding-md);
                position: relative;
                flex: 1;
                max-width: 45%;
            }

            .flow-connector {
                position: relative;
                height: 30px;
                width: 100%;
            }

            .connector-line {
                position: absolute;
                background: var(--border-color);
                height: 2px;
                top: 50%;
                transform-origin: center center;
            }

            .connector-line.left {
                left: 25%;
                width: 29%;
                transform: translateX(-50%) rotate(-45deg); /* Rotate the line diagonally */
            }

            .connector-line.right {
                right: 25%;
                width: 29%;
                transform: translateX(50%) rotate(45deg); /* Rotate the line diagonally in the opposite direction */
            }


            .flow-arrow {
                width: 2px;
                height: 30px;
                background: var(--border-color);
                position: relative;
                margin: 5px 0;
            }

            .flow-arrow::after {
                content: '';
                position: absolute;
                bottom: 0;
                left: 50%;
                transform: translateX(-50%);
                width: 0;
                height: 0;
                border-left: 6px solid transparent;
                border-right: 6px solid transparent;
                border-top: 6px solid var(--border-color);
            }

            @media (max-width: 768px) {
                .parameters-grid {
                    grid-template-columns: repeat(2, 1fr);
                }

                .flow-split {
                    flex-direction: column;
                    align-items: center;
                }

                .flow-column {
                    max-width: 100%;
                    margin-bottom: var(--padding-xl);
                }

                .flow-card {
                    min-width: 180px;
                }

                .connector-line {
                    display: none;
                }
            }
        </style>
    `);

    dialog.show();

    // Add event handlers for edit and delete buttons
    dialog.$wrapper.find('.btn-edit-scope').on('click', () => {
        dialog.hide();
        showScopeEditDialog(frm, scope);
    });

    dialog.$wrapper.find('.btn-delete-scope').on('click', () => {
        dialog.hide();
        deleteScope(frm, scope.scope_number);
    });
}

// Function to show scope edit dialog
function showScopeEditDialog(frm, scope = null) {
    frappe.db.get_single_value('Rua', 'vat').then(vat_value => {
        const dialog = new frappe.ui.Dialog({
            title: scope ? `Edit Scope ${scope.scope_number}` : 'Add New Scope',
            fields: [
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
                    fieldname: 'retention',
                    fieldtype: 'Percent',
                    label: 'Retention',
                    default: 0
                },
                {
                    fieldname: 'vat_inclusive',
                    fieldtype: 'Check',
                    label: 'VAT Inclusive',
                    default: 0
                },
                {
                    fieldname: 'vat',
                    fieldtype: 'Percent',
                    label: 'VAT',
                    default: vat_value,
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
            primary_action_label: scope ? 'Save Changes' : 'Add Scope',
            primary_action(values) {
                if (scope) {
                    // Check if there are items using this scope
                    const items_with_scope = frm.doc.items ? 
                        frm.doc.items.filter(item => item.scope_number === scope.scope_number) : [];
                    
                    const update_scope = () => {
                        // Update existing scope
                        const scope_idx = frm.doc.scopes.findIndex(s => s.scope_number === scope.scope_number);
                        if (scope_idx !== -1) {
                            Object.assign(frm.doc.scopes[scope_idx], values);
                            
                            // Update all items using this scope
                            if (frm.doc.items) {
                                frm.doc.items.forEach(item => {
                                    if (item.scope_number === scope.scope_number) {
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
                            rua_company.project_dashboard.render(frm);
                            frappe.show_alert({
                                message: __('Scope {0} updated', [scope.scope_number]),
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
                    Object.assign(row, values, { scope_number: next_scope_number });
                    
                    frm.refresh_field('scopes');
                    frm.dirty();
                    dialog.hide();
                    frm.save();
                    rua_company.project_dashboard.render(frm);
                    frappe.show_alert({
                        message: __('Scope {0} added', [next_scope_number]),
                        indicator: 'green'
                    });
                }
            }
        });
        
        // If editing, populate the fields with existing scope data
        if (scope) {
            dialog.set_values({
                description: scope.description,
                glass_sqm_price: scope.glass_sqm_price,
                labour_charges: scope.labour_charges,
                aluminum_weight: scope.aluminum_weight,
                sdf: scope.sdf,
                profit: scope.profit,
                retention: scope.retention,
                vat_inclusive: scope.vat_inclusive,
                vat: scope.vat,
                rounding: scope.rounding || 'Round up to nearest 5'
            });
        }
        
        dialog.show();
    });
}

// Function to delete scope
function deleteScope(frm, scopeNumber) {
    const scope = frm.doc.scopes.find(s => s.scope_number === scopeNumber);
    if (!scope) return;

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
            frm.save();
            rua_company.project_dashboard.render(frm);
            frappe.show_alert({
                message: __('Scope {0} removed', [scope.scope_number]),
                indicator: 'green'
            });
        }
    );
}

// Function to show project financials dialog
function showProjectFinancialsDialog(frm) {
    const dialog = new frappe.ui.Dialog({
        title: 'Project Financial Overview',
        size: 'extra-large',
        fields: [{
            fieldname: 'financials_html',
            fieldtype: 'HTML'
        }]
    });

    // Calculate project totals
    const projectTotals = {
        totalPriceExclVAT: 0,
        totalVAT: 0,
        totalPriceInclVAT: 0,
        totalRetention: 0,
        totalPriceAfterRetention: 0,
        totalCost: 0,
        totalProfit: 0
    };

    // Generate flowchart HTML
    const generateFlowchartHTML = () => {
        const scopeFlowcharts = frm.doc.scopes.map(scope => {
            // Calculate scope totals
            projectTotals.totalPriceExclVAT += scope.total_price_excluding_vat || 0;
            projectTotals.totalVAT += scope.total_vat_amount || 0;
            projectTotals.totalPriceInclVAT += scope.total_price || 0;
            projectTotals.totalRetention += (scope.total_price * (scope.retention || 0) / 100) || 0;
            projectTotals.totalPriceAfterRetention += scope.total_price_after_retention || 0;
            projectTotals.totalCost += scope.total_cost || 0;
            projectTotals.totalProfit += scope.total_profit || 0;

            const colorSet = SCOPE_COLORS[(parseInt(scope.scope_number) - 1) % SCOPE_COLORS.length];
            
            return `
                <div class="scope-flow-container">
                    <div class="scope-header" style="
                        background: ${colorSet.bg}; 
                        color: ${colorSet.text};
                        padding: 1rem;
                        border-radius: 8px 8px 0 0;
                        margin-bottom: 0;">
                        <h3 style="margin: 0; font-size: 1.1rem;">
                            <i class="fa fa-bookmark-o mr-2"></i>
                            Scope ${scope.scope_number}: ${scope.description || 'Untitled Scope'}
                        </h3>
                    </div>
                    <div class="scope-flow" style="
                        background: var(--card-bg);
                        border: 1px solid var(--border-color);
                        border-radius: 0 0 8px 8px;
                        padding: 1.5rem;
                        margin-bottom: 2rem;">
                        
                        <!-- Main Price Section -->
                        <div class="flow-section">
                            <div class="flow-node main" style="
                                background: ${colorSet.bg};
                                border: 2px solid ${colorSet.bg};
                                border-radius: 8px;
                                padding: 1rem;
                                text-align: center;
                                margin-bottom: 1.5rem;">
                                <div class="flow-label" style="
                                    color: var(--text-muted);
                                    font-size: 0.9rem;
                                    margin-bottom: 0.5rem;">Total Price (Excl. VAT)</div>
                                <div class="flow-value" style="
                                    font-size: 1.2rem;
                                    font-weight: 600;
                                    color: ${colorSet.text};">${formatCurrency(scope.total_price_excluding_vat)}</div>
                            </div>
                        </div>

                        <!-- Split Sections -->
                        <div class="flow-split" style="
                            display: grid;
                            grid-template-columns: 1fr 1fr;
                            gap: 2rem;">
                            
                            <!-- Left Branch - VAT and Total -->
                            <div class="flow-branch">
                                <div class="flow-node" style="
                                    background: var(--bg-color);
                                    border: 1px solid var(--border-color);
                                    border-radius: 8px;
                                    padding: 0.8rem;
                                    margin-bottom: 1rem;">
                                    <div class="flow-label" style="color: var(--text-muted); font-size: 0.9rem;">VAT Amount</div>
                                    <div class="flow-value" style="font-weight: 500;">${formatCurrency(scope.total_vat_amount)}</div>
                                </div>
                                
                                <div class="flow-node highlighted" style="
                                    background: ${colorSet.bg};
                                    border: 1px solid ${colorSet.bg};
                                    border-radius: 8px;
                                    padding: 1rem;
                                    margin-bottom: 1rem;">
                                    <div class="flow-label" style="color: var(--text-muted); font-size: 0.9rem;">Total Price (Incl. VAT)</div>
                                    <div class="flow-value" style="
                                        font-size: 1.1rem;
                                        font-weight: 600;
                                        color: ${colorSet.text};">${formatCurrency(scope.total_price)}</div>
                                </div>

                                <!-- Cost and Profit -->
                                <div class="flow-split secondary" style="
                                    display: grid;
                                    grid-template-columns: 1fr 1fr;
                                    gap: 1rem;">
                                    <div class="flow-node small" style="
                                        background: var(--bg-color);
                                        border: 1px solid var(--border-color);
                                        border-radius: 8px;
                                        padding: 0.8rem;">
                                        <div class="flow-label" style="
                                            color: var(--text-muted);
                                            font-size: 0.85rem;">Cost</div>
                                        <div class="flow-value" style="color: var(--red-600);">
                                            ${formatCurrency(scope.total_cost)}</div>
                                    </div>
                                    <div class="flow-node small positive" style="
                                        background: var(--bg-color);
                                        border: 1px solid var(--border-color);
                                        border-radius: 8px;
                                        padding: 0.8rem;">
                                        <div class="flow-label" style="
                                            color: var(--text-muted);
                                            font-size: 0.85rem;">Profit</div>
                                        <div class="flow-value" style="color: var(--green-600);">
                                            ${formatCurrency(scope.total_profit)}</div>
                                    </div>
                                </div>
                            </div>

                            <!-- Right Branch - Retention -->
                            <div class="flow-branch">
                                <div class="flow-node" style="
                                    background: var(--bg-color);
                                    border: 1px solid var(--border-color);
                                    border-radius: 8px;
                                    padding: 0.8rem;
                                    margin-bottom: 1rem;">
                                    <div class="flow-label" style="color: var(--text-muted); font-size: 0.9rem;">Price After Retention</div>
                                    <div class="flow-value" style="font-weight: 500;">${formatCurrency(scope.price_after_retention)}</div>
                                </div>
                                <div class="flow-node" style="
                                    background: var(--bg-color);
                                    border: 1px solid var(--border-color);
                                    border-radius: 8px;
                                    padding: 0.8rem;
                                    margin-bottom: 1rem;">
                                    <div class="flow-label" style="color: var(--text-muted); font-size: 0.9rem;">VAT After Retention</div>
                                    <div class="flow-value" style="font-weight: 500;">${formatCurrency(scope.vat_after_retention)}</div>
                                </div>
                                <div class="flow-node highlighted" style="
                                    background: ${colorSet.bg};
                                    border: 1px solid ${colorSet.bg};
                                    border-radius: 8px;
                                    padding: 1rem;">
                                    <div class="flow-label" style="color: var(--text-muted); font-size: 0.9rem;">Total After Retention</div>
                                    <div class="flow-value" style="
                                        font-size: 1.1rem;
                                        font-weight: 600;
                                        color: ${colorSet.text};">${formatCurrency(scope.total_price_after_retention)}</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        return `
            <div class="project-flow-container" style="max-width: 1200px; margin: auto;">
                <div class="project-header" style="
                    background: var(--card-bg);
                    border: 1px solid var(--border-color);
                    border-radius: 8px;
                    padding: 1.5rem;
                    margin-bottom: 2rem;
                    text-align: center;">
                    <h2 style="
                        margin: 0;
                        color: var(--heading-color);
                        font-size: 1.5rem;
                        font-weight: 600;">
                        <i class="fa fa-building-o mr-2"></i>
                        SN#${frm.doc.serial_number || '0'}: ${frm.doc.project_name || frm.doc.name}
                    </h2>
                </div>

                <div class="scopes-flow">
                    ${scopeFlowcharts}
                </div>

                <!-- Project Summary Section -->
                <div class="project-summary" style="
                    background: var(--card-bg);
                    border: 1px solid var(--border-color);
                    border-radius: 8px;
                    overflow: hidden;">
                    <div class="summary-header" style="
                        background: var(--bg-color);
                        padding: 1rem;
                        border-bottom: 1px solid var(--border-color);">
                        <h3 style="
                            margin: 0;
                            color: var(--heading-color);
                            font-size: 1.2rem;">
                            <i class="fa fa-calculator mr-2"></i>
                            Project Summary
                        </h3>
                    </div>

                    <div class="summary-grid" style="
                        display: grid;
                        grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
                        gap: 1.5rem;
                        padding: 1.5rem;">
                        
                        <!-- Summary Cards -->
                        <div class="summary-card" style="
                            background: var(--bg-color);
                            border: 1px solid var(--border-color);
                            border-radius: 8px;
                            flex-direction: column;
                            padding: 1rem;">
                            <div class="card-label" style="
                                color: var(--text-muted);
                                font-size: 0.9rem;
                                margin-bottom: 0.5rem;">Total Price (Excl. VAT)</div>
                            <div class="card-value" style="
                                font-size: 1.2rem;
                                font-weight: 600;">${formatCurrency(projectTotals.totalPriceExclVAT)}</div>
                        </div>

                        <div class="summary-card" style="
                            background: var(--bg-color);
                            border: 1px solid var(--border-color);
                            border-radius: 8px;
                            flex-direction: column;
                            padding: 1rem;">
                            <div class="card-label" style="
                                color: var(--text-muted);
                                font-size: 0.9rem;
                                margin-bottom: 0.5rem;">Total VAT</div>
                            <div class="card-value" style="
                                font-size: 1.2rem;
                                font-weight: 600;">${formatCurrency(projectTotals.totalVAT)}</div>
                        </div>

                        <div class="summary-card highlighted" style="
                            background: var(--bg-color);
                            border: 1px solid var(--border-color);
                            border-radius: 8px;
                            flex-direction: column;
                            padding: 1rem;">
                            <div class="card-label" style="
                                color: var(--text-muted);
                                font-size: 0.9rem;
                                margin-bottom: 0.5rem;">Total Price (Incl. VAT)</div>
                            <div class="card-value" style="
                                font-size: 1.3rem;
                                font-weight: 600;
                                color: var(--text-color);">${formatCurrency(projectTotals.totalPriceInclVAT)}</div>
                        </div>

                        <div class="summary-card" style="
                            background: var(--bg-color);
                            border: 1px solid var(--border-color);
                            border-radius: 8px;
                            flex-direction: column;
                            padding: 1rem;">
                            <div class="card-label" style="
                                color: var(--text-muted);
                                font-size: 0.9rem;
                                margin-bottom: 0.5rem;">Total Retention</div>
                            <div class="card-value" style="
                                font-size: 1.2rem;
                                font-weight: 600;">${formatCurrency(projectTotals.totalRetention)}</div>
                        </div>

                        <div class="summary-card highlighted" style="
                            background: var(--bg-color);
                            border: 1px solid var(--border-color);
                            border-radius: 8px;
                            flex-direction: column;
                            padding: 1rem;">
                            <div class="card-label" style="
                                color: var(--text-muted);
                                font-size: 0.9rem;
                                margin-bottom: 0.5rem;">Total After Retention</div>
                            <div class="card-value" style="
                                font-size: 1.3rem;
                                font-weight: 600;
                                color: var(--text-color);">${formatCurrency(projectTotals.totalPriceAfterRetention)}</div>
                        </div>

                        <div class="summary-card" style="
                            background: var(--bg-red);
                            border: 1px solid var(--red-600);
                            border-radius: 8px;
                            flex-direction: column;
                            padding: 1rem;">
                            <div class="card-label" style="
                                color: var(--text-muted);
                                font-size: 0.9rem;
                                margin-bottom: 0.5rem;">Total Cost</div>
                            <div class="card-value" style="
                                font-size: 1.2rem;
                                font-weight: 600;
                                color: var(--text-on-red);">${formatCurrency(projectTotals.totalCost)}</div>
                        </div>

                        <div class="summary-card" style="
                            background: var(--bg-green);
                            border: 1px solid var(--green-600);
                            border-radius: 8px;
                            flex-direction: column;
                            padding: 1rem;">
                            <div class="card-label" style="
                                color: var(--text-muted);
                                font-size: 0.9rem;
                                margin-bottom: 0.5rem;">Total Profit</div>
                            <div class="card-value" style="
                                font-size: 1.2rem;
                                font-weight: 600;
                                color: var(--green-600);">${formatCurrency(projectTotals.totalProfit)}</div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    };

    dialog.fields_dict.financials_html.$wrapper.html(generateFlowchartHTML());
    dialog.show();
}

// Function to show items dialog
function showItemsDialog(frm) {
    let currentScope = 'all';
    
    let dialog = new frappe.ui.Dialog({
        title: 'Project Items',
        size: 'extra-large',
        fields: [
            {
                fieldname: 'filters_section',
                fieldtype: 'Section Break',
                label: 'Filters'
            },
            {
                fieldname: 'scope_chips_html',
                fieldtype: 'HTML'
            },
            {
                fieldname: 'search',
                fieldtype: 'Data',
                label: 'Search Items',
                placeholder: 'Search by item or description...'
            },
            {
                fieldname: 'items_html',
                fieldtype: 'HTML'
            }
        ]
    });

    // Function to render scope filter chips
    function renderScopeChips() {
        const scopeChips = ['all', ...frm.doc.scopes.map(s => s.scope_number)];
        const chipsHTML = `
            <div class="scope-chips">
                ${scopeChips.map((scope, index) => {
                    const isAll = scope === 'all';
                    const colorSet = isAll ? {bg: 'var(--fg-color)', text: 'var(--text-color)'} 
                                        : SCOPE_COLORS[(parseInt(scope) - 1) % SCOPE_COLORS.length];
                    const isActive = currentScope === scope;
                    return `
                        <div class="scope-chip ${isActive ? 'active' : ''}" 
                             data-scope="${scope}"
                             style="background: ${colorSet.bg}; 
                                    color: ${colorSet.text};
                                    border: 2px solid ${isActive ? colorSet.text : 'transparent'};
                                    box-shadow: ${isActive ? `0 2px 6px ${colorSet.bg}` : 'none'};
                                    transform: ${isActive ? 'translateY(-2px)' : 'none'}">
                            ${isAll ? 'All Scopes' : `Scope ${scope}`}
                        </div>
                    `;
                }).join('')}
            </div>
        `;
        dialog.fields_dict.scope_chips_html.$wrapper.html(chipsHTML);
    }

    // Function to render items table
    function renderItemsTable(items) {
        const headers = [
            { label: 'Item Details', cols: ['Item', 'Description'], color: 'blue' },
            { label: 'Dimensions', cols: ['Width', 'Height'], color: 'purple' },
            { label: 'Glass', cols: ['Unit', 'Price', 'Total'], color: 'green' },
            { label: 'Aluminum', cols: ['Unit', 'Price', 'Total'], color: 'orange' },
            { label: 'Total', cols: ['Overall Price'], color: 'red' }
        ];

        // Group items by scope
        const groupedItems = {};
        items.forEach(item => {
            if (!groupedItems[item.scope_number]) {
                groupedItems[item.scope_number] = [];
            }
            groupedItems[item.scope_number].push(item);
        });

        const tableHTML = `
            <div class="items-table-container">
                <table class="table table-bordered items-table" style="margin: 0">
                    <thead>
                        <tr class="header-group">
                            ${headers.map(group => `
                                <th colspan="${group.cols.length}" class="text-center"
                                    style="background: var(--bg-${group.color}); color: var(--text-on-${group.color});">
                                    ${group.label}
                                </th>
                            `).join('')}
                        </tr>
                        <tr>
                            ${headers.map(group => 
                                group.cols.map(col => `
                                    <th style="background: var(--subtle-accent);">
                                        ${col}
                                    </th>
                                `).join('')
                            ).join('')}
                        </tr>
                    </thead>
                    <tbody>
                        ${Object.entries(groupedItems).map(([scopeNumber, scopeItems]) => {
                            const scope = frm.doc.scopes.find(s => s.scope_number === scopeNumber);
                            const colorSet = SCOPE_COLORS[(parseInt(scopeNumber) - 1) % SCOPE_COLORS.length];
                            return `
                                <tr class="scope-header">
                                    <td colspan="${headers.reduce((sum, h) => sum + h.cols.length, 0)}"
                                        style="background: ${colorSet.bg}; color: ${colorSet.text}; font-weight: 600;">
                                        Scope ${scopeNumber}
                                    </td>
                                </tr>
                                ${scopeItems.map(item => `
                                    <tr class="item-row" style="background: ${colorSet.bg}10;">
                                        <td class="item-cell">${item.item || ''}</td>
                                        <td class="desc-cell">${item.description || ''}</td>
                                        <td class="text-center">${item.width || 0}cm</td>
                                        <td class="text-center">${item.height || 0}cm</td>
                                        <td>${formatCurrency(item.glass_unit)}</td>
                                        <td class="text-right">${formatCurrency(item.glass_price)}</td>
                                        <td class="text-right">${formatCurrency(item.total_glass)}</td>
                                        <td>${formatCurrency(item.aluminum_unit)}</td>
                                        <td class="text-right">${formatCurrency(item.aluminum_price)}</td>
                                        <td class="text-right">${formatCurrency(item.total_aluminum)}</td>
                                        <td class="text-right total-cell">${formatCurrency(item.overall_price)}</td>
                                    </tr>
                                    <tr class="formula-row" style="background: ${colorSet.bg}05;">
                                        <td colspan="2"></td>
                                        <td colspan="2" class="formula-cell glass-formula area-formula">
                                        Area: ${item.area || 0}sqm
                                        </td>
                                        <td colspan="6" class="formula-cell glass-formula actual-formula">
                                            [Actual Unit (Inc. Labour): ${formatCurrency(item.actual_unit)}] + [Profit: ${formatCurrency(item.total_profit)}] = [Actual Unit Rate: ${formatCurrency(item.actual_unit_rate)}] × [QTY: ${item.qty}]
                                        </td>
                                        <td></td>
                                    </tr>
                                `).join('')}
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        `;

        dialog.fields_dict.items_html.$wrapper.html(tableHTML);
    }

    // Function to filter items
    function filterItems() {
        const searchText = (dialog.get_value('search') || '').toLowerCase();
        let filteredItems = frm.doc.items;

        if (currentScope !== 'all') {
            filteredItems = filteredItems.filter(item => item.scope_number === currentScope);
        }

        if (searchText) {
            filteredItems = filteredItems.filter(item => 
                (item.item && item.item.toLowerCase().includes(searchText)) ||
                (item.description && item.description.toLowerCase().includes(searchText))
            );
        }

        renderItemsTable(filteredItems);
    }

    // Add event listeners
    dialog.fields_dict.search.df.onchange = filterItems;

    // Add custom styles
    dialog.$wrapper.append(`
        <style>
            .scope-chips {
                display: flex;
                flex-wrap: wrap;
                gap: var(--padding-xs);
                padding: var(--padding-sm) 0;
            }
            
            .scope-chip {
                padding: 6px 16px;
                border-radius: 20px;
                cursor: pointer;
                font-size: var(--text-sm);
                transition: all 0.2s;
                font-weight: 500;
            }
            
            .scope-chip:hover {
                opacity: 0.9;
                transform: translateY(-1px);
            }

            .scope-chip.active {
                font-weight: 600;
            }
            
            .items-table-container {
                max-height: 60vh;
                overflow-y: auto;
                border-radius: var(--border-radius-lg);
                background: var(--card-bg);
            }
            
            .items-table {
                margin-bottom: 0;
                border-collapse: separate;
                border-spacing: 0;
            }
            
            .items-table th {
                position: sticky;
                top: 0;
                z-index: 1;
                font-weight: 600;
                white-space: nowrap;
                padding: var(--padding-sm);
                border-color: var(--table-border-color);
            }
            
            .items-table .header-group th {
                top: 0;
                padding: 12px;
                font-weight: 600;
                text-transform: uppercase;
                font-size: var(--text-sm);
                letter-spacing: 0.5px;
                border-color: var(--table-border-color);
            }

            .items-table .header-group th:first-child {
                border-top-left-radius: var(--border-radius-lg);
            }

            .items-table .header-group th:last-child {
                border-top-right-radius: var(--border-radius-lg);
            }
            
            .scope-header td {
                padding: 10px var(--padding-lg);
                border-color: var(--table-border-color);
            }
            
            .items-table td {
                padding: var(--padding-sm);
                vertical-align: middle;
                border-color: var(--table-border-color);
            }
            
            .formula-row td {
                border-top: none;
                padding-top: 0;
                padding-bottom: var(--padding-sm);
            }

            .formula-cell {
                color: var(--text-muted);
                font-size: var(--text-xs);
                font-family: var(--font-family-monospace);
                background: var(--subtle-fg);
                margin: 0 var(--padding-xs);
            }

            .area-formula {
                color: var(--text-muted);
                padding: var(--padding-xs) var(--padding-sm);
                text-align: center;
                font-weight: bold;
                background-color: var(--bg-purple);
                color: var(--text-on-purple)
            }

            .actual-formula {
                color: var(--text-muted);
                padding: var(--padding-xs) var(--padding-sm);
            }
            
            .item-cell {
                font-weight: 500;
                min-width: 120px;
            }
            
            .desc-cell {
                min-width: 200px;
                color: var(--text-muted);
            }
            
            .total-cell {
                font-weight: 600;
                color: var(--text-color);
            }
            
            .text-right {
                text-align: right;
            }
            
            .text-center {
                text-align: center;
            }
        </style>
    `);

    // Initialize
    renderScopeChips();
    filterItems();

    // Add click handler for scope chips
    dialog.$wrapper.on('click', '.scope-chip', function() {
        currentScope = $(this).data('scope');
        dialog.$wrapper.find('.scope-chip').removeClass('active');
        $(this).addClass('active');
        filterItems();
    });

    dialog.show();
}

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

// Initialize the dashboard
frappe.ui.form.on('Project', {
    refresh: function(frm) {
        rua_company.project_dashboard.render(frm);
    }
});
