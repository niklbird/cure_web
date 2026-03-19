# Update database from the newest JSON report in DATA_FOLDER
import os
import glob
import json

from django.conf import settings
from django.core.management.base import BaseCommand
from backend.models import (
    Report, RelyingParty, ErrorMessage, Repository,
    LogMessage, RelyingPartyLog, Inconsistency, Difference,
    GhostbusterRecord
)


class Command(BaseCommand):
    help = 'Update the database from the newest report file in DATA_FOLDER'

    def handle(self, *args, **kwargs):
        data_folder = getattr(settings, 'DATA_FOLDER', '/app/data/reports')
        self.stdout.write(f"Looking for report files in: {data_folder}")

        if not os.path.isdir(data_folder):
            self.stderr.write(f"Data folder does not exist: {data_folder}")
            return

        files = [f for f in glob.glob(os.path.join(data_folder, "*")) if os.path.isfile(f)]

        if not files:
            self.stdout.write("No report files found.")
            return

        newest_file = max(files, key=os.path.getmtime)
        self.stdout.write(f"Loading report from: {newest_file}")

        with open(newest_file, "r") as f:
            report = json.load(f)

        report_obj = Report.objects.create(
            time_stamp=report["time"],
            num_objects=report["amount_objects"],
            num_roas=report["amount_roas"],
            num_cas=report["amount_cas"],
            num_overlap_vrps=report["overlapping_vrps"],
            num_diff_vrps=report["differential_vrps"],
            num_total_vrps=report["total_vrps"],
            max_rp_exec_time=report["max_rp_execution_time"]["secs"],
            crawler_exec_time=report["crawler_execution_time"]["secs"]
        )

        for rp, num_vrps in report["vrps_rps"]:
            RelyingParty.objects.create(
                report=report_obj,
                name=rp,
                num_vrps=num_vrps
            )

        for log_msg in report["rp_logs"]:
            rp, _ = RelyingParty.objects.get_or_create(
                report=report_obj,
                name=log_msg[0]
            )

            for log_entry in log_msg[1].split("\n"):
                RelyingPartyLog.objects.create(
                    relying_party=rp,
                    log_entry=log_entry
                )

        for rp_name, error_msg_list in report["aggregated_errors"]:
            rp, _ = RelyingParty.objects.get_or_create(
                report=report_obj,
                name=rp_name
            )

            for message, count in error_msg_list:
                ErrorMessage.objects.create(
                    report=report_obj,
                    relying_party=rp,
                    message=message,
                    count=count
                )

        for repo in report["reachable_repos"]:
            if len(repo) == 2:
                uri, contained_vrps = repo
            else:
                uri, contained_vrps = repo, 0

            Repository.objects.create(
                report=report_obj,
                uri=uri,
                reachable=True,
                contained_vrps=contained_vrps,
                num_affected_vrps=0
            )

        for repo in report["unreachable_repos"].keys():
            repo_obj = Repository.objects.create(
                report=report_obj,
                uri=repo,
                reachable=False,
                contained_vrps=report["unreachable_repos"][repo][0],
                num_affected_vrps=report["unreachable_repos"][repo][0]
            )

            for rp_name, error_message in report["unreachable_repos"][repo][1]:
                rp = RelyingParty.objects.get(
                    report=report_obj,
                    name=rp_name
                )

                LogMessage.objects.create(
                    relying_party=rp,
                    repository=repo_obj,
                    log_entry=error_message
                )

        for gbr in report.get("gbrs", []):
            GhostbusterRecord.objects.create(
                report=report_obj,
                name=gbr[0],
                email=gbr[1]
            )

        for inconsistency in report.get("mapped_inconsistencies", []):
            Inconsistency.objects.create(
                report=report_obj,
                file_name=inconsistency[0],
                log_message=inconsistency[1],
                num_impacted_vrps=inconsistency[2]
            )

        for difference in report.get("persistent_diffs", []):
            for rp in difference[1]:
                Difference.objects.create(
                    report=report_obj,
                    relying_party=rp,
                    vrp=difference[0]
                )

        self.stdout.write(self.style.SUCCESS(
            f"Successfully loaded report from {newest_file} "
            f"({report_obj.num_objects} objects, {report_obj.num_total_vrps} VRPs)"
        ))