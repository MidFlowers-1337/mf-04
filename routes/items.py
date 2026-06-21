from flask import Blueprint, request, jsonify
from services.items import ItemService

items_bp = Blueprint('items', __name__, url_prefix='/api/items')


@items_bp.route('', methods=['GET'])
def list_items():
    item_type = request.args.get('type')
    status = request.args.get('status')
    items = ItemService.list_items(item_type, status)
    return jsonify(items)


@items_bp.route('', methods=['POST'])
def create_item():
    data = request.get_json()
    try:
        item = ItemService.create_item(data)
        return jsonify(item), 201
    except ValueError as e:
        return jsonify({'error': str(e)}), 400


@items_bp.route('/<int:item_id>', methods=['GET'])
def get_item(item_id):
    item = ItemService.get_item(item_id)
    if not item:
        return jsonify({'error': 'Item not found'}), 404
    return jsonify(item)


@items_bp.route('/<int:item_id>', methods=['PUT'])
def update_item(item_id):
    data = request.get_json()
    try:
        item = ItemService.update_item(item_id, data)
        if not item:
            return jsonify({'error': 'Item not found'}), 404
        return jsonify(item)
    except ValueError as e:
        return jsonify({'error': str(e)}), 400


@items_bp.route('/<int:item_id>', methods=['DELETE'])
def delete_item(item_id):
    success = ItemService.delete_item(item_id)
    if not success:
        return jsonify({'error': 'Item not found'}), 404
    return jsonify({'success': True})


@items_bp.route('/<int:item_id>/episode', methods=['PUT'])
def update_episode(item_id):
    data = request.get_json()
    current_episode = data.get('current_episode', 0)
    try:
        item = ItemService.update_episode(item_id, current_episode)
        if not item:
            return jsonify({'error': 'Item not found'}), 404
        return jsonify(item)
    except ValueError as e:
        return jsonify({'error': str(e)}), 400


@items_bp.route('/wantlist', methods=['GET'])
def get_wantlist():
    items = ItemService.get_wantlist()
    return jsonify(items)


@items_bp.route('/wantlist/reorder', methods=['PUT'])
def reorder_wantlist():
    data = request.get_json()
    item_order = data.get('order', [])
    ItemService.reorder_wantlist(item_order)
    return jsonify({'success': True})


@items_bp.route('/<int:item_id>/pin', methods=['POST'])
def pin_item(item_id):
    success = ItemService.pin_item(item_id)
    if not success:
        return jsonify({'error': 'Item not found or not in wantlist'}), 404
    return jsonify({'success': True})
