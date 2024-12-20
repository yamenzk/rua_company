frappe.ui.form.on('Scope Custom Function', {
    refresh: function(frm) {
        frm.add_custom_button(__('Function Documentation'), function() {
            show_function_documentation();
        });
    }
});

function show_function_documentation() {
    const sections = {
        basic_structure: `
            <div class="section-content">
                <div class="main-content">
                    <p>Custom functions allow you to create reusable calculations that can be used in scope formulas. Each function must:</p>
                    <ul>
                        <li>List parameters one per line at the start</li>
                        <li>Contain Python code for the calculation</li>
                        <li>Assign the final value to 'result' variable</li>
                        <li>Return a numeric value (integer or float)</li>
                    </ul>
                </div>
                
                <div class="expandable-examples">
                    <button class="btn btn-xs btn-default expand-btn">
                        <span class="expand-text">Show Examples</span>
                        <span class="toggle-icon">▼</span>
                    </button>
                    <div class="expanded-content">
                        <h5>Basic Structure</h5>
                        <pre>
# Parameters
width
height
glass_type

# Function Code
if glass_type == 'tempered':
    price_per_sqm = 120
else:
    price_per_sqm = 80

result = width * height * price_per_sqm
                        </pre>
                    </div>
                </div>
            </div>
        `,

        utilities: `
            <div class="section-content">
                <div class="main-content">
                    <p>Available utilities in custom functions:</p>
                    <ul>
                        <li><code>math</code> - Python's <a style="text-decoration: underline;" href="https://docs.python.org/3/library/math.html" target="_blank">math module</a></li>
                        <li><code>flt(value)</code> - Convert to float with precision</li>
                        <li><code>cint(value)</code> - Convert to integer</li>
                        <li><code>frappe</code> - <a style="text-decoration: underline;" href="https://manual.buildwithhussain.dev/cheatsheets/script-python-api/" target="_blank">Frappe framework utilities</a></li>
                    </ul>
                </div>

                <div class="expandable-examples">
                    <button class="btn btn-xs btn-default expand-btn">
                        <span class="expand-text">Show Examples</span>
                        <span class="toggle-icon">▼</span>
                    </button>
                    <div class="expanded-content">
                        <h5>Area with Rounded Corners</h5>
                        <pre>
# Parameters
width
height
radius

# Function Code
rectangle = width * height
corners = 4 * (radius * radius)
quarter_circles = 4 * (math.pi * radius * radius / 4)

result = rectangle - corners + quarter_circles
                        </pre>
                    </div>
                </div>
            </div>
        `,

    };

    const d = new frappe.ui.Dialog({
        title: 'Custom Function Documentation',
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
                            <h4>Basic Structure</h4>
                            <span class="section-toggle">▼</span>
                        </div>
                        ${sections.basic_structure}
                    </div>
                    
                    <div class="section">
                        <div class="section-header">
                            <h4>Available Utilities</h4>
                            <span class="section-toggle">▼</span>
                        </div>
                        ${sections.utilities}
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