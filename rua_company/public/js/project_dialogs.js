frappe.provide("rua_company.project_dialogs");

// Add Expense Dialog
rua_company.project_dialogs.showAddExpenseDialog = function (frm) {
  const dialog = new frappe.ui.Dialog({
    title: __("Add Expense"),
    size: "small",
    fields: [
      {
        fieldname: "basic_info_section",
        fieldtype: "Section Break",
        label: __("Basic Information"),
      },
      {
        fieldname: "party",
        fieldtype: "Link",
        options: "Party",
        label: __("Party"),
        mandatory_depends_on: "eval:1",
        description: __("Select the party for this expense"),
      },
      {
        fieldname: "item_wrapper",
        fieldtype: "HTML",
        label: __("Item"),
        options: `
                    <div class="item-autocomplete-wrapper">
                        <input type="text" class="form-control item-autocomplete" placeholder="${__(
                          "Type to search items..."
                        )}" />
                        <div class="item-suggestions"></div>
                    </div>
                    <style>
                        .item-autocomplete-wrapper {
                            position: relative;
                        }
                        .item-suggestions {
                            position: absolute;
                            top: 100%;
                            left: 0;
                            right: 0;
                            z-index: 1000;
                            max-height: 300px;
                            overflow-y: auto;
                            background: var(--modal-bg);
                            border: 1px solid var(--border-color);
                            border-radius: var(--border-radius);
                            box-shadow: var(--shadow-base);
                            display: none;
                        }
                        .item-suggestion {
                            padding: 8px 12px;
                            cursor: pointer;
                            border-bottom: 1px solid var(--border-color);
                        }
                        .item-suggestion:last-child {
                            border-bottom: none;
                        }
                        .item-suggestion:hover {
                            background: var(--fg-hover-color);
                        }
                        .item-suggestion.selected {
                            background: var(--fg-hover-color);
                        }
                        .item-suggestion .item-name {
                            font-weight: 600;
                            color: var(--text-color);
                        }
                        .item-suggestion .item-details {
                            font-size: 0.85em;
                            color: var(--text-muted);
                            margin-top: 2px;
                        }
                        .item-suggestion .item-rate {
                            float: right;
                            font-weight: 600;
                            color: var(--text-color);
                        }
                    </style>
                `,
      },
      {
        fieldname: "item",
        fieldtype: "Data",
        label: __("Item"),
        hidden: 1,
        mandatory_depends_on: "eval:1",
      },
      {
        fieldname: "col_break1",
        fieldtype: "Column Break",
      },
      {
        fieldname: "qty",
        fieldtype: "Int",
        label: __("Quantity"),
        mandatory_depends_on: "eval:1",
        default: 1,
        onchange: function () {
          updateTotal(dialog);
        },
      },
      {
        fieldname: "rate",
        fieldtype: "Currency",
        label: __("Rate (VAT Incl.)"),
        mandatory_depends_on: "eval:1",
        onchange: function () {
          updateTotal(dialog);
        },
      },
      {
        fieldname: "total_amount",
        fieldtype: "Currency",
        label: __("Total Amount"),
        read_only: 1,
        bold: 1,
        default: 0,
      },
      {
        fieldname: "dimensions_section",
        fieldtype: "Section Break",
        label: __("Dimensions"),
        collapsible: 1,
      },
      {
        fieldname: "width",
        fieldtype: "Float",
        label: __("Width (cm)"),
      },
      {
        fieldname: "col_break2",
        fieldtype: "Column Break",
      },
      {
        fieldname: "height",
        fieldtype: "Float",
        label: __("Height (cm)"),
      },
      {
        fieldname: "details_section",
        fieldtype: "Section Break",
        label: __("Additional Details"),
        collapsible: 1,
      },
      {
        fieldname: "description",
        fieldtype: "Small Text",
        label: __("Description"),
      },
      {
        fieldtype: "Section Break",
      },
      {
        fieldtype: "HTML",
        options: `
                    <div class="alert alert-info mb-0 mt-3" style="display: flex; align-items: center;">
                        <i class="fa fa-info-circle mr-2"></i>
                        <span>${__("The rate should be VAT inclusive")}</span>
                    </div>
                `,
      },
    ],
    primary_action_label: __("Add Expense"),
    primary_action(values) {
      if (!frm.doc.additional_items) {
        frm.doc.additional_items = [];
      }

      const amount = values.qty * values.rate;

      frappe.call({
        method: "frappe.client.insert",
        args: {
          doc: {
            doctype: "Payment Voucher",
            project: frm.doc.name,
            type: "Pay",
            party: values.party,
            amount: amount,
            is_petty_cash: 1,
          },
        },
        callback: function (r) {
          if (!r.exc) {
            let row = frappe.model.add_child(
              frm.doc,
              "Additional Items",
              "additional_items"
            );
            Object.assign(row, {
              ...values,
              amount: amount,
              payment_voucher: r.message.name,
            });

            frm.refresh_field("additional_items");
            frm.dirty();
            dialog.hide();

            frm
              .save()
              .then(() => {
                return new Promise((resolve, reject) => {
                  frappe.call({
                    method: "frappe.client.get",
                    args: {
                      doctype: frm.doctype,
                      name: frm.docname,
                    },
                    callback: function (r) {
                      if (!r.exc) {
                        resolve();
                      } else {
                        reject();
                      }
                    },
                  });
                });
              })
              .then(() => {
                frappe.call({
                  method: "frappe.client.submit",
                  args: {
                    doc: r.message,
                  },
                  callback: function (r2) {
                    if (!r2.exc) {
                      rua_company.project_dashboard.render(frm);
                      frappe.show_alert({
                        message: __("Expense added successfully"),
                        indicator: "green",
                      });
                    }
                  },
                });
              });
          }
        },
      });
    },
  });

  // Function to update total amount
  function updateTotal(dialog) {
    const qty = dialog.get_value("qty") || 0;
    const rate = dialog.get_value("rate") || 0;
    const total = qty * rate;
    dialog.set_value("total_amount", total);
  }

  // After dialog creation, setup autocomplete
  let selectedItem = null;
  const $itemInput = dialog.$wrapper.find(".item-autocomplete");
  const $suggestions = dialog.$wrapper.find(".item-suggestions");
  let currentSelectedIndex = -1;

  function populateItemFields(item) {
    dialog.set_value("item", item.item);
    if (item.description) dialog.set_value("description", item.description);
    if (item.last_rate) dialog.set_value("rate", item.last_rate);
    if (item.width) dialog.set_value("width", item.width);
    if (item.height) dialog.set_value("height", item.height);
    selectedItem = item;
    updateTotal(dialog);
  }

  function renderSuggestions(items) {
    if (!items || !items.length) {
      $suggestions.hide();
      return;
    }

    $suggestions.empty();

    items.forEach((item, index) => {
      const $suggestion = $(`
                <div class="item-suggestion ${
                  index === currentSelectedIndex ? "selected" : ""
                }" data-index="${index}">
                    <div class="item-rate">${formatCurrency(
                      item.last_rate
                    )}</div>
                    <div class="item-name">${frappe.utils.escape_html(
                      item.item
                    )}</div>
                    <div class="item-details">
                        ${
                          item.description
                            ? `<div>${frappe.utils.escape_html(
                                item.description
                              )}</div>`
                            : ""
                        }
                        ${
                          item.width || item.height
                            ? `<div>${item.width}cm × ${item.height}cm</div>`
                            : ""
                        }
                    </div>
                </div>
            `);

      $suggestion.data("item", item);
      $suggestion.on("click", function () {
        populateItemFields(item);
        $itemInput.val(item.item);
        $suggestions.hide();
      });

      $suggestions.append($suggestion);
    });

    $suggestions.show();
  }

  let searchTimeout;
  $itemInput.on("input", function () {
    clearTimeout(searchTimeout);
    currentSelectedIndex = -1;
    const query = $(this).val();
    const party = dialog.get_value("party");

    // Set the hidden item field value to the current input
    dialog.set_value("item", query);

    if (!query && !party) {
      $suggestions.hide();
      return;
    }

    searchTimeout = setTimeout(() => {
      frappe.call({
        method:
          "rua_company.rua_company.doctype.project.project.get_item_suggestions",
        args: {
          doctype: "Items",
          txt: query || "",
          searchfield: "item",
          start: 0,
          page_len: 10,
          filters: JSON.stringify(party ? { party: party } : {}),
        },
        callback: function (r) {
          if (r.message && r.message.length > 0) {
            const items = r.message.map((item) => ({
              item: item[0] || "",
              description: item[1] || "",
              last_rate: parseFloat(item[2]) || 0,
              width: parseFloat(item[3]) || 0,
              height: parseFloat(item[4]) || 0,
            }));
            renderSuggestions(items);
          } else {
            $suggestions.hide();
          }
        },
      });
    }, 300);
  });

  $itemInput.on("focus", function () {
    const party = dialog.get_value("party");
    if (party) {
      $(this).trigger("input");
    }
  });

  $itemInput.on("keydown", function (e) {
    const $items = $suggestions.find(".item-suggestion");
    const itemsLength = $items.length;

    switch (e.keyCode) {
      case 40: // Down arrow
        e.preventDefault();
        currentSelectedIndex = Math.min(
          currentSelectedIndex + 1,
          itemsLength - 1
        );
        break;
      case 38: // Up arrow
        e.preventDefault();
        currentSelectedIndex = Math.max(currentSelectedIndex - 1, 0);
        break;
      case 13: // Enter
        e.preventDefault();
        if (currentSelectedIndex >= 0) {
          const $selected = $items.eq(currentSelectedIndex);
          const item = $selected.data("item");
          if (item) {
            populateItemFields(item);
            $itemInput.val(item.item);
            $suggestions.hide();
          }
        }
        break;
      case 27: // Escape
        $suggestions.hide();
        break;
    }

    $items.removeClass("selected");
    if (currentSelectedIndex >= 0) {
      $items.eq(currentSelectedIndex).addClass("selected");
    }
  });

  $(document).on("mousedown", function (e) {
    if (!$(e.target).closest(".item-autocomplete-wrapper").length) {
      $suggestions.hide();
    }
  });

  dialog.fields_dict.party.df.onchange = function () {
    const party = dialog.get_value("party");
    if (party) {
      $itemInput.trigger("input");
    } else {
      $suggestions.hide();
      $itemInput.val("");
      dialog.set_value("item", "");
    }
  };

  dialog.show();

  updateTotal(dialog);
};

// Expense Details Dialog
rua_company.project_dialogs.showExpenseDetailsDialog = function (frm, idx) {
  // Convert idx to number if it's a string
  idx = parseInt(idx);

  // Find the expense in the additional_items array
  const expense = frm.doc.additional_items?.find((item) => item.idx === idx);
  if (!expense) {
    frappe.msgprint(__("Expense not found"));
    return;
  }

  const dialog = new frappe.ui.Dialog({
    title: __("Expense Details"),
    size: "small",
    fields: [
      {
        fieldname: "basic_info_section",
        fieldtype: "Section Break",
        label: __("Basic Information"),
      },
      {
        fieldname: "party",
        fieldtype: "Link",
        options: "Party",
        label: __("Party"),
        read_only: 1,
        default: expense.party,
        bold: 1,
      },
      {
        fieldname: "item",
        fieldtype: "Data",
        label: __("Item"),
        read_only: 1,
        default: expense.item,
        bold: 1,
      },
      {
        fieldname: "col_break1",
        fieldtype: "Column Break",
      },
      {
        fieldname: "qty",
        fieldtype: "Float",
        label: __("Quantity"),
        read_only: 1,
        default: expense.qty,
      },
      {
        fieldname: "rate",
        fieldtype: "Currency",
        label: __("Rate (VAT Incl.)"),
        read_only: 1,
        default: expense.rate,
      },
      {
        fieldname: "amount",
        fieldtype: "Currency",
        label: __("Total Amount"),
        read_only: 1,
        default: expense.amount,
        bold: 1,
      },
      {
        fieldname: "dimensions_section",
        fieldtype: "Section Break",
        label: __("Dimensions"),
        collapsible: 1,
      },
      {
        fieldname: "width",
        fieldtype: "Float",
        label: __("Width (cm)"),
        read_only: 1,
        default: expense.width,
      },
      {
        fieldname: "col_break2",
        fieldtype: "Column Break",
      },
      {
        fieldname: "height",
        fieldtype: "Float",
        label: __("Height (cm)"),
        read_only: 1,
        default: expense.height,
      },
      {
        fieldname: "details_section",
        fieldtype: "Section Break",
        label: __("Additional Details"),
        collapsible: 1,
      },
      {
        fieldname: "description",
        fieldtype: "Small Text",
        label: __("Description"),
        read_only: 1,
        default: expense.description,
      },
    ],
    primary_action_label: __("Delete Expense"),
    primary_action() {
      frappe.confirm(
        __("Are you sure you want to delete this expense?"),
        () => {
          if (expense.payment_voucher) {
            frappe.call({
              method: "frappe.client.cancel",
              args: {
                doctype: "Payment Voucher",
                name: expense.payment_voucher,
              },
              freeze: true,
              freeze_message: __("Canceling Payment Voucher..."),
              callback: function (r) {
                if (!r.exc) {
                  // Remove the expense from the array
                  const expenses = frm.doc.additional_items || [];
                  const expenseIndex = expenses.findIndex(
                    (item) => item.idx === idx
                  );
                  if (expenseIndex !== -1) {
                    expenses.splice(expenseIndex, 1);
                    frm.refresh_field("additional_items");
                    frm.dirty();
                    dialog.hide();

                    frm
                      .save()
                      .then(() => {
                        return new Promise((resolve, reject) => {
                          frappe.call({
                            method: "frappe.client.get",
                            args: {
                              doctype: frm.doctype,
                              name: frm.docname,
                            },
                            callback: function (r) {
                              if (!r.exc) {
                                resolve();
                              } else {
                                reject();
                              }
                            },
                          });
                        });
                      })
                      .then(() => {
                        frappe.call({
                          method: "frappe.client.submit",
                          args: {
                            doc: r.message,
                          },
                          callback: function (r2) {
                            if (!r2.exc) {
                              rua_company.project_dashboard.render(frm);
                              frappe.show_alert({
                                message: __("Expense deleted successfully"),
                                indicator: "green",
                              });
                            }
                          },
                        });
                      });
                  }
                }
              },
            });
          } else {
            // If no payment voucher, just remove the expense
            const expenses = frm.doc.additional_items || [];
            const expenseIndex = expenses.findIndex((item) => item.idx === idx);
            if (expenseIndex !== -1) {
              expenses.splice(expenseIndex, 1);
              frm.refresh_field("additional_items");
              frm.dirty();
              dialog.hide();

              frm
                .save()
                .then(() => {
                  return new Promise((resolve, reject) => {
                    frappe.call({
                      method: "frappe.client.get",
                      args: {
                        doctype: frm.doctype,
                        name: frm.docname,
                      },
                      callback: function (r) {
                        if (!r.exc) {
                          resolve();
                        } else {
                          reject();
                        }
                      },
                    });
                  });
                })
                .then(() => {
                  frappe.call({
                    method: "frappe.client.submit",
                    args: {
                      doc: r.message,
                    },
                    callback: function (r2) {
                      if (!r2.exc) {
                        rua_company.project_dashboard.render(frm);
                        frappe.show_alert({
                          message: __("Expense deleted successfully"),
                          indicator: "green",
                        });
                      }
                    },
                  });
                });
            }
          }
        }
      );
    },
  });

  dialog.show();
};

// Manage Parties Dialog
rua_company.project_dialogs.showManagePartiesDialog = function (frm) {
  const dialog = new frappe.ui.Dialog({
    title: "Manage Project Parties",
    fields: [
      {
        fieldname: "existing_parties_section",
        fieldtype: "Section Break",
        label: "Current Parties",
      },
      {
        fieldname: "parties_html",
        fieldtype: "HTML",
      },
      {
        fieldname: "add_party_section",
        fieldtype: "Section Break",
        label: "Add New Party",
      },
      {
        fieldname: "party",
        fieldtype: "Link",
        options: "Party",
        label: "Select Party",
        get_query: () => {
          return {
            filters: {
              name: ["not in", (frm.doc.parties || []).map((p) => p.party)],
            },
          };
        },
        onchange: function () {
          const party = this.get_value();
          if (party) {
            frappe.db.get_value(
              "Party",
              party,
              ["default_type", "default_section"],
              (r) => {
                if (r.default_type) {
                  dialog.set_value("type", r.default_type);
                }
                if (r.default_type === "Supplier" && r.default_section) {
                  dialog.set_value("section", r.default_section);
                }
              }
            );
          }
        },
      },
      {
        fieldname: "type",
        fieldtype: "Select",
        label: "Type",
        options: "\nClient\nSupplier\nConsultant",
        depends_on: "eval:doc.party",
      },
      {
        fieldname: "section",
        fieldtype: "Select",
        label: "Section",
        options: "\nAluminum\nGlass\nCladding",
        depends_on: 'eval:doc.type=="Supplier"',
      },
    ],
    primary_action_label: "Add Party",
    primary_action(values) {
      if (!values.party || !values.type) {
        frappe.throw(__("Please select both Party and Type"));
        return;
      }

      let row = frappe.model.add_child(frm.doc, "Parties", "parties");
      row.party = values.party;
      row.type = values.type;
      if (values.type === "Supplier" && values.section) {
        row.section = values.section;
      }

      frm.refresh_field("parties");
      frm.dirty();
      dialog.clear();
      dialog.hide();
      refresh_parties_list(dialog, frm);
      frm.save();
    },
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

    frm.doc.parties.forEach((party) => {
      const row = $(`
                <tr>
                    <td>${party.party}</td>
                    <td>${party.type}</td>
                    <td>${party.section || ""}</td>
                    <td>
                        <button class="btn btn-danger btn-xs btn-remove-party" 
                                data-party="${party.party}">
                            Remove
                        </button>
                    </td>
                </tr>
            `);

      row.find(".btn-remove-party").on("click", () => {
        frappe.confirm(
          __("Are you sure you want to remove {0}?", [party.party]),
          () => {
            frm.doc.parties = frm.doc.parties.filter(
              (p) => p.party !== party.party
            );
            frm.refresh_field("parties");
            frm.dirty();
            refresh_parties_list(dialog, frm);
            frm.save();
          }
        );
      });

      table.find("tbody").append(row);
    });

    wrapper.append(table);
  }

  // Initial refresh of parties list
  refresh_parties_list(dialog, frm);

  dialog.show();
};

// Scope Details Dialog
rua_company.project_dialogs.showScopeDetailsDialog = function (frm, scope) {
  // Get scope color based on scope number
  const colorIndex = (parseInt(scope.scope_number) - 1) % SCOPE_COLORS.length;
  const colorSet = {
    bg: SCOPE_COLORS[colorIndex].bg,
    text: SCOPE_COLORS[colorIndex].text,
    cardBg: "var(--card-bg)",
    borderColor: "var(--border-color)",
  };

  const d = new frappe.ui.Dialog({
    title: __("Scope Details"),
    size: "large",
    fields: [
      {
        fieldname: "scope_details_html",
        fieldtype: "HTML",
      },
    ],
  });

  // Add edit button to dialog header
  const editBtn = $(`
        <button class="btn btn-default btn-sm edit-scope-btn" style="margin-left: 10px;">
            <i class="fa fa-pencil"></i> ${__("Edit")}
        </button>
    `);

  d.header.find(".modal-actions").prepend(editBtn);

  // Edit button click handler
  editBtn.click(() => {
    const editDialog = new frappe.ui.Dialog({
      title: __("Edit Scope"),
      fields: [
        {
          fieldname: "description",
          fieldtype: "Data",
          label: "Description",
          reqd: 1,
          default: scope.description,
        },
        {
          fieldname: "glass_sqm_price",
          fieldtype: "Currency",
          label: "Glass SQM Price",
          reqd: 1,
          default: scope.glass_sqm_price,
        },
        {
          fieldname: "labour_charges",
          fieldtype: "Currency",
          label: "Labour Charges",
          reqd: 1,
          default: scope.labour_charges,
        },
        {
          fieldname: "aluminum_weight",
          fieldtype: "Float",
          label: "Aluminum Weight",
          reqd: 1,
          default: scope.aluminum_weight,
        },
        {
          fieldtype: "Column Break",
        },
        {
          fieldname: "powder_coating",
          fieldtype: "Currency",
          label: "Powder Coating",
          reqd: 1,
          default: scope.sdf,
        },
        {
          fieldname: "profit",
          fieldtype: "Percent",
          label: "Profit Percentage",
          reqd: 1,
          default: scope.profit,
        },
        {
          fieldname: "retention",
          fieldtype: "Percent",
          label: "Retention",
          default: scope.retention,
        },
        {
          fieldname: "rounding",
          fieldtype: "Select",
          label: "Rounding",
          options: ["No Rounding", "Round up to nearest 5"],
          default: scope.rounding || "Round up to nearest 5",
        },
      ],
      primary_action_label: __("Update"),
      primary_action(values) {
        // Check if there are items using this scope
        const items_with_scope = frm.doc.items
          ? frm.doc.items.filter(
              (item) => item.scope_number === scope.scope_number
            )
          : [];

        const update_scope = () => {
          const scope_idx = frm.doc.scopes.findIndex(
            (s) => s.scope_number === scope.scope_number
          );
          if (scope_idx !== -1) {
            // Update the scope with new values
            Object.assign(frm.doc.scopes[scope_idx], {
              ...values,
              sdf: values.powder_coating, // Map powder_coating to sdf field
            });

            // Update items using this scope
            if (frm.doc.items) {
              frm.doc.items.forEach((item) => {
                if (item.scope_number === scope.scope_number) {
                  item.glass_unit = values.glass_sqm_price;
                  item.profit_percentage = values.profit;
                }
              });
              frm.refresh_field("items");
            }

            frm.refresh_field("scopes");
            frm.dirty();
            editDialog.hide();
            d.hide();
            frm.save().then(() => {
              rua_company.project_dashboard.render(frm);
              frappe.show_alert({
                message: __("Scope {0} updated", [scope.scope_number]),
                indicator: "green",
              });
            });
          }
        };

        if (items_with_scope.length > 0) {
          frappe.confirm(
            __(
              "This scope is being used by {0} items. Updating this scope will also update these items. Are you sure you want to continue?",
              [items_with_scope.length]
            ),
            () => {
              update_scope();
            }
          );
        } else {
          update_scope();
        }
      },
    });

    editDialog.show();
  });

  // Add styles
  d.$wrapper.append(generateScopeDialogStyles());

  // Set HTML content with updated aesthetic
  const updatedHTML = `
        <div class="scope-details-container">
            <!-- Header Section -->
            <div class="scope-header" style="
                background: ${colorSet.bg}; 
                color: ${colorSet.text};
                padding: 1.5rem;
                border-radius: 12px;
                margin-bottom: 1.5rem;
            ">
                <h3 style="margin-bottom: 0.5rem; font-size: 1.5rem;">
                    ${scope.description || "Untitled Scope"}
                </h3>
                <div class="scope-meta" style="display: flex; gap: 2rem;">
                    <div>
                        <i class="fa fa-hashtag"></i> 
                        Scope ${scope.scope_number}
                    </div>
                    <div>
                        <i class="fa fa-tag"></i> 
                        ${scope.type || "N/A"}
                    </div>
                </div>
            </div>

            <div class="row">
                <!-- Left Column -->
                <div class="col-md-6">
                    <!-- Base Parameters Section -->
                    <div class="section-container" style="height: calc(100% - 1.5rem);">
                        <h4 class="section-title">
                            <i class="fa fa-cubes"></i> Base Parameters
                        </h4>
                        <div class="parameters-grid">
                            <div class="scope-detail-card">
                                <div class="detail-label">Glass SQM Price</div>
                                <div class="detail-value">${formatCurrency(
                                  scope.glass_sqm_price
                                )}</div>
                            </div>
                            <div class="scope-detail-card">
                                <div class="detail-label">Labour Charges</div>
                                <div class="detail-value">${formatCurrency(
                                  scope.labour_charges
                                )}</div>
                            </div>
                            <div class="scope-detail-card">
                                <div class="detail-label">Aluminum Weight</div>
                                <div class="detail-value">${
                                  scope.aluminum_weight || 0
                                } kg</div>
                            </div>
                            <div class="scope-detail-card">
                                <div class="detail-label">Powder Coating</div>
                                <div class="detail-value">${formatCurrency(
                                  scope.sdf || 0
                                )}</div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Right Column -->
                <div class="col-md-6">
                    <!-- Financial Parameters Section -->
                    <div class="section-container" style="height: calc(100% - 1.5rem);">
                        <h4 class="section-title">
                            <i class="fa fa-calculator"></i> Financial Parameters
                        </h4>
                        <div class="parameters-grid">
                            <div class="scope-detail-card">
                                <div class="detail-label">Profit</div>
                                <div class="detail-value highlighted">${
                                  scope.profit || 0
                                }%</div>
                            </div>
                            <div class="scope-detail-card">
                                <div class="detail-label">Retention</div>
                                <div class="detail-value">${
                                  scope.retention || 0
                                }%</div>
                            </div>
                            <div class="scope-detail-card">
                                <div class="detail-label">VAT Rate</div>
                                <div class="detail-value">${
                                  scope.vat || 0
                                }%</div>
                            </div>
                            <div class="scope-detail-card">
                                <div class="detail-label">Rounding</div>
                                <div class="detail-value">${
                                  scope.rounding === "Round up to nearest 5"
                                    ? "~5"
                                    : "None"
                                }</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Financial Flow Chart Section -->
            <div class="section-container" style="margin-top: 1.5rem;">
                <h4 class="section-title">
                    <i class="fa fa-money"></i> Financial Flow
                </h4>
                <div class="financial-flow-chart">
                    <!-- Starting Point -->
                    <div class="flow-row">
                        <div class="flow-card main">
                            <div class="flow-label">Total Price (Excl. VAT)</div>
                            <div class="flow-value">${formatCurrency(
                              scope.total_price_excluding_vat
                            )}</div>
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
                                <div class="flow-label">VAT Amount</div>
                                <div class="flow-value">${formatCurrency(
                                  scope.total_vat_amount
                                )}</div>
                            </div>
                            
                            <div class="flow-card highlighted">
                                <div class="flow-label">Total Price (Incl. VAT)</div>
                                <div class="flow-value">${formatCurrency(
                                  scope.total_price
                                )}</div>
                            </div>

                            <!-- Cost and Profit -->
                            <div class="flow-split secondary">
                                <div class="flow-card small">
                                    <div class="flow-label">Cost</div>
                                    <div class="flow-value negative">${formatCurrency(
                                      scope.total_cost
                                    )}</div>
                                </div>
                                <div class="flow-card small">
                                    <div class="flow-label">Profit</div>
                                    <div class="flow-value positive">${formatCurrency(
                                      scope.total_profit
                                    )}</div>
                                </div>
                            </div>
                        </div>

                        <!-- Right Side - Retention Path -->
                        <div class="flow-column">
                            <div class="flow-card">
                                <div class="flow-label">Price After Retention</div>
                                <div class="flow-value">${formatCurrency(
                                  scope.price_after_retention
                                )}</div>
                            </div>
                            <div class="flow-card">
                                <div class="flow-label">VAT After Retention</div>
                                <div class="flow-value">${formatCurrency(
                                  scope.vat_after_retention
                                )}</div>
                            </div>
                            <div class="flow-card highlighted">
                                <div class="flow-label">Total After Retention</div>
                                <div class="flow-value">${formatCurrency(
                                  scope.total_price_after_retention
                                )}</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

  d.fields_dict.scope_details_html.$wrapper.html(updatedHTML);

  // Add delete button
  const deleteBtn = $(`
        <button class="btn btn-danger btn-sm" style="margin-left: 10px;">
            <i class="fa fa-trash"></i> ${__("Delete")}
        </button>
    `);

  d.header.find(".modal-actions").prepend(deleteBtn);

  // Delete button click handler
  deleteBtn.click(() => {
    frappe.confirm(__("Are you sure you want to delete this scope?"), () => {
      const scope_idx = frm.doc.scopes.findIndex(
        (s) => s.scope_number === scope.scope_number
      );
      if (scope_idx !== -1) {
        frm.doc.scopes.splice(scope_idx, 1);
        frm.refresh_field("scopes");
        frm.dirty();
        d.hide();
        frm.save().then(() => {
          rua_company.project_dashboard.render(frm);
          frappe.show_alert({
            message: __("Scope {0} deleted", [scope.scope_number]),
            indicator: "green",
          });
        });
      }
    });
  });

  d.show();
};

// Scope Edit Dialog
rua_company.project_dialogs.showScopeEditDialog = function (frm, scope = null) {
  const scope_types = [
    {
      type: "Openings",
      icon: "window-restore",
      description: "Windows, Doors, and other openings",
    },
    {
      type: "Louvers",
      icon: "sliders-h",
      description: "Ventilation and sun shading systems",
    },
    {
      type: "Handrails",
      icon: "grip-lines",
      description: "Balustrades and safety rails",
    },
    {
      type: "Claddings",
      icon: "layer-group",
      description: "Exterior wall coverings",
    },
    {
      type: "Pergolas",
      icon: "home",
      description: "Outdoor shade structures",
    },
    {
      type: "Skylights",
      icon: "sun",
      description: "Roof windows and light openings",
    },
    {
      type: "Shower Partitions",
      icon: "shower",
      description: "Bathroom dividers and enclosures",
    },
  ];

  let current_step = 1;
  let selected_type = null;
  let dialog = null;

  function showTypeSelection() {
    const type_cards_html = `
            <div class="scope-type-section">
                <div class="scope-type-grid">
                    ${scope_types
                      .map(
                        (type) => `
                        <div class="scope-type-card" data-type="${type.type}">
                            <div class="scope-type-icon">
                                <i class="fa fa-${type.icon}"></i>
                            </div>
                            <div class="scope-type-content">
                                <div class="scope-type-title">${type.type}</div>
                                <div class="scope-type-desc">${type.description}</div>
                            </div>
                        </div>
                    `
                      )
                      .join("")}
                </div>
            </div>
        `;

    dialog = new frappe.ui.Dialog({
      title: scope
        ? `Edit Scope ${scope.scope_number}`
        : "Add New Scope (Step 1 of 2)",
      fields: [
        {
          fieldtype: "HTML",
          fieldname: "type_cards",
          options: type_cards_html,
        },
      ],
      primary_action_label: "Next",
      primary_action() {
        if (!selected_type) {
          frappe.msgprint(__("Please select a scope type"));
          return;
        }
        dialog.hide();
        showScopeDetails();
      },
    });

    // Add custom styles
    dialog.$wrapper.find(".scope-type-section").css({
      padding: "15px",
    });

    dialog.$wrapper.find(".scope-type-grid").css({
      display: "grid",
      "grid-template-columns": "repeat(2, 1fr)",
      gap: "20px",
      "margin-top": "10px",
    });

    dialog.$wrapper.find(".scope-type-card").css({
      border: "1px solid var(--border-color)",
      "border-radius": "8px",
      padding: "15px",
      cursor: "pointer",
      transition: "all 0.2s ease",
      background: "var(--card-bg)",
      display: "flex",
      "align-items": "center",
      gap: "15px",
    });

    dialog.$wrapper.find(".scope-type-icon").css({
      "font-size": "1.5em",
      color: "var(--text-muted)",
      width: "40px",
      height: "40px",
      display: "flex",
      "align-items": "center",
      "justify-content": "center",
      background: "var(--bg-light-gray)",
      "border-radius": "8px",
    });

    dialog.$wrapper.find(".scope-type-title").css({
      "font-weight": "600",
      "margin-bottom": "4px",
    });

    dialog.$wrapper.find(".scope-type-desc").css({
      color: "var(--text-muted)",
      "font-size": "0.9em",
    });

    // Add hover and selection effects
    dialog.$wrapper
      .find(".scope-type-card")
      .hover(
        function () {
          if (!$(this).hasClass("selected")) {
            $(this).css({
              "box-shadow": "var(--shadow-base)",
              "border-color": "var(--primary-color)",
              transform: "translateY(-2px)",
            });
          }
        },
        function () {
          if (!$(this).hasClass("selected")) {
            $(this).css({
              "box-shadow": "none",
              "border-color": "var(--border-color)",
              transform: "none",
            });
          }
        }
      )
      .click(function () {
        dialog.$wrapper.find(".scope-type-card").removeClass("selected").css({
          "box-shadow": "none",
          "border-color": "var(--border-color)",
          transform: "none",
          background: "var(--card-bg)",
        });

        $(this).addClass("selected").css({
          "box-shadow": "var(--shadow-base)",
          "border-color": "var(--primary-color)",
          transform: "translateY(-2px)",
          background: "var(--primary-color-light)",
        });

        selected_type = $(this).data("type");
      });

    // If editing, preselect the type
    if (scope) {
      dialog.$wrapper
        .find(`.scope-type-card[data-type="${scope.type}"]`)
        .click();
    }

    dialog.show();
  }

  function showScopeDetails() {
    frappe.db.get_single_value("Rua", "vat").then((vat_value) => {
      const is_openings_or_skylight =
        selected_type === "Openings" || selected_type === "Skylights";

      let fields = [
        {
          fieldname: "type",
          fieldtype: "Data",
          label: "Type",
          read_only: 1,
          default: selected_type,
        },
        {
          fieldname: "description",
          fieldtype: "Data",
          label: "Description",
          mandatory_depends_on: "eval:1",
          default: selected_type,
        },
        {
          fieldname: "labour_charges",
          fieldtype: "Currency",
          label: "Labour Charges",
          mandatory_depends_on: "eval:1",
        },
        {
          fieldname: "profit",
          fieldtype: "Percent",
          label: "Profit Percentage",
          mandatory_depends_on: "eval:1",
          default: 35,
        },
        {
          fieldtype: "Column Break",
        },
        {
          fieldname: "retention",
          fieldtype: "Percent",
          label: "Retention",
          default: 10,
        },
        {
          fieldname: "rounding",
          fieldtype: "Select",
          label: "Rounding",
          options: ["No Rounding", "Round up to nearest 5"],
          default: "Round up to nearest 5",
        },
      ];

      // Add fields specific to openings and skylights
      if (is_openings_or_skylight) {
        fields = [
          ...fields,
          {
            fieldtype: "Section Break",
            label: "Material Costs",
          },
          {
            fieldname: "glass_sqm_price",
            fieldtype: "Currency",
            label: "Glass SQM Price",
            mandatory_depends_on: "eval:1",
          },
          {
            fieldname: "aluminum_weight",
            fieldtype: "Float",
            label: "Aluminum Weight",
            mandatory_depends_on: "eval:1",
          },
          {
            fieldname: "powder_coating",
            fieldtype: "Currency",
            label: "Powder Coating",
            mandatory_depends_on: "eval:1",
            default: scope.powder_coating,
          },
        ];
      }

      // Add VAT information section
      fields.push(
        {
          fieldtype: "Section Break",
          label: "VAT Information",
        },
        {
          fieldname: "vat_info",
          fieldtype: "HTML",
          options: `
                        <div class="vat-info" style="padding: 10px; background: var(--bg-light-gray); border-radius: 8px;">
                            <div style="font-weight: 600; margin-bottom: 5px;">VAT Rate: ${vat_value}%</div>
                            <div style="color: var(--text-muted); font-size: 0.9em;">
                                VAT will be automatically calculated based on this rate
                            </div>
                        </div>
                    `,
        }
      );

      dialog = new frappe.ui.Dialog({
        title: scope
          ? `Edit Scope ${scope.scope_number}`
          : "Add New Scope (Step 2 of 2)",
        fields: fields,
        primary_action_label: scope ? "Save Changes" : "Add Scope",
        primary_action(values) {
          if (scope) {
            // Update existing scope logic
            const items_with_scope = frm.doc.items
              ? frm.doc.items.filter(
                  (item) => item.scope_number === scope.scope_number
                )
              : [];

            const update_scope = () => {
              const scope_idx = frm.doc.scopes.findIndex(
                (s) => s.scope_number === scope.scope_number
              );
              if (scope_idx !== -1) {
                Object.assign(frm.doc.scopes[scope_idx], values);

                if (frm.doc.items) {
                  frm.doc.items.forEach((item) => {
                    if (item.scope_number === scope.scope_number) {
                      item.glass_unit = values.glass_sqm_price;
                      item.profit_percentage = values.profit;
                    }
                  });
                  frm.refresh_field("items");
                }

                frm.refresh_field("scopes");
                frm.dirty();
                dialog.hide();
                frm.save();
                rua_company.project_dashboard.render(frm);
                frappe.show_alert({
                  message: __("Scope {0} updated", [scope.scope_number]),
                  indicator: "green",
                });
              }
            };

            if (items_with_scope.length > 0) {
              frappe.confirm(
                __(
                  "This scope is being used by {0} items. Updating this scope will also update these items. Are you sure you want to continue?",
                  [items_with_scope.length]
                ),
                () => {
                  update_scope();
                }
              );
            } else {
              update_scope();
            }
          } else {
            // Add new scope logic
            if (!frm.doc.scopes) {
              frm.doc.scopes = [];
            }

            const next_scope_number =
              frm.doc.scopes.length > 0
                ? Math.max(...frm.doc.scopes.map((s) => s.scope_number)) + 1
                : 1;

            frm.doc.scopes.push({
              ...values,
              scope_number: next_scope_number,
            });

            frm.refresh_field("scopes");
            frm.dirty();
            dialog.hide();
            frm.save();
            rua_company.project_dashboard.render(frm);
            frappe.show_alert({
              message: __("Scope {0} added", [next_scope_number]),
              indicator: "green",
            });
          }
        },
      });

      // Set values if editing
      if (scope) {
        dialog.set_values(scope);
      }

      dialog.show();
    });
  }

  // Start with type selection
  showTypeSelection();
};

// Project Financials Dialog
rua_company.project_dialogs.showProjectFinancialsDialog = function (frm) {
  const dialog = new frappe.ui.Dialog({
    title: "Project Financial Overview",
    size: "extra-large",
    fields: [
      {
        fieldname: "use_contract_value",
        label: __("Based on Contract Value"),
        fieldtype: "Check",
        onchange: function () {
          refreshFinancials();
        },
      },
      {
        fieldname: "financials_html",
        fieldtype: "HTML",
      },
    ],
  });

  // Calculate project totals
  const projectTotals = {
    totalPriceExclVAT: 0,
    totalVAT: 0,
    totalPriceInclVAT: 0,
    totalRetention: 0,
    totalPriceAfterRetention: 0,
    totalCost: 0,
    totalProfit: 0,
  };

  // Function to refresh financials when toggle changes
  const refreshFinancials = () => {
    dialog.fields_dict.financials_html.$wrapper.html(generateFlowchartHTML());
  };

  // Generate flowchart HTML
  const generateFlowchartHTML = () => {
    // Reset totals
    Object.keys(projectTotals).forEach((key) => (projectTotals[key] = 0));

    const useContractValue = dialog.get_value("use_contract_value");
    const contractValue = frm.doc.contract_value || 0;
    const totalOriginalPrice = frm.doc.scopes.reduce(
      (sum, scope) => sum + (scope.total_price_excluding_vat || 0),
      0
    );

    const scopeFlowcharts = frm.doc.scopes
      .map((scope) => {
        const scopeNumber = scope.scope_number;
        const colorSet = SCOPE_COLORS[(scopeNumber - 1) % SCOPE_COLORS.length];

        let scopePriceExclVAT = scope.total_price_excluding_vat || 0;
        let scopeVAT = scope.total_vat_amount || 0;
        let scopePriceInclVAT = scope.total_price || 0;
        let scopeRetention =
          (scope.total_price * (scope.retention || 0)) / 100 || 0;
        let scopePriceAfterRetention = scope.total_price_after_retention || 0;
        let scopeCost = scope.total_cost || 0;
        let scopeProfit = scope.total_profit || 0;

        if (useContractValue && totalOriginalPrice > 0) {
          // Calculate this scope's proportion of the contract value
          const scopeRatio =
            (scope.total_price_excluding_vat || 0) / totalOriginalPrice;
          scopePriceExclVAT = contractValue * scopeRatio;
          scopeVAT = scopePriceExclVAT * 0.05; // 5% VAT
          scopePriceInclVAT = scopePriceExclVAT + scopeVAT;
          scopeRetention = (scopePriceInclVAT * (scope.retention || 0)) / 100;
          scopePriceAfterRetention = scopePriceInclVAT - scopeRetention;
          scopeProfit = scopePriceExclVAT - scopeCost;
        }

        // Add to project totals
        projectTotals.totalPriceExclVAT += scopePriceExclVAT;
        projectTotals.totalVAT += scopeVAT;
        projectTotals.totalPriceInclVAT += scopePriceInclVAT;
        projectTotals.totalRetention += scopeRetention;
        projectTotals.totalPriceAfterRetention += scopePriceAfterRetention;
        projectTotals.totalCost += scopeCost;
        projectTotals.totalProfit += scopeProfit;

        return generateScopeFinancialSection(scope, colorSet, {
          scopePriceExclVAT,
          scopeVAT,
          scopePriceInclVAT,
          scopeRetention,
          scopePriceAfterRetention,
          scopeCost,
          scopeProfit,
        });
      })
      .join("");

    return `
            <div class="project-flow-container" style="max-width: 1200px; margin: auto;">
                ${generateProjectHeader(frm)}
                <div class="scopes-flow">
                    ${scopeFlowcharts}
                </div>
                ${generateProjectSummary(projectTotals)}
            </div>
        `;
  };

  dialog.fields_dict.financials_html.$wrapper.html(generateFlowchartHTML());
  dialog.show();
};

// Generate Project Header HTML
function generateProjectHeader(frm) {
  return `
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
                SN#${frm.doc.serial_number || "0"}: ${
    frm.doc.project_name || frm.doc.name
  }
            </h2>
        </div>
    `;
}

// Generate Scope Financial Section HTML
function generateScopeFinancialSection(scope, colorSet, financials) {
  return `
        <div class="scope-flow-container">
            <div class="scope-header" style="
                background: ${colorSet.bg}; 
                color: ${colorSet.text};
                padding: 1rem;
                border-radius: 8px 8px 0 0;
                margin-bottom: 0;">
                <h2 style="
                    margin: 0;
                    color: var(--heading-color);
                    font-size: 1.1rem;
                    font-weight: 600;">
                    <i class="fa fa-bookmark-o mr-2"></i>
                    Scope ${scope.scope_number}: ${
    scope.description || "Untitled Scope"
  }
                </h2>
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
                            color: ${colorSet.text};">${formatCurrency(
    financials.scopePriceExclVAT
  )}</div>
                    </div>
                </div>

                <!-- Split Sections -->
                <div class="flow-split" style="
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 2rem;">
                    ${generateLeftBranch(colorSet, financials)}
                    ${generateRightBranch(colorSet, financials)}
                </div>
            </div>
        </div>
    `;
}

// Generate Left Branch HTML (VAT and Total)
function generateLeftBranch(colorSet, financials) {
  return `
        <div class="flow-branch">
            <div class="flow-node" style="
                background: var(--bg-color);
                border: 1px solid var(--border-color);
                border-radius: 8px;
                padding: 0.8rem;
                margin-bottom: 1rem;">
                <div class="flow-label" style="color: var(--text-muted); font-size: 0.9rem;">VAT Amount</div>
                <div class="flow-value" style="font-weight: 500;">${formatCurrency(
                  financials.scopeVAT
                )}</div>
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
                    color: ${colorSet.text};">${formatCurrency(
    financials.scopePriceInclVAT
  )}</div>
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
                        ${formatCurrency(financials.scopeCost)}</div>
                </div>
                <div class="flow-node small" style="
                    background: var(--bg-color);
                    border: 1px solid var(--border-color);
                    border-radius: 8px;
                    padding: 0.8rem;">
                    <div class="flow-label" style="
                        color: var(--text-muted);
                        font-size: 0.85rem;">Profit</div>
                    <div class="flow-value" style="color: var(--green-600);">
                        ${formatCurrency(financials.scopeProfit)}</div>
                </div>
            </div>
        </div>
    `;
}

// Generate Right Branch HTML (Retention)
function generateRightBranch(colorSet, financials) {
  return `
        <div class="flow-branch">
            <div class="flow-node" style="
                background: var(--bg-color);
                border: 1px solid var(--border-color);
                border-radius: 8px;
                padding: 0.8rem;
                margin-bottom: 1rem;">
                <div class="flow-label" style="color: var(--text-muted); font-size: 0.9rem;">Price After Retention</div>
                <div class="flow-value" style="font-weight: 500;">${formatCurrency(
                  financials.scopePriceAfterRetention
                )}</div>
            </div>
            <div class="flow-node" style="
                background: var(--bg-color);
                border: 1px solid var(--border-color);
                border-radius: 8px;
                padding: 0.8rem;
                margin-bottom: 1rem;">
                <div class="flow-label" style="color: var(--text-muted); font-size: 0.9rem;">VAT After Retention</div>
                <div class="flow-value" style="font-weight: 500;">${formatCurrency(
                  financials.scopeVAT
                )}</div>
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
                    color: ${colorSet.text};">${formatCurrency(
    financials.scopePriceAfterRetention
  )}</div>
            </div>
        </div>
    `;
}

// Generate Project Summary HTML
function generateProjectSummary(projectTotals) {
  return `
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
                ${generateSummaryCards(projectTotals)}
            </div>
        </div>
    `;
}

// Generate Summary Cards HTML
function generateSummaryCards(totals) {
  const cards = [
    {
      label: "Total Price (Excl. VAT)",
      value: totals.totalPriceExclVAT,
      style: "normal",
    },
    {
      label: "Total VAT",
      value: totals.totalVAT,
      style: "normal",
    },
    {
      label: "Total Price (Incl. VAT)",
      value: totals.totalPriceInclVAT,
      style: "highlighted",
    },
    {
      label: "Total Retention",
      value: totals.totalRetention,
      style: "normal",
    },
    {
      label: "Total After Retention",
      value: totals.totalPriceAfterRetention,
      style: "highlighted",
    },
    {
      label: "Total Cost",
      value: totals.totalCost,
      style: "cost",
    },
    {
      label: "Total Profit",
      value: totals.totalProfit,
      style: "profit",
    },
  ];

  return cards
    .map((card) => {
      let cardStyle = "";
      let valueStyle = "";

      switch (card.style) {
        case "highlighted":
          cardStyle = "background: var(--bg-color);";
          valueStyle =
            "font-size: 1.3rem; font-weight: 600; color: var(--text-color);";
          break;
        case "cost":
          cardStyle =
            "background: var(--bg-red); border: 1px solid var(--red-600);";
          valueStyle =
            "font-size: 1.2rem; font-weight: 600; color: var(--text-on-red);";
          break;
        case "profit":
          cardStyle =
            "background: var(--bg-green); border: 1px solid var(--green-600);";
          valueStyle =
            "font-size: 1.2rem; font-weight: 600; color: var(--green-600);";
          break;
        default:
          cardStyle = "background: var(--bg-color);";
          valueStyle = "font-size: 1.2rem; font-weight: 600;";
      }

      return `
            <div class="summary-card" style="
                ${cardStyle}
                border: 1px solid var(--border-color);
                border-radius: 8px;
                flex-direction: column;
                padding: 1rem;">
                <div class="card-label" style="
                    color: var(--text-muted);
                    font-size: 0.9rem;
                    margin-bottom: 0.5rem;">${card.label}</div>
                <div class="card-value" style="${valueStyle}">
                    ${formatCurrency(card.value)}
                </div>
            </div>
        `;
    })
    .join("");
}

// Add custom styles for the financials dialog
const financialsDialogStyles = `
    <style>
        .project-flow-container {
            max-width: 1200px;
            margin: auto;
        }

        .scope-flow-container {
            margin-bottom: 2rem;
        }

        .flow-section {
            display: flex;
            flex-direction: column;
            align-items: center;
        }

        .flow-split {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 2rem;
            margin-top: 1rem;
        }

        .flow-branch {
            display: flex;
            flex-direction: column;
            gap: 1rem;
        }

        .flow-node {
            background: var(--fg-color);
            border: 1px solid var(--border-color);
            border-radius: var(--border-radius-lg);
            padding: 1rem;
        }

        .flow-node.highlighted {
            background: var(--bg-blue-50);
            border-color: var(--blue-200);
        }

        .flow-label {
            color: var(--text-muted);
            font-size: 0.9rem;
            margin-bottom: 0.25rem;
        }

        .flow-value {
            font-weight: 600;
            font-size: 1.1rem;
        }

        .flow-value.positive {
            color: var(--green-600);
        }

        .flow-value.negative {
            color: var(--red-600);
        }

        .flow-split {
            display: flex;
            justify-content: space-around;
            margin-top: 2rem;
            gap: 2rem;
        }

        .flow-column {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 1rem;
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
            transition: all 0.2s ease;
        }

        .connector-line.left {
            left: 25%;
            width: 29%;
            transform: translateX(-50%) rotate(-45deg);
        }

        .connector-line.right {
            right: 25%;
            width: 29%;
            transform: translateX(50%) rotate(45deg);
        }

        /* Dialog Button Styles */
        .edit-scope-btn {
            background: var(--primary-color-light);
            color: var(--primary-color);
            border: none;
            transition: all 0.2s ease;
        }

        .edit-scope-btn:hover {
            background: var(--primary-color);
            color: var(--white);
        }

        /* Responsive Styles */
        @media (max-width: 768px) {
            .parameters-grid {
                grid-template-columns: 1fr;
            }

            .flow-split {
                flex-direction: column;
                align-items: center;
            }

            .flow-column {
                max-width: 100%;
                margin-bottom: 2rem;
            }

            .flow-card {
                min-width: 180px;
            }

            .connector-line {
                display: none;
            }

            .section-container {
                margin-bottom: 1rem;
                padding: 1rem;
            }
        }
    </style>
`;

// Items Dialog
rua_company.project_dialogs.showItemsDialog = function (frm) {
  let currentScope = "all";

  const dialog = new frappe.ui.Dialog({
    title: "Project Items",
    size: "extra-large",
    fields: [
      {
        fieldname: "filters_section",
        fieldtype: "Section Break",
        label: "Filters",
      },
      {
        fieldname: "scope_chips_html",
        fieldtype: "HTML",
      },
      {
        fieldname: "search",
        fieldtype: "Data",
        label: "Search Items",
        placeholder: "Search by item or description...",
      },
      {
        fieldname: "items_html",
        fieldtype: "HTML",
      },
    ],
  });

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

    function renderScopeChips() {
        // Ensure scope numbers are strings for consistent comparison
        const scopeChips = ["all", ...frm.doc.scopes.map((s) => s.scope_number.toString())];
        const chipsHTML = `
            <div class="scope-chips-container" style="display: flex; justify-content: space-between; align-items: center;">
                <div class="scope-chips">
                    ${scopeChips.map((scope, index) => {
                        const isAll = scope === "all";
                        const colorSet = isAll
                            ? { bg: "var(--fg-color)", text: "var(--text-color)" }
                            : SCOPE_COLORS[(parseInt(scope) - 1) % SCOPE_COLORS.length];
                        const isActive = currentScope === scope;
                        return `
                            <div class="scope-chip ${isActive ? "active" : ""}" 
                                 data-scope="${scope}"
                                 style="background: ${colorSet.bg}; 
                                        color: ${colorSet.text};
                                        border: 2px solid ${isActive ? colorSet.text : "transparent"};
                                        box-shadow: ${isActive ? `0 2px 6px ${colorSet.bg}` : "none"};
                                        transform: ${isActive ? "translateY(-2px)" : "none"}">
                                ${isAll ? "All Scopes" : `Scope ${scope}`}
                            </div>
                        `;
                    }).join("")}
                </div>
                ${currentScope !== "all" ? `
                    <button class="btn btn-primary btn-sm add-item-btn">
                        <i class="fa fa-plus"></i> Add Item
                    </button>
                ` : ''}
            </div>
        `;
        dialog.fields_dict.scope_chips_html.$wrapper.html(chipsHTML);
    
        // Add click handler for Add Item button
        dialog.$wrapper.find('.add-item-btn').on('click', () => {
            showAddItemDialog(frm, currentScope);
        });
    }
    
    // Add Item Dialog
    function showAddItemDialog(frm, scopeNumber) {
        const scope = frm.doc.scopes.find(s => s.scope_number === scopeNumber);
        if (!scope) return;
    
        const isOpeningsOrSkylight = scope.type === "Openings" || scope.type === "Skylights";
        
        let fields = [
            {
                fieldname: 'item',
                fieldtype: 'Data',
                label: 'Item',
                reqd: 1
            },
            {
                fieldname: 'description',
                fieldtype: 'Data',
                label: 'Description'
            },
            {
                fieldname: 'qty',
                fieldtype: 'Int',
                label: 'Quantity',
                reqd: 1,
                default: 1,
                min: 1
            }
        ];
    
        if (isOpeningsOrSkylight) {
            fields = [
                ...fields,
                {
                    fieldname: 'dimensions_section',
                    fieldtype: 'Section Break',
                    label: 'Dimensions'
                },
                {
                    fieldname: 'width',
                    fieldtype: 'Float',
                    label: 'Width (cm)',
                    reqd: 1,
                    min: 0
                },
                {
                    fieldname: 'height',
                    fieldtype: 'Float',
                    label: 'Height (cm)',
                    reqd: 1,
                    min: 0
                },
                {
                    fieldname: 'glass_section',
                    fieldtype: 'Section Break',
                    label: 'Glass Details'
                },
                {
                    fieldname: 'glass_unit',
                    fieldtype: 'Float',
                    label: 'Glass Unit',
                    default: scope.glass_sqm_price,
                    reqd: 1
                },
                {
                    fieldname: 'aluminum_section',
                    fieldtype: 'Section Break',
                    label: 'Aluminum Details'
                },
                {
                    fieldname: 'curtain_wall',
                    fieldtype: 'Float',
                    label: 'Curtain Wall',
                    reqd: 1
                },
                {
                    fieldname: 'col_break1',
                    fieldtype: 'Column Break'
                },
                {
                    fieldname: 'insertion_1',
                    fieldtype: 'Float',
                    label: 'Insertion 1'
                },
                {
                    fieldname: 'insertion_2',
                    fieldtype: 'Float',
                    label: 'Insertion 2'
                },
                {
                    fieldname: 'col_break2',
                    fieldtype: 'Column Break'
                },
                {
                    fieldname: 'insertion_3',
                    fieldtype: 'Float',
                    label: 'Insertion 3'
                },
                {
                    fieldname: 'insertion_4',
                    fieldtype: 'Float',
                    label: 'Insertion 4'
                }
            ];
        } 
    
        // Add profit percentage field
        fields.push(
            {
                fieldname: 'profit_section',
                fieldtype: 'Section Break',
                label: 'Profit Details'
            },
            {
                fieldname: 'profit_percentage',
                fieldtype: 'Percent',
                label: 'Profit Percentage',
                default: scope.profit,
                reqd: 1
            }
        );
    
        const addItemDialog = new frappe.ui.Dialog({
            title: `Add Item to Scope ${scope.scope_number}`,
            fields: fields,
            primary_action_label: 'Add Item',
            primary_action(values) {
                // Convert numeric fields to numbers
                const numericFields = ['width', 'height', 'glass_unit', 'curtain_wall', 
                    'insertion_1', 'insertion_2', 'insertion_3', 'insertion_4', 'qty'];
                
                const processedValues = { ...values };
                numericFields.forEach(field => {
                    if (field in processedValues) {
                        processedValues[field] = flt(processedValues[field]);
                    }
                });
                
                frappe.call({
                    method: "rua_company.rua_company.doctype.project.project.add_item",
                    args: {
                        project: frm.doc.name,
                        scope_number: scope.scope_number,
                        item_data: processedValues
                    },
                    freeze: true,
                    freeze_message: __("Adding item..."),
                    callback: function(r) {
                        if (!r.exc) {
                            addItemDialog.hide();
                            frm.reload_doc();
                            frappe.show_alert({
                                message: __("Item added successfully"),
                                indicator: "green"
                            });
                        }
                    }
                });
            }
        });
    
        addItemDialog.show();
    }

  function renderItemsTable(items) {
    const headers = [
      { label: "Item Details", cols: ["Item", "Description"], color: "blue" },
      { label: "Dimensions", cols: ["Width", "Height"], color: "purple" },
      { label: "Glass", cols: ["Unit", "Price", "Total"], color: "green" },
      { label: "Aluminum", cols: ["Unit", "Price", "Total"], color: "orange" },
      { label: "Total", cols: ["Overall Price"], color: "red" },
    ];

    // Group items by scope
    const groupedItems = {};
    items.forEach((item) => {
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
                            ${headers
                              .map(
                                (group) => `
                                <th colspan="${group.cols.length}" class="text-center"
                                    style="background: var(--bg-${group.color}); color: var(--text-on-${group.color});">
                                    ${group.label}
                                </th>
                            `
                              )
                              .join("")}
                        </tr>
                        <tr>
                            ${headers
                              .map((group) =>
                                group.cols
                                  .map(
                                    (col) => `
                                    <th style="background: var(--subtle-accent);">
                                        ${col}
                                    </th>
                                `
                                  )
                                  .join("")
                              )
                              .join("")}
                        </tr>
                    </thead>
                    <tbody>
                        ${Object.entries(groupedItems)
                          .map(([scopeNumber, scopeItems]) => {
                            const scope = frm.doc.scopes.find(
                              (s) => s.scope_number === scopeNumber
                            );
                            const colorSet =
                              SCOPE_COLORS[
                                (parseInt(scopeNumber) - 1) %
                                  SCOPE_COLORS.length
                              ];
                            return `
                                <tr class="scope-header">
                                    <td colspan="${headers.reduce(
                                      (sum, h) => sum + h.cols.length,
                                      0
                                    )}"
                                        style="background: ${
                                          colorSet.bg
                                        }; color: ${
                              colorSet.text
                            }; font-weight: 600;">
                                        Scope ${scopeNumber}
                                    </td>
                                </tr>
                                ${scopeItems
                                  .map(
                                    (item) => `
                                    <tr class="item-row" style="background: ${
                                      colorSet.bg
                                    }10;">
                                        <td class="item-cell">${
                                          item.item || ""
                                        }</td>
                                        <td class="desc-cell">${
                                          item.description || ""
                                        }</td>
                                        <td class="text-center">${
                                          item.width || 0
                                        }cm</td>
                                        <td class="text-center">${
                                          item.height || 0
                                        }cm</td>
                                        <td>${formatCurrency(
                                          item.glass_unit
                                        )}</td>
                                        <td class="text-right">${formatCurrency(
                                          item.glass_price
                                        )}</td>
                                        <td class="text-right">${formatCurrency(
                                          item.total_glass
                                        )}</td>
                                        <td>${formatCurrency(
                                          item.aluminum_unit
                                        )}</td>
                                        <td class="text-right">${formatCurrency(
                                          item.aluminum_price
                                        )}</td>
                                        <td class="text-right">${formatCurrency(
                                          item.total_aluminum
                                        )}</td>
                                        <td class="text-right total-cell">${formatCurrency(
                                          item.overall_price
                                        )}</td>
                                    </tr>
                                    <tr class="formula-row" style="background: ${
                                      colorSet.bg
                                    }05;">
                                        <td colspan="2"></td>
                                        <td colspan="2" class="formula-cell glass-formula area-formula">
                                        Area: ${item.area || 0}sqm
                                        </td>
                                        <td colspan="6" class="formula-cell glass-formula actual-formula">
                                            [Actual Unit (Inc. Labour): ${formatCurrency(
                                              item.actual_unit
                                            )}] + [Profit: ${formatCurrency(
                                      item.total_profit
                                    )}] = [Actual Unit Rate: ${formatCurrency(
                                      item.actual_unit_rate
                                    )}] × [QTY: ${item.qty}]
                                        </td>
                                        <td></td>
                                    </tr>
                                `
                                  )
                                  .join("")}
                            `;
                          })
                          .join("")}
                    </tbody>
                </table>
            </div>
        `;

    dialog.fields_dict.items_html.$wrapper.html(tableHTML);
  }

  function filterItems() {
    const searchText = (dialog.get_value("search") || "").toLowerCase();
    let filteredItems = frm.doc.items;

    if (currentScope !== "all") {
      filteredItems = filteredItems.filter(
        (item) => item.scope_number === currentScope
      );
    }

    if (searchText) {
      filteredItems = filteredItems.filter(
        (item) =>
          (item.item && item.item.toLowerCase().includes(searchText)) ||
          (item.description &&
            item.description.toLowerCase().includes(searchText))
      );
    }

    renderItemsTable(filteredItems);
  }

  // Add event listeners
  dialog.fields_dict.search.df.onchange = filterItems;

  // Add click handler for scope chips
  dialog.$wrapper.on("click", ".scope-chip", function () {
    currentScope = $(this).data("scope");
    dialog.$wrapper.find(".scope-chip").removeClass("active");
    $(this).addClass("active");
    renderScopeChips();
    filterItems();
  });

  // Initialize
  renderScopeChips();
  filterItems();

  dialog.show();
};

// Contract Value Dialog
rua_company.project_dialogs.showContractValueDialog = function (frm) {
  new frappe.ui.Dialog({
    title: __("Edit Contract Value"),
    fields: [
      {
        label: __("Contract Value"),
        fieldname: "contract_value",
        fieldtype: "Currency",
        default: frm.doc.contract_value || 0,
      },
    ],
    primary_action_label: __("Update"),
    primary_action(values) {
      if (values.contract_value !== undefined) {
        frm.set_value("contract_value", values.contract_value);
        frm.save();
      }
      this.hide();
    },
  }).show();
};

// Helper Functions
function setupItemAutocomplete(dialog) {
  dialog.$wrapper.find(".item-autocomplete").on("input", function () {
    const query = $(this).val();
    const $suggestions = dialog.$wrapper.find(".item-suggestions");

    if (query.length < 2) {
      $suggestions.hide();
      return;
    }

    frappe.call({
      method: "rua_company.rua_company.doctype.project.project.get_items",
      args: { query: query },
      callback: function (response) {
        if (response.message) {
          const items = response.message;
          let html = "";
          items.forEach((item) => {
            html += `
                            <div class="item-suggestion" data-item="${
                              item.name
                            }">
                                <div class="item-name">${item.name}</div>
                                <div class="item-description">${
                                  item.description || ""
                                }</div>
                            </div>
                        `;
          });
          $suggestions.html(html).show();
        }
      },
    });
  });

  // Handle item selection
  dialog.$wrapper
    .find(".item-suggestions")
    .on("click", ".item-suggestion", function () {
      const selectedItem = $(this).data("item");
      dialog.$wrapper.find(".item-autocomplete").val(selectedItem);
      dialog.set_value("selected_item", selectedItem);
      dialog.$wrapper.find(".item-suggestions").hide();
    });

  // Handle keyboard navigation
  dialog.$wrapper.find(".item-autocomplete").on("keydown", function (e) {
    const $items = $suggestions.find(".item-suggestion");
    const $selected = $items.find(".selected");
    const itemsLength = $items.length;

    switch (e.which) {
      case 40: // Down arrow
        e.preventDefault();
        if (!$selected.length) {
          $items.first().addClass("selected");
        } else {
          $selected.removeClass("selected").next().addClass("selected");
        }
        break;
      case 38: // Up arrow
        e.preventDefault();
        if (!$selected.length) {
          $items.last().addClass("selected");
        } else {
          $selected.removeClass("selected").prev().addClass("selected");
        }
        break;
      case 13: // Enter
        e.preventDefault();
        if ($selected.length) {
          $selected.click();
        }
        break;
    }
  });

  $(document).on("mousedown", function (e) {
    // Using mousedown instead of click for better UX
    if (!$(e.target).closest(".item-autocomplete-wrapper").length) {
      $suggestions.hide();
    }
  });
}

function deleteScope(frm, scopeNumber) {
  const scope = frm.doc.scopes.find((s) => s.scope_number === scopeNumber);
  if (!scope) return;

  // Check if scope is in use
  const items_with_scope = frm.doc.items
    ? frm.doc.items.filter((item) => item.scope_number === scope.scope_number)
    : [];

  if (items_with_scope.length > 0) {
    frappe.msgprint(
      __("Cannot delete scope {0} as it is being used by {1} items", [
        scope.scope_number,
        items_with_scope.length,
      ])
    );
    return;
  }

  frappe.confirm(
    __("Are you sure you want to delete scope {0}?", [scope.scope_number]),
    () => {
      frm.doc.scopes = frm.doc.scopes.filter(
        (s) => s.scope_number !== scope.scope_number
      );
      frm.refresh_field("scopes");
      frm.dirty();
      frm.save();
      rua_company.project_dashboard.render(frm);
      frappe.show_alert({
        message: __("Scope {0} removed", [scope.scope_number]),
        indicator: "green",
      });
    }
  );
}

// Helper function to generate scope dialog styles
function generateScopeDialogStyles() {
  return `
        <style>
            .scope-details-container {
                padding: 1rem;
            }
            
            .section-container {
                margin-bottom: 1rem;
                background: var(--card-bg);
                border-radius: 8px;
                padding: 1rem;
            }
            
            .section-title {
                font-size: 1rem;
                font-weight: 600;
                color: var(--heading-color);
                margin-bottom: 0.75rem;
                display: flex;
                align-items: center;
                gap: 0.5rem;
            }
            
            .section-title i {
                color: var(--primary-color);
                font-size: 0.875rem;
            }
            
            .parameters-grid {
                display: grid;
                grid-template-columns: repeat(2, 1fr);
                gap: 0.75rem;
            }
            
            .scope-detail-card {
                background: var(--fg-color);
                border: 1px solid var(--border-color);
                border-radius: 6px;
                padding: 0.75rem;
            }
            
            .detail-label {
                font-size: 0.75rem;
                color: var(--text-muted);
                margin-bottom: 0.25rem;
                text-transform: uppercase;
                letter-spacing: 0.5px;
            }
            
            .detail-value {
                font-size: 0.875rem;
                color: var(--text-color);
            }
            
            .detail-value.highlighted {
                color: var(--primary-color);
                font-weight: 500;
            }

            /* Flow Chart Styles */
            .financial-flow-chart {
                padding: 1.5rem 1rem;
                position: relative;
            }

            .flow-row {
                display: flex;
                justify-content: center;
                align-items: center;
                margin-bottom: 1.5rem;
            }

            .flow-card {
                background: var(--fg-color);
                border: 1px solid var(--border-color);
                border-radius: 6px;
                padding: 0.75rem;
                min-width: 180px;
                text-align: center;
                position: relative;
                z-index: 2;
            }

            .flow-card.main {
                border-color: var(--primary-color);
            }

            .flow-card.main .flow-label {
                color: var(--text-muted);
            }

            .flow-card.main .flow-value {
                color: var(--primary-color);
            }

            .flow-card.highlighted {
                border-color: var(--primary-color);
            }

            .flow-card.highlighted .flow-value {
                color: var(--primary-color);
            }

            .flow-card.small {
                min-width: 140px;
                padding: 0.5rem;
            }

            .flow-label {
                font-size: 0.75rem;
                color: var(--text-muted);
                margin-bottom: 0.25rem;
                text-transform: uppercase;
                letter-spacing: 0.5px;
            }

            .flow-value {
                font-size: 0.875rem;
                font-weight: 500;
                color: var(--text-color);
            }

            .flow-value.positive {
                color: var(--green-600);
            }

            .flow-value.negative {
                color: var(--red-600);
            }

            .flow-split {
                display: flex;
                justify-content: space-around;
                margin-top: 1.5rem;
                gap: 1.5rem;
            }

            .flow-column {
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 0.75rem;
                position: relative;
                flex: 1;
                max-width: 45%;
            }

            .flow-connector {
                position: relative;
                height: 24px;
                width: 100%;
            }

            .connector-line {
                position: absolute;
                background: var(--border-color);
                height: 1px;
                top: 50%;
                transform-origin: center center;
            }

            .connector-line.left {
                left: 25%;
                width: 29%;
                transform: translateX(-50%) rotate(-45deg);
            }

            .connector-line.right {
                right: 25%;
                width: 29%;
                transform: translateX(50%) rotate(45deg);
            }

            /* Dialog Button Styles */
            .edit-scope-btn {
                background: transparent;
                color: var(--primary-color);
                border: 1px solid var(--primary-color);
                transition: all 0.2s ease;
            }

            .edit-scope-btn:hover {
                background: var(--primary-color);
                color: var(--white);
            }

            /* Responsive Styles */
            @media (max-width: 768px) {
                .parameters-grid {
                    grid-template-columns: 1fr;
                }

                .flow-split {
                    flex-direction: column;
                    align-items: center;
                }

                .flow-column {
                    max-width: 100%;
                    margin-bottom: 1.5rem;
                }

                .flow-card {
                    min-width: 160px;
                }

                .connector-line {
                    display: none;
                }

                .section-container {
                    margin-bottom: 0.75rem;
                    padding: 0.75rem;
                }
            }
        </style>
    `;
}
