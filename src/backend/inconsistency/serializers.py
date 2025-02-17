from rest_framework import serializers
from .models import *


class OwnerSerializer(serializers.ModelSerializer):
    class Meta:
        model = Owner
        fields = '__all__'


class URLSerializer(serializers.ModelSerializer):
    class Meta:
        model = URL
        fields = '__all__'


class CommunicationTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = CommunicationType
        fields = '__all__'


class PublicationPointSerializer(serializers.ModelSerializer):
    urls = URLSerializer(many=True)
    communication_types = CommunicationTypeSerializer(many=True)

    class Meta:
        model = PublicationPoint
        fields = ['repository', 'urls', 'communication_types']


class ErrorMessageSerializer(serializers.ModelSerializer):
    class Meta:
        model = ErrorMessage
        fields = '__all__'


class RelyingPartySerializer(serializers.ModelSerializer):
    class Meta:
        model = RelyingParty
        fields = '__all__'


class VRPSerializer(serializers.ModelSerializer):
    class Meta:
        model = VRP
        fields = '__all__'


class UnreachabilitySerializer(serializers.ModelSerializer):
    publication_point = PublicationPointSerializer()
    error_messages = ErrorMessageSerializer(many=True)

    class Meta:
        model = Unreachability
        fields = ['publication_point', 'time_stamp', 'error_messages']


class InconsistencySerializer(serializers.ModelSerializer):
    owner = OwnerSerializer()
    accepting_rps = RelyingPartySerializer(many=True)
    rejecting_rps = RelyingPartySerializer(many=True)
    affected_vrps = VRPSerializer(many=True)

    class Meta:
        model = Inconsistency
        fields = '__all__'


class ErrorSerializer(serializers.ModelSerializer):
    owner = OwnerSerializer()
    affected_vrps = VRPSerializer(many=True)

    class Meta:
        model = Error
        fields = '__all__'