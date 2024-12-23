import frappe

app_name = "rua_company"
app_title = "Rua Company"
app_publisher = "Yamen Zakhour"
app_description = "Rua Company Management System"
app_email = "yz.kh@icloud.com"
app_license = "mit"

fixtures = [
    {
        "dt": "Custom HTML Block"
    }
]

# Apps
# ------------------

# required_apps = []

# Each item in the list will be shown as an app in the apps page

def get_logo():
    try:
        logo = frappe.db.get_single_value("Rua", "logo_icon")
        return logo if logo else "/assets/rua_company/i-b.png"
    except Exception:
        return "/assets/rua_company/i-b.png"

add_to_apps_screen = [
	{
		"name": "rua_company",
		"logo": get_logo(),
		"title": "Rua Company",
		"route": "/app/rua-company",
	}
]

# Includes in <head>
# ------------------

# include js, css files in header of desk.html
app_include_css = "/assets/rua_company/css/project_dashboard.css"
# app_include_js = [
#     "/assets/rua_company/js/project_dashboard.js"
# ]

# include js, css files in header of web template
# web_include_css = "/assets/rua_company/css/rua_company.css"
# web_include_js = "/assets/rua_company/js/rua_company.js"

# include custom scss in every website theme (without file extension ".scss")
# website_theme_scss = "rua_company/public/scss/website"

# include js, css files in header of web form
# webform_include_js = {"doctype": "public/js/doctype.js"}
# webform_include_css = {"doctype": "public/css/doctype.css"}

# include js in page
# page_js = {"page" : "public/js/file.js"}

# include js in doctype views
doctype_js = {
    "Project": [
        "public/js/project_dashboard.js",
        "public/js/project_dialogs.js"
    ]
}

doctype_css = {
    "Project": [
        "public/css/project_dashboard.css",
    ]
}
# doctype_list_js = {"doctype" : "public/js/doctype_list.js"}
# doctype_tree_js = {"doctype" : "public/js/doctype_tree.js"}
# doctype_calendar_js = {"doctype" : "public/js/doctype_calendar.js"}

# Svg Icons
# ------------------
# include app icons in desk
# app_include_icons = "rua_company/icons/rua-icon.svg"

# Home Pages
# ----------

# application home page (will override Website Settings)
# home_page = "login"

# website user home page (by Role)
# role_home_page = {
# 	"Role": "home_page"
# }

# Generators
# ----------

# automatically create page for each record of this doctype
# website_generators = ["Web Page"]

# Jinja
# ----------

# add methods and filters to jinja environment
# jinja = {
# 	"methods": "rua_company.utils.jinja_methods",
# 	"filters": "rua_company.utils.jinja_filters"
# }

# Installation
# ------------

# before_install = "rua_company.install.before_install"
# after_install = "rua_company.after_install"

# before_uninstall = "rua_company.before_uninstall"
# after_uninstall = "rua_company.uninstall.after_uninstall"

# Integration Setup
# ------------------
# To set up dependencies/integrations with other apps
# Name of the app being installed is passed as an argument

# before_app_install = "rua_company.utils.before_app_install"
# after_app_install = "rua_company.utils.after_app_install"

# Integration Cleanup
# -------------------
# To clean up dependencies/integrations with other apps
# Name of the app being uninstalled is passed as an argument

# before_app_uninstall = "rua_company.utils.before_app_uninstall"
# after_app_uninstall = "rua_company.utils.after_app_uninstall"

# Desk Notifications
# ------------------
# See frappe.core.notifications.get_notification_config

# notification_config = "rua_company.notifications.get_notification_config"

# Permissions
# -----------
# Permissions evaluated in scripted ways

# permission_query_conditions = {
# 	"Event": "frappe.desk.doctype.event.event.get_permission_query_conditions",
# }
#
# has_permission = {
# 	"Event": "frappe.desk.doctype.event.event.has_permission",
# }

# DocType Class
# ---------------
# Override standard doctype classes

# override_doctype_class = {
# 	"ToDo": "custom_app.overrides.CustomToDo"
# }

# Document Events
# ---------------
# Hook on document methods and events

doc_events = {
	"Scope Items": {
		"on_update": "rua_company.rua_company.doctype.bill.bill.handle_scope_item_update"
	}
}

# Scheduled Tasks
# ---------------

# scheduler_events = {
# 	"all": [
# 		"rua_company.tasks.all"
# 	],
# 	"daily": [
# 		"rua_company.tasks.daily"
# 	],
# 	"hourly": [
# 		"rua_company.tasks.hourly"
# 	],
# 	"weekly": [
# 		"rua_company.tasks.weekly"
# 	],
# 	"monthly": [
# 		"rua_company.tasks.monthly"
# 	],
# }

# Testing
# -------

# before_tests = "rua_company.install.before_tests"

# Overriding Methods
# ------------------------------
#
# override_whitelisted_methods = {
# 	"frappe.desk.doctype.event.event.get_events": "rua_company.event.get_events"
# }
#
# rua_company/hooks.py
whitelisted_methods = {
    "get_item_suggestions": "rua_company.rua_company.doctype.project.project.get_item_suggestions"
}
# each overriding function accepts a `data` argument;
# generated from the base implementation of the doctype dashboard,
# along with any modifications made in other Frappe apps
# override_doctype_dashboards = {
# 	"Task": "rua_company.task.get_dashboard_data"
# }

# exempt linked doctypes from being automatically cancelled
#
# auto_cancel_exempted_doctypes = ["Auto Repeat"]

# Ignore links to specified DocTypes when deleting documents
# -----------------------------------------------------------

# ignore_links_on_delete = ["Communication", "ToDo"]

# Request Events
# ----------------
# before_request = ["rua_company.utils.before_request"]
# after_request = ["rua_company.utils.after_request"]

# Job Events
# ----------
# before_job = ["rua_company.utils.before_job"]
# after_job = ["rua_company.utils.after_job"]

# User Data Protection
# --------------------

# user_data_fields = [
# 	{
# 		"doctype": "{doctype_1}",
# 		"filter_by": "{filter_by}",
# 		"redact_fields": ["{field_1}", "{field_2}"],
# 		"partial": 1,
# 	},
# 	{
# 		"doctype": "{doctype_2}",
# 		"filter_by": "{filter_by}",
# 		"partial": 1,
# 	},
# 	{
# 		"doctype": "{doctype_3}",
# 		"strict": False,
# 	},
# 	{
# 		"doctype": "{doctype_4}"
# 	}
# ]

# Authentication and authorization
# --------------------------------

# auth_hooks = [
# 	"rua_company.auth.validate"
# ]

# Automatically update python controller files with type annotations for this app.
# export_python_type_annotations = True

# default_log_clearing_doctypes = {
# 	"Logging DocType Name": 30  # days to retain logs
# }
