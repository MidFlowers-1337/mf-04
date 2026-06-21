from flask import Blueprint, request, jsonify
from services.stats import StatsService

stats_bp = Blueprint('stats', __name__, url_prefix='/api/stats')


@stats_bp.route('/yearly/<int:year>', methods=['GET'])
def get_yearly_stats(year):
    stats = StatsService.get_yearly_stats(year)
    return jsonify(stats)


@stats_bp.route('/years', methods=['GET'])
def get_available_years():
    years = StatsService.get_available_years()
    return jsonify(years)
