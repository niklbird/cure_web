from django.db import models

# Create your models here.

class Update(models.Model):
    time_stamp = models.DateTimeField()

class User(models.Model):
    email = models.EmailField(primary_key=True)
    is_active = models.BooleanField()
    filters = models.TextField()

class Owner(models.Model):
    id = models.CharField(max_length=100, primary_key=True)
    email = models.EmailField()
    time_stamp = models.DateTimeField()

class URL(models.Model):
    url = models.URLField(primary_key=True)

class CommunicationType(models.Model):
    name = models.CharField(max_length=100, primary_key=True)

class PublicationPoint(models.Model):
    repository = models.CharField(max_length=100, primary_key=True)
    urls = models.ManyToManyField(URL, related_name='relying_parties')
    communication_types = models.ManyToManyField(CommunicationType, related_name='relying_parties')

class ErrorMessage(models.Model):
    id = models.AutoField(primary_key=True)
    text = models.TextField()

class RelyingParty(models.Model):
    name = models.CharField(max_length=100, primary_key=True)


class VRP(models.Model):
    prefix = models.CharField(max_length=100)
    asn = models.CharField(max_length=100)


class Unreachability(models.Model):
    publication_point = models.ForeignKey(PublicationPoint, on_delete=models.CASCADE, related_name='unreachabilities')
    time_stamp = models.DateTimeField()
    error_messages = models.ManyToManyField(ErrorMessage, related_name='unreachabilities')
    update = models.ForeignKey(Update, on_delete=models.CASCADE, related_name="unreachabilities")

class Inconsistency(models.Model):
    affected_object = models.CharField(max_length=100)
    object_type = models.CharField(max_length=100)
    owner = models.ForeignKey(Owner, on_delete=models.CASCADE, related_name='inconsistencies')
    accepting_rps = models.ManyToManyField(RelyingParty, related_name='accepting')
    rejecting_rps = models.ManyToManyField(RelyingParty, related_name='rejecting')
    reason = models.TextField()
    affected_vrps = models.ManyToManyField(VRP, related_name='inconsistencies')
    time_stamp = models.DateTimeField()
    update = models.ForeignKey(Update, on_delete=models.CASCADE, related_name="inconsistencies")

class Error(models.Model):
    name = models.CharField(max_length=100)
    object_type = models.CharField(max_length=100)
    owner = models.ForeignKey(Owner, on_delete=models.CASCADE, related_name='errors')
    reason = models.TextField()
    affected_vrps = models.ManyToManyField(VRP, related_name='errors')
    time_stamp = models.DateTimeField()
    update = models.ForeignKey(Update, on_delete=models.CASCADE, related_name="errors")
