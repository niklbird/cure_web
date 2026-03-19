from rest_framework import serializers
from .models import (
    Report, RelyingParty, ErrorMessage, Repository, 
    LogMessage, RelyingPartyLog, GhostbusterRecord,
    Inconsistency, Difference
)

class ErrorMessageSerializer(serializers.ModelSerializer):
    class Meta:
        model = ErrorMessage
        fields = ['message', 'count']

class RelyingPartyLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = RelyingPartyLog
        fields = ['log_entry']

class RelyingPartySerializer(serializers.ModelSerializer):
    errors = ErrorMessageSerializer(many=True, read_only=True)
    rp_logs = RelyingPartyLogSerializer(many=True, read_only=True)

    class Meta:
        model = RelyingParty
        fields = ['name', 'num_vrps', 'errors', 'rp_logs']

class RepositoryLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = LogMessage
        fields = ['log_entry']

class RepositorySerializer(serializers.ModelSerializer):
    logs = RepositoryLogSerializer(many=True, read_only=True)

    class Meta:
        model = Repository
        fields = ['uri', 'reachable', 'contained_vrps', 'num_affected_vrps', 'logs']

class GhostbusterRecordSerializer(serializers.ModelSerializer):
    class Meta:
        model = GhostbusterRecord
        fields = ['name', 'email']

class InconsistencySerializer(serializers.ModelSerializer):
    class Meta:
        model = Inconsistency
        fields = ['file_name', 'log_message', 'num_impacted_vrps']

class DifferenceSerializer(serializers.ModelSerializer):
    class Meta:
        model = Difference
        fields = ['relying_party', 'vrp']

class ReportSerializer(serializers.ModelSerializer):
    relying_parties = RelyingPartySerializer(many=True, read_only=True)
    aggregated_errors = ErrorMessageSerializer(many=True, read_only=True)
    repositories = RepositorySerializer(many=True, read_only=True)
    ghostbusters = GhostbusterRecordSerializer(many=True, read_only=True)
    inconsistencies = InconsistencySerializer(many=True, read_only=True)
    differences = DifferenceSerializer(many=True, read_only=True)

    class Meta:
        model = Report
        fields = [
            'id', 'time_stamp', 'num_objects', 'num_roas', 'num_cas', 
            'num_overlap_vrps', 'num_diff_vrps', 'num_total_vrps', 
            'max_rp_exec_time', 'crawler_exec_time', 'num_repos',
            'relying_parties', 'aggregated_errors', 'repositories', 
            'ghostbusters', 'inconsistencies', 'differences'
        ]
