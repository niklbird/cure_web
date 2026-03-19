# myapp/views.py
from django.db.models import Prefetch
from rest_framework.response import Response
from rest_framework.decorators import api_view

from .models import Report, RelyingParty
from .serializers import ReportSerializer, RelyingPartyLogSerializer


@api_view(['GET'])
def get_latest_report(request):
    """
    API endpoint to fetch the latest report with all necessary aggregations 
    for the NotifyView dashboard.
    """
    try:
        latest_report = Report.objects.prefetch_related(
            Prefetch('relying_parties', queryset=RelyingParty.objects.prefetch_related('rp_logs', 'errors')),
            'inconsistencies',
            'aggregated_errors',
            'repositories',
            'ghostbusters',
            'differences'
        ).latest('time_stamp')
    except Report.DoesNotExist:
        return Response({}, status=404)
    except Exception as e:
        print(f"Error fetching latest report: {e}")
        return Response({'error': str(e)}, status=500)

    # Core report data
    report_serializer = ReportSerializer(latest_report)
    data = report_serializer.data

    # Aggregations for frontend
    rp_logs_initial = {}
    rp_logs_counts = {}
    vrps_by_rp = []
    
    for rp in latest_report.relying_parties.all():
        # Limit initial logs to 50 as per frontend INITIAL_LOG_LIMIT
        rp_logs_initial[rp.name] = [log.log_entry for log in rp.rp_logs.all()[:50]]
        rp_logs_counts[rp.name] = rp.rp_logs.count()
        vrps_by_rp.append([rp.name, rp.num_vrps])

    reachable_repos_count = latest_report.repositories.filter(reachable=True).count()
    unreachable_repos_count = latest_report.repositories.filter(reachable=False).count()

    # Construct the final response structure
    response_data = {
        'latest_report': data,
        'ghostbusters_count': latest_report.ghostbusters.count(),
        'num_repos': latest_report.num_repos,
        'vrps_by_rp': vrps_by_rp,
        'rp_logs_initial': rp_logs_initial,
        'rp_logs_counts': rp_logs_counts,
        'reachable_repos_count': reachable_repos_count,
        'unreachable_repos_count': unreachable_repos_count,
        'inconsistencies': data.get('inconsistencies', []),
        'error_messages': data.get('aggregated_errors', []),
        'repositories': data.get('repositories', [])
    }

    return Response(response_data)


@api_view(['GET'])
def get_all_rp_logs(request, rp_name):
    """API endpoint to fetch all logs for a given relying party."""
    try:
        latest_report = Report.objects.latest('time_stamp')
        # Find the relying party in the latest report
        rp = latest_report.relying_parties.get(name=rp_name)
        logs = rp.rp_logs.all()
        serializer = RelyingPartyLogSerializer(logs, many=True)
        # Return a list of entries as the user might be expecting a simple list
        return Response({'logs': [log['log_entry'] for log in serializer.data]})
    except (Report.DoesNotExist, RelyingParty.DoesNotExist):
        return Response({'logs': []}, status=404)
    except Exception as e:
        return Response({'error': str(e)}, status=500)
