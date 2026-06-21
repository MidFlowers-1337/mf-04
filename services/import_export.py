import json
from models.repository import ItemRepository


class ImportExportService:
    @staticmethod
    def export_all():
        items = ItemRepository.get_all_items()
        return {
            'version': '1.0',
            'exported_at': __import__('datetime').datetime.now().isoformat(),
            'items': items
        }

    @staticmethod
    def validate_import_data(data):
        if not isinstance(data, dict):
            return False, 'Data must be a JSON object'
        if 'items' not in data:
            return False, 'Missing "items" field'
        if not isinstance(data['items'], list):
            return False, '"items" must be an array'
        
        required_fields = ['title', 'item_type']
        valid_types = ['book', 'movie', 'music']
        valid_statuses = ['want', 'doing', 'done']
        
        for i, item in enumerate(data['items']):
            if not isinstance(item, dict):
                return False, f'Item {i} must be an object'
            for field in required_fields:
                if field not in item:
                    return False, f'Item {i} missing required field: {field}'
            if item['item_type'] not in valid_types:
                return False, f'Item {i} invalid item_type: {item["item_type"]}'
            if 'status' in item and item['status'] not in valid_statuses:
                return False, f'Item {i} invalid status: {item["status"]}'
            if 'rating' in item and item['rating'] is not None:
                if not isinstance(item['rating'], int) or item['rating'] < 1 or item['rating'] > 5:
                    return False, f'Item {i} invalid rating'
        
        return True, None

    @staticmethod
    def import_items(data):
        is_valid, error = ImportExportService.validate_import_data(data)
        if not is_valid:
            return {'success': False, 'error': error, 'imported': 0, 'skipped': 0}
        
        imported = 0
        skipped = 0
        
        for item_data in data['items']:
            existing = ItemRepository.find_by_title_and_type(
                item_data['title'], item_data['item_type']
            )
            if existing:
                skipped += 1
                continue
            
            clean_data = {
                'title': item_data['title'],
                'item_type': item_data['item_type'],
                'creator': item_data.get('creator'),
                'tags': item_data.get('tags'),
                'rating': item_data.get('rating'),
                'comment': item_data.get('comment'),
                'status': item_data.get('status', 'want'),
                'start_date': item_data.get('start_date'),
                'end_date': item_data.get('end_date'),
                'total_episodes': item_data.get('total_episodes'),
                'current_episode': item_data.get('current_episode', 0),
                'sort_order': item_data.get('sort_order', 0),
            }
            ItemRepository.create_item(clean_data)
            imported += 1
        
        return {
            'success': True,
            'imported': imported,
            'skipped': skipped
        }
