from flask import Blueprint, request, jsonify, send_file
import json
import io
from datetime import datetime
from services.import_export import ImportExportService

import_export_bp = Blueprint('import_export', __name__, url_prefix='/api')


@import_export_bp.route('/export', methods=['GET'])
def export_data():
    data = ImportExportService.export_all()
    output = io.BytesIO()
    output.write(json.dumps(data, ensure_ascii=False, indent=2).encode('utf-8'))
    output.seek(0)
    filename = f'tracker-backup-{datetime.now().strftime("%Y%m%d-%H%M%S")}.json'
    return send_file(
        output,
        mimetype='application/json',
        as_attachment=True,
        download_name=filename
    )


@import_export_bp.route('/import', methods=['POST'])
def import_data():
    if 'file' not in request.files:
        return jsonify({'error': 'No file uploaded'}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No file selected'}), 400
    
    try:
        content = file.read().decode('utf-8')
        data = json.loads(content)
    except json.JSONDecodeError as e:
        return jsonify({'error': f'Invalid JSON: {str(e)}'}), 400
    except Exception as e:
        return jsonify({'error': str(e)}), 400
    
    result = ImportExportService.import_items(data)
    if not result['success']:
        return jsonify(result), 400
    return jsonify(result)
