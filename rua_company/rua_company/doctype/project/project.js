// Copyright (c) 2024, Yamen Zakhour and contributors
// For license information, please see license.txt

frappe.ui.form.on("Project", {
    refresh(frm) {
        updateProjectDisplay(frm);
    },
    
    project_name: function(frm) { updateProjectDisplay(frm); },
    location: function(frm) { updateProjectDisplay(frm); },
    contract_value: function(frm) { updateProjectDisplay(frm); },
    image: function(frm) { updateProjectDisplay(frm); },
    parties: function(frm) { updateProjectDisplay(frm); }
});

function getPartyIcon(type, section) {
    switch(type) {
        case 'Client':
            return `<svg class="party-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                <circle cx="12" cy="7" r="4"></circle>
            </svg>`;
        case 'Consultant':
            return `<svg class="party-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path>
                <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path>
            </svg>`;
        case 'Supplier':
            let sectionIcon = '';
            switch(section) {
                case 'Aluminum':
                    return `<svg class="party-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M12 2L2 7l10 5 10-5-10-5z"></path>
                        <path d="M2 17l10 5 10-5"></path>
                        <path d="M2 12l10 5 10-5"></path>
                    </svg>`;
                case 'Glass':
                    return `<svg class="party-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M12 2L2 7l10 5 10-5-10-5z"></path>
                        <path d="M2 17l10 5 10-5"></path>
                    </svg>`;
                case 'Cladding':
                    return `<svg class="party-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                        <line x1="3" y1="9" x2="21" y2="9"></line>
                        <line x1="3" y1="15" x2="21" y2="15"></line>
                    </svg>`;
                default:
                    return `<svg class="party-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                    </svg>`;
            }
    }
}

function getPartyChipClass(type, section) {
    let baseClass = 'party-chip';
    switch(type) {
        case 'Client':
            return `${baseClass} client-chip`;
        case 'Consultant':
            return `${baseClass} consultant-chip`;
        case 'Supplier':
            switch(section) {
                case 'Aluminum':
                    return `${baseClass} supplier-aluminum-chip`;
                case 'Glass':
                    return `${baseClass} supplier-glass-chip`;
                case 'Cladding':
                    return `${baseClass} supplier-cladding-chip`;
                default:
                    return `${baseClass} supplier-chip`;
            }
        default:
            return baseClass;
    }
}

function generatePartyChips(frm) {
    if (!frm.doc.parties || !frm.doc.parties.length) return '';
    
    const chips = frm.doc.parties.map(row => {
        const chipClass = getPartyChipClass(row.type, row.section);
        const icon = getPartyIcon(row.type, row.section);
        const sectionText = row.section ? ` - ${row.section}` : '';
        return `
            <div class="${chipClass}" data-party-idx="${row.idx}" style="cursor: pointer;">
                ${icon}
                <span class="chip-party-name">${row.party}</span>
                <span class="chip-party-type">${row.type}${sectionText}</span>
            </div>
        `;
    }).join('');
    
    return `
        <div class="party-chips-container">
            <div class="chips-label">Project Parties</div>
            <div class="party-chips">
                ${chips}
                <div class="party-chip add-party-chip" style="cursor: pointer;">
                    <svg class="party-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="12" y1="5" x2="12" y2="19"></line>
                        <line x1="5" y1="12" x2="19" y2="12"></line>
                    </svg>
                    <span class="chip-party-name">Add Party</span>
                </div>
            </div>
        </div>
    `;
}

function getTypeStyle(type, section) {
    switch(type) {
        case 'Client':
            return {
                background: '#e0f2fe',
                color: '#0369a1'
            };
        case 'Consultant':
            return {
                background: '#f1f5f9',
                color: '#475569'
            };
        case 'Supplier':
            if (section) {
                switch(section) {
                    case 'Aluminum':
                        return {
                            background: '#fef3c7',
                            color: '#92400e'
                        };
                    case 'Glass':
                        return {
                            background: '#e0f7fa',
                            color: '#006064'
                        };
                    case 'Cladding':
                        return {
                            background: '#fce7f3',
                            color: '#9d174d'
                        };
                }
            }
            return {
                background: '#f0fdf4',
                color: '#166534'
            };
        default:
            return {
                background: '#f3f4f6',
                color: '#374151'
            };
    }
}

function showPartyDetails(frm, party) {
    const typeStyle = getTypeStyle(party.type, party.section);
    
    let d = new frappe.ui.Dialog({
        title: `
            <div class="party-dialog-title">
                ${party.image ? 
                    `<img src="${party.image}" class="party-dialog-image" alt="${party.party}"/>` :
                    `<div class="party-dialog-image-placeholder">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                            <circle cx="12" cy="7" r="4"></circle>
                        </svg>
                    </div>`
                }
                <span class="party-dialog-name">${party.party}</span>
            </div>
        `,
        fields: [
            {
                fieldtype: 'HTML',
                fieldname: 'party_details',
                options: `
                    <div class="party-details">
                        <style>
                            .party-dialog-title {
                                display: flex;
                                align-items: center;
                                gap: 12px;
                                padding: 0 6px;
                            }
                            .party-dialog-image, .party-dialog-image-placeholder {
                                width: 32px;
                                height: 32px;
                                border-radius: 50%;
                                object-fit: cover;
                            }
                            .party-dialog-image-placeholder {
                                background: #f5f5f5;
                                display: flex;
                                align-items: center;
                                justify-content: center;
                                color: #999;
                            }
                            .party-dialog-name {
                                font-size: 18px;
                                font-weight: 600;
                                color: #1a1a1a;
                            }
                            .party-details {
                                padding: 15px 0;
                            }
                            .party-type-section {
                                margin-bottom: 24px;
                                padding: 12px 16px;
                                background: ${typeStyle.background};
                                color: ${typeStyle.color};
                                border-radius: 8px;
                                display: flex;
                                align-items: center;
                                gap: 8px;
                            }
                            .type-badge {
                                font-size: 14px;
                                font-weight: 500;
                            }
                            .section-badge {
                                font-size: 13px;
                                padding: 2px 8px;
                                border-radius: 12px;
                                background: rgba(0, 0, 0, 0.05);
                            }
                            .info-cards {
                                display: grid;
                                gap: 12px;
                                grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                            }
                            .info-card {
                                padding: 16px;
                                border-radius: 8px;
                                background: #ffffff;
                                border: 1px solid #e2e8f0;
                                transition: all 0.2s;
                                cursor: pointer;
                            }
                            .info-card:hover {
                                border-color: #cbd5e1;
                                box-shadow: 0 2px 4px rgba(0,0,0,0.05);
                                transform: translateY(-1px);
                            }
                            .card-label {
                                font-size: 12px;
                                text-transform: uppercase;
                                letter-spacing: 0.5px;
                                color: #64748b;
                                margin-bottom: 4px;
                            }
                            .card-value {
                                font-size: 14px;
                                color: #0f172a;
                                font-weight: 500;
                            }
                            .info-card.clickable {
                                position: relative;
                            }
                            .info-card.clickable::after {
                                content: "";
                                position: absolute;
                                right: 12px;
                                top: 50%;
                                transform: translateY(-50%);
                                width: 16px;
                                height: 16px;
                                background-image: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="%2364748b" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>');
                                background-size: contain;
                                opacity: 0.5;
                            }
                        </style>
                        <div class="party-type-section">
                            <span class="type-badge">${party.type}</span>
                            ${party.section ? `<span class="section-badge">${party.section}</span>` : ''}
                        </div>
                        <div class="info-cards">
                            ${party.phone ? `
                                <div class="info-card clickable" onclick="window.open('tel:${party.phone}', '_blank')">
                                    <div class="card-label">Phone</div>
                                    <div class="card-value">${party.phone}</div>
                                </div>
                            ` : ''}
                            ${party.email ? `
                                <div class="info-card clickable" onclick="window.open('mailto:${party.email}', '_blank')">
                                    <div class="card-label">Email</div>
                                    <div class="card-value">${party.email}</div>
                                </div>
                            ` : ''}
                            ${party.trn ? `
                                <div class="info-card clickable" onclick="frappe.utils.copy_to_clipboard('${party.trn}')">
                                    <div class="card-label">TRN</div>
                                    <div class="card-value">${party.trn}</div>
                                </div>
                            ` : ''}
                            ${party.emirate ? `
                                <div class="info-card">
                                    <div class="card-label">Emirate</div>
                                    <div class="card-value">${party.emirate}</div>
                                </div>
                            ` : ''}
                        </div>
                    </div>
                `
            }
        ],
        primary_action_label: 'Close',
        primary_action() {
            d.hide();
        },
        secondary_action_label: 'Remove Party',
        secondary_action() {
            frappe.confirm(
                `Are you sure you want to remove ${party.party} from this project?`,
                () => {
                    let parties = frm.doc.parties.filter(p => p.name !== party.name);
                    frappe.model.set_value(frm.doctype, frm.docname, 'parties', parties)
                        .then(() => {
                            frm.save().then(() => {
                                d.hide();
                                frappe.show_alert({
                                    message: __('Party Removed'),
                                    indicator: 'green'
                                });
                            });
                        });
                }
            );
        }
    });

    d.show();

    // Add copy success message
    document.querySelector('.info-card[onclick*="copy_to_clipboard"]')?.addEventListener('click', () => {
        frappe.show_alert({
            message: __('TRN Copied to Clipboard'),
            indicator: 'green'
        });
    });
}

function showAddPartyDialog(frm) {
    // Get current party names to exclude
    const currentParties = (frm.doc.parties || []).map(p => p.party);
    let partyDoc = null;
    
    let d = new frappe.ui.Dialog({
        title: 'Add New Party',
        fields: [
            {
                label: 'Party',
                fieldname: 'party',
                fieldtype: 'Link',
                options: 'Party',
                reqd: 1,
                get_query: () => {
                    return {
                        filters: [
                            ['name', 'not in', currentParties]
                        ]
                    };
                },
                onchange: function() {
                    const party = this.get_value();
                    if (party) {
                        frappe.db.get_doc('Party', party)
                            .then(doc => {
                                partyDoc = doc;
                                d.set_value('type', doc.default_type);
                                d.set_value('section', doc.default_section);
                                
                                // Show/hide section field based on type
                                if (doc.default_type === 'Supplier') {
                                    d.set_df_property('section', 'hidden', 0);
                                    d.set_df_property('section', 'reqd', 1);
                                } else {
                                    d.set_df_property('section', 'hidden', 1);
                                    d.set_df_property('section', 'reqd', 0);
                                }
                            });
                    }
                }
            },
            {
                label: 'Type',
                fieldname: 'type',
                fieldtype: 'Select',
                options: '\nSupplier\nConsultant\nClient',
                reqd: 1,
                onchange: function() {
                    const type = this.get_value();
                    if (type === 'Supplier') {
                        d.set_df_property('section', 'hidden', 0);
                        d.set_df_property('section', 'reqd', 1);
                    } else {
                        d.set_df_property('section', 'hidden', 1);
                        d.set_df_property('section', 'reqd', 0);
                        d.set_value('section', ''); // Clear section if not supplier
                    }
                }
            },
            {
                label: 'Section',
                fieldname: 'section',
                fieldtype: 'Select',
                options: '\nAluminum\nGlass\nCladding',
                hidden: 1
            }
        ],
        primary_action_label: 'Add',
        primary_action(values) {
            if (!partyDoc) return;

            // Create a new row in the child table
            let row = frm.add_child('parties', {
                party: values.party,
                type: values.type,
                section: values.section,
                phone: partyDoc.phone,
                email: partyDoc.email,
                trn: partyDoc.trn,
                emirate: partyDoc.emirate,
                image: partyDoc.image
            });

            // Mark the form as dirty and refresh
            frm.refresh_field('parties');
            frm.dirty();
            
            // Save the document
            frm.save()
                .then(() => {
                    d.hide();
                    frappe.show_alert({
                        message: __('Party Added Successfully'),
                        indicator: 'green'
                    });
                })
                .catch(err => {
                    frappe.throw(__('Error adding party: ' + err.message));
                });
        }
    });
    d.show();
}

function setupClickHandlers(frm) {
    // Project Name
    $('.project-name').off('click').on('click', function() {
        let d = new frappe.ui.Dialog({
            title: 'Edit Project Name',
            fields: [
                {
                    label: 'Project Name',
                    fieldname: 'project_name',
                    fieldtype: 'Data',
                    reqd: 1,
                    default: frm.doc.project_name
                }
            ],
            size: 'small',
            primary_action_label: 'Update',
            primary_action(values) {
                frappe.model.set_value(frm.doctype, frm.docname, 'project_name', values.project_name)
                    .then(() => {
                        frm.save().then(() => {
                            d.hide();
                            frappe.show_alert({
                                message: __('Project Name Updated'),
                                indicator: 'green'
                            });
                        });
                    });
            }
        });
        d.show();
    });

    // Location
    $('.meta-item').off('click').on('click', function() {
        let d = new frappe.ui.Dialog({
            title: 'Edit Location',
            fields: [
                {
                    label: 'Location',
                    fieldname: 'location',
                    fieldtype: 'Data',
                    reqd: 1,
                    default: frm.doc.location
                }
            ],
            size: 'small',
            primary_action_label: 'Update',
            primary_action(values) {
                frappe.model.set_value(frm.doctype, frm.docname, 'location', values.location)
                    .then(() => {
                        frm.save().then(() => {
                            d.hide();
                            frappe.show_alert({
                                message: __('Location Updated'),
                                indicator: 'green'
                            });
                        });
                    });
            }
        });
        d.show();
    });

    // Contract Value
    $('.value-display').off('click').on('click', function() {
        let d = new frappe.ui.Dialog({
            title: 'Edit Contract Value',
            fields: [
                {
                    label: 'Contract Value (AED)',
                    fieldname: 'contract_value',
                    fieldtype: 'Currency',
                    reqd: 1,
                    default: frm.doc.contract_value,
                    options: 'AED'
                }
            ],
            size: 'small',
            primary_action_label: 'Update',
            primary_action(values) {
                frappe.model.set_value(frm.doctype, frm.docname, 'contract_value', values.contract_value)
                    .then(() => {
                        frm.save().then(() => {
                            d.hide();
                            frappe.show_alert({
                                message: __('Contract Value Updated'),
                                indicator: 'green'
                            });
                        });
                    });
            }
        });
        d.show();
    });

    // Image
    $('.project-image-wrapper').off('click').on('click', function() {
        new frappe.ui.FileUploader({
            doctype: frm.doctype,
            docname: frm.docname,
            frm: frm,
            folder: 'Home/Attachments',
            on_success: (file_doc) => {
                frappe.model.set_value(frm.doctype, frm.docname, 'image', file_doc.file_url)
                    .then(() => {
                        frm.save().then(() => {
                            frappe.show_alert({
                                message: __('Image Updated'),
                                indicator: 'green'
                            });
                        });
                    });
            }
        });
    });

    // Party chip click handler
    $('.party-chip').not('.add-party-chip').off('click').on('click', function() {
        const idx = $(this).data('party-idx');
        const party = frm.doc.parties.find(p => p.idx === idx);
        if (party) {
            showPartyDetails(frm, party);
        }
    });

    // Add party chip click handler
    $('.add-party-chip').off('click').on('click', function() {
        showAddPartyDialog(frm);
    });
}

let showDraftsState = {
    'Purchase Order': false,
    'Tax Invoice': false,
    'Quotation': false,
    'Proforma': false,
    'Request for Quotation': false,
    'receive': false,
    'pay': false
};

function setupDraftToggles(frm) {
    $('.draft-toggle').each(function() {
        const $toggle = $(this);
        const type = $toggle.data('type');
        
        $toggle.off('change').on('change', function() {
            showDraftsState[type] = this.checked;
            updateProjectDisplay(frm);
        });
    });
}

function generateOverviewSections(frm, bills, receiveVouchers, payVouchers) {
    // Group bills by type
    const groupedBills = {};
    const totals = {};
    const allBillTypes = ['Purchase Order', 'Tax Invoice', 'Quotation', 'Proforma', 'Request for Quotation'];
    
    // Initialize all bill types with empty arrays
    allBillTypes.forEach(type => {
        groupedBills[type] = [];
        totals[type] = 0;
    });

    // Populate with actual bills
    bills.forEach(bill => {
        if (!groupedBills[bill.bill_type]) {
            groupedBills[bill.bill_type] = [];
            totals[bill.bill_type] = 0;
        }
        groupedBills[bill.bill_type].push(bill);
        totals[bill.bill_type] += bill.grand_total || 0;
    });

    // Calculate voucher totals
    const receiveTotal = receiveVouchers.reduce((sum, v) => sum + (v.payment_amount || 0), 0);
    const payTotal = payVouchers.reduce((sum, v) => sum + (v.payment_amount || 0), 0);

    // Generate bill card HTML
    const generateBillCard = (type, bills) => `
        <div class="overview-card">
            <div class="overview-header">
                <div class="header-content">
                    <div class="type-info">
                        <div class="title-row">
                            <span class="type-title">${type}</span>
                            <span class="count-badge">${bills.length}</span>
                        </div>
                        <label class="show-drafts-toggle">
                            <span class="toggle-label">Show Drafts</span>
                            <div class="toggle-switch-wrapper">
                                <input type="checkbox" class="draft-toggle" data-type="${type}" ${showDraftsState[type] ? 'checked' : ''}>
                                <div class="toggle-switch"></div>
                            </div>
                        </label>
                    </div>
                    <span class="total-amount">${format_currency(totals[type], 'AED', 0)}</span>
                </div>
            </div>
            <div class="virtual-list">
                <div class="item-list">
                    ${bills.length > 0 ? bills.map(bill => `
                        <div class="list-item">
                            <div class="item-info">
                                <div class="item-number">${bill.bill_number || '0'}</div>
                                <div class="item-date">${frappe.datetime.str_to_user(bill.date)}</div>
                            </div>
                            <div class="item-info">
                                <div class="item-name-row">
                                    <a href="/app/bill/${bill.name}" class="item-link">${bill.name}</a>
                                    ${bill.docstatus === 0 ? '<span class="draft-chip">Draft</span>' : ''}
                                </div>
                                <div class="item-amount">${format_currency(bill.grand_total || 0, 'AED', 0)}</div>
                            </div>
                            ${(bill.bill_type === 'Purchase Order' || bill.bill_type === 'Tax Invoice') ? `
                                <div class="payment-status ${bill.payment_status === 'Paid' ? 'status-paid' : 'status-unpaid'}">
                                    ${bill.payment_status || 'Unpaid'}
                                </div>
                            ` : ''}
                        </div>
                    `).join('') : `
                        <div class="empty-state">
                            <div class="empty-icon">📄</div>
                            <div class="empty-text">No ${type}s Found</div>
                            <div class="empty-subtext">Create a new ${type.toLowerCase()} to get started</div>
                        </div>
                    `}
                </div>
            </div>
        </div>
    `;

    // Generate voucher card HTML
    const generateVoucherCard = (type, vouchers, isReceive) => `
        <div class="overview-card">
            <div class="overview-header">
                <div class="header-content">
                    <div class="type-info">
                        <div class="title-row">
                            <span class="type-title">${type}</span>
                            <span class="count-badge">${vouchers.length}</span>
                        </div>
                        <label class="show-drafts-toggle">
                            <span class="toggle-label">Show Drafts</span>
                            <div class="toggle-switch-wrapper">
                                <input type="checkbox" class="draft-toggle" data-type="${isReceive ? 'receive' : 'pay'}" ${isReceive ? showDraftsState.receiveVouchers : showDraftsState.payVouchers ? 'checked' : ''}>
                                <div class="toggle-switch"></div>
                            </div>
                        </label>
                    </div>
                    <span class="total-amount">${format_currency(isReceive ? receiveTotal : payTotal, 'AED', 0)}</span>
                </div>
            </div>
            <div class="virtual-list">
                <div class="item-list">
                    ${vouchers.length > 0 ? vouchers.map(voucher => `
                        <div class="list-item">
                            <div class="voucher-date">
                                ${frappe.datetime.str_to_user(voucher.date)}
                            </div>
                            <div class="item-info">
                                <div class="item-name-row">
                                    <a href="/app/payment-voucher/${voucher.name}" class="item-link">${voucher.name}</a>
                                    ${voucher.docstatus === 0 ? '<span class="draft-chip">Draft</span>' : ''}
                                </div>
                                <div class="item-amount">${format_currency(voucher.payment_amount || 0, 'AED', 0)}</div>
                            </div>
                            <div class="arrow-icon ${isReceive ? 'arrow-receive' : 'arrow-pay'}">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    ${isReceive ? 
                                        '<path d="M12 5v14M19 12l-7 7-7-7"/>' :
                                        '<path d="M12 19V5M5 12l7-7 7 7"/>'
                                    }
                                </svg>
                            </div>
                        </div>
                    `).join('') : `
                        <div class="empty-state">
                            <div class="empty-icon">${isReceive ? '⬇️' : '⬆️'}</div>
                            <div class="empty-text">No ${type} Found</div>
                            <div class="empty-subtext">Create a new payment voucher to get started</div>
                        </div>
                    `}
                </div>
            </div>
        </div>
    `;

    return `
        <div class="overview-sections">
            <style>
                .overview-sections {
                    margin-top: 30px;
                }
                .section {
                    margin-bottom: 30px;
                }
                .section-header {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    padding: 12px 16px;
                    background: #f8fafc;
                    border: 1px solid #e2e8f0;
                    border-radius: 8px;
                    cursor: pointer;
                    margin-bottom: 20px;
                    user-select: none;
                }
                .section-header:hover {
                    background: #f1f5f9;
                }
                .section-title {
                    font-size: 16px;
                    font-weight: 600;
                    color: #1e293b;
                }
                .section-icon {
                    width: 20px;
                    height: 20px;
                    transition: transform 0.2s;
                }
                .section-icon.collapsed {
                    transform: rotate(-90deg);
                }
                .section-content {
                    display: grid;
                    gap: 20px;
                    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                }
                .overview-card {
                    background: white;
                    border-radius: 8px;
                    border: 1px solid #e2e8f0;
                    overflow: hidden;
                }
                .overview-header {
                    padding: 16px;
                    background: #f8fafc;
                    border-bottom: 1px solid #e2e8f0;
                }
                .header-content {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                .type-info {
                    display: flex;
                    flex-direction: column;
                    gap: 6px;
                }
                .title-row {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }
                .type-title {
                    font-size: 16px;
                    font-weight: 600;
                    color: #1e293b;
                }
                .count-badge {
                    font-size: 13px;
                    padding: 2px 8px;
                    border-radius: 12px;
                    background: #e2e8f0;
                    color: #475569;
                }
                .show-drafts-toggle {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    cursor: pointer;
                    user-select: none;
                    margin: 0 !important;
                    
                }
                .toggle-label {
                    font-size: 13px;
                    color: #64748b;
                }
                .toggle-switch-wrapper {
                    position: relative;
                    width: 44px;
                    height: 24px;
                }
                .draft-toggle {
                    opacity: 0;
                    width: 0;
                    height: 0;
                    position: absolute;
                }
                .toggle-switch {
                    position: absolute;
                    cursor: pointer;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background-color: #e2e8f0;
                    transition: .3s;
                    border-radius: 24px;
                }
                .toggle-switch:before {
                    position: absolute;
                    content: "";
                    height: 18px;
                    width: 18px;
                    left: 3px;
                    bottom: 3px;
                    background-color: white;
                    transition: .3s;
                    border-radius: 50%;
                    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
                }
                .draft-toggle:checked + .toggle-switch {
                    background-color: #2563eb;
                }
                .draft-toggle:checked + .toggle-switch:before {
                    transform: translateX(20px);
                }
                .draft-toggle:focus + .toggle-switch {
                    box-shadow: 0 0 1px #2563eb;
                }
                .total-amount {
                    font-size: 15px;
                    font-weight: 500;
                    color: #2563eb;
                }
                .virtual-list {
                    height: 300px;
                    overflow-y: auto;
                }
                .item-list {
                    padding: 8px 0;
                }
                .list-item {
                    padding: 12px 16px;
                    transition: background-color 0.2s;
                    display: grid;
                    grid-template-columns: 1fr 1fr auto;
                    gap: 16px;
                    align-items: center;
                }
                .list-item:hover {
                    background: #f8fafc;
                }
                .item-info {
                    display: flex;
                    flex-direction: column;
                    gap: 4px;
                }
                .item-number {
                    font-size: 14px;
                    font-weight: 500;
                    color: #1e293b;
                }
                .item-date {
                    font-size: 13px;
                    color: #64748b;
                }
                .item-link {
                    font-size: 14px;
                    color: #2563eb;
                    text-decoration: none;
                    font-weight: 500;
                }
                .item-link:hover {
                    text-decoration: underline;
                }
                .item-amount {
                    font-size: 13px;
                    color: #64748b;
                }
                .payment-status {
                    font-size: 12px;
                    padding: 4px 8px;
                    border-radius: 12px;
                    font-weight: 500;
                }
                .status-paid {
                    background: #dcfce7;
                    color: #166534;
                }
                .status-unpaid {
                    background: #fee2e2;
                    color: #991b1b;
                }
                .arrow-icon {
                    width: 24px;
                    height: 24px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                .arrow-receive {
                    color: #059669;
                }
                .arrow-pay {
                    color: #dc2626;
                }
                .empty-state {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    padding: 40px 20px;
                    text-align: center;
                }
                .empty-icon {
                    font-size: 24px;
                    margin-bottom: 12px;
                }
                .empty-text {
                    font-size: 14px;
                    font-weight: 500;
                    color: #1e293b;
                    margin-bottom: 4px;
                }
                .empty-subtext {
                    font-size: 13px;
                    color: #64748b;
                }
                .item-name-row {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }
                .draft-chip {
                    font-size: 11px;
                    font-weight: 500;
                    padding: 2px 6px;
                    border-radius: 4px;
                    background-color: #fee2e2;
                    color: #dc2626;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                }
                @media (max-width: 1200px) {
                    .section-content {
                        grid-template-columns: repeat(2, 1fr);
                    }
                }
                @media (max-width: 768px) {
                    .section-content {
                        grid-template-columns: 1fr;
                    }
                }
            </style>
            <div class="section">
                <div class="section-header" onclick="this.nextElementSibling.style.display = this.nextElementSibling.style.display === 'none' ? 'grid' : 'none'; this.querySelector('.section-icon').classList.toggle('collapsed')">
                    <svg class="section-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="6 9 12 15 18 9"></polyline>
                    </svg>
                    <span class="section-title">Actual Financing</span>
                </div>
                <div class="section-content" style="grid-template-columns: repeat(auto-fit, minmax(330px, 1fr));">
                    ${generateBillCard('Purchase Order', groupedBills['Purchase Order'])}
                    ${generateVoucherCard('Paid Payments', payVouchers, false)}
                    ${generateBillCard('Tax Invoice', groupedBills['Tax Invoice'])}
                    ${generateVoucherCard('Received Payments', receiveVouchers, true)}
                </div>
            </div>
            <div class="section">
                <div class="section-header" onclick="this.nextElementSibling.style.display = this.nextElementSibling.style.display === 'none' ? 'grid' : 'none'; this.querySelector('.section-icon').classList.toggle('collapsed')">
                    <svg class="section-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="6 9 12 15 18 9"></polyline>
                    </svg>
                    <span class="section-title">Draft Financing</span>
                </div>
                <div class="section-content" style="grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));">
                    ${Object.entries(groupedBills)
                        .filter(([type]) => !['Purchase Order', 'Tax Invoice'].includes(type))
                        .map(([type, bills]) => generateBillCard(type, bills))
                        .join('')}
                </div>
            </div>
        </div>
    `;
}

function updateProjectDisplay(frm) {
    // Get all bills at once and filter them in memory
    const getBills = () => frappe.db.get_list('Bill', {
        filters: {
            'project': frm.doc.name,
            'docstatus': ['in', [0, 1]] // Get both drafts and submitted
        },
        fields: ['name', 'bill_number', 'bill_type', 'creation', 'grand_total', 'date', 'payment_status', 'docstatus'],
        order_by: 'creation desc',
        limit: 1000
    }).then(bills => {
        // Calculate project costs from submitted Purchase Order bills
        const projectCosts = bills
            .filter(bill => bill.docstatus === 1 && bill.bill_type === 'Purchase Order')
            .reduce((total, bill) => total + (bill.grand_total || 0), 0);
        
        // Calculate profit percentage
        const contractValue = frm.doc.contract_value || 0;
        const profitAmount = contractValue - projectCosts;
        const profitPercentage = contractValue > 0 ? (profitAmount / contractValue * 100) : 0;
        
        // Filter bills based on their type and draft state
        const filteredBills = bills.filter(bill => 
            bill.docstatus === 1 || showDraftsState[bill.bill_type]
        );
        
        return {
            bills: filteredBills,
            projectCosts,
            profitAmount,
            profitPercentage
        };
    });

    const getReceiveVouchers = () => frappe.db.get_list('Payment Voucher', {
        filters: {
            'project': frm.doc.name,
            'docstatus': showDraftsState['receive'] ? ['in', [0, 1]] : 1,
            'type': 'Receive'
        },
        fields: ['name', 'date', 'payment_amount', 'docstatus'],
        order_by: 'date desc',
        limit: 1000
    });

    const getPayVouchers = () => frappe.db.get_list('Payment Voucher', {
        filters: {
            'project': frm.doc.name,
            'docstatus': showDraftsState['pay'] ? ['in', [0, 1]] : 1,
            'type': 'Pay'
        },
        fields: ['name', 'date', 'payment_amount', 'docstatus'],
        order_by: 'date desc',
        limit: 1000
    });

    Promise.all([getBills(), getReceiveVouchers(), getPayVouchers()])
        .then(([bills, receiveVouchers, payVouchers]) => {
            const projectHtml = `
                <style>
                    .project-display {
                        max-width: 100%;
                        padding: 20px 0;
                    }
                    .project-header {
                        display: flex;
                        gap: 40px;
                        align-items: flex-start;
                        margin-bottom: 30px;
                    }
                    .project-image-wrapper {
                        flex-shrink: 0;
                        width: 240px;
                        height: 240px;
                        position: relative;
                        border-radius: 4px;
                        overflow: hidden;
                        cursor: pointer;
                        transition: opacity 0.2s;
                    }
                    .project-image-wrapper:hover {
                        opacity: 0.9;
                    }
                    .project-image-wrapper:hover::after {
                        content: "Click to change image";
                        position: absolute;
                        bottom: 0;
                        left: 0;
                        right: 0;
                        background: rgba(0, 0, 0, 0.7);
                        color: white;
                        padding: 8px;
                        font-size: 13px;
                        text-align: center;
                    }
                    .project-image {
                        width: 100%;
                        height: 100%;
                        object-fit: cover;
                    }
                    .project-info {
                        flex-grow: 1;
                        padding-top: 10px;
                    }
                    .project-name {
                        font-size: 32px;
                        font-weight: 600;
                        color: #1a1a1a;
                        margin-bottom: 12px;
                        line-height: 1.2;
                        cursor: pointer;
                        transition: color 0.2s;
                    }
                    .project-name:hover {
                        color: #2563eb;
                    }
                    .project-meta {
                        display: flex;
                        align-items: center;
                        gap: 24px;
                        margin-bottom: 24px;
                    }
                    .meta-item {
                        display: flex;
                        align-items: center;
                        gap: 8px;
                        color: #666;
                        cursor: pointer;
                        padding: 4px 8px;
                        margin: -4px -8px;
                        border-radius: 4px;
                        transition: background-color 0.2s;
                    }
                    .meta-item:hover {
                        background-color: #f3f4f6;
                    }
                    .meta-icon {
                        width: 18px;
                        height: 18px;
                        color: #666;
                    }
                    .meta-text {
                        font-size: 15px;
                    }
                    .value-cards {
                        display: grid;
                        grid-template-columns: repeat(3, 1fr);
                        gap: 20px;
                        margin-top: 20px;
                        padding-top: 20px;
                        border-top: 1px solid #eee;
                    }
                    .value-card {
                        background: #fff;
                        padding: 16px;
                        border-radius: 8px;
                        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
                        transition: transform 0.2s, box-shadow 0.2s;
                    }
                    .value-card.contract-value {
                        cursor: pointer;
                    }
                    .value-card.contract-value:hover {
                        transform: translateY(-2px);
                        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
                    }
                    .value-card.project-costs {
                        background: #f8fafc;
                    }
                    .value-card.project-profit {
                        position: relative;
                    }
                    .value-card.project-profit.positive {
                        background: #f0fdf4;
                    }
                    .value-card.project-profit.negative {
                        background: #fef2f2;
                    }
                    .value-label {
                        font-size: 13px;
                        text-transform: uppercase;
                        letter-spacing: 0.5px;
                        color: #666;
                        margin-bottom: 8px;
                    }
                    .value-amount {
                        font-size: 24px;
                        font-weight: 600;
                        color: #1a1a1a;
                    }
                    .profit-percentage {
                        position: absolute;
                        top: 16px;
                        right: 16px;
                        font-size: 14px;
                        font-weight: 500;
                    }
                    .project-profit.positive .profit-percentage {
                        color: #16a34a;
                    }
                    .project-profit.negative .profit-percentage {
                        color: #dc2626;
                    }
                    .party-chips-container {
                        margin-top: 20px;
                    }
                    .chips-label {
                        font-size: 13px;
                        text-transform: uppercase;
                        letter-spacing: 0.5px;
                        color: #666;
                        margin-bottom: 12px;
                    }
                    .party-chips {
                        display: flex;
                        flex-wrap: wrap;
                        gap: 8px;
                    }
                    .party-chip {
                        display: inline-flex;
                        align-items: center;
                        gap: 6px;
                        padding: 6px 12px;
                        border-radius: 16px;
                        font-size: 13px;
                        background: #f3f4f6;
                        color: #374151;
                        transition: transform 0.2s, box-shadow 0.2s;
                    }
                    .party-chip:hover {
                        transform: translateY(-1px);
                        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
                    }
                    .add-party-chip {
                        background: #e0e7ff;
                        color: #4f46e5;
                    }
                    .add-party-chip:hover {
                        background: #dbeafe;
                    }
                    .chip-party-name {
                        font-weight: 500;
                    }
                    .chip-party-type {
                        opacity: 0.7;
                        font-size: 12px;
                    }
                    .client-chip {
                        background: #e0f2fe;
                        color: #0369a1;
                    }
                    .consultant-chip {
                        background: #f1f5f9;
                        color: #475569;
                    }
                    .supplier-chip {
                        background: #f0fdf4;
                        color: #166534;
                    }
                    .supplier-aluminum-chip {
                        background: #fef3c7;
                        color: #92400e;
                    }
                    .supplier-glass-chip {
                        background: #e0f7fa;
                        color: #006064;
                    }
                    .supplier-cladding-chip {
                        background: #fce7f3;
                        color: #9d174d;
                    }
                    .no-image {
                        width: 100%;
                        height: 100%;
                        background: #f5f5f5;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                    }
                    .no-image svg {
                        color: #999;
                    }
                    .editable-hint {
                        display: inline-block;
                        margin-left: 8px;
                        font-size: 12px;
                        color: #666;
                        opacity: 0;
                        transition: opacity 0.2s;
                    }
                    .project-name:hover .editable-hint,
                    .meta-item:hover .editable-hint,
                    .value-display:hover .editable-hint {
                        opacity: 1;
                    }
                    @media (max-width: 768px) {
                        .project-header {
                            flex-direction: column;
                            gap: 24px;
                        }
                        .project-image-wrapper {
                            width: 100%;
                            height: 200px;
                        }
                        .project-meta {
                            flex-direction: column;
                            align-items: flex-start;
                            gap: 12px;
                        }
                    }
                </style>
                <div class="project-display">
                    <div class="project-header">
                        <div class="project-image-wrapper">
                            ${frm.doc.image ? 
                                `<img src="${frm.doc.image}" class="project-image" alt="Project Image"/>` :
                                `<div class="no-image">
                                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                                        <circle cx="8.5" cy="8.5" r="1.5"></circle>
                                        <polyline points="21 15 16 10 5 21"></polyline>
                                    </svg>
                                </div>`
                            }
                        </div>
                        <div class="project-info">
                            <h1 class="project-name">
                                ${frm.doc.project_name || 'Untitled Project'}
                                <span class="editable-hint">(Click to edit)</span>
                            </h1>
                            <div class="project-meta">
                                <div class="meta-item">
                                    <svg class="meta-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                                        <circle cx="12" cy="10" r="3"></circle>
                                    </svg>
                                    <span class="meta-text">${frm.doc.location || 'Location not specified'}</span>
                                    <span class="editable-hint">(Click to edit)</span>
                                </div>
                            </div>
                            <div class="value-cards">
                                <div class="value-card contract-value">
                                    <div class="value-label">Contract Value</div>
                                    <div class="value-amount">${
                                        frm.doc.contract_value ? 
                                        format_currency(frm.doc.contract_value, 'AED', 0) : 
                                        'Not specified'
                                    }</div>
                                    <span class="editable-hint">(Click to edit)</span>
                                </div>
                                <div class="value-card project-costs">
                                    <div class="value-label">Project Costs</div>
                                    <div class="value-amount">${format_currency(bills.projectCosts, 'AED', 0)}</div>
                                </div>
                                <div class="value-card project-profit ${bills.profitAmount >= 0 ? 'positive' : 'negative'}">
                                    <div class="value-label">Project Profit</div>
                                    <div class="value-amount">${format_currency(bills.profitAmount, 'AED', 0)}</div>
                                    <div class="profit-percentage">${bills.profitPercentage.toFixed(1)}%</div>
                                </div>
                            </div>
                            ${generatePartyChips(frm)}
                        </div>
                    </div>
                    ${generateOverviewSections(frm, bills.bills, receiveVouchers, payVouchers)}
                </div>
            `;
            
            frm.set_df_property('project_html', 'options', projectHtml);
            
            // Setup toggle event listeners and click handlers after the HTML is rendered
            setTimeout(() => {
                setupDraftToggles(frm);
                setupClickHandlers(frm);
            }, 100);
        });
}
