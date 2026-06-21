from flask import Blueprint, request, jsonify
from services.tags import TagService

tags_bp = Blueprint('tags', __name__, url_prefix='/api/tags')


@tags_bp.route('', methods=['GET'])
def list_tags():
    return jsonify(TagService.list_tags())


@tags_bp.route('', methods=['POST'])
def create_tag():
    data = request.get_json()
    name = (data or {}).get('name', '')
    try:
        tag = TagService.create_tag(name)
        return jsonify(tag), 201
    except ValueError as e:
        return jsonify({'error': str(e)}), 400


@tags_bp.route('/<int:tag_id>', methods=['PUT'])
def rename_tag(tag_id):
    data = request.get_json()
    new_name = (data or {}).get('name', '')
    try:
        new_id = TagService.rename_tag(tag_id, new_name)
        return jsonify({'success': True, 'id': new_id})
    except ValueError as e:
        return jsonify({'error': str(e)}), 400


@tags_bp.route('/<int:tag_id>', methods=['DELETE'])
def delete_tag(tag_id):
    TagService.delete_tag(tag_id)
    return jsonify({'success': True})
