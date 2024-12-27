# Copyright (c) 2024, Yamen Zakhour and contributors
# For license information, please see license.txt

import frappe
import base64
import os
import json
from PIL import Image, ImageDraw, ImageFont
from io import BytesIO
from frappe.model.document import Document
from datetime import datetime
from frappe.utils.file_manager import get_file_path
import requests


class Docusign(Document):
    def process_signature_image(self, signature_data, is_base64=True, protect_signature=True, values=None):
        values = values or {}
        # Handle base64 data
        if is_base64:
            # Remove the data:image/png;base64, prefix if present
            base64_data = signature_data
            if ',' in base64_data:
                base64_data = base64_data.split(',')[1]
            
            # Convert base64 to image
            image_data = base64.b64decode(base64_data)
            image = Image.open(BytesIO(image_data))
        else:
            # Handle direct image data
            image = Image.open(BytesIO(signature_data))
        
        # Standardize image size
        MAX_WIDTH = 215
        MAX_HEIGHT = 150  # Maximum height for uploaded images
        
        # For uploaded images (not base64), apply both width and height constraints
        if not is_base64:
            # Calculate ratios for both width and height
            width_ratio = MAX_WIDTH / float(image.width)
            height_ratio = MAX_HEIGHT / float(image.height)
            
            # Use the smaller ratio to ensure both dimensions are within limits
            ratio = min(width_ratio, height_ratio)
            new_width = int(float(image.width) * ratio)
            new_height = int(float(image.height) * ratio)
            image = image.resize((new_width, new_height), Image.Resampling.LANCZOS)
        else:
            # For signatures (base64), only apply width constraint
            if image.width > MAX_WIDTH:
                ratio = MAX_WIDTH / float(image.width)
                new_height = int(float(image.height) * ratio)
                image = image.resize((MAX_WIDTH, new_height), Image.Resampling.LANCZOS)
        
        # Create a new image with the same size
        new_image = Image.new('RGBA', (image.width, image.height), (255, 255, 255, 0))
        
        # If protect_signature is enabled, create watermark
        if protect_signature:
            # Create watermark text using document name
            watermark = Image.new('RGBA', (image.width, image.height), (255, 255, 255, 0))
            draw = ImageDraw.Draw(watermark)
            try:
                font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 12)
            except:
                font = ImageFont.load_default()
            
            # Calculate text size
            text = self.signed_docname
            text_width = draw.textlength(text, font=font)
            text_height = font.size
            
            # Create repeating pattern
            for y in range(0, image.height, text_height + 10):
                for x in range(0, image.width, int(text_width) + 20):
                    draw.text((x, y), text, fill=(128, 128, 128, 64), font=font)
            
            # Merge watermark with original image
            new_image = Image.alpha_composite(watermark, image)
        else:
            new_image.paste(image, (0, 0))
        
        # Add text below signature
        draw = ImageDraw.Draw(new_image)
        # Calculate font size based on image height (smaller for uploaded images)
        base_font_size = 8 if is_base64 else 7
        try:
            font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", base_font_size)
        except:
            font = ImageFont.load_default()
        
        # Calculate text positions with smaller margins
        margin_x = 10 if is_base64 else 8
        margin_y = 8 if is_base64 else 6
        line_height = base_font_size + 2  # Add small padding
        
        # Add text at the top
        current_y = margin_y
        
        # Add name and position on the left
        if self.signee_name and values.get('include_name'):
            draw.text((margin_x, current_y), self.signee_name, fill='black', font=font)
            current_y += line_height

        if self.position and values.get('include_position'):
            draw.text((margin_x, current_y), self.position, fill='black', font=font)
            
        # Add date on the right
        if self.date and values.get('include_date'):
            formatted_date = frappe.utils.formatdate(self.date, "dd/mm/yyyy")
            date_text = f"Signed on {formatted_date}"
            # Get the width of the date text to position it on the right
            date_width = draw.textlength(date_text, font=font)
            right_x = new_image.width - date_width - margin_x
            draw.text((right_x, margin_y), date_text, fill='black', font=font)
        
        # Create a BytesIO object to save the PNG
        output = BytesIO()
        new_image.save(output, format='PNG')
        output.seek(0)
        
        # Save the file
        filename = f"signature_{frappe.generate_hash()[:10]}.png"
        _file = frappe.get_doc({
            "doctype": "File",
            "file_name": filename,
            "content": output.getvalue(),
            "attached_to_doctype": self.doctype,
            "attached_to_name": self.name,
            "attached_to_field": "image",
            "is_private": 0
        })
        _file.save()
        
        # Update the image field with the file URL
        self.image = _file.file_url
        self.save(ignore_permissions=True)


@frappe.whitelist()
def process_signature(docname, signature, signee_name=None, position=None, date=None, protect_signature=True, values=None):
    if isinstance(values, str):
        values = json.loads(values)
    values = values or {}
    
    doc = frappe.get_doc("Docusign", docname)
    if values.get('include_name'):
        doc.signee_name = signee_name
    if values.get('include_position'):
        doc.position = position
    if values.get('include_date'):
        doc.date = date
    doc.process_signature_image(signature, is_base64=True, protect_signature=protect_signature, values=values)
    return True


@frappe.whitelist()
def process_uploaded_signature(docname, file_url, signee_name=None, position=None, date=None, protect_signature=True, values=None):
    if isinstance(values, str):
        values = json.loads(values)
    values = values or {}
    
    doc = frappe.get_doc("Docusign", docname)
    if values.get('include_name'):
        doc.signee_name = signee_name
    if values.get('include_position'):
        doc.position = position
    if values.get('include_date'):
        doc.date = date
    
    # Get the file content using Frappe's file handling
    file_path = get_file_path(file_url)
    with open(file_path, 'rb') as f:
        file_content = f.read()
    
    doc.process_signature_image(file_content, is_base64=False, protect_signature=protect_signature, values=values)
    return True


@frappe.whitelist()
def process_password_signature(docname, password, signee_name=None, position=None, date=None, protect_signature=True, values=None):
    if isinstance(values, str):
        values = json.loads(values)
    values = values or {}
    # Find all employees with quick sign passwords
    employees = frappe.get_all(
        "Employee",
        filters={"quick_sign_password": ["!=", ""]},
        fields=["name", "full_name", "position", "signature"]
    )
    
    # Find employee with matching password
    matching_employee = None
    for emp in employees:
        emp_doc = frappe.get_doc("Employee", emp.name)
        if emp_doc.get_password('quick_sign_password') == password:
            matching_employee = emp
            break
    
    if not matching_employee:
        frappe.throw("Invalid quick sign password")
    
    # Check if employee has a signature
    if not matching_employee.signature:
        frappe.throw("Employee does not have a signature set up")
    
    # Get the docusign document
    doc = frappe.get_doc("Docusign", docname)
    
    # Update document fields
    if values.get('include_name'):
        doc.signee_name = signee_name
    if values.get('include_position'):
        doc.position = position
    if values.get('include_date'):
        doc.date = date
    
    # Process the signature
    doc.process_signature_image(matching_employee.signature, is_base64=True, protect_signature=protect_signature, values=values)
    return True
