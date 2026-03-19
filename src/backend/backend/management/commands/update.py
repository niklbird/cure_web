# Update database
import os
import glob
import json

from django.core.management.base import BaseCommand
from backend.models import Report, RelyingParty, ErrorMessage, Repository, LogMessage, RelyingPartyLog, Inconsistency, Difference, GhostbusterRecord

DATA_FOLDER = "/home/update/data"


class Command(BaseCommand):
    help = 'Update the database'

    def handle(self, *args, **kwargs):
        files = [f for f in glob.glob(os.path.join(DATA_FOLDER, "*")) if os.path.isfile(f)]

        if not files: return

        newest_file = max(files, key=os.path.getmtime)
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
            Repository.objects.create(
                report=report_obj,
                uri=repo[0],
                reachable=True,
                contained_vrps=repo[1],
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

        for gbr in report["gbrs"]:
            GhostbusterRecord.objects.create(
                    report=report_obj,
                    name=gbr[0],
                    email=gbr[1]
            )

        for inconsistency in report["mapped_inconsistencies"]:
            Inconsistency.objects.create(
                    report=report_obj,
                    file_name=inconsistency[0],
                    log_message=inconsistency[1],
                    num_impacted_vrps=inconsistency[2]
            )

        for difference in report["persistent_diffs"]:
            for rp in difference[1]:
                Difference.objects.create(
                        report=report_obj,
                        relying_party=rp,
                        vrp=difference[0]
                )
