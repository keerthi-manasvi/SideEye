"""
Custom exception handlers for the SideEye API
"""

from rest_framework.views import exception_handler
from rest_framework.response import Response
from rest_framework import status
from django.core.exceptions import ValidationError
from django.http import Http404
import logging

logger = logging.getLogger(__name__)


def custom_exception_handler(exc, context):
    """
    Custom exception handler that provides consistent error responses
    """
    # Call REST framework's default exception handler first
    response = exception_handler(exc, context)
    
    # Get the view and request from context
    view = context.get('view')
    request = context.get('request')
    
    # Log the exception with context
    if response is not None:
        logger.warning(
            f"API Exception in {view.__class__.__name__ if view else 'Unknown'}: "
            f"{exc.__class__.__name__}: {str(exc)}"
        )
    else:
        logger.error(
            f"Unhandled Exception in {view.__class__.__name__ if view else 'Unknown'}: "
            f"{exc.__class__.__name__}: {str(exc)}"
        )
    
    # Handle specific exception types
    if response is not None:
        custom_response_data = {
            'error': True,
            'message': 'An error occurred while processing your request',
            'details': {
                'error_code': exc.__class__.__name__,
                'field_errors': {},
                'validation_errors': []
            }
        }
        
        # Handle validation errors
        if hasattr(exc, 'detail'):
            if isinstance(exc.detail, dict):
                # Field-specific validation errors
                custom_response_data['details']['field_errors'] = exc.detail
                custom_response_data['message'] = 'Validation failed for one or more fields'
            elif isinstance(exc.detail, list):
                # General validation errors
                custom_response_data['details']['validation_errors'] = exc.detail
                custom_response_data['message'] = 'Validation failed'
            else:
                # Single error message
                custom_response_data['message'] = str(exc.detail)
        
        # Handle specific status codes
        if response.status_code == status.HTTP_400_BAD_REQUEST:
            custom_response_data['message'] = 'Bad request - please check your input data'
        elif response.status_code == status.HTTP_404_NOT_FOUND:
            custom_response_data['message'] = 'The requested resource was not found'
        elif response.status_code == status.HTTP_405_METHOD_NOT_ALLOWED:
            custom_response_data['message'] = 'Method not allowed for this endpoint'
        elif response.status_code == status.HTTP_500_INTERNAL_SERVER_ERROR:
            custom_response_data['message'] = 'Internal server error - please try again later'
        
        response.data = custom_response_data
        
    else:
        # Handle exceptions that weren't caught by DRF
        if isinstance(exc, ValidationError):
            # Django model validation errors
            response = Response({
                'error': True,
                'message': 'Validation error',
                'details': {
                    'error_code': 'ValidationError',
                    'field_errors': exc.message_dict if hasattr(exc, 'message_dict') else {},
                    'validation_errors': exc.messages if hasattr(exc, 'messages') else [str(exc)]
                }
            }, status=status.HTTP_400_BAD_REQUEST)
            
        elif isinstance(exc, Http404):
            # Django 404 errors
            response = Response({
                'error': True,
                'message': 'Resource not found',
                'details': {
                    'error_code': 'NotFound',
                    'field_errors': {},
                    'validation_errors': []
                }
            }, status=status.HTTP_404_NOT_FOUND)
            
        else:
            # Unhandled exceptions
            response = Response({
                'error': True,
                'message': 'An unexpected error occurred',
                'details': {
                    'error_code': exc.__class__.__name__,
                    'field_errors': {},
                    'validation_errors': [str(exc)]
                }
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    return response


def handle_serializer_errors(serializer_errors):
    """
    Helper function to format serializer errors consistently
    """
    formatted_errors = {}
    
    for field, errors in serializer_errors.items():
        if isinstance(errors, list):
            formatted_errors[field] = [str(error) for error in errors]
        else:
            formatted_errors[field] = [str(errors)]
    
    return formatted_errors


def create_error_response(message, field_errors=None, validation_errors=None, status_code=status.HTTP_400_BAD_REQUEST):
    """
    Helper function to create consistent error responses
    """
    return Response({
        'error': True,
        'message': message,
        'details': {
            'field_errors': field_errors or {},
            'validation_errors': validation_errors or [],
            'error_code': 'ValidationError' if status_code == status.HTTP_400_BAD_REQUEST else 'Error'
        }
    }, status=status_code)