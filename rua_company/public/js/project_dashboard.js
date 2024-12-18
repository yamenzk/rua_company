// Initialize rua_company namespace if it doesn't exist
frappe.provide("rua_company");
frappe.provide("rua_company.project_dashboard");

// Define the dashboard object first
rua_company.project_dashboard = {
  render: function (frm) {
    // Remove any existing listeners before generating new HTML
    removeExistingListeners();

    // Generate dashboard HTML
    generateDashboardHTML(frm);

    // Attach event listeners
    attachDashboardEventListeners(frm);
    listenersAttached = true;
  },
  showAddExpenseDialog: function(frm) {
    rua_company.project_dialogs.showAddExpenseDialog(frm);
  },
  showExpenseDetailsDialog: function(frm, idx) {
    rua_company.project_dialogs.showExpenseDetailsDialog(frm, idx);
  },
  showManagePartiesDialog: function(frm) {
    rua_company.project_dialogs.showManagePartiesDialog(frm);
  },
  showScopeDetailsDialog: function(frm, scopeNumber) {
    const scope = frm.doc.scopes.find(s => s.scope_number === scopeNumber);
    if (!scope) {
      frappe.throw(__("Scope {0} not found", [scopeNumber]));
      return;
    }
    rua_company.project_dialogs.showScopeDetailsDialog(frm, scope);
  },
  showScopeEditDialog: function(frm, scope = null) {
    rua_company.project_dialogs.showScopeEditDialog(frm, scope);
  },
  showProjectFinancialsDialog: function(frm) {
    rua_company.project_dialogs.showProjectFinancialsDialog(frm);
  },
  showItemsDialog: function(frm) {
    rua_company.project_dialogs.showItemsDialog(frm);
  },
  showContractValueDialog: function(frm) {
    rua_company.project_dialogs.showContractValueDialog(frm);
  }
};

// Helper function to format currency
const formatCurrency = (amount) => {
  return (
    new Intl.NumberFormat("en-AE", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount || 0) + " AED"
  );
};

// Helper function to format date
const formatDate = (dateStr) => {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  });
};

// Helper function to get scope styling
function getScopeStyle(scopeNumber) {
  if (!scopeNumber) return {
    bg: 'var(--fg-color)',
    text: 'var(--text-muted)'
  };
  
  const colorSet = SCOPE_COLORS[(parseInt(scopeNumber) - 1) % SCOPE_COLORS.length];
  return {
    bg: colorSet.bg,
    text: colorSet.text
  };
}

// Helper function to format status text
function formatStatus(status) {
  if (status === "Not Billable") return "N/B";
  if (status === "Partially Paid") return "Partial";
  return status || "";
}

// Helper function to render document list items
function renderDocListItems(items, emptyMessage = 'No items found') {
  if (!items?.length) return `<div class="empty-state">${emptyMessage}</div>`;
  
  return items.map(row => {
    const style = getScopeStyle(row.scope);
    return `
      <div class="doc-list-item">
        <div class="scope" style="background: ${style.bg}; color: ${style.text};">
          ${row.scope || ""}
        </div>
        <div class="doc-info">
          <a href="/app/project-bill/${row.bill}" class="bill">${row.bill}</a>
          <div class="amount">${formatCurrency(row.grand_total)}</div>
        </div>
        ${row.status ? `
          <span class="status-chip status-${(row.status || "").toLowerCase().replace(" ", "-")}">
            ${formatStatus(row.status)}
          </span>
        ` : `<span class="draft-badge">Draft</span>`}
      </div>
    `;
  }).join('');
}

// Helper function to render payment list items
function renderPaymentListItems(items, direction = 'incoming', emptyMessage = 'No payments found') {
  if (!items?.length) return `<div class="empty-state">${emptyMessage}</div>`;
  
  return items.map(row => `
    <div class="payment-list-item">
      <div class="date">${formatDate(row.date)}</div>
      <div class="payment-info">
        <a href="/app/payment-voucher/${row.voucher}" class="voucher">${row.voucher}</a>
        <div class="amount">${formatCurrency(row.amount)}</div>
      </div>
      <div class="payment-arrow arrow-${direction}">
        ${direction === 'incoming' ? '↓' : '↑'}
      </div>
    </div>
  `).join('');
}

// Helper function to render document category section
function renderDocumentCategory(items, categoryTitle) {
  return items?.length ? `
    <div class="doc-category">${categoryTitle}</div>
    ${renderDocListItems(items)}
  ` : '';
}

// Helper function to render document block with multiple categories
function renderDocumentBlock(submittedDocs, draftDocs, blockTitle, emptyMessage) {
  return `
    <div class="summary-block">
      <div class="summary-card">
        <div class="title">${blockTitle}</div>
      </div>
      <div class="doc-list-container">
        ${submittedDocs?.length ? renderDocumentCategory(submittedDocs, `Submitted ${blockTitle}`) : ''}
        ${draftDocs?.length ? renderDocumentCategory(draftDocs, `Draft ${blockTitle}`) : ''}
        ${!submittedDocs?.length && !draftDocs?.length ? `<div class="empty-state">${emptyMessage}</div>` : ''}
      </div>
    </div>
  `;
}

// Helper function to calculate scope statistics
function calculateScopeStats(scope, items) {
  const scopeItems = items.filter(item => item.scope_number === scope.scope_number);
  return {
    itemCount: scopeItems.length,
    totalValue: scopeItems.reduce((sum, item) => sum + (item.overall_price || 0), 0)
  };
}

// Helper function to render scope item
function renderScopeItem(scope, index, items) {
    const stats = calculateScopeStats(scope, items);
    const style = getScopeStyle(scope.scope_number);
    
    return `
        <div class="rua-scope-card" data-scope="${scope.scope_number}">
            <div class="rua-scope-header">
                <div class="rua-scope-number" style="background: ${style.text}">${scope.scope_number}</div>
                <h4 class="rua-scope-title">${scope.description || `Scope ${scope.scope_number}`}</h4>
            </div>
            
            <div class="rua-scope-stats">
                <div class="rua-scope-stat">
                    <i class="fa fa-cubes"></i>
                    <span>${stats.itemCount} Items</span>
                </div>
                <div class="rua-scope-stat">
                    <i class="fa fa-money"></i>
                    <span>${formatCurrency(stats.totalValue)}</span>
                </div>
            </div>
        </div>
    `;
}

// Helper function to render expense card
function renderExpenseCard(item) {
    return `
        <div class="expense-card clickable" data-item-idx="${item.idx}">
            <div class="expense-title">${item.item || "Untitled"}</div>
            ${item.description ? `<div class="expense-description">${item.description}</div>` : ""}
            <div class="expense-amount">${formatCurrency(item.amount || 0)}</div>
        </div>
    `;
}

// Helper function to render additional expenses section
function renderAdditionalExpenses(expenses, totalAmount) {
    return `
        <div class="finance-section additional-expenses">
            <div class="section-header">
                <h2>Additional Expenses</h2>
                <span class="total-badge">Total: ${formatCurrency(totalAmount || 0)}</span>
            </div>
            <div class="info-panel mb-3">
                <p><i class="fa fa-info-circle"></i> Expenses listed here are automatically processed as paid. The total amount is incorporated into the final payable sum and adjusted in the balance calculation.</p>
            </div>
            <div class="expenses-grid">
                ${(expenses || []).map(item => renderExpenseCard(item)).join("")}
                <div class="expense-card add-expense clickable" style="background: var(--fg-color); border: 1px dashed var(--gray-400);">
                    <div class="expense-add-content" style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%;">
                        <i class="fa fa-plus" style="font-size: 20px; color: var(--text-muted);"></i>
                        <div style="color: var(--text-muted); margin-top: 8px;">Add Expense</div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

// Define event listener configurations
const eventListenerConfig = [
    {
        selector: '.contract-value',
        event: 'click',
        handler: frm => () => rua_company.project_dashboard.showContractValueDialog(frm)
    },
    {
        selector: '.party-tag.add-party',
        event: 'click',
        handler: frm => () => rua_company.project_dashboard.showManagePartiesDialog(frm)
    },
    {
        selector: '.scope-item:not(.add-scope)',
        event: 'click',
        handler: frm => function(e) {
            if (!$(e.target).closest(".scope-actions").length) {
                const scopeNumber = parseInt($(this).data("scope-number"));
                rua_company.project_dashboard.showScopeDetailsDialog(frm, scopeNumber);
            }
        }
    },
    {
        selector: '.add-scope',
        event: 'click',
        handler: frm => () => rua_company.project_dashboard.showScopeEditDialog(frm)
    },
    {
        selector: '.view-items-btn',
        event: 'click',
        handler: frm => () => rua_company.project_dashboard.showItemsDialog(frm)
    },
    {
        selector: '.project-financials-btn',
        event: 'click',
        handler: frm => () => rua_company.project_dashboard.showProjectFinancialsDialog(frm)
    },
    {
        selector: '.expense-card.clickable:not(.add-expense)',
        event: 'click',
        handler: frm => function() {
            const idx = this.dataset.itemIdx;
            rua_company.project_dashboard.showExpenseDetailsDialog(frm, idx);
        }
    },
    {
        selector: '.expense-card.add-expense',
        event: 'click',
        handler: frm => () => rua_company.project_dashboard.showAddExpenseDialog(frm)
    },
    {
        selector: '.project-image',
        event: 'click',
        handler: frm => () => {
            frappe.prompt({
                label: 'Image URL',
                fieldname: 'image',
                fieldtype: 'Data',
                default: frm.doc.image || ''
            }, values => {
                frm.set_value('image', values.image);
                frm.save();
            }, 'Update Project Image');
        }
    },
    {
        selector: '.project-name',
        event: 'click',
        handler: frm => () => {
            frappe.prompt({
                label: 'Project Name',
                fieldname: 'project_name',
                fieldtype: 'Data',
                default: frm.doc.project_name || ''
            }, values => {
                frm.set_value('project_name', values.project_name);
                frm.save();
            }, 'Update Project Name');
        }
    },
    {
        selector: '.project-location',
        event: 'click',
        handler: frm => () => {
            frappe.prompt({
                label: 'Location',
                fieldname: 'location',
                fieldtype: 'Data',
                default: frm.doc.location || ''
            }, values => {
                frm.set_value('location', values.location);
                frm.save();
            }, 'Update Project Location');
        }
    }
];

// Function to generate dashboard HTML
function generateDashboardHTML(frm) {
    const dashboardContainer =
        document.getElementById("actual_billing_dash") ||
        createDashboardContainer(frm);

    // Generate scopes HTML
    const scopesHTML = frm.doc.scopes
        ? frm.doc.scopes
            .map((scope, index) => renderScopeItem(scope, index, frm.doc.items))
            .join("")
        : "";

    const dashboardHTML = `
<div class="rua-dashboard">
    <div class="rua-project-header">
        <div class="rua-header-main">
            <div class="rua-header-title-section">
                <div class="rua-header-title">
                    <h2 class="rua-project-title">${frm.doc.name}</h2>
                    <div class="rua-project-id">#${frm.doc.serial_number || ""}</div>
                </div>
                <div class="rua-project-status rua-status-${(frm.doc.status || "").toLowerCase().replace(" ", "-")}">
                    ${frm.doc.status || ""}
                </div>
            </div>

            <div class="rua-header-meta">
                <div class="rua-meta-item">
                    <i class="fa fa-map-marker"></i>
                    <span>${frm.doc.location || "Location not specified"}</span>
                </div>
                <div class="rua-meta-item">
                    <i class="fa fa-clock-o"></i>
                    <span>${formatDate(frm.doc.creation) || "Date not available"}</span>
                </div>
            </div>

            <div class="rua-project-parties">
                ${(frm.doc.parties || []).map((party) => `
                    <div class="rua-party-chip rua-party-${party.type.toLowerCase()}">
                        <i class="fa fa-${party.type === "Client" ? "user" : party.type === "Supplier" ? "truck" : "briefcase"}"></i>
                        <span>${party.party}</span>
                    </div>
                `).join("")}
                <button class="rua-add-party-btn">
                    <i class="fa fa-plus"></i>
                    Add Party
                </button>
            </div>
        </div>

        <div class="rua-header-actions">
            <button class="rua-action-btn rua-primary-btn view-items-btn">
                <i class="fa fa-list"></i>
                View Items
            </button>
            <button class="rua-action-btn rua-secondary-btn project-financials-btn">
                <i class="fa fa-money"></i>
                Financials
            </button>
        </div>
    </div>

    <div class="rua-scopes-section">
        <div class="rua-scopes-header">
            <h3 class="rua-scopes-title">Project Scopes</h3>
            <button class="rua-action-btn rua-secondary-btn">
                <i class="fa fa-plus"></i>
                Add Scope
            </button>
        </div>
        
        <div class="rua-scopes-grid">
            ${scopesHTML}
        </div>
    </div>

    <!-- Project Overview -->
    <div class="project-overview">
        <div class="overview-card clickable">
            <div class="label">Contract Value</div>
            <div class="amount value">${formatCurrency(frm.doc.contract_value || 0)}</div>
            <div class="metric">Total project value</div>
        </div>
        
        <div class="overview-card">
            <div class="label">Project Profit</div>
            <div class="amount ${(frm.doc.project_profit || 0) >= 0 ? "metric-positive" : "metric-negative"}">
                ${formatCurrency(frm.doc.project_profit)}
            </div>
            <div class="metric">
                ${(frm.doc.profit_percentage || 0).toFixed(1)}% margin
            </div>
        </div>
        
        <div class="overview-card">
            <div class="label">Net Position</div>
            <div class="amount net">${formatCurrency((frm.doc.due_receivables || 0) - (frm.doc.due_payables || 0))}</div>
            <div class="metric">Receivables - Payables</div>
        </div>
    </div>

    <!-- Receivables Section -->
    <div class="finance-section">
        <div class="section-header">
            <h2>Receivables</h2>
            <span class="total-badge">Due: ${formatCurrency(
              frm.doc.due_receivables
            )}</span>
        </div>
        
        <div class="section-content">
            <div class="summary-grid-3">
                <!-- Proformas Block -->
                <div class="summary-block">
                    <div class="summary-card">
                        <div class="title">Total Proformas</div>
                        <div class="value">${formatCurrency(
                          frm.doc.total_proformas
                        )}</div>
                    </div>
                    <div class="doc-list-container">
                        ${renderDocListItems(frm.doc.proformas, 'No proformas found')}
                    </div>
                </div>

                <!-- Invoices Block -->
                <div class="summary-block">
                    <div class="summary-card">
                        <div class="title">Total Invoices</div>
                        <div class="value">${formatCurrency(
                          frm.doc.total_invoices
                        )}</div>
                    </div>
                    <div class="doc-list-container">
                        ${renderDocListItems(frm.doc.invoices, 'No invoices found')}
                    </div>
                </div>

                <!-- Received Payments Block -->
                <div class="summary-block">
                    <div class="summary-card">
                        <div class="title">Total Received</div>
                        <div class="value">${formatCurrency(
                          frm.doc.total_received
                        )}</div>
                    </div>
                    <div class="payment-list-container">
                        ${renderPaymentListItems(frm.doc.received_table, 'incoming', 'No payments received')}
                    </div>
                </div>
            </div>
        </div>
    </div>

    <!-- Payables Section -->
    <div class="finance-section">
        <div class="section-header">
            <h2>Payables</h2>
            <span class="total-badge">Due: ${formatCurrency(
              frm.doc.due_payables
            )}</span>
        </div>
        
        <div class="section-content">
            <div class="summary-grid-2">
                <!-- Purchase Orders Block -->
                <div class="summary-block">
                    <div class="summary-card">
                        <div class="title">Total Purchase Orders</div>
                        <div class="value">${formatCurrency(
                          frm.doc.total_expenses
                        )}</div>
                    </div>
                    <div class="doc-list-container">
                        ${renderDocListItems(frm.doc.lpos, 'No purchase orders found')}
                    </div>
                </div>

                <!-- Paid Payments Block -->
                <div class="summary-block">
                    <div class="summary-card">
                        <div class="title">Total Paid</div>
                        <div class="value">${formatCurrency(
                          frm.doc.total_paid
                        )}</div>
                    </div>
                    <div class="payment-list-container">
                        ${renderPaymentListItems(frm.doc.paid_table, 'outgoing', 'No payments made')}
                        ${frm.doc.total_additional_expenses > 0 ? `
                        <div class="payment-list-item">
                            <div class="date" style="font-weight: bold;">AUTO</div>
                            <div class="payment-info">
                                <p class="voucher" style="margin: 0">Additional expenses</p>
                                <div class="amount">${formatCurrency(
                                  frm.doc.total_additional_expenses
                                )}</div>
                            </div>
                            <div class="payment-arrow arrow-outgoing">↑</div>
                        </div>
                        ` : ""}
                    </div>
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
            <div class="summary-grid-3">
                <!-- Proforma Drafts -->
                <div class="summary-block">
                    <div class="summary-card">
                        <div class="title">Proforma Drafts</div>
                    </div>
                    <div class="doc-list-container">
                        ${renderDocListItems(frm.doc.proforma_drafts, 'No proforma drafts found')}
                    </div>
                </div>

                <!-- LPO Drafts -->
                <div class="summary-block">
                    <div class="summary-card">
                        <div class="title">Purchase Order Drafts</div>
                    </div>
                    <div class="doc-list-container">
                        ${renderDocListItems(frm.doc.lpo_drafts, 'No purchase order drafts found')}
                    </div>
                </div>

                <!-- Invoice Drafts -->
                <div class="summary-block">
                    <div class="summary-card">
                        <div class="title">Invoice Drafts</div>
                    </div>
                    <div class="doc-list-container">
                        ${renderDocListItems(frm.doc.invoice_drafts, 'No invoice drafts found')}
                    </div>
                </div>
            </div>

            <!-- Second Row: Quotations and RFQs -->
            <div class="summary-grid-2" style="margin-top: var(--padding-lg);">
                <!-- Quotations Block -->
                ${renderDocumentBlock(
                  frm.doc.quotations,
                  frm.doc.quotation_drafts,
                  'Quotations',
                  'No quotations found'
                )}

                <!-- RFQs Block -->
                ${renderDocumentBlock(
                  frm.doc.rfqs,
                  frm.doc.rfq_drafts,
                  'RFQs',
                  'No RFQs found'
                )}
            </div>
        </div>
    </div>

    <!-- Additional Expenses Section -->
    ${renderAdditionalExpenses(frm.doc.additional_items, frm.doc.total_additional_expenses)}
  `;

    dashboardContainer.innerHTML = dashboardHTML;
}

// Function to create dashboard container
function createDashboardContainer(frm) {
    const dashboardContainer = document.createElement("div");
    dashboardContainer.id = "actual_billing_dash";
    // Add it after the form-dashboard section
    const formDashboard = frm.dashboard.wrapper;
    formDashboard.parentNode.insertBefore(
        dashboardContainer,
        formDashboard.nextSibling
    );
    return dashboardContainer;
}

// Function to attach event listeners to dashboard elements
function attachDashboardEventListeners(frm) {
    eventListenerConfig.forEach(config => {
        const elements = document.querySelectorAll(config.selector);
        elements.forEach(element => {
            if (element) {
                element.addEventListener(config.event, config.handler(frm));
            }
        });
    });
}

// Function to remove existing event listeners
function removeExistingListeners() {
    const elements = [
        '.project-image',
        '.project-name',
        '.project-location',
        '.party-tag.add-party',
        '.expense-card.clickable',
        '.scope-item.clickable'
    ];

    elements.forEach((selector) => {
        const elements = document.querySelectorAll(selector);
        elements.forEach(element => {
            if (element) {
                element.replaceWith(element.cloneNode(true));
            }
        });
    });

    listenersAttached = false;
}

// Initialize the dashboard
frappe.ui.form.on("Project", {
    refresh: function (frm) {
        rua_company.project_dashboard.render(frm);
    },
});
