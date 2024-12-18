// Copyright (c) 2024, Yamen Zakhour and contributors
// For license information, please see license.txt

frappe.ui.form.on("Project", {
  refresh(frm) {
    if (frm.doc.__islocal) {
      frappe.prompt(
        {
          label: "Project Name",
          fieldname: "project_name",
          fieldtype: "Data",
          reqd: 1,
        },
        function (values) {
          frappe.model.set_value(
            frm.doctype,
            frm.docname,
            "project_name",
            values.project_name
          );
          frm.save();
        },
        "Enter Project Name",
        "Continue"
      );
    }

    // Handle items table visibility based on scopes
    const hasScopes = frm.doc.scopes && frm.doc.scopes.length > 0;

    // Get the items field wrapper
    const itemsWrapper = frm.fields_dict.items.wrapper;

    if (!hasScopes) {
      // Hide the items table
      $(itemsWrapper).addClass("hidden");

      // Show the message if it doesn't exist
      if (!itemsWrapper.querySelector(".no-scope-message")) {
        const message = $(`
                    <div class="no-scope-message" style="
                        padding: 2rem;
                        text-align: center;
                        background-color: var(--bg-light-gray);
                        border-radius: 0.5rem;
                        margin: 1rem 0;
                    ">
                        <div style="
                            font-size: 4rem;
                            color: var(--text-muted);
                            margin-bottom: 1rem;
                        ">
                            <i class="fa fa-clipboard"></i>
                        </div>
                        <div style="
                            font-size: 1.2rem;
                            color: var(--text-muted);
                            margin-bottom: 0.5rem;
                        ">
                            Define a scope to start adding items.
                        </div>
                    </div>
                `);
        $(itemsWrapper).after(message);
      }
    } else {
      // Show the items table and remove the message
      $(itemsWrapper).removeClass("hidden");
      $(".no-scope-message").remove();
    }

    frm.page.clear_actions_menu();

    // Add Generate dropdown items with icons
    frm
      .add_custom_button(
        __("Request for Quotation"),
        function () {
          create_project_bill(frm, "Request for Quotation");
        },
        __("Generate")
      )
      .addClass("has-icon")
      .prepend('<i class="fa fa-file-text-o"></i> ');

    frm
      .add_custom_button(
        __("Purchase Order"),
        function () {
          create_project_bill(frm, "Purchase Order");
        },
        __("Generate")
      )
      .addClass("has-icon")
      .prepend('<i class="fa fa-shopping-cart"></i> ');

    frm
      .add_custom_button(
        __("Quotation"),
        function () {
          create_project_bill(frm, "Quotation");
        },
        __("Generate")
      )
      .addClass("has-icon")
      .prepend('<i class="fa fa-quote-left"></i> ');

    frm
      .add_custom_button(
        __("Proforma"),
        function () {
          create_project_bill(frm, "Proforma");
        },
        __("Generate")
      )
      .addClass("has-icon")
      .prepend('<i class="fa fa-file"></i> ');

    frm
      .add_custom_button(
        __("Tax Invoice"),
        function () {
          create_project_bill(frm, "Tax Invoice");
        },
        __("Generate")
      )
      .addClass("has-icon")
      .prepend('<i class="fa fa-file-text"></i> ');

    frm
      .add_custom_button(
        __("Payment Voucher"),
        function () {
          create_project_bill(frm, "Payment Voucher");
        },
        __("Generate")
      )
      .addClass("has-icon")
      .prepend('<i class="fa fa-money"></i> ');

    // Style the Generate parent button
    $('.inner-group-button[data-label="Generate"] .btn-default')
      .removeClass("btn-default")
      .addClass("btn-warning");

    // Add refresh button
    frm
      .add_custom_button(__("Refresh"), function () {
        frappe.confirm(
          __("This will clear and repopulate all child tables. Continue?"),
          function () {
            frappe.call({
              method:
                "rua_company.rua_company.doctype.project.project.refresh_all_tables",
              args: {
                project: frm.doc.name,
              },
              freeze: true,
              freeze_message: __("Refreshing all tables..."),
              callback: function (r) {
                if (r.exc) {
                  frappe.msgprint({
                    title: __("Error"),
                    indicator: "red",
                    message: __("Failed to refresh tables. Please try again."),
                  });
                  return;
                }
                frm.reload_doc();
                frappe.show_alert({
                  message: __("All tables refreshed successfully"),
                  indicator: "green",
                });
              },
            });
          }
        );
      })
      .addClass("has-icon")
      .prepend('<i class="fa fa-refresh"></i>');
    // Add import button to grid
    if (!frm.doc.__islocal) {
      frm.fields_dict["items"].grid.add_custom_button(
        __("Import from Excel"),
        function () {
          show_import_dialog(frm);
        }
      );
      frm.fields_dict["items"].grid.grid_buttons
        .find(".btn-custom")
        .removeClass("btn-default btn-secondary")
        .addClass("btn-success");
    }

    if (frm.doc.docstatus === 0) {
      // For Open status
      if (frm.doc.status === "Open" && !frm.doc.__islocal) {
        frm.page.add_action_item(
          __('<i class="fa fa-file-text-o"></i> Set as Tender'),
          function () {
            frappe.confirm(__("Set this project as Tender?"), function () {
              frm.set_value("status", "Tender");
              frm.save();
            });
          }
        );

        frm.page.add_action_item(
          __('<i class="fa fa-briefcase"></i> Set as Job In Hand'),
          function () {
            frappe.confirm(__("Set this project as Job In Hand?"), function () {
              frm.set_value("status", "Job In Hand");
              frm.save();
            });
          }
        );

        frm.page.add_action_item(
          __('<i class="fa fa-ban"></i> Cancel Project'),
          function () {
            frappe.confirm(
              __(
                "Are you sure you want to cancel this project? This action cannot be undone."
              ),
              function () {
                frm.set_value("status", "Cancelled");
                frm.save();
              }
            );
          }
        );
      }

      // For Tender status
      if (frm.doc.status === "Tender") {
        frm.page.add_action_item(
          __('<i class="fa fa-play"></i> Start Progress'),
          function () {
            frappe.confirm(__("Start progress on this project?"), function () {
              frm.set_value("status", "In Progress");
              frm.save();
            });
          }
        );

        frm.page.add_action_item(
          __('<i class="fa fa-ban"></i> Cancel Project'),
          function () {
            frappe.confirm(
              __(
                "Are you sure you want to cancel this project? This action cannot be undone."
              ),
              function () {
                frm.set_value("status", "Cancelled");
                frm.save();
              }
            );
          }
        );
      }

      // For Job In Hand status
      if (frm.doc.status === "Job In Hand") {
        frm.page.add_action_item(
          __('<i class="fa fa-play"></i> Start Progress'),
          function () {
            frappe.confirm(__("Start progress on this project?"), function () {
              frm.set_value("status", "In Progress");
              frm.save();
            });
          }
        );

        frm.page.add_action_item(
          __('<i class="fa fa-ban"></i> Cancel Project'),
          function () {
            frappe.confirm(
              __(
                "Are you sure you want to cancel this project? This action cannot be undone."
              ),
              function () {
                frm.set_value("status", "Cancelled");
                frm.save();
              }
            );
          }
        );
      }

      // For In Progress status
      if (frm.doc.status === "In Progress") {
        frm.page.add_action_item(
          __('<i class="fa fa-check-circle"></i> Mark Complete'),
          function () {
            frappe.confirm(__("Mark this project as completed?"), function () {
              frm.set_value("status", "Completed");
              frm.save();
            });
          }
        );

        frm.page.add_action_item(
          __('<i class="fa fa-ban"></i> Cancel Project'),
          function () {
            frappe.confirm(
              __(
                "Are you sure you want to cancel this project? This action cannot be undone."
              ),
              function () {
                frm.set_value("status", "Cancelled");
                frm.save();
              }
            );
          }
        );
      }
    }

    // Apply color coding to scopes and items grids
    if (frm.doc.scopes && frm.doc.scopes.length > 1) {
      apply_color_coding(frm);
    }
  },

  download_import_template: function (frm, scope) {
    frappe.call({
      method:
        "rua_company.rua_company.doctype.project.project.get_import_template",
      args: {
        scope: JSON.stringify(scope),
      },
      callback: function (r) {
        if (r.message) {
          const blob = b64toBlob(
            r.message.content,
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          );
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.style.display = "none";
          a.href = url;
          a.download = r.message.filename;
          document.body.appendChild(a);
          a.click();
          window.URL.revokeObjectURL(url);
          a.remove();
        }
      },
    });
  },
});

// Define scope colors using Frappe design system variables
const SCOPE_COLORS = [
  { bg: "var(--bg-orange)", text: "var(--text-on-orange)" },
  { bg: "var(--bg-blue)", text: "var(--text-on-blue)" },
  { bg: "var(--bg-purple)", text: "var(--text-on-purple)" },
  { bg: "var(--bg-green)", text: "var(--text-on-green)" },
  { bg: "var(--bg-yellow)", text: "var(--text-on-yellow)" },
  { bg: "var(--bg-cyan)", text: "var(--text-on-cyan)" },
  { bg: "var(--bg-pink)", text: "var(--text-on-pink)" },
  { bg: "var(--bg-gray)", text: "var(--text-on-gray)" },
];

// Function to apply color coding
function apply_color_coding(frm) {
  // Only proceed if we have more than one scope
  if (!frm.doc.scopes || frm.doc.scopes.length <= 1) {
    // Clear any existing colors
    frm.fields_dict["scopes"].grid.grid_rows.forEach((grid_row) => {
      $(grid_row.wrapper).css({
        "background-color": "",
        "border-color": "",
      });
      $(grid_row.wrapper).find(".col").css({
        color: "",
        "border-right": "",
      });
    });

    frm.fields_dict["items"].grid.grid_rows.forEach((grid_row) => {
      $(grid_row.wrapper).css({
        "background-color": "",
        "border-color": "",
      });
      $(grid_row.wrapper).find(".col").css({
        color: "",
        "border-right": "",
      });
    });
    return;
  }

  setTimeout(() => {
    // Color the scopes grid
    if (frm.fields_dict["scopes"].grid.grid_rows) {
      frm.fields_dict["scopes"].grid.grid_rows.forEach((grid_row, index) => {
        const scopeNum = grid_row.doc.scope_number;
        if (scopeNum) {
          const colorSet = SCOPE_COLORS[(scopeNum - 1) % SCOPE_COLORS.length];

          $(grid_row.wrapper).css({
            "background-color": colorSet.bg,
          });

          // Apply text color to cells
          $(grid_row.wrapper).find(".col").css({
            color: colorSet.text,
            "border-right": "0",
          });
        }
      });
    }

    // Color the items grid
    if (frm.fields_dict["items"].grid.grid_rows) {
      frm.fields_dict["items"].grid.grid_rows.forEach((grid_row) => {
        const scopeNum = grid_row.doc.scope_number;
        if (scopeNum) {
          const colorSet = SCOPE_COLORS[(scopeNum - 1) % SCOPE_COLORS.length];

          $(grid_row.wrapper).css({
            "background-color": colorSet.bg,
          });

          // Apply text color to cells
          $(grid_row.wrapper).find(".col").css({
            color: colorSet.text,
            "border-right": "0",
          });
        }
      });
    }
  }, 100);
}

function create_project_bill(frm, bill_type) {
  // Get filtered parties based on bill type
  let party_type;
  if (bill_type === "Purchase Order" || bill_type === "Request for Quotation") {
    party_type = "Supplier";
  } else if (bill_type === "Payment Voucher") {
    party_type = null; // All parties allowed
  } else {
    party_type = "Client";
  }

  let parties = frm.doc.parties.filter(
    (p) => !party_type || p.type === party_type
  );
  if (!parties.length) {
    frappe.msgprint(__(`No ${party_type || ""} parties found in the project`));
    return;
  }

  // If it's a payment voucher, get outstanding amounts for all parties
  if (bill_type === "Payment Voucher") {
    frappe.call({
      method:
        "rua_company.rua_company.doctype.project.project.get_party_outstanding_amounts",
      args: {
        project: frm.doc.name,
        parties: parties.map((p) => ({
          party: p.party,
          type: p.type,
        })),
      },
      callback: function (r) {
        if (r.message) {
          show_party_dialog(r.message);
        }
      },
    });
  } else {
    show_party_dialog({});
  }

  function show_party_dialog(outstanding_amounts) {
    // Format party labels based on type and section
    let party_cards = parties.map((p) => {
      let label, amount_info = "";
      if (bill_type === "Payment Voucher") {
        let amount = outstanding_amounts[p.party] || 0;
        let formatted_amount = format_currency(
          Math.abs(amount),
          frm.doc.currency
        );
        let direction;
        if (p.type === "Supplier") {
          direction =
            amount > 0 ? "To Pay" : amount < 0 ? "To Receive" : "No Balance";
        } else {
          direction =
            amount > 0 ? "To Receive" : amount < 0 ? "To Pay" : "No Balance";
        }
        amount_info = `<div class="amount-info ${direction.toLowerCase().replace(' ', '-')}">
          ${direction}: ${formatted_amount}
        </div>`;
      }

      return {
        party: p.party,
        type: p.type,
        section: p.section,
        amount_info: amount_info
      };
    });

    // Group parties by type for better organization
    let grouped_parties = {};
    party_cards.forEach(p => {
      if (!grouped_parties[p.type]) {
        grouped_parties[p.type] = [];
      }
      grouped_parties[p.type].push(p);
    });

    let fields = [
      {
        fieldtype: "HTML",
        fieldname: "party_cards",
        options: `
          <div class="party-cards-container">
            ${Object.entries(grouped_parties).map(([type, parties]) => `
              <div class="party-type-section">
                <h6 class="text-muted">${type}</h6>
                <div class="party-cards-grid">
                  ${parties.map(p => `
                    <div class="party-card" data-party="${p.party}">
                      <div class="party-card-header">
                        <div class="party-name">${p.party}</div>
                        ${p.type === "Supplier" && p.section ? 
                          `<div class="party-section">${p.section}</div>` : 
                          ''}
                      </div>
                      ${p.amount_info}
                    </div>
                  `).join('')}
                </div>
              </div>
            `).join('')}
          </div>
        `
      }
    ];

    // Add RFQ specific fields if needed
    if (bill_type === "Request for Quotation") {
      fields.push({
        fieldtype: "HTML",
        fieldname: "rfq_type_cards",
        options: `
          <div class="rfq-type-section">
            <h6 class="text-muted">${__("RFQ Type")}</h6>
            <div class="rfq-type-cards">
              <div class="rfq-type-card" data-type="items">
                <div class="rfq-icon">
                  <i class="fa fa-list"></i>
                </div>
                <div class="rfq-type-content">
                  <div class="rfq-type-title">${__("RFQ from Items")}</div>
                  <div class="rfq-type-desc">${__("Create RFQ from selected project items")}</div>
                </div>
              </div>
              <div class="rfq-type-card" data-type="link">
                <div class="rfq-icon">
                  <i class="fa fa-link"></i>
                </div>
                <div class="rfq-type-content">
                  <div class="rfq-type-title">${__("RFQ from Link")}</div>
                  <div class="rfq-type-desc">${__("Create RFQ using an external link")}</div>
                </div>
              </div>
            </div>
            <div class="rfq-link-container" style="display: none;">
              <div class="form-group">
                <label class="control-label">${__("RFQ URL")}</label>
                <input type="text" class="form-control rfq-url-input" placeholder="${__("Enter RFQ URL")}">
                <small class="form-text text-muted">
                  ${__("Enter the URL for the external RFQ")}
                </small>
              </div>
            </div>
          </div>
        `
      });

      // Add hidden fields to store the values
      fields.push(
        {
          fieldtype: "Data",
          fieldname: "rfq_type",
          hidden: 1
        },
        {
          fieldtype: "Data",
          fieldname: "url",
          hidden: 1
        }
      );
    }

    let d = new frappe.ui.Dialog({
      title: __("Select Party"),
      fields: fields,
      primary_action_label: __("Next"),
      primary_action(values) {
        let selected_party = d.$wrapper.find(".party-card.selected").data("party");
        if (!selected_party) {
          frappe.msgprint(__("Please select a party"));
          return;
        }

        values.party = selected_party;

        if (bill_type === "Request for Quotation") {
          values.rfq_type = d.$wrapper.find(".rfq-type-card.selected").data("type");
          if (!values.rfq_type) {
            frappe.msgprint(__("Please select an RFQ type"));
            return;
          }
          if (values.rfq_type === "link") {
            values.url = d.$wrapper.find(".rfq-url-input").val();
            if (!values.url) {
              frappe.msgprint(__("Please enter an RFQ URL"));
              return;
            }
          }
        }

        d.hide();
        if (bill_type === "Payment Voucher") {
          frappe.model.open_mapped_doc({
            method:
              "rua_company.rua_company.doctype.project.project.make_payment_voucher",
            frm: frm,
            args: {
              party: values.party,
              outstanding_amount: outstanding_amounts[values.party] || 0,
            },
            freeze: true,
            freeze_message: __("Creating Payment Voucher..."),
          });
        } else if (
          bill_type === "Request for Quotation" &&
          values.rfq_type === "link"
        ) {
          create_bill_with_scope(frm, bill_type, "0", {
            send_rfq_link: 1,
            url: values.url,
            party: values.party,
          });
        } else if (
          bill_type === "Request for Quotation" ||
          bill_type === "Purchase Order"
        ) {
          show_item_selection_dialog(frm, bill_type, "0", values.party);
        } else {
          create_bill_with_scope(frm, bill_type, "0", {
            party: values.party,
          });
        }
      },
    });

    // Add custom styles
    d.$wrapper.find(".party-cards-container").css({
      "max-height": "60vh",
      "overflow-y": "auto",
      "padding": "15px"
    });

    d.$wrapper.find(".party-type-section").css({
      "margin-bottom": "25px"
    });

    d.$wrapper.find(".party-cards-grid").css({
      "display": "grid",
      "grid-template-columns": "repeat(2, 1fr)",
      "gap": "20px",
      "margin-top": "10px"
    });

    d.$wrapper.find(".party-card").css({
      "border": "1px solid var(--border-color)",
      "border-radius": "8px",
      "padding": "15px",
      "cursor": "pointer",
      "transition": "all 0.2s ease",
      "background": "var(--card-bg)",
      "min-width": "200px"
    });

    d.$wrapper.find(".party-card-header").css({
      "margin-bottom": "10px"
    });

    d.$wrapper.find(".party-name").css({
      "font-weight": "600",
      "font-size": "1.1em",
      "color": "var(--text-color)",
      "margin-bottom": "4px"
    });

    d.$wrapper.find(".party-section").css({
      "color": "var(--text-muted)",
      "font-size": "0.9em"
    });

    d.$wrapper.find(".amount-info").css({
      "font-size": "0.9em",
      "padding": "4px 8px",
      "border-radius": "4px",
      "display": "inline-block",
      "margin-top": "8px"
    });

    d.$wrapper.find(".amount-info.to-pay").css({
      "background": "var(--red-50)",
      "color": "var(--red-600)"
    });

    d.$wrapper.find(".amount-info.to-receive").css({
      "background": "var(--green-50)",
      "color": "var(--green-600)"
    });

    d.$wrapper.find(".amount-info.no-balance").css({
      "background": "var(--gray-50)",
      "color": "var(--gray-600)"
    });

    // Make the dialog wider to accommodate two cards
    d.$wrapper.find(".modal-dialog").css({
      "max-width": "700px"
    });

    // Add hover effect
    d.$wrapper.find(".party-card").hover(
      function() {
        $(this).css({
          "box-shadow": "var(--shadow-base)",
          "border-color": "var(--primary-color)",
          "transform": "translateY(-2px)"
        });
      },
      function() {
        if (!$(this).hasClass("selected")) {
          $(this).css({
            "box-shadow": "none",
            "border-color": "var(--border-color)",
            "transform": "none"
          });
        }
      }
    );

    // Add click handler for party selection
    d.$wrapper.find(".party-card").on("click", function() {
      d.$wrapper.find(".party-card").removeClass("selected").css({
        "box-shadow": "none",
        "border-color": "var(--border-color)",
        "transform": "none",
        "background": "var(--card-bg)"
      });
      
      $(this).addClass("selected").css({
        "box-shadow": "var(--shadow-base)",
        "border-color": "var(--primary-color)",
        "transform": "translateY(-2px)",
        "background": "var(--primary-color-light)"
      });
    });

    // Add custom styles for RFQ section
    if (bill_type === "Request for Quotation") {
      d.$wrapper.find(".rfq-type-section").css({
        "margin-top": "30px",
        "padding": "0 15px"
      });

      d.$wrapper.find(".rfq-type-cards").css({
        "display": "grid",
        "grid-template-columns": "repeat(2, 1fr)",
        "gap": "20px",
        "margin-top": "10px"
      });

      d.$wrapper.find(".rfq-type-card").css({
        "border": "1px solid var(--border-color)",
        "border-radius": "8px",
        "padding": "15px",
        "cursor": "pointer",
        "transition": "all 0.2s ease",
        "background": "var(--card-bg)",
        "display": "flex",
        "align-items": "center",
        "gap": "15px"
      });

      d.$wrapper.find(".rfq-icon").css({
        "font-size": "1.5em",
        "color": "var(--text-muted)",
        "width": "40px",
        "height": "40px",
        "display": "flex",
        "align-items": "center",
        "justify-content": "center",
        "background": "var(--bg-light-gray)",
        "border-radius": "8px"
      });

      d.$wrapper.find(".rfq-type-title").css({
        "font-weight": "600",
        "margin-bottom": "4px"
      });

      d.$wrapper.find(".rfq-type-desc").css({
        "color": "var(--text-muted)",
        "font-size": "0.9em"
      });

      d.$wrapper.find(".rfq-link-container").css({
        "margin-top": "20px",
        "padding": "15px",
        "border": "1px solid var(--border-color)",
        "border-radius": "8px",
        "background": "var(--card-bg)"
      });

      // Add hover effect for RFQ type cards
      d.$wrapper.find(".rfq-type-card").hover(
        function() {
          $(this).css({
            "box-shadow": "var(--shadow-base)",
            "border-color": "var(--primary-color)",
            "transform": "translateY(-2px)"
          });
        },
        function() {
          if (!$(this).hasClass("selected")) {
            $(this).css({
              "box-shadow": "none",
              "border-color": "var(--border-color)",
              "transform": "none"
            });
          }
        }
      );

      // Add click handler for RFQ type selection
      d.$wrapper.find(".rfq-type-card").on("click", function() {
        d.$wrapper.find(".rfq-type-card").removeClass("selected").css({
          "box-shadow": "none",
          "border-color": "var(--border-color)",
          "transform": "none",
          "background": "var(--card-bg)"
        });
        
        $(this).addClass("selected").css({
          "box-shadow": "var(--shadow-base)",
          "border-color": "var(--primary-color)",
          "transform": "translateY(-2px)",
          "background": "var(--primary-color-light)"
        });

        // Show/hide URL input based on selection
        if ($(this).data("type") === "link") {
          d.$wrapper.find(".rfq-link-container").slideDown();
        } else {
          d.$wrapper.find(".rfq-link-container").slideUp();
        }
      });
    }

    // Add hover effect
    d.$wrapper.find(".party-card").hover(
      function() {
        $(this).css({
          "box-shadow": "var(--shadow-base)",
          "border-color": "var(--primary-color)",
          "transform": "translateY(-2px)"
        });
      },
      function() {
        if (!$(this).hasClass("selected")) {
          $(this).css({
            "box-shadow": "none",
            "border-color": "var(--border-color)",
            "transform": "none"
          });
        }
      }
    );

    // Add click handler for party selection
    d.$wrapper.find(".party-card").on("click", function() {
      d.$wrapper.find(".party-card").removeClass("selected").css({
        "box-shadow": "none",
        "border-color": "var(--border-color)",
        "transform": "none",
        "background": "var(--card-bg)"
      });
      
      $(this).addClass("selected").css({
        "box-shadow": "var(--shadow-base)",
        "border-color": "var(--primary-color)",
        "transform": "translateY(-2px)",
        "background": "var(--primary-color-light)"
      });
    });

    d.show();
  }
}

function show_item_selection_dialog(frm, bill_type, scope, party) {
  // Get all items since we're not filtering by scope anymore
  let items = frm.doc.items || [];

  // Create dialog fields
  let fields = [
    {
      fieldtype: "HTML",
      fieldname: "items_html",
      options: `
        <div class="item-selector">
          <div class="select-actions">
            <button class="btn btn-xs btn-default select-all">Select All</button>
            <button class="btn btn-xs btn-default clear-all">Clear All</button>
          </div>
          <div class="table-responsive">
            <table class="table table-bordered">
              <thead>
                <tr>
                  <th style="width: 30px;">
                    <div class="checkbox">
                      <label>
                        <input type="checkbox" class="select-all-checkbox">
                      </label>
                    </div>
                  </th>
                  <th>${__("Item")}</th>
                  <th>${__("Description")}</th>
                  <th>${__("Scope")}</th>
                  <th>${__("Qty")}</th>
                  <th>${__("Width")}</th>
                  <th>${__("Height")}</th>
                  ${bill_type === "Purchase Order" ? `<th>${__("Rate")}</th>` : ""}
                </tr>
              </thead>
              <tbody>
                ${items.map((item, idx) => `
                  <tr>
                    <td>
                      <div class="checkbox">
                        <label>
                          <input type="checkbox" class="item-checkbox" data-idx="${idx}" ${item.selected ? "checked" : ""}>
                        </label>
                      </div>
                    </td>
                    <td>${item.item || ""}</td>
                    <td>${item.description || ""}</td>
                    <td>
                      <span class="scope-tag">Scope ${item.scope_number || "N/A"}</span>
                    </td>
                    <td class="text-right">${item.qty || ""}</td>
                    <td class="text-right">${item.width || ""}</td>
                    <td class="text-right">${item.height || ""}</td>
                    ${bill_type === "Purchase Order" 
                      ? `<td class="text-right">${format_currency(item.actual_unit_rate || 0, frm.doc.currency)}</td>` 
                      : ""}
                  </tr>
                `).join("")}
              </tbody>
            </table>
          </div>
        </div>
      `,
    },
  ];

  let d = new frappe.ui.Dialog({
    title: __("Select Items"),
    fields: fields,
    primary_action_label: __("Create"),
    primary_action(values) {
      // Get selected items
      let selected_items = [];
      d.$wrapper
        .find(".item-checkbox:checked")
        .each(function () {
          let idx = $(this).data("idx");
          selected_items.push(items[idx]);
        });

      if (!selected_items.length) {
        frappe.msgprint(__("Please select at least one item"));
        return;
      }

      d.hide();
      create_bill_with_scope(frm, bill_type, "0", {
        items: selected_items,
        party: party,
      });
    },
  });

  // Add custom styles
  d.$wrapper.find(".item-selector").css({
    "max-height": "70vh",
    "overflow-y": "auto"
  });

  d.$wrapper.find(".select-actions").css({
    "margin-bottom": "10px",
    "display": "flex",
    "gap": "10px"
  });

  d.$wrapper.find(".scope-tag").css({
    "background-color": "var(--bg-light-gray)",
    "padding": "2px 6px",
    "border-radius": "4px",
    "font-size": "0.9em",
    "color": "var(--text-muted)"
  });

  // Add event handlers
  d.$wrapper.find(".select-all, .select-all-checkbox").on("click", function() {
    let isChecked = $(this).is(":checked");
    if ($(this).hasClass("select-all")) {
      isChecked = true;
      d.$wrapper.find(".select-all-checkbox").prop("checked", true);
    }
    d.$wrapper.find(".item-checkbox").prop("checked", isChecked);
  });

  d.$wrapper.find(".clear-all").on("click", function() {
    d.$wrapper.find(".item-checkbox, .select-all-checkbox").prop("checked", false);
  });

  // Handle select all checkbox state based on individual selections
  d.$wrapper.find(".item-checkbox").on("change", function() {
    let allChecked = d.$wrapper.find(".item-checkbox:not(:checked)").length === 0;
    d.$wrapper.find(".select-all-checkbox").prop("checked", allChecked);
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
      ...args,
    },
    freeze: true,
    freeze_message: __("Creating {0} for Scope {1}...", [__(bill_type), scope]),
  });
}

//#region Excel Import
function b64toBlob(b64Data, contentType = "", sliceSize = 512) {
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

function show_import_dialog(frm) {
  let selected_scope = null;

  const dialog = new frappe.ui.Dialog({
    title: "Import Items",
    fields: [
      {
        fieldname: "scope_select_html",
        fieldtype: "HTML",
        options: `
          <div class="excel-import-container">
            <div class="excel-scope-section">
              <div class="excel-scope-header">
                ${
                  frm.doc.scopes.length > 1
                    ? '<div class="text-lg font-bold mb-3">Choose a Scope</div>'
                    : ""
                }
              </div>
              <div class="excel-scope-list"></div>
            </div>
            
            <div class="excel-upload-section mt-6">
              <div class="flex items-center justify-between mb-4">
                <div class="text-lg font-bold">Import Your Data</div>
                <button class="btn btn-default excel-template-btn">
                  <i class="fa fa-download mr-2"></i>Get Template
                </button>
              </div>
              <div class="excel-file-upload"></div>
            </div>
          </div>
        `,
      },
      {
        fieldname: "upload_file",
        fieldtype: "Attach",
        label: "Upload Excel File",
        reqd: 1,
        onchange: function () {
          const file = dialog.get_value("upload_file");
          if (file && selected_scope) {
            import_excel_data(file, selected_scope, dialog, frm);
          } else if (!selected_scope) {
            frappe.msgprint("Please select a scope first");
            dialog.set_value("upload_file", "");
          }
        },
      },
    ],
  });

  // Add custom styles
  dialog.$wrapper.append(`
    <style>
      .excel-import-container {
        padding: 0.5rem;
      }
      
      .excel-scope-list {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 1rem;
        margin-bottom: 1.5rem;
      }
      
      .excel-scope-item {
        position: relative;
        border-radius: 8px;
        border: 2px solid transparent;
        transition: all 0.2s ease;
        cursor: pointer;
        overflow: hidden;
      }
      
      .excel-scope-item:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(0,0,0,0.1);
      }
      
      .excel-scope-item.excel-scope-active {
        border-color: var(--primary);
      }
      
      .excel-scope-content {
        padding: 1.25rem;
      }
      
      .excel-scope-number {
        font-size: 1.25rem;
        font-weight: bold;
        margin-bottom: 0.5rem;
      }
      
      .excel-scope-desc {
        font-size: 0.875rem;
        opacity: 0.8;
      }
      
      .excel-upload-section {
        background: var(--bg-light-gray);
        border-radius: 8px;
        padding: 1.5rem;
      }
      
      .excel-template-btn {
        padding: 6px 12px;
        border-radius: 6px;
        font-size: 0.875rem;
      }
      
      .excel-file-upload {
        border-radius: 8px;
        background: white;
        padding: 1rem;
      }
      
      /* Override Frappe's attach field styling */
      .excel-file-upload .attach-input-wrap {
        margin-bottom: 0;
      }
    </style>
  `);

  function import_excel_data(file_url, scope, dialog, frm) {
    frappe.call({
      method:
        "rua_company.rua_company.doctype.project.project.import_items_from_excel",
      args: {
        file_url: file_url,
        scope: JSON.stringify(scope),
      },
      freeze: true,
      freeze_message: __("Importing items from Excel..."),
      callback: function (r) {
        if (!r.exc) {
          dialog.hide();
          frappe.show_alert({
            message: __("Successfully imported {0} items", [
              r.message.items.length,
            ]),
            indicator: "green",
          });
          frm.reload_doc().then(() => {
            // After reload, trigger calculations for all items in the imported scope
            const scopeItems = frm.doc.items.filter(
              (item) => item.scope_number === scope.scope_number
            );
            scopeItems.forEach((item) => {
              // trigger_calculations(frm, item);
            });
            frm.refresh();
          });
        }
      },
    });
  }

  // Create scope cards
  const scope_container =
    dialog.fields_dict.scope_select_html.$wrapper.find(".excel-scope-list");

  frm.doc.scopes.forEach((scope) => {
    const color = SCOPE_COLORS[(scope.scope_number - 1) % SCOPE_COLORS.length];

    const card = $(`
      <div class="excel-scope-item" data-scope='${JSON.stringify(scope)}'>
        <div class="excel-scope-content" style="background: ${color.bg}22">
          <div class="excel-scope-number" style="color: ${color.text}">
            Scope ${scope.scope_number}
          </div>
          ${
            scope.description
              ? `<div class="excel-scope-desc">${scope.description}</div>`
              : ""
          }
        </div>
      </div>
    `);

    card.on("click", function () {
      selectScope($(this), scope);
    });

    scope_container.append(card);

    // Auto-select if only one scope
    if (frm.doc.scopes.length === 1) {
      selectScope(card, scope);
    }
  });

  // Move the upload field into our custom container
  const upload_container =
    dialog.fields_dict.scope_select_html.$wrapper.find(".excel-file-upload");
  const upload_field = dialog.fields_dict.upload_file.$wrapper;
  upload_container.append(upload_field);

  // Add template button handler
  dialog.$wrapper.find(".excel-template-btn").on("click", () => {
    if (selected_scope) {
      download_import_template(frm, selected_scope);
    } else {
      frappe.msgprint("Please select a scope first");
    }
  });

  function selectScope($card, scope) {
    // Remove active class from all cards
    scope_container.find(".excel-scope-item").removeClass("excel-scope-active");

    // Add active class to clicked card
    $card.addClass("excel-scope-active");

    // Store selected scope
    selected_scope = scope;

    // Check if file already uploaded
    const file = dialog.get_value("upload_file");
    if (file) {
      import_excel_data(file, scope, dialog, frm);
    }
  }

  dialog.show();
}

function download_import_template(frm, scope) {
  frappe.call({
    method:
      "rua_company.rua_company.doctype.project.project.get_import_template",
    args: {
      scope: JSON.stringify(scope),
    },
    callback: function (r) {
      if (r.message) {
        const blob = b64toBlob(
          r.message.content,
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        );
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.style.display = "none";
        a.href = url;
        a.download = r.message.filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        a.remove();
      }
    },
  });
}

//#endregion
