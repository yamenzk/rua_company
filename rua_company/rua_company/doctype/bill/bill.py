# Copyright (c) 2024, Yamen Zakhour and contributors
# For license information, please see license.txt

import frappe
import json
from frappe.model.document import Document
from frappe.utils import cint

class Bill(Document):
	def validate(self):
		self.update_totals()
	
	def update_totals(self):
		"""Update bill totals by summing scope item totals of the same type"""
		if not self.scope_items:
			self._data = ''
			return
			
		# Group scope items by scope type
		scope_items_by_type = {}
		for item in self.scope_items:
			if not item.scope_item:
				continue
				
			scope_doc = frappe.get_doc('Scope Items', item.scope_item)
			if scope_doc.scope_type not in scope_items_by_type:
				scope_items_by_type[scope_doc.scope_type] = []
			scope_items_by_type[scope_doc.scope_type].append(scope_doc)
		
		# Initialize bill totals
		bill_totals = {}
		
		# Process each scope type
		for scope_type, scope_items in scope_items_by_type.items():
			scope_type_doc = frappe.get_doc('Scope Type', scope_type)
			
			# Get billable formulas for this scope type
			billable_formulas = [
				formula.field_name 
				for formula in scope_type_doc.calculation_formulas 
				if hasattr(formula, 'in_bill') and cint(formula.in_bill)
			]
			
			# Sum totals for this scope type
			type_totals = {}
			for scope_doc in scope_items:
				totals_data = json.loads(scope_doc._totals_data) if isinstance(scope_doc._totals_data, str) else scope_doc._totals_data
				if not totals_data:
					continue
					
				for field_name in billable_formulas:
					if field_name in totals_data:
						if field_name not in type_totals:
							type_totals[field_name] = 0
						type_totals[field_name] += float(totals_data[field_name])
			
			# Add type totals to bill totals
			if type_totals:
				bill_totals[scope_type] = type_totals
		
		# Update bill's _data field
		self._data = json.dumps(bill_totals) if bill_totals else "{}"

	def refresh_scope_item_data(self, scope_item_name):
		"""Refresh data for a specific scope item in the bill"""
		if not self.auto_update_items or self.docstatus != 0:
			return

		for item in self.scope_items:
			if item.scope_item == scope_item_name:
				# Fetch fresh data
				scope_doc = frappe.get_doc('Scope Items', scope_item_name)
				result = get_scope_item_data(scope_item_name)
				if result and '_data' in result:
					item._data = json.dumps(result['_data'])
		
		# Update totals after refreshing data
		self.update_totals()
		self.save()

@frappe.whitelist()
def get_scope_item_data(scope_item):
	"""Get scope item data with fields filtered by in_bill flag"""
	scope_doc = frappe.get_doc('Scope Items', scope_item)
	
	result = {
		'scope_item': scope_item,
		'_data': {
			scope_item: {
				'items': {},
				'totals': {},
				'constants': {}
			}
		}
	}
	
	if not scope_doc.items:
		return result
				
	# Get the scope type document to access field configurations
	scope_type_doc = frappe.get_doc('Scope Type', scope_doc.scope_type)
	
	# Create a lookup dictionary for field configurations
	field_config_dict = {
		fc.field_name: fc.in_bill 
		for fc in scope_type_doc.scope_fields 
		if hasattr(fc, 'field_name') and hasattr(fc, 'in_bill')
	}
	
	# Process items data
	for idx, item in enumerate(scope_doc.items):
		
		if not item._data or not item.row_id:
			continue
			
		# Parse _data if it's a string
		item_data = json.loads(item._data) if isinstance(item._data, str) else item_data
		
		# Create entry for this item
		row_data = {
			'item_name': item.item_name
		}
		
		# Add fields where in_bill is True
		for field_name, value in item_data.items():
			if field_name in field_config_dict and cint(field_config_dict[field_name]):
				row_data[field_name] = value
		
		# Add this item's data to the result using row_id as key
		result['_data'][scope_item]['items'][item.row_id] = row_data
	
	# Process totals data
	totals_data = json.loads(scope_doc._totals_data) if isinstance(scope_doc._totals_data, str) else scope_doc._totals_data
	if totals_data:
		# Get calculation formulas with in_bill=1
		billable_formulas = {
			formula.field_name: True 
			for formula in scope_type_doc.calculation_formulas 
			if hasattr(formula, 'in_bill') and cint(formula.in_bill)
		}
		
		# Add only billable totals
		for field_name, value in totals_data.items():
			if field_name in billable_formulas:
				result['_data'][scope_item]['totals'][field_name] = value
	
	# Process constants data
	constants_data = json.loads(scope_doc._constants_data) if isinstance(scope_doc._constants_data, str) else scope_doc._constants_data
	if constants_data:
		# Get constants with in_bill=1
		billable_constants = {
			constant.constant_name: True 
			for constant in scope_type_doc.constants 
			if hasattr(constant, 'in_bill') and cint(constant.in_bill)
		}
		
		# Add only billable constants
		for field_name, value in constants_data.items():
			if field_name in billable_constants:
				result['_data'][scope_item]['constants'][field_name] = value
			
	return result

def handle_scope_item_update(doc, method):
	"""Handler for scope item document updates"""
	# Find all draft bills that have auto_update enabled and contain this scope item
	bills = frappe.get_all(
		'Bill',
		filters={
			'docstatus': 0,
			'auto_update_items': 1
		},
		fields=['name']
	)
	
	for bill in bills:
		# Check if this scope item is in the bill
		bill_doc = frappe.get_doc('Bill', bill.name)
		for item in bill_doc.scope_items:
			if item.scope_item == doc.name:
				bill_doc.refresh_scope_item_data(doc.name)
				break
