// Copyright (c) 2024, Yamen Zakhour and contributors
// For license information, please see license.txt

frappe.ui.form.on("Employee", {
    refresh(frm) {
        renderDocumentGrid(frm);
        updateFullNameAndAge(frm);
        setupQuickNationalities(frm);
    },
    documents: function(frm) {
        renderDocumentGrid(frm);
    },
    first_name: function(frm) {
        updateFullName(frm);
    },
    last_name: function(frm) {
        updateFullName(frm);
    },
    date_of_birth: function(frm) {
        validateAge(frm);
        updateAge(frm);
    },
    before_save: function(frm) {
        // Double-check age validation before saving
        if (!validateAge(frm)) {
            frappe.validated = false;
        }
    }
});

function renderDocumentGrid(frm) {
    const wrapper = frm.get_field('html_azof').$wrapper.find('#document-manager');
    wrapper.empty();
    
    const grid = $('<div class="document-grid"></div>').appendTo(wrapper);

    // Add the "Add Document" card first
    const addCard = $(`
        <div class="document-card add-document-card">
            <div class="add-document-content">
                <div class="add-icon">
                    <i class="fa fa-plus"></i>
                </div>
                <div class="add-text">Add Document</div>
            </div>
        </div>
    `).appendTo(grid);

    // Add Document click handler
    addCard.click(() => {
        const documentTypes = [
            'Emirates ID',
            'Visa',
            'Passport',
            'Labour Card',
            'Job Offer',
            'Work Permit',
            'Health Insurance',
            'Driving License',
            'Involuntary Loss Of Employment (ILOE)',
            'Worker Protection Program (WPP)',
            'Tenancy Contract'
        ];

        const d = new frappe.ui.Dialog({
            title: 'Add New Document',
            fields: [
                {
                    label: 'Document Name',
                    fieldname: 'document_name',
                    fieldtype: 'Data',
                    reqd: 1,
                    description: 'Type to search or enter a custom document name'
                },
                {
                    label: 'Document Number',
                    fieldname: 'number',
                    fieldtype: 'Data'
                },
                {
                    label: 'Issue Date',
                    fieldname: 'issue_date',
                    fieldtype: 'Date'
                },
                {
                    label: 'Expiry Date',
                    fieldname: 'expiry_date',
                    fieldtype: 'Date'
                },
                {
                    label: 'Place of Issue',
                    fieldname: 'place_of_issue',
                    fieldtype: 'Data'
                },
                {
                    label: 'Attachment',
                    fieldname: 'attach',
                    fieldtype: 'Attach',
                    reqd: 1
                }
            ],
            primary_action_label: 'Add',
            primary_action(values) {
                // Add new row to the documents table
                const child = frappe.model.add_child(frm.doc, 'Documents', 'documents');
                Object.assign(child, values);
                
                // Refresh the form and save
                frm.refresh_field('documents');
                frm.save().then(() => {
                    // Close dialog and show success message after save
                    d.hide();
                    frappe.show_alert({
                        message: __('Document added successfully'),
                        indicator: 'green'
                    });
                    // Refresh the document grid
                    renderDocumentGrid(frm);
                }).catch(() => {
                    frappe.show_alert({
                        message: __('Error saving document'),
                        indicator: 'red'
                    });
                });
            }
        });

        // Add datalist for document name suggestions
        const datalistId = frappe.utils.get_random(6);
        d.fields_dict.document_name.$input.attr('list', datalistId);
        const datalist = $(`<datalist id="${datalistId}"></datalist>`);
        documentTypes.forEach(type => {
            datalist.append(`<option value="${type}">`);
        });
        d.fields_dict.document_name.$input.after(datalist);

        d.show();
    });
    
    // Then render existing documents
    if (frm.doc.documents && frm.doc.documents.length) {
        frm.doc.documents.forEach(doc => {
            if (doc.attach) {
                const card = $(`
                    <div class="document-card">
                        <div class="document-preview">
                            ${getFilePreview(doc.attach)}
                        </div>
                        <div class="document-info">
                            <div class="document-name">${doc.document_name || 'Untitled'}</div>
                            <div class="document-number">${doc.number || ''}</div>
                            ${doc.expiry_date ? `
                                <div class="document-expiry" style="color: ${getExpiryStatus(doc.expiry_date).color}">
                                    ${getExpiryStatus(doc.expiry_date).message}
                                </div>
                            ` : ''}
                            <div class="document-actions">
                                <button class="btn btn-xs btn-default qr-btn" title="Show QR Code">
                                    <i class="fa fa-qrcode"></i>
                                </button>
                                <button class="btn btn-xs btn-default copy-btn" title="Copy Document Number">
                                    <i class="fa fa-copy"></i>
                                </button>
                                <button class="btn btn-xs btn-default update-btn" title="Update Document">
                                    <i class="fa fa-edit"></i>
                                </button>
                                <button class="btn btn-xs btn-danger delete-btn" title="Delete Document">
                                    <i class="fa fa-trash"></i>
                                </button>
                            </div>
                        </div>
                    </div>
                `).appendTo(grid);

                // QR Code button click handler
                card.find('.qr-btn').click((e) => {
                    e.stopPropagation(); // Prevent card click event
                    const fullUrl = frappe.urllib.get_base_url() + doc.attach;
                    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(fullUrl)}`;
                    
                    const d = new frappe.ui.Dialog({
                        title: 'Document QR Code',
                        fields: [{
                            fieldtype: 'HTML',
                            fieldname: 'qr_code'
                        }]
                    });
                    
                    d.fields_dict.qr_code.$wrapper.html(`
                        <div class="text-center">
                            <img src="${qrUrl}" alt="QR Code" style="display: block; margin: 0 auto; padding: 1rem;">
                            <div class="text-muted mt-2">Scan to access document</div>
                            <div class="text-muted small">${fullUrl}</div>
                        </div>
                    `);
                    
                    d.show();
                });

                // Copy button click handler
                card.find('.copy-btn').click((e) => {
                    e.stopPropagation(); // Prevent card click event
                    if (doc.number) {
                        frappe.utils.copy_to_clipboard(doc.number);
                        frappe.show_alert({
                            message: __('Document number copied to clipboard'),
                            indicator: 'green'
                        });
                    } else {
                        frappe.show_alert({
                            message: __('No document number available'),
                            indicator: 'orange'
                        });
                    }
                });

                // Update button click handler
                card.find('.update-btn').click((e) => {
                    e.stopPropagation(); // Prevent card click event
                    const d = new frappe.ui.Dialog({
                        title: 'Update Document',
                        fields: [
                            {
                                label: 'Document Name',
                                fieldname: 'document_name',
                                fieldtype: 'Data',
                                reqd: 1,
                                default: doc.document_name
                            },
                            {
                                label: 'Document Number',
                                fieldname: 'number',
                                fieldtype: 'Data',
                                default: doc.number
                            },
                            {
                                label: 'Issue Date',
                                fieldname: 'issue_date',
                                fieldtype: 'Date',
                                default: doc.issue_date
                            },
                            {
                                label: 'Expiry Date',
                                fieldname: 'expiry_date',
                                fieldtype: 'Date',
                                default: doc.expiry_date
                            },
                            {
                                label: 'Place of Issue',
                                fieldname: 'place_of_issue',
                                fieldtype: 'Data',
                                default: doc.place_of_issue
                            },
                            {
                                label: 'Attachment',
                                fieldname: 'attach',
                                fieldtype: 'Attach',
                                default: doc.attach
                            }
                        ],
                        primary_action_label: 'Update',
                        primary_action(values) {
                            // Find the index of the current document in the table
                            const docIndex = frm.doc.documents.findIndex(d => d.name === doc.name);
                            if (docIndex !== -1) {
                                // Update the document values
                                frappe.model.set_value(doc.doctype, doc.name, values);
                                
                                // Save the form
                                frm.save().then(() => {
                                    // Close dialog and show success message after save
                                    d.hide();
                                    frappe.show_alert({
                                        message: __('Document updated and saved successfully'),
                                        indicator: 'green'
                                    });
                                }).catch(() => {
                                    frappe.show_alert({
                                        message: __('Error saving document'),
                                        indicator: 'red'
                                    });
                                });
                            }
                        }
                    });
                    d.show();
                });

                // Delete button click handler
                card.find('.delete-btn').click((e) => {
                    e.stopPropagation(); // Prevent card click event
                    frappe.confirm(
                        'Are you sure you want to delete this document?',
                        () => {
                            // Find the index of the document to delete
                            const docIndex = frm.doc.documents.findIndex(d => d.name === doc.name);
                            if (docIndex !== -1) {
                                // Remove the document from the table
                                frappe.model.clear_doc(doc.doctype, doc.name);
                                
                                // Mark form as dirty and refresh
                                frm.dirty();
                                frm.refresh_field('documents');
                                
                                // Refresh the document grid display
                                renderDocumentGrid(frm);
                                
                                frappe.show_alert({
                                    message: __('Document deleted. Please save the form to confirm deletion.'),
                                    indicator: 'yellow'
                                });
                            }
                        }
                    );
                });

                // Add click handler to open the file
                card.click(() => {
                    window.open(doc.attach, '_blank');
                });
            }
        });
    }

    // Add message if no documents (but still keep the Add Document card)
    if (!frm.doc.documents || !frm.doc.documents.length) {
        $('<div class="text-muted text-center mt-4">No documents attached yet</div>').appendTo(wrapper);
    }

    // Add custom styles
    const style = `
        <style>
            .document-grid {
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
                gap: 1rem;
                padding: 1rem;
            }
            .document-card {
                background: var(--card-bg);
                border: 1px solid var(--border-color);
                border-radius: var(--border-radius-md);
                overflow: hidden;
                transition: transform 0.2s, box-shadow 0.2s;
                cursor: pointer;
            }
            .document-card:hover {
                transform: translateY(-2px);
                box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
            }
            .add-document-card {
                display: flex;
                align-items: center;
                justify-content: center;
                min-height: 250px;
                border: 2px dashed var(--border-color);
                background: var(--card-bg);
            }
            .add-document-content {
                text-align: center;
                color: var(--text-color);
            }
            .add-icon {
                font-size: 2rem;
                margin-bottom: 0.5rem;
            }
            .add-text {
                font-weight: 500;
            }
            .add-document-card:hover {
                border-color: var(--btn-primary);
                color: var(--text-color);
            }
            .document-preview {
                height: 150px;
                background: var(--card-bg);
                display: flex;
                align-items: center;
                justify-content: center;
            }
            .document-preview img {
                max-width: 100%;
                max-height: 100%;
                object-fit: contain;
            }
            .document-preview iframe {
                width: 100%;
                height: 100%;
                border: none;
            }
            .document-info {
                padding: 1rem;
            }
            .document-name {
                font-weight: 600;
                margin-bottom: 0.5rem;
            }
            .document-number {
                color: #6b7280;
                font-size: 0.875rem;
                margin-bottom: 0.25rem;
            }
            .document-expiry {
                font-size: 0.875rem;
                margin-bottom: 0.5rem;
                font-weight: 500;
            }
            .document-actions {
                display: flex;
                gap: 0.5rem;
                margin-top: 0.5rem;
            }
            .document-actions .btn {
                padding: 0.25rem 0.5rem;
            }
            #qr-code-container {
                display: inline-block;
                padding: 1rem;
                background: white;
                border-radius: 4px;
            }
            #qr-code-container img {
                display: block;
            }
        </style>
    `;
    wrapper.append(style);
}

function validateAge(frm) {
    if (!frm.doc.date_of_birth) return true;

    const birthDate = frappe.datetime.str_to_obj(frm.doc.date_of_birth);
    const today = new Date();
    
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
    }
    
    if (age < 18) {
        frappe.msgprint(__('Employee must be at least 18 years old.'));
        frm.set_value('date_of_birth', '');
        return false;
    }
    
    return true;
}

function setupQuickNationalities(frm) {
    const commonNationalities = [
        { country: 'Pakistan', flag: '🇵🇰' },
        { country: 'India', flag: '🇮🇳' },
        { country: 'Nepal', flag: '🇳🇵' },
        { country: 'Bangladesh', flag: '🇧🇩' }
    ];

    // Create HTML for quick nationality buttons
    const buttonsHtml = `
        <div class="quick-nationality-buttons">
            <div class="text-muted small mb-2">Quick Select:</div>
            ${commonNationalities.map(n => `
                <button class="btn btn-xs btn-default quick-nationality" data-country="${n.country}">
                    ${n.flag} ${n.country}
                </button>
            `).join('')}
        </div>
        <style>
            .quick-nationality-buttons {
                margin-top: 10px;
            }
            .quick-nationality {
                margin-right: 5px;
                margin-bottom: 5px;
            }
            .quick-nationality:hover {
                background-color: var(--fg-hover-color);
            }
        </style>
    `;

    // Insert buttons after nationality field
    const $nationalityField = frm.get_field('nationality').$wrapper;
    if (!$nationalityField.next('.quick-nationality-buttons').length) {
        $nationalityField.after(buttonsHtml);
        
        // Add click handlers
        $nationalityField.next('.quick-nationality-buttons').find('.quick-nationality').on('click', function(e) {
            e.preventDefault();
            const country = $(this).data('country');
            // Set both the form value and the input value
            frm.set_value('nationality', country);
            // Trigger change event
            frm.refresh_field('nationality');
        });
    }
}

function updateFullName(frm) {
    const firstName = frm.doc.first_name || '';
    const lastName = frm.doc.last_name || '';
    const fullName = [firstName, lastName].filter(Boolean).join(' ');
    
    frm.set_value('full_name', fullName);
}

function updateAge(frm) {
    if (!frm.doc.date_of_birth) {
        frm.set_value('age', 0);
        return;
    }

    const birthDate = frappe.datetime.str_to_obj(frm.doc.date_of_birth);
    const today = new Date();
    
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    
    // Adjust age if birthday hasn't occurred this year
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
    }
    
    frm.set_value('age', age);
}

function updateFullNameAndAge(frm) {
    updateFullName(frm);
    updateAge(frm);
}

function getExpiryStatus(expiryDate) {
    if (!expiryDate) return null;
    
    const today = frappe.datetime.get_today();
    const daysUntilExpiry = frappe.datetime.get_diff(expiryDate, today);
    
    if (daysUntilExpiry < 0) {
        return {
            status: 'expired',
            color: 'var(--red-500)',
            message: `Expired ${Math.abs(daysUntilExpiry)} days ago`
        };
    } else if (daysUntilExpiry <= 30) {
        return {
            status: 'critical',
            color: 'var(--red-500)',
            message: `Expires in ${daysUntilExpiry} days`
        };
    } else if (daysUntilExpiry <= 90) {
        return {
            status: 'warning',
            color: 'var(--yellow-500)',
            message: `Expires in ${daysUntilExpiry} days`
        };
    } else {
        return {
            status: 'good',
            color: 'var(--green-500)',
            message: `Expires in ${daysUntilExpiry} days`
        };
    }
}

function getFilePreview(fileUrl) {
    const extension = fileUrl.split('.').pop().toLowerCase();
    const imageExtensions = ['jpg', 'jpeg', 'png', 'gif'];
    
    if (imageExtensions.includes(extension)) {
        return `<img src="${fileUrl}" alt="Document Preview"/>`;
    }
    
    if (extension === 'pdf') {
        return `<iframe src="${fileUrl}" width="100%" height="100%" frameborder="0"></iframe>`;
    }
    
    // For non-image and non-PDF files, show an icon based on file type
    const fileTypeIcons = {
        'doc': 'file-word',
        'docx': 'file-word',
        'xls': 'file-excel',
        'xlsx': 'file-excel',
        'default': 'file'
    };
    
    const iconName = fileTypeIcons[extension] || fileTypeIcons.default;
    return `<i class="fa fa-${iconName} fa-3x text-muted"></i>`;
}
