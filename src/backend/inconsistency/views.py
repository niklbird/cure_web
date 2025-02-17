from django.http import HttpResponse
from django.core.mail import send_mail
from django.contrib.auth.tokens import default_token_generator
from django.contrib.sites.shortcuts import get_current_site
from django.utils.http import urlsafe_base64_encode, urlsafe_base64_decode
from rest_framework import viewsets, status
from rest_framework.views import APIView
from rest_framework.response import Response
from .models import Error, Inconsistency, Unreachability, User
from .serializers import ErrorSerializer, InconsistencySerializer, UnreachabilitySerializer

class ErrorViewSet(viewsets.ModelViewSet):
    queryset = Error.objects.all()
    serializer_class = ErrorSerializer

class InconsistencyViewSet(viewsets.ModelViewSet):
    queryset = Inconsistency.objects.all()
    serializer_class = InconsistencySerializer

class UnreachabilityViewSet(viewsets.ModelViewSet):
    queryset = Unreachability.objects.all()
    serializer_class = UnreachabilitySerializer


class RegisterView(APIView):
    def post(self, request):
        email = request.data.get('email')
        
        if User.objects.filter(email=email).exists():
            return Response({'error': 'Email already registered'}, status=status.HTTP_400_BAD_REQUEST)

        user = User.objects.create(email=email, is_active=False)  # Create user but do not activate
        
        # Generate a token for email verification
        token = "secret_token" # default_token_generator.make_token(user)
        uid = urlsafe_base64_encode(bytes("cool_uid", 'utf-8'))

        # Send verification email
        verification_url = f"http://{get_current_site(request).domain}/verify-email/{uid}/{token}/"
        send_mail(
            'Verify your email',
            f'Click here to verify your email: {verification_url}',
            'no-reply@yourdomain.com',
            [email],
        )

        return Response({'message': 'Please check your email for verification'}, status=status.HTTP_200_OK)


class VerifyEmailView(APIView):
    def get(self, request, uidb64, token):
        try:
            uid = urlsafe_base64_decode(uidb64).decode()
            user = User.objects.get(pk=uid)
        except (TypeError, ValueError, OverflowError, User.DoesNotExist):
            user = None
        
        if user is not None and default_token_generator.check_token(user, token):
            user.is_active = True
            user.save()
            return HttpResponse('Your email has been verified.')
        else:
            return HttpResponse('Verification failed or expired token.', status=400)
