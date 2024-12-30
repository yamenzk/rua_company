// Copyright (c) 2024, Yamen Zakhour and contributors
// For license information, please see license.txt

frappe.ui.form.on("Bill", {
  refresh: function (frm) {
    if (frm.doc.docstatus === 1 && (frm.doc.bill_type === "Tax Invoice" || frm.doc.bill_type === "Purchase Order")) {
      frm.add_custom_button(__("Generate Payment"), function () {
        frappe.new_doc("Payment Voucher", {
          payment_amount: parseFloat(frm.doc.grand_total),
          party: frm.doc.party,
          date: frappe.datetime.get_today(),
          project: frm.doc.project,
          bill: frm.doc.name,
          type: frm.doc.bill_type === "Purchase Order" ? "Pay" : "Receive"
        });
      });
    }

    if (frm.doc.docstatus !== 1) {
      frm
        .add_custom_button(__("Add Items"), function () {
          // Get list of already added scope items
          const added_items = new Set(
            frm.doc.scope_items
              ? frm.doc.scope_items.map((row) => row.scope_item)
              : []
          );

          // Create a custom dialog
          const d = new frappe.ui.Dialog({
            title: __("Select Scope Items"),
            fields: [
              {
                label: __("Scope Items"),
                fieldname: "scope_items_html",
                fieldtype: "HTML",
              },
            ],
            primary_action_label: __("Add Selected Items"),
            primary_action(values) {
              const selected = Object.keys(d.selected_items || {}).filter(
                (k) => d.selected_items[k]
              );
              if (selected.length > 0) {
                frappe.call({
                  method:
                    "rua_company.rua_company.doctype.bill.bill.get_scope_item_data",
                  args: {
                    scope_item: selected[0],
                  },
                  callback: function (r) {
                    if (r.message) {
                      let row = frm.add_child("scope_items");
                      row.scope_item = r.message.scope_item;
                      row.data = JSON.stringify(r.message.data);
                      frm.refresh_field("scope_items");
                      frm.save();
                      d.hide();
                    }
                  },
                });
              }
            },
          });

          d.selected_items = {};

          // Function to render the list
          function render_list(items) {
            const html = items
              .map((item) => {
                const is_added = added_items.has(item.name);
                const checkbox = is_added
                  ? ""
                  : `
						<input type="checkbox" 
							data-item="${item.name}"
							class="scope-item-cb" 
							${d.selected_items[item.name] ? "checked" : ""}
						>
					`;
                const remove_btn = is_added
                  ? `
						<button class="btn btn-xs btn-danger ml-2 remove-item" data-item="${item.name}">
							${__("Remove")}
						</button>
					`
                  : "";

                return `
						<div class="list-item ${is_added ? "text-muted" : ""}" data-item="${item.name}">
							<div class="list-item__content">
								<div class="list-item__content ellipsis">
									${checkbox}
									${item.name}
									${is_added ? '<span class="text-muted ml-2">(' + __("Added") + ")</span>" : ""}
									${remove_btn}
								</div>
							</div>
						</div>
					`;
              })
              .join("");

            const wrapper = d.fields_dict.scope_items_html.$wrapper;
            wrapper.html(`
					<div class="scope-items-list">
						${html}
					</div>
				`);

            // Bind events
            wrapper.find(".scope-item-cb").on("change", function () {
              const item = $(this).attr("data-item");
              d.selected_items[item] = this.checked;
            });

            wrapper.find(".remove-item").on("click", function () {
              const item_to_remove = $(this).attr("data-item");
              frm.doc.scope_items = frm.doc.scope_items.filter(
                (row) => row.scope_item !== item_to_remove
              );
              frm.refresh_field("scope_items");
              frm.dirty();
              frm.save();
              added_items.delete(item_to_remove);
              // Refresh the list
              fetch_and_render_items();
            });
          }

          // Function to fetch and render items
          function fetch_and_render_items() {
            frappe.db
              .get_list("Scope Items", {
                fields: ["name", "status", "modified"],
                filters: {
                  project: frm.doc.project,
                  status: "Assigned",
                  docstatus: ["!=", 2],
                },
                order_by: "modified desc",
              })
              .then((items) => {
                console.log("Fetched items:", items);
                console.log("Added items:", Array.from(added_items));
                render_list(items);
              });
          }

          // Initial render
          fetch_and_render_items();

          d.show();
        })
        .addClass("btn-primary");
    }

    // Render bill data
    render_bill_data(frm);
  },
});

function render_bill_data(frm) {
  if (!frm.doc.scope_items || !frm.doc.scope_items.length) return;

  // Parse scope items data
  const scope_items_data = {};
  frm.doc.scope_items.forEach((item) => {
    if (!item.scope_item || !item.data) return;

    try {
      const data = JSON.parse(item.data);
      const scope_item_id = Object.keys(data)[0];
      scope_items_data[scope_item_id] = {
        name: item.scope_item,
        ...data[scope_item_id],
      };
    } catch (e) {
      console.error("Error parsing scope item data:", e);
    }
  });

  // Parse bill totals
  let bill_totals = {};
  try {
    bill_totals = JSON.parse(frm.doc.data || "{}");
  } catch (e) {
    console.error("Error parsing bill totals:", e);
  }

  // Get all scope item IDs
  const scope_item_ids = Object.keys(scope_items_data);

  // Create chips HTML (with All chip first)
  const chips_html = `
		${
      scope_item_ids.length > 1
        ? `
		<div class="chip scope-type-chip active" data-type="all">
			<div class="chip-text">${__("All")}</div>
		</div>
		`
        : ""
    }
		${scope_item_ids
      .map(
        (id) => `
			<div class="chip scope-type-chip${
        scope_item_ids.length === 1 ? " active" : ""
      }" data-type="${id}">
				<div class="chip-text">${scope_items_data[id].name}</div>
			</div>
		`
      )
      .join("")}
	`;

  // Function to create table for a specific set of items
  function create_items_table(items_data) {
    if (!Object.keys(items_data).length) return "";

    // Get all unique fields
    const fields = new Set();
    Object.values(items_data).forEach((item) => {
      Object.keys(item).forEach((field) => {
        if (!field.endsWith('_unit')) {
          fields.add(field);
        }
      });
    });

    // Unit color mapping using Frappe design system
    const unitColorMap = {
      'SQM': 'blue',     // Square meters - blue
      'LM': 'green',     // Linear meters - green
      'm': 'purple',     // Meters - purple
      'cm': 'red',       // Centimeters - red
      'mm': 'yellow',    // Millimeters - yellow
      'g': 'orange',     // Grams - orange
      'kg': 'pink'       // Kilograms - pink
    };

    const header_html = Array.from(fields)
      .map((field) => `<th>${frappe.model.unscrub(field)}</th>`)
      .join("");

    const rows_html = Object.entries(items_data)
      .map(
        ([id, item]) => `
			<tr>
				${Array.from(fields)
          .map((field) => {
            const unit = item[`${field}_unit`];
            const colorClass = unit ? unitColorMap[unit] || 'gray' : '';
            return `<td>${item[field] || ""}${unit ? ` <span class="unit-chip ${colorClass}">${unit}</span>` : ''}</td>`;
          })
          .join("")}
			</tr>
		`
      )
      .join("");

    return `
			<div class="items-section mb-4">
				<h6 class="mb-3">${__("Items")}</h6>
				<div class="table-responsive">
					<table class="table table-bordered table-sm">
						<thead>
							<tr>${header_html}</tr>
						</thead>
						<tbody>
							${rows_html}
						</tbody>
					</table>
				</div>
			</div>
		`;
  }

  // Function to create constants section
  function create_constants_section(constants_data, title) {
    if (!Object.keys(constants_data).length) return "";

    return `
			<div class="constants-section mb-4">
				<h6 class="mb-3">${__("Constants")}${title ? ` - ${title}` : ""}</h6>
				<div class="card">
					<div class="card-body">
						<div class="row">
							${Object.entries(constants_data)
                .map(
                  ([key, value]) => `
								<div class="col-sm-4">
									<div class="constant-item">
										<span class="constant-label">${frappe.model.unscrub(key)}:</span>
										<span class="constant-value">${value}</span>
									</div>
								</div>
							`
                )
                .join("")}
						</div>
					</div>
				</div>
			</div>
		`;
  }

  // Function to create totals section
  function create_totals_section(totals_data, title, scope_type) {
    if (!Object.keys(totals_data).length) return "";

    let totals_rows = [];
    if (scope_type) {
      // For bill totals with scope type
      Object.entries(totals_data).forEach(([type, type_totals]) => {
        Object.entries(type_totals).forEach(([field, value]) => {
          totals_rows.push(`
						<tr>
							<td>
								${frappe.model.unscrub(field)}
								<span class="scope-type-tag">${type}</span>
							</td>
							<td class="text-right">${value}</td>
						</tr>
					`);
        });
      });
    } else {
      // For regular totals
      totals_rows = Object.entries(totals_data).map(
        ([field, value]) => `
				<tr>
					<td>${frappe.model.unscrub(field)}</td>
					<td class="text-right">${value}</td>
				</tr>
			`
      );
    }

    return `
			<div class="totals-section mb-4">
				<h6 class="mb-3">${__("Totals")}${title ? ` - ${title}` : ""}</h6>
				<div class="table-responsive">
					<table class="table table-bordered table-sm">
						<thead>
							<tr>
								<th>${__("Field")}</th>
								<th class="text-right">${__("Value")}</th>
							</tr>
						</thead>
						<tbody>
							${totals_rows.join("")}
						</tbody>
					</table>
				</div>
			</div>
		`;
  }

  // Create tables for each scope item and the All view
  const tables_html = `
		<div class="scope-type-table${
      scope_item_ids.length > 1 ? " active" : ""
    }" data-type="all">
			<h5 class="mb-4">${__("All Items")}</h5>
			${Object.entries(scope_items_data)
        .map(
          ([id, data]) => `
				<div class="scope-item-section mb-4">
					<h6 class="mb-3">${data.name}</h6>
					${create_items_table(data.items)}
					${create_constants_section(data.constants)}
					${create_totals_section(data.totals)}
				</div>
			`
        )
        .join("")}
			<div class="d-flex justify-content-end">
				${create_totals_section(bill_totals, "Bill Totals", true)}
			</div>
		</div>
		${Object.entries(scope_items_data)
      .map(
        ([id, data]) => `
			<div class="scope-type-table${
        scope_item_ids.length === 1 ? " active" : ""
      }" data-type="${id}">
				${create_items_table(data.items)}
				${create_constants_section(data.constants)}
				<div class="d-flex justify-content-end">
					${create_totals_section(data.totals)}
				</div>
			</div>
		`
      )
      .join("")}
	`;

  // Render the complete HTML
  const html = `
		<div class="bill-data">
			<style>
				.bill-data .chip {
					display: inline-flex;
					align-items: center;
					padding: 4px 12px;
					margin: 4px;
					background: var(--control-bg);
					border-radius: 16px;
					cursor: pointer;
					transition: background-color 0.2s;
				}
				.bill-data .chip:hover {
					background: var(--control-bg-on-hover);
				}
				.bill-data .chip.active {
					background: var(--primary);
					color: white;
				}
				.bill-data .scope-type-table {
					display: none;
					margin-top: 1rem;
				}
				.bill-data .scope-type-table.active {
					display: block;
				}
				.bill-data .constant-item {
					margin: 0.5rem 0;
				}
				.bill-data .constant-label {
					font-weight: 500;
					margin-right: 0.5rem;
				}
				.bill-data .card {
					background: var(--control-bg);
					border: none;
				}
				.bill-data .scope-item-section {
					padding: 1rem;
					background: var(--control-bg);
					border-radius: var(--border-radius);
				}
				.bill-data .totals-section table {
					max-width: 400px;
					min-width: 300px;
				}
				.bill-data .scope-type-tag {
					display: inline-block;
					padding: 2px 8px;
					margin-left: 8px;
					background: var(--primary-light);
					color: var(--text-color);
					border-radius: 12px;
					font-size: 0.8em;
				}
				.bill-data .unit-chip {
					display: inline-block;
					padding: 2px 8px;
					margin-left: 4px;
					border-radius: 12px;
					font-size: 0.75em;
					font-weight: 500;
				}
				.bill-data .unit-chip.blue {
					background-color: var(--bg-blue);
					color: var(--text-on-blue);
				}
				.bill-data .unit-chip.green {
					background-color: var(--bg-green);
					color: var(--text-on-green);
				}
				.bill-data .unit-chip.purple {
					background-color: var(--bg-purple);
					color: var(--text-on-purple);
				}
				.bill-data .unit-chip.red {
					background-color: var(--bg-red);
					color: var(--text-on-red);
				}
				.bill-data .unit-chip.yellow {
					background-color: var(--bg-yellow);
					color: var(--text-on-yellow);
				}
				.bill-data .unit-chip.orange {
					background-color: var(--bg-orange);
					color: var(--text-on-orange);
				}
				.bill-data .unit-chip.pink {
					background-color: var(--bg-pink);
					color: var(--text-on-pink);
				}
				.bill-data .unit-chip.gray {
					background-color: var(--bg-gray);
					color: var(--text-on-gray);
				}
			</style>
			<div class="scope-type-chips mb-4">
				${chips_html}
			</div>
			<div class="scope-type-tables">
				${tables_html}
			</div>
		</div>
	`;

  $(frm.fields_dict.bill_html.wrapper).html(html);

  // Handle chip clicks
  $(frm.fields_dict.bill_html.wrapper)
    .find(".scope-type-chip")
    .on("click", function () {
      const type = $(this).data("type");
      const $wrapper = $(frm.fields_dict.bill_html.wrapper);

      // Update chip active state
      $wrapper.find(".scope-type-chip").removeClass("active");
      $(this).addClass("active");

      // Show selected table
      $wrapper.find(".scope-type-table").removeClass("active");
      $wrapper
        .find(`.scope-type-table[data-type="${type}"]`)
        .addClass("active");
    });
}

// Refresh the bill data when document is updated
frappe.ui.form.on("Bill", "after_save", function (frm) {
  render_bill_data(frm);
});
