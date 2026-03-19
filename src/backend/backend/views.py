# myapp/views.py
from django.db.models import Prefetch
from rest_framework.response import Response
from rest_framework.decorators import api_view

from .models import Report, RelyingParty


@api_view(['GET'])
def get_latest_report(request):
    # Use select_related and prefetch_related to optimize database queries, reducing page load time.
    latest_report = Report.objects.order_by('-time_stamp').prefetch_related(
        Prefetch('relying_parties', queryset=RelyingParty.objects.prefetch_related('rp_logs', 'errors')),
        'inconsistencies',
        'aggregated_errors',
        'repositories',
        'ghostbusters',
        'differences'
    ).first()
    return Response(latest_report.to_dict())
 

@api_view(['GET'])
def get_all_rp_logs(request, rp_name):
    """API endpoint to fetch all logs for a given relying party."""
    latest_report = Report.objects.order_by('-time_stamp').first()
    if latest_report:
        try:
            # Find the relying party in the latest report
            rp = latest_report.relying_parties.get(name=rp_name)
            logs = list(rp.rp_logs.all().values_list('log_entry', flat=True))
            return Response({'logs': logs})
        except RelyingParty.DoesNotExist:
            return Response({'logs': []}, status=404)
    return Response({'logs': []}, status=404)
