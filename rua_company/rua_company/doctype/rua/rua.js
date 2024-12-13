// Copyright (c) 2024, Yamen Zakhour and contributors
// For license information, please see license.txt

frappe.ui.form.on("Rua", {
    refresh(frm) {
        // Add Generate VAT Report button
        frm.add_custom_button(__('Generate VAT Report'), function() {
            show_vat_report_dialog(frm);
        }).addClass('btn-primary');
    }
});

function show_vat_report_dialog(frm) {
    const dialog = new frappe.ui.Dialog({
        title: __('Generate VAT Report'),
        fields: [
            {
                fieldtype: 'HTML',
                fieldname: 'quarter_buttons',
                options: `
                    <div style="margin-bottom: 15px;">
                        <div style="margin-bottom: 10px; font-weight: bold;">${__('Quick Select Quarter')}</div>
                        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px;">
                            <button class="btn btn-default btn-sm quarter-btn" data-quarter="1" 
                                style="height: 60px; white-space: normal; text-align: center; line-height: 1.2;">
                                <div style="font-weight: bold;">Q1</div>
                                <div style="font-size: 0.8em;">Nov, Dec, Jan</div>
                            </button>
                            <button class="btn btn-default btn-sm quarter-btn" data-quarter="2"
                                style="height: 60px; white-space: normal; text-align: center; line-height: 1.2;">
                                <div style="font-weight: bold;">Q2</div>
                                <div style="font-size: 0.8em;">Feb, Mar, Apr</div>
                            </button>
                            <button class="btn btn-default btn-sm quarter-btn" data-quarter="3"
                                style="height: 60px; white-space: normal; text-align: center; line-height: 1.2;">
                                <div style="font-weight: bold;">Q3</div>
                                <div style="font-size: 0.8em;">May, Jun, Jul</div>
                            </button>
                            <button class="btn btn-default btn-sm quarter-btn" data-quarter="4"
                                style="height: 60px; white-space: normal; text-align: center; line-height: 1.2;">
                                <div style="font-weight: bold;">Q4</div>
                                <div style="font-size: 0.8em;">Aug, Sep, Oct</div>
                            </button>
                        </div>
                    </div>
                `
            },
            {
                fieldname: 'from_date',
                label: __('From Date'),
                fieldtype: 'Date',
                reqd: 1,
                default: frappe.datetime.add_months(frappe.datetime.get_today(), -1)
            },
            {
                fieldname: 'to_date',
                label: __('To Date'),
                fieldtype: 'Date',
                reqd: 1,
                default: frappe.datetime.get_today()
            },
            {
                fieldname: 'include_no_trn',
                label: __('Include parties with no TRN'),
                fieldtype: 'Check',
                default: 1
            }
        ],
        primary_action_label: __('Generate'),
        primary_action(values) {
            generate_vat_report(frm, values.from_date, values.to_date, values.include_no_trn);
            dialog.hide();
        }
    });

    // Add click handlers for quarter buttons
    dialog.$wrapper.find('.quarter-btn').on('click', function() {
        const quarter = $(this).data('quarter');
        const currentYear = moment().year();
        let fromDate, toDate;

        // Remove active class from all buttons
        dialog.$wrapper.find('.quarter-btn').removeClass('btn-primary').addClass('btn-default');
        // Add active class to clicked button
        $(this).removeClass('btn-default').addClass('btn-primary');

        switch(quarter) {
            case 1: // Q1: Nov, Dec, Jan
                fromDate = moment([currentYear - 1, 10, 1]); // Previous year November
                toDate = moment([currentYear, 0, 31]); // Current year January
                break;
            case 2: // Q2: Feb, Mar, Apr
                fromDate = moment([currentYear, 1, 1]); // February
                toDate = moment([currentYear, 3, 30]); // April
                break;
            case 3: // Q3: May, Jun, Jul
                fromDate = moment([currentYear, 4, 1]); // May
                toDate = moment([currentYear, 6, 31]); // July
                break;
            case 4: // Q4: Aug, Sep, Oct
                fromDate = moment([currentYear, 7, 1]); // August
                toDate = moment([currentYear, 9, 31]); // October
                break;
        }

        dialog.set_value('from_date', fromDate.format('YYYY-MM-DD'));
        dialog.set_value('to_date', toDate.format('YYYY-MM-DD'));
    });

    dialog.show();
}

function generate_vat_report(frm, from_date, to_date, include_no_trn) {
    frappe.call({
        method: 'rua_company.rua_company.doctype.rua.rua.generate_vat_report',
        args: {
            from_date: from_date,
            to_date: to_date,
            include_no_trn: include_no_trn
        },
        callback: function(r) {
            if (!r.exc) {
                // Convert base64 to Blob
                const binary = atob(r.message.file_content);
                const array = new Uint8Array(binary.length);
                for (let i = 0; i < binary.length; i++) {
                    array[i] = binary.charCodeAt(i);
                }
                const blob = new Blob([array], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

                // Create download link
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.style.display = 'none';
                a.href = url;
                a.download = r.message.file_name;
                
                document.body.appendChild(a);
                a.click();
                
                // Cleanup
                window.URL.revokeObjectURL(url);
                document.body.removeChild(a);
            }
        },
        freeze: true,
        freeze_message: __('Generating VAT Report...')
    });
}
