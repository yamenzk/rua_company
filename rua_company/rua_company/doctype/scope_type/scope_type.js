// Copyright (c) 2024, Yamen Zakhour and contributors
// For license information, please see license.txt

frappe.ui.form.on('Scope Type', {
    refresh: function(frm) {
        frm.add_custom_button(__('Formula Documentation'), function() {
            show_formula_documentation();
        });
    }
});

// Helper function to convert label to field name
function labelToFieldName(label) {
    if (!label) return '';
    return label
        .toLowerCase()
        // Replace special characters and spaces with underscore
        .replace(/[^a-z0-9]+/g, '_')
        // Remove leading/trailing underscores
        .replace(/^_+|_+$/g, '')
        // Replace multiple underscores with single
        .replace(/_+/g, '_');
}

// Handle Scope Fields child table
frappe.ui.form.on('Scope Field Configuration', {
    label: function(frm, cdt, cdn) {
        const row = locals[cdt][cdn];
        if (row.label && !row.field_name) {
            frappe.model.set_value(cdt, cdn, 'field_name', labelToFieldName(row.label));
        }
    },
    
    auto_calculate: function(frm, cdt, cdn) {
        const row = locals[cdt][cdn];
        if (row.auto_calculate) {
            frappe.model.set_value(cdt, cdn, 'read_only', 1);
        }
    }
});

// Handle Calculation Formulas child table
frappe.ui.form.on('Scope Calculation Formula', {
    label: function(frm, cdt, cdn) {
        const row = locals[cdt][cdn];
        if (row.label && !row.total_name) {
            frappe.model.set_value(cdt, cdn, 'total_name', labelToFieldName(row.label));
        }
    }
});

// Handle Constants child table
frappe.ui.form.on('Scope Constant', {
    label: function(frm, cdt, cdn) {
        const row = locals[cdt][cdn];
        if (row.label && !row.constant_name) {
            frappe.model.set_value(cdt, cdn, 'constant_name', labelToFieldName(row.label));
        }
    }
});

function show_formula_documentation() {
    const sections = {
        field_level: `
            <div class="section-content">
                <div class="main-content">
                    <p>Field level formulas allow you to perform calculations using values from:</p>
                    <ul>
                        <li><code>variables['field_name']</code> - Other fields within the same item</li>
                        <li><code>doc_totals['total_name']</code> - Scope-level calculated totals. You can also include predefined constants here</li>
                        <li><code>constants['constant_name']</code> - User defined constants</li>
                    </ul>
                    <p>These formulas support all standard JavaScript mathematical operations and the <a style="text-decoration: underline;" href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math" target="_blank">Math object</a>. You can also use Math object functions.</p>
                </div>
                
                <div class="expandable-examples">
                    <button class="btn btn-xs btn-default expand-btn">
                        <span class="expand-text">Show Examples</span>
                        <span class="toggle-icon">▼</span>
                    </button>
                    <div class="expanded-content">
                        <h5>Basic Area Calculation</h5>
                        <pre>variables['length'] * variables['width']</pre>
                        
                        <h5>Circular Area with Constants</h5>
                        <pre>Math.pow(variables['radius'], 2) * Math.PI</pre>
                        
                        <h5>Cumulative Calculations</h5>
                        <pre>doc_totals['total_area'] + variables['area']</pre>
                    </div>
                </div>
            </div>
        `,

        scope_level: `
            <div class="section-content">
                <div class="main-content">
                    <p>Scope level formulas calculate totals across all items using these aggregate functions:</p>
                    <ul>
                        <li><code>sum('field_name')</code> - Sum all values</li>
                        <li><code>avg('field_name')</code> - Calculate average</li>
                        <li><code>min('field_name')</code> - Find minimum value</li>
                        <li><code>max('field_name')</code> - Find maximum value</li>
                        <li><code>count('field_name')</code> - Count items</li>
                        <li><code>distinct_count('field_name')</code> - Count unique values</li>
                    </ul>
                    <p>These formulas can reference other calculated totals using doc_totals.</p>
                </div>

                <div class="expandable-examples">
                    <button class="btn btn-xs btn-default expand-btn">
                        <span class="expand-text">Show Examples</span>
                        <span class="toggle-icon">▼</span>
                    </button>
                    <div class="expanded-content">
                        <h5>Progressive Calculations</h5>
                        <pre>
// First calculate total amount
sum('amount')

// Then calculate tax
doc_totals['total_amount'] * 0.2
                        </pre>
                        
                        <h5>Setting Constants</h5>
                        <pre>
// Define VAT rate as a constant
5

// Use the constant in calculations
doc_totals['total_amount'] * (doc_totals['vat_rate'] / 100)
                        </pre>
                        
                        <h5>Comparative Analysis</h5>
                        <pre>
// Calculate price spread
doc_totals['max_price'] - doc_totals['min_price']
                        </pre>
                    </div>
                </div>
            </div>
        `,

        filtered_aggregates: `
            <div class="section-content">
                <div class="main-content">
                    <p>Filtered aggregates allow you to calculate totals for specific subsets of items using the items array. Each item contains all its fields accessible via dot notation (item.field_name).</p>
                    <p>Key features:</p>
                    <ul>
                        <li>Use filter() to select specific items</li>
                        <li>Use reduce() for custom aggregations</li>
                        <li>Access any field value using dot notation</li>
                        <li>Chain multiple conditions using && (AND) or || (OR)</li>
                    </ul>
                </div>

                <div class="expandable-examples">
                    <button class="btn btn-xs btn-default expand-btn">
                        <span class="expand-text">Show Examples</span>
                        <span class="toggle-icon">▼</span>
                    </button>
                    <div class="expanded-content">
                        <h5>Type-Based Calculations</h5>
                        <pre>
items.filter(item => item.product_type === 'window')
     .reduce((sum, item) => sum + (item.area || 0), 0)
                        </pre>

                        <h5>Multi-Condition Filtering</h5>
                        <pre>
items.filter(item => 
    item.glass_type === 'tempered' && 
    item.area > 2.5
).reduce((sum, item) => sum + (item.area || 0), 0)
                        </pre>
                    </div>
                </div>
            </div>
        `,

        custom_functions: `
            <div class="section-content">
                <div class="main-content">
                    <p>Custom functions provide reusable calculations that can be shared across different scopes. They are accessed using the custom object and always return a numeric value.</p>
                    <p>Key characteristics:</p>
                    <ul>
                        <li>Parameters must be in the correct order</li>
                        <li>Can access both variables and doc_totals</li>
                        <li>Useful for standardizing complex calculations</li>
                        <li>Help maintain consistency across scopes</li>
                    </ul>
                </div>

                <div class="expandable-examples">
                    <button class="btn btn-xs btn-default expand-btn">
                        <span class="expand-text">Show Examples</span>
                        <span class="toggle-icon">▼</span>
                    </button>
                    <div class="expanded-content">
                        <h5>Volume-Based Pricing</h5>
                        <pre>
custom.calculate_price_with_discount(
    variables['area'],
    variables['unit_price'],
    doc_totals['total_area']  // For volume discount
)
                        </pre>

                        <h5>Complex Property Calculation</h5>
                        <pre>
custom.calculate_thermal_performance(
    variables['u_value'],
    variables['thickness'],
    variables['has_coating']
)
                        </pre>
                    </div>
                </div>
            </div>
        `,

        conditional_values: `
            <div class="section-content">
                <div class="main-content">
                    <p>Conditional formulas allow you to calculate values based on specific conditions or scenarios. They can use:</p>
                    <ul>
                        <li>Ternary operators for simple conditions</li>
                        <li>Multiple nested conditions</li>
                        <li>Combinations of field values and totals</li>
                        <li>Standard comparison operators (===, !==, >, <, >=, <=)</li>
                    </ul>
                </div>

                <div class="expandable-examples">
                    <button class="btn btn-xs btn-default expand-btn">
                        <span class="expand-text">Show Examples</span>
                        <span class="toggle-icon">▼</span>
                    </button>
                    <div class="expanded-content">
                        <h5>Basic Price Adjustments</h5>
                        <pre>
// Apply thermal break surcharge
variables['base_price'] * (
    variables['has_thermal_break'] ? 1.25 : 1
)
                        </pre>

                        <h5>Multiple Condition Pricing</h5>
                        <pre>
// Glass treatment pricing
let price_factor = 
    variables['treatment'] === 'tempered' ? 1.8 :
    variables['treatment'] === 'laminated' ? 1.6 :
    variables['treatment'] === 'coated' ? 1.4 : 1
                        </pre>

                        <h5>Complex Business Logic</h5>
                        <pre>
// Calculate final price with all factors
variables['base_price'] * (
    // Size factors
    (variables['area'] > 4.0 ? 1.25 : 1) *
    // Treatment factors
    (variables['is_tempered'] ? 1.8 : 1) *
    // Project factors
    (doc_totals['is_export'] ? 1.15 : 1)
)
                        </pre>
                    </div>
                </div>
            </div>
        `
    };

    const d = new frappe.ui.Dialog({
        title: 'Formula Documentation',
        size: 'extra-large',
        fields: [{
            fieldname: 'html_content',
            fieldtype: 'HTML',
            options: `
                <style>
                    .section-container {
                        padding: 0 15px;
                    }
                    
                    .section-header {
                        display: flex;
                        align-items: center;
                        padding: 10px 15px;
                        background: var(--bg-gray);
                        border-radius: 6px;
                        margin: 10px 0;
                        cursor: pointer;
                    }
                    
                    .section-header h4 {
                        margin: 0;
                        flex-grow: 1;
                    }
                    
                    .section-toggle {
                        margin-left: 10px;
                    }
                    
                    .section-content {
                        display: none;
                        padding: 15px;
                        border: 1px solid var(--border-color);
                        border-radius: 6px;
                        margin-top: -5px;
                        margin-bottom: 10px;
                    }
                    
                    .section-content.show {
                        display: block;
                    }
                    
                    .expandable-examples {
                        margin-top: 15px;
                        border-top: 1px solid var(--border-color);
                        padding-top: 15px;
                    }
                    
                    .expand-btn {
                        display: flex;
                        align-items: center;
                        gap: 5px;
                    }
                    
                    .toggle-icon {
                        font-size: 8px;
                        transition: transform 0.2s;
                    }
                    
                    .expand-btn.active .toggle-icon {
                        transform: rotate(180deg);
                    }
                    
                    .expanded-content {
                        display: none;
                        margin-top: 15px;
                    }
                    
                    .expanded-content.show {
                        display: block;
                    }
                    
                    pre {
                        background: var(--bg-gray);
                        padding: 12px;
                        border-radius: 4px;
                        overflow-x: auto;
                        margin: 10px 0;
                    }
                    
                    code {
                        background: var(--bg-light-gray);
                        padding: 2px 4px;
                        border-radius: 3px;
                        color: var(--text-color);
                    }

                    ul {
                        padding-left: 20px;
                    }

                    li {
                        margin-bottom: 5px;
                    }
                </style>
                
                <div class="section-container">
                    <div class="section">
                        <div class="section-header">
                            <h4>Field Level Formulas</h4>
                            <span class="section-toggle">▼</span>
                        </div>
                        ${sections.field_level}
                    </div>
                    
                    <div class="section">
                        <div class="section-header">
                            <h4>Scope Level Formulas</h4>
                            <span class="section-toggle">▼</span>
                        </div>
                        ${sections.scope_level}
                    </div>
                    
                    <div class="section">
                        <div class="section-header">
                            <h4>Filtered Aggregates</h4>
                            <span class="section-toggle">▼</span>
                        </div>
                        ${sections.filtered_aggregates}
                    </div>
                    
                    <div class="section">
                        <div class="section-header">
                            <h4>Custom Functions</h4>
                            <span class="section-toggle">▼</span>
                        </div>
                        ${sections.custom_functions}
                    </div>
                    
                    <div class="section">
                        <div class="section-header">
                            <h4>Conditional Values</h4>
                            <span class="section-toggle">▼</span>
                        </div>
                        ${sections.conditional_values}
                    </div>
                </div>
            `
        }],
        primary_action_label: 'Close',
        primary_action(values) {
            d.hide();
        }
    });

    d.show();

    // Initialize collapsible sections and expandable examples
    setTimeout(() => {
        // Section toggles
        d.$wrapper.find('.section-header').on('click', function() {
            const section = $(this).closest('.section');
            const content = section.find('.section-content');
            const toggle = section.find('.section-toggle');
            
            content.toggleClass('show');
            toggle.text(content.hasClass('show') ? '▲' : '▼');
            
            // Open first section's examples if this is the first opening
            if (content.hasClass('show') && !content.data('initialized')) {
                content.data('initialized', true);
                content.find('.expand-btn').first().click();
            }
        });

        // Example toggles
        d.$wrapper.find('.expand-btn').on('click', function() {
            const btn = $(this);
            const content = btn.siblings('.expanded-content');
            const textSpan = btn.find('.expand-text');
            
            content.toggleClass('show');
            btn.toggleClass('active');
            textSpan.text(content.hasClass('show') ? 'Hide Examples' : 'Show Examples');
        });

        // Open first section by default
        d.$wrapper.find('.section-header').first().click();
    }, 100);
}