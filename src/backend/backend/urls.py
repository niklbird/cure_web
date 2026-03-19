# myapp/urls.py
from django.urls import path
from . import views

urlpatterns = [
    path('api/get_latest_report/', views.get_latest_report, name='get_latest_report'),
    path('api/get_all_rp_logs/<str:rp_name>/', views.get_all_rp_logs, name='get_all_rp_logs'),
]
