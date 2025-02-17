from inconsistency.models import *
from django.core.management.base import BaseCommand


def add_ghostbuster_records(records, update):
    time_stamp = records["Time"]

    for record in records["Contacts"]:
        Owner.objects.get_or_create(
            id = record["Owner"],
            defaults={
                "email": record["EmailAddress"],
                "time_stamp": time_stamp
            }
        )


def add_unreachabilities(records, update):
    time_stamp = records["Time"]

    for record in records["UnreachablePublicationPoints"]:
        if PublicationPoint.objects.filter(repository=record["Repository"]).exists():
            publication_point = PublicationPoint.objects.get(repository=record["Repository"])
        else:
            publication_point = PublicationPoint.objects.create(
                repository = record["Repository"]
            )

            for url in record["URLs"]:
                url, _ = URL.objects.get_or_create(
                    url = url
                )

                publication_point.urls.add(url)

            for communication_type in record["CommunicationTypes"]:
                communication_type, _ = CommunicationType.objects.get_or_create(
                    name = communication_type
                )

                publication_point.communication_types.add(communication_type)

            publication_point.save()

        unreachability = Unreachability.objects.create(
            publication_point = publication_point,
            time_stamp = time_stamp,
            update = update
        )

        for error in record["ErrorMessages"]:
            error_message, _ = ErrorMessage.objects.get_or_create(
                text = error
            )

            unreachability.error_messages.add(error_message)
        
        unreachability.save()


def add_inconsistencies_and_errors(records, update):
    time_stamp = records["Time"]

    for record in records["Inconsistencies"]:
        owner, _ = Owner.objects.get_or_create(
            id = record["Owner"],
            defaults={
                "time_stamp": time_stamp
            }
        )

        inconsistency = Inconsistency.objects.create(
            affected_object = record["ObjectName"],
            object_type = record["ObjectType"],
            owner = owner,
            reason = record["Reason"],
            time_stamp = time_stamp,
            update = update
        )

        for rp in record["AcceptingRPs"]:
            relying_party, _ = RelyingParty.objects.get_or_create(
                name = rp
            )

            inconsistency.accepting_rps.add(relying_party)

        for rp in record["RejectingRPs"]:
            relying_party, _ = RelyingParty.objects.get_or_create(
                name = rp
            )

            inconsistency.rejecting_rps.add(relying_party)

        for vrp in record["AffectedVRPs"]:
            vrp, _ = VRP.objects.get_or_create(
                prefix = vrp["Prefix"],
                asn = vrp["ASN"]
            )

            inconsistency.affected_vrps.add(vrp)

        inconsistency.save()

    for record in records["Errors"]:
        owner, _ = Owner.objects.get_or_create(
            id = record["Owner"],
            defaults={
                "time_stamp": time_stamp
            }
        )

        error = Error.objects.create(
            name = record["ObjectName"],
            object_type = record["ObjectType"],
            owner = owner,
            reason = record["Reason"],
            time_stamp = time_stamp,
            update = update
        )

        for vrp in record["AffectedVRPs"]:
            vrp, _ = VRP.objects.get_or_create(
                prefix = vrp["Prefix"],
                asn = vrp["ASN"]
            )

            error.affected_vrps.add(vrp)

        error.save()

import json
import os
import datetime
from django.core.mail import send_mail


def send_notification(user, records):
    send_mail(
        'RPKI Issue Notification',
        """
        {records}
        """.format(records=records),
        'no-reply@yourdomain.com',
        [user.email],
    )

class Command(BaseCommand):
    help = 'Add test data to the database'

    def handle(self, *args, **kwargs):
        update = Update.objects.create(
            time_stamp=datetime.datetime.now()
        )

        with open('./test_data/ghostbuser.json', 'r') as file:
            ghostbuster_records = json.load(file)
            add_ghostbuster_records(ghostbuster_records, update)

        with open('./test_data/repositories.json', 'r') as file:
            unreachabilities = json.load(file)
            add_unreachabilities(unreachabilities, update)

        with open('./test_data/objects.json', 'r') as file:
            inconsistencies_and_errors = json.load(file)
            add_inconsistencies_and_errors(inconsistencies_and_errors, update)

        # for error in update.errors:
        #     if error.owner.email:
        #         send_notification(error.owner, error)

        # for inconsistency in update.inconsistencies:
        #     if inconsistency.owner.email:
        #         send_notification(inconsistency.owner, inconsistency)

        
        # for user in User.objects.all():
        #     uns = update.unreachabilities.filter(user.filters)
        #     errors = update.errors.filter(user.filters)
        #     inconsistencies = update.inconsistencies.filter(user.filters)

        #     if uns or errors or inconsistencies:
        #         send_notification(user, [uns, errors, inconsistencies])


