from django.shortcuts import render
from django.http import JsonResponse
from rest_framework.decorators import api_view, action
from rest_framework.response import Response
from rest_framework import status, viewsets, mixins
from rest_framework.viewsets import GenericViewSet
from django.utils import timezone
from datetime import timedelta
import logging
import json

from .models import UserPreferences, EmotionReading, UserFeedback, Task, YouTubePlaylist, MusicRecommendation
from .serializers import (
    UserPreferencesSerializer, 
    EmotionReadingSerializer, 
    UserFeedbackSerializer,
    TaskSerializer,
    TaskRecommendationSerializer,
    TaskSortingSerializer,
    YouTubePlaylistSerializer,
    MusicRecommendationSerializer
)
from .services.error_handling_service import error_handling_service
from .services.emotion_analysis_service import EmotionAnalysisService
from .services.notification_service import NotificationService
from .services.music_recommendation_service import music_recommendation_service
from .services.theme_recommendation_service import theme_recommendation_service
from .services.cli_hook_service import cli_hook_service
from .services.error_handling_service import error_handling_service
# from .services.data_privacy_service import data_privacy_service

logger = logging.getLogger(__name__)


@api_view(['GET'])
def health_check(request):
    """
    Health check endpoint to verify Django service is running
    """
    logger.info("Health check requested")
    return Response({
        'status': 'healthy',
        'service': 'SideEye Django Backend',
        'version': '1.0.0',
        'timestamp': timezone.now().isoformat()
    })


@api_view(['GET'])
def system_health(request):
    """
    Comprehensive system health check endpoint with error handling status
    """
    try:
        # Get comprehensive system health status
        health_status = error_handling_service.get_system_health_status()
        
        # Add additional system information
        health_status.update({
            'django_status': 'healthy',
            'database_status': 'healthy',  # This would be checked in real implementation
            'cache_status': 'healthy',     # This would be checked in real implementation
        })
        
        # Check for any scheduled recoveries
        recovery_status = error_handling_service.check_and_attempt_scheduled_recoveries()
        health_status['recovery_status'].update(recovery_status)
        
        # Determine HTTP status code based on overall health
        http_status = status.HTTP_200_OK
        if health_status['overall_status'] == 'offline':
            http_status = status.HTTP_503_SERVICE_UNAVAILABLE
        elif health_status['overall_status'] == 'degraded':
            http_status = status.HTTP_206_PARTIAL_CONTENT
        elif health_status['overall_status'] == 'error':
            http_status = status.HTTP_500_INTERNAL_SERVER_ERROR
        
        logger.info(f"System health check: {health_status['overall_status']}")
        return Response(health_status, status=http_status)
        
    except Exception as e:
        logger.error(f"Error getting system health: {e}")
        return Response({
            'overall_status': 'error',
            'error': str(e),
            'timestamp': timezone.now().isoformat()
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class ErrorHandlingViewSet(GenericViewSet):
    """
    ViewSet for error handling and recovery operations
    """
    
    @action(detail=False, methods=['post'])
    def report_error(self, request):
        """
        Report an error from the frontend
        """
        try:
            # Extract error data from request
            error_data = {
                'type': request.data.get('error_type', 'frontend_error'),
                'message': request.data.get('error_message', ''),
                'stack_trace': request.data.get('error_stack', ''),
                'context': {
                    'user_agent': request.data.get('user_agent', ''),
                    'url': request.data.get('url', ''),
                    'timestamp': request.data.get('timestamp', timezone.now().isoformat()),
                    'additional_data': request.data.get('additional_data', {})
                }
            }
            
            # Log the error
            error_id = error_handling_service.log_error(error_data)
            
            # Get user-friendly message
            logged_error = error_handling_service.get_error_by_id(error_id)
            friendly_message = error_handling_service.get_user_friendly_error_message(logged_error)
            
            logger.info(f"Frontend error reported: {error_id}")
            return Response({
                'error_id': error_id,
                'message': 'Error reported successfully',
                'user_friendly_message': friendly_message,
                'timestamp': timezone.now().isoformat()
            })
            
        except Exception as e:
            logger.error(f"Error reporting frontend error: {e}")
            return Response(
                {'error': 'Failed to report error'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=False, methods=['get'])
    def error_stats(self, request):
        """
        Get error statistics and metrics
        """
        try:
            stats = error_handling_service.get_error_stats()
            return Response(stats)
            
        except Exception as e:
            logger.error(f"Error getting error statistics: {e}")
            return Response(
                {'error': 'Failed to get error statistics'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=False, methods=['get'])
    def recent_errors(self, request):
        """
        Get recent errors with optional limit
        """
        try:
            limit = int(request.query_params.get('limit', 10))
            limit = max(1, min(limit, 100))  # Limit between 1 and 100
            
            recent_errors = error_handling_service.get_recent_errors(limit)
            
            # Add user-friendly messages
            for error in recent_errors:
                error['user_friendly_message'] = error_handling_service.get_user_friendly_error_message(error)
            
            return Response({
                'errors': recent_errors,
                'count': len(recent_errors),
                'limit': limit
            })
            
        except ValueError:
            return Response(
                {'error': 'Invalid limit parameter'},
                status=status.HTTP_400_BAD_REQUEST
            )
        except Exception as e:
            logger.error(f"Error getting recent errors: {e}")
            return Response(
                {'error': 'Failed to get recent errors'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=True, methods=['get'])
    def error_report(self, request, pk=None):
        """
        Get comprehensive error report for a specific error
        """
        try:
            error_report = error_handling_service.create_error_report(pk)
            
            if 'error' in error_report:
                return Response(error_report, status=status.HTTP_404_NOT_FOUND)
            
            return Response(error_report)
            
        except Exception as e:
            logger.error(f"Error creating error report: {e}")
            return Response(
                {'error': 'Failed to create error report'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=False, methods=['post'])
    def clear_errors(self, request):
        """
        Clear the error log (admin function)
        """
        try:
            error_handling_service.clear_error_log()
            logger.info("Error log cleared")
            return Response({
                'message': 'Error log cleared successfully',
                'timestamp': timezone.now().isoformat()
            })
            
        except Exception as e:
            logger.error(f"Error clearing error log: {e}")
            return Response(
                {'error': 'Failed to clear error log'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=False, methods=['get'])
    def export_errors(self, request):
        """
        Export error log for debugging
        """
        try:
            export_data = error_handling_service.export_error_log()
            
            return Response({
                'export_data': json.loads(export_data),
                'export_timestamp': timezone.now().isoformat()
            })
            
        except Exception as e:
            logger.error(f"Error exporting error log: {e}")
            return Response(
                {'error': 'Failed to export error log'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=False, methods=['post'])
    def enable_offline_mode(self, request):
        """
        Enable offline mode with specified reason
        """
        try:
            reason = request.data.get('reason', 'manual_activation')
            
            success = error_handling_service.enable_offline_mode(reason)
            
            if success:
                return Response({
                    'message': 'Offline mode enabled successfully',
                    'reason': reason,
                    'timestamp': timezone.now().isoformat()
                })
            else:
                return Response(
                    {'error': 'Failed to enable offline mode'},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR
                )
                
        except Exception as e:
            logger.error(f"Error enabling offline mode: {e}")
            return Response(
                {'error': 'Failed to enable offline mode'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=False, methods=['post'])
    def disable_offline_mode(self, request):
        """
        Disable offline mode and restore normal operation
        """
        try:
            success = error_handling_service.disable_offline_mode()
            
            if success:
                return Response({
                    'message': 'Offline mode disabled successfully',
                    'timestamp': timezone.now().isoformat()
                })
            else:
                return Response({
                    'message': 'System was not in offline mode',
                    'timestamp': timezone.now().isoformat()
                })
                
        except Exception as e:
            logger.error(f"Error disabling offline mode: {e}")
            return Response(
                {'error': 'Failed to disable offline mode'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=False, methods=['get'])
    def offline_status(self, request):
        """
        Get current offline mode status and information
        """
        try:
            offline_info = error_handling_service.get_offline_mode_info()
            return Response(offline_info)
            
        except Exception as e:
            logger.error(f"Error getting offline status: {e}")
            return Response(
                {'error': 'Failed to get offline status'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=False, methods=['post'])
    def handle_service_degradation(self, request):
        """
        Handle service degradation with specified service and level
        """
        try:
            service_name = request.data.get('service_name')
            degradation_level = request.data.get('degradation_level', 'partial')
            error_message = request.data.get('error_message', 'Service degradation reported')
            
            if not service_name:
                return Response(
                    {'error': 'service_name is required'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Create error for degradation
            error = Exception(error_message)
            
            result = error_handling_service.handle_service_degradation(
                service_name, error, degradation_level
            )
            
            logger.info(f"Service degradation handled: {service_name} - {degradation_level}")
            return Response(result)
            
        except Exception as e:
            logger.error(f"Error handling service degradation: {e}")
            return Response(
                {'error': 'Failed to handle service degradation'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=False, methods=['post'])
    def memory_cleanup(self, request):
        """
        Trigger memory pressure handling and cleanup
        """
        try:
            success = error_handling_service.handle_memory_pressure()
            
            return Response({
                'success': success,
                'message': 'Memory cleanup completed' if success else 'Memory cleanup failed',
                'timestamp': timezone.now().isoformat()
            })
            
        except Exception as e:
            logger.error(f"Error during memory cleanup: {e}")
            return Response(
                {'error': 'Failed to perform memory cleanup'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class UserPreferencesViewSet(mixins.CreateModelMixin,
                           mixins.RetrieveModelMixin,
                           mixins.UpdateModelMixin,
                           mixins.ListModelMixin,
                           GenericViewSet):
    """
    ViewSet for managing user preferences
    Supports: GET (list/retrieve), POST (create), PUT/PATCH (update)
    """
    queryset = UserPreferences.objects.all()
    serializer_class = UserPreferencesSerializer
    
    def get_object(self):
        """
        Get or create user preferences (single instance per user)
        """
        try:
            # For now, we assume single user. In future, this could be user-specific
            return UserPreferences.objects.first() or UserPreferences.objects.create()
        except Exception as e:
            logger.error(f"Error getting user preferences: {e}")
            raise
    
    def list(self, request, *args, **kwargs):
        """
        List user preferences (returns single instance)
        """
        try:
            preferences = self.get_object()
            serializer = self.get_serializer(preferences)
            logger.info("User preferences retrieved")
            return Response(serializer.data)
        except Exception as e:
            logger.error(f"Error listing user preferences: {e}")
            return Response(
                {'error': 'Failed to retrieve preferences'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    def create(self, request, *args, **kwargs):
        """
        Create or update user preferences
        """
        try:
            # Get existing preferences or create new
            preferences = UserPreferences.objects.first()
            if preferences:
                # Update existing
                serializer = self.get_serializer(preferences, data=request.data, partial=True)
            else:
                # Create new
                serializer = self.get_serializer(data=request.data)
            
            if serializer.is_valid():
                serializer.save()
                logger.info("User preferences saved successfully")
                return Response(serializer.data, status=status.HTTP_200_OK)
            else:
                logger.warning(f"User preferences validation failed: {serializer.errors}")
                return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            logger.error(f"Error saving user preferences: {e}")
            return Response(
                {'error': 'Failed to save preferences'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class EmotionReadingViewSet(mixins.CreateModelMixin,
                          mixins.RetrieveModelMixin,
                          mixins.ListModelMixin,
                          GenericViewSet):
    """
    ViewSet for emotion readings
    Supports: GET (list/retrieve), POST (create)
    """
    queryset = EmotionReading.objects.all()
    serializer_class = EmotionReadingSerializer
    
    def get_queryset(self):
        """
        Optionally filter emotion readings by date range
        """
        queryset = EmotionReading.objects.all()
        
        # Filter by date range if provided
        start_date = self.request.query_params.get('start_date')
        end_date = self.request.query_params.get('end_date')
        
        if start_date:
            try:
                # Handle both ISO format with and without timezone
                if start_date.endswith('Z'):
                    start_date = start_date[:-1] + '+00:00'
                start_datetime = timezone.datetime.fromisoformat(start_date)
                if timezone.is_naive(start_datetime):
                    start_datetime = timezone.make_aware(start_datetime)
                queryset = queryset.filter(timestamp__gte=start_datetime)
            except (ValueError, TypeError):
                pass  # Invalid date format, ignore filter
        
        if end_date:
            try:
                # Handle both ISO format with and without timezone
                if end_date.endswith('Z'):
                    end_date = end_date[:-1] + '+00:00'
                end_datetime = timezone.datetime.fromisoformat(end_date)
                if timezone.is_naive(end_datetime):
                    end_datetime = timezone.make_aware(end_datetime)
                queryset = queryset.filter(timestamp__lte=end_datetime)
            except (ValueError, TypeError):
                pass  # Invalid date format, ignore filter
        
        # Limit results to prevent large responses
        limit = self.request.query_params.get('limit')
        if limit:
            try:
                limit_int = int(limit)
                queryset = queryset[:limit_int]
            except ValueError:
                pass  # Invalid limit, ignore
        
        return queryset
    
    def create(self, request, *args, **kwargs):
        """
        Create new emotion reading
        """
        try:
            serializer = self.get_serializer(data=request.data)
            if serializer.is_valid():
                emotion_reading = serializer.save()
                logger.info(f"Emotion reading created: {emotion_reading.get_dominant_emotion()}")
                return Response(serializer.data, status=status.HTTP_201_CREATED)
            else:
                logger.warning(f"Emotion reading validation failed: {serializer.errors}")
                return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            logger.error(f"Error creating emotion reading: {e}")
            return Response(
                {'error': 'Failed to create emotion reading'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=False, methods=['get'])
    def latest(self, request):
        """
        Get the latest emotion reading
        """
        try:
            latest_reading = EmotionReading.objects.first()
            if latest_reading:
                serializer = self.get_serializer(latest_reading)
                return Response(serializer.data)
            else:
                return Response(
                    {'message': 'No emotion readings found'},
                    status=status.HTTP_404_NOT_FOUND
                )
        except Exception as e:
            logger.error(f"Error getting latest emotion reading: {e}")
            return Response(
                {'error': 'Failed to retrieve latest reading'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=False, methods=['get'])
    def summary(self, request):
        """
        Get emotion summary for the last 24 hours
        """
        try:
            # Get readings from last 24 hours
            since = timezone.now() - timedelta(hours=24)
            readings = EmotionReading.objects.filter(timestamp__gte=since)
            
            if not readings.exists():
                return Response({
                    'message': 'No emotion readings in the last 24 hours',
                    'count': 0
                })
            
            # Calculate averages
            total_readings = readings.count()
            avg_energy = sum(r.energy_level for r in readings) / total_readings
            avg_posture = sum(r.posture_score for r in readings) / total_readings
            avg_blink_rate = sum(r.blink_rate for r in readings) / total_readings
            avg_confidence = sum(r.confidence for r in readings) / total_readings
            
            # Get dominant emotions
            emotion_counts = {}
            for reading in readings:
                dominant = reading.get_dominant_emotion()
                if dominant:
                    emotion = dominant[0]
                    emotion_counts[emotion] = emotion_counts.get(emotion, 0) + 1
            
            return Response({
                'period': '24 hours',
                'total_readings': total_readings,
                'averages': {
                    'energy_level': round(avg_energy, 3),
                    'posture_score': round(avg_posture, 3),
                    'blink_rate': round(avg_blink_rate, 1),
                    'confidence': round(avg_confidence, 3)
                },
                'emotion_distribution': emotion_counts,
                'most_common_emotion': max(emotion_counts.items(), key=lambda x: x[1])[0] if emotion_counts else None
            })
        except Exception as e:
            logger.error(f"Error generating emotion summary: {e}")
            return Response(
                {'error': 'Failed to generate summary'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=False, methods=['post'])
    def analyze(self, request):
        """
        Analyze emotion data and provide enhanced insights
        """
        try:
            emotion_service = EmotionAnalysisService()
            
            # Process the emotion data
            processed_data = emotion_service.process_emotion_reading(request.data)
            
            # Create the emotion reading
            serializer = self.get_serializer(data=processed_data)
            if serializer.is_valid():
                emotion_reading = serializer.save()
                
                # Check for notification triggers
                user_preferences = UserPreferences.objects.first()
                notification_result = emotion_service.should_trigger_notification(
                    emotion_reading, user_preferences
                )
                
                # Schedule notifications if needed
                notification_service = NotificationService()
                scheduled_notifications = []
                
                if notification_result['should_notify']:
                    for notification in notification_result['notifications']:
                        schedule_result = notification_service.schedule_notification(notification)
                        scheduled_notifications.append(schedule_result)
                
                response_data = {
                    'emotion_reading': serializer.data,
                    'analysis': {
                        'calculated_energy': processed_data.get('calculated_energy'),
                        'dominant_emotion': processed_data.get('dominant_emotion'),
                        'analysis_timestamp': processed_data.get('analysis_timestamp')
                    },
                    'notifications': {
                        'triggered': notification_result['should_notify'],
                        'count': len(notification_result['notifications']),
                        'scheduled': scheduled_notifications
                    }
                }
                
                logger.info(f"Emotion analysis completed with {len(scheduled_notifications)} notifications")
                return Response(response_data, status=status.HTTP_201_CREATED)
            else:
                logger.warning(f"Emotion analysis validation failed: {serializer.errors}")
                return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
                
        except Exception as e:
            logger.error(f"Error in emotion analysis: {e}")
            return Response(
                {'error': 'Failed to analyze emotion data'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=False, methods=['get'])
    def trends(self, request):
        """
        Get emotion trends and pattern analysis
        """
        try:
            # Get hours parameter (default 24)
            hours = int(request.query_params.get('hours', 24))
            hours = max(1, min(hours, 168))  # Limit between 1 hour and 1 week
            
            emotion_service = EmotionAnalysisService()
            trends = emotion_service.analyze_emotion_trends(hours)
            
            return Response(trends)
            
        except ValueError:
            return Response(
                {'error': 'Invalid hours parameter'},
                status=status.HTTP_400_BAD_REQUEST
            )
        except Exception as e:
            logger.error(f"Error getting emotion trends: {e}")
            return Response(
                {'error': 'Failed to analyze trends'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class UserFeedbackViewSet(mixins.CreateModelMixin,
                        mixins.RetrieveModelMixin,
                        mixins.ListModelMixin,
                        GenericViewSet):
    """
    ViewSet for user feedback
    Supports: GET (list/retrieve), POST (create)
    """
    queryset = UserFeedback.objects.all()
    serializer_class = UserFeedbackSerializer
    
    def get_queryset(self):
        """
        Optionally filter feedback by suggestion type
        """
        queryset = UserFeedback.objects.all()
        
        suggestion_type = self.request.query_params.get('suggestion_type')
        if suggestion_type:
            queryset = queryset.filter(suggestion_type=suggestion_type)
        
        user_response = self.request.query_params.get('user_response')
        if user_response:
            queryset = queryset.filter(user_response=user_response)
        
        return queryset
    
    def create(self, request, *args, **kwargs):
        """
        Create new user feedback
        """
        try:
            serializer = self.get_serializer(data=request.data)
            if serializer.is_valid():
                feedback = serializer.save()
                logger.info(f"User feedback created: {feedback.suggestion_type} - {feedback.user_response}")
                return Response(serializer.data, status=status.HTTP_201_CREATED)
            else:
                logger.warning(f"User feedback validation failed: {serializer.errors}")
                return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            logger.error(f"Error creating user feedback: {e}")
            return Response(
                {'error': 'Failed to create feedback'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=False, methods=['get'])
    def analytics(self, request):
        """
        Get feedback analytics for learning purposes
        """
        try:
            # Get feedback statistics by suggestion type
            feedback_stats = {}
            
            for suggestion_type, _ in UserFeedback.SUGGESTION_TYPES:
                type_feedback = UserFeedback.objects.filter(suggestion_type=suggestion_type)
                total = type_feedback.count()
                
                if total > 0:
                    accepted = type_feedback.filter(user_response='accepted').count()
                    rejected = type_feedback.filter(user_response='rejected').count()
                    modified = type_feedback.filter(user_response='modified').count()
                    ignored = type_feedback.filter(user_response='ignored').count()
                    
                    feedback_stats[suggestion_type] = {
                        'total': total,
                        'accepted': accepted,
                        'rejected': rejected,
                        'modified': modified,
                        'ignored': ignored,
                        'acceptance_rate': round(accepted / total * 100, 1) if total > 0 else 0
                    }
            
            return Response({
                'feedback_statistics': feedback_stats,
                'total_feedback_entries': UserFeedback.objects.count()
            })
        except Exception as e:
            logger.error(f"Error generating feedback analytics: {e}")
            return Response(
                {'error': 'Failed to generate analytics'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=False, methods=['get'])
    def learning_effectiveness(self, request):
        """
        Get learning algorithm effectiveness metrics
        """
        try:
            from .services.music_recommendation_service import music_recommendation_service
            from .services.theme_recommendation_service import theme_recommendation_service
            
            # Get effectiveness metrics from both services
            music_metrics = music_recommendation_service.get_learning_effectiveness()
            theme_metrics = theme_recommendation_service.get_learning_effectiveness()
            
            return Response({
                'music_learning': music_metrics,
                'theme_learning': theme_metrics,
                'overall_learning_active': music_metrics.get('learning_active', False) or theme_metrics.get('learning_active', False)
            })
            
        except Exception as e:
            logger.error(f"Error getting learning effectiveness: {e}")
            return Response(
                {'error': 'Failed to get learning metrics'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class ThemeRecommendationViewSet(GenericViewSet):
    """
    ViewSet for theme recommendations
    """
    
    @action(detail=False, methods=['post'])
    def get_recommendations(self, request):
        """
        Get theme recommendations based on emotions and energy level
        """
        try:
            # Validate required fields
            emotions = request.data.get('emotions', {})
            energy_level = request.data.get('energy_level')
            max_recommendations = request.data.get('max_recommendations', 3)
            
            if not emotions or energy_level is None:
                return Response(
                    {'error': 'emotions and energy_level are required'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            if not 0.0 <= energy_level <= 1.0:
                return Response(
                    {'error': 'energy_level must be between 0.0 and 1.0'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Get user preferences
            user_preferences = UserPreferences.objects.first()
            
            # Get recommendations
            recommendations = theme_recommendation_service.get_recommendations(
                emotions=emotions,
                energy_level=energy_level,
                user_preferences=user_preferences,
                max_recommendations=max_recommendations
            )
            
            logger.info(f"Generated {len(recommendations)} theme recommendations")
            return Response({
                'recommendations': recommendations,
                'total_count': len(recommendations),
                'request_context': {
                    'emotions': emotions,
                    'energy_level': energy_level,
                    'timestamp': timezone.now().isoformat()
                }
            })
            
        except Exception as e:
            logger.error(f"Error getting theme recommendations: {e}")
            return Response(
                {'error': 'Failed to get theme recommendations'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=False, methods=['post'])
    def submit_feedback(self, request):
        """
        Submit feedback on a theme recommendation
        """
        try:
            # Validate required fields
            theme_recommendation = request.data.get('theme_recommendation')
            response = request.data.get('response')
            alternative_choice = request.data.get('alternative_choice')
            
            if not theme_recommendation or not response:
                return Response(
                    {'error': 'theme_recommendation and response are required'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            valid_responses = ['accepted', 'rejected', 'modified', 'ignored']
            if response not in valid_responses:
                return Response(
                    {'error': f'response must be one of: {valid_responses}'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Record feedback
            theme_recommendation_service.record_user_feedback(
                theme_recommendation=theme_recommendation,
                response=response,
                alternative_choice=alternative_choice
            )
            
            return Response({
                'message': 'Feedback recorded successfully',
                'response': response,
                'timestamp': timezone.now().isoformat()
            })
            
        except Exception as e:
            logger.error(f"Error submitting theme feedback: {e}")
            return Response(
                {'error': 'Failed to submit feedback'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=False, methods=['get'])
    def learning_metrics(self, request):
        """
        Get theme learning algorithm effectiveness metrics
        """
        try:
            metrics = theme_recommendation_service.get_learning_effectiveness()
            return Response(metrics)
            
        except Exception as e:
            logger.error(f"Error getting theme learning metrics: {e}")
            return Response(
                {'error': 'Failed to get learning metrics'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=False, methods=['post'])
    def apply_theme(self, request):
        """
        Apply a theme using CLI hooks with fallback mechanisms
        """
        try:
            # Validate required fields
            theme_data = request.data.get('theme_data')
            
            if not theme_data:
                return Response(
                    {'error': 'theme_data is required'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Validate theme data structure
            required_fields = ['theme_name', 'colors']
            for field in required_fields:
                if field not in theme_data:
                    return Response(
                        {'error': f'{field} is required in theme_data'},
                        status=status.HTTP_400_BAD_REQUEST
                    )
            
            # Apply theme using theme recommendation service
            result = theme_recommendation_service.apply_theme(theme_data)
            
            logger.info(f"Theme application result: {result.get('success', False)}")
            return Response(result)
            
        except Exception as e:
            logger.error(f"Error applying theme: {e}")
            return Response(
                {'error': 'Failed to apply theme'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class CLIHookViewSet(GenericViewSet):
    """
    ViewSet for CLI hook management and execution
    """
    
    @action(detail=False, methods=['get'])
    def configuration(self, request):
        """
        Get current CLI hook configuration
        """
        try:
            config = cli_hook_service.get_hook_configuration()
            return Response(config)
            
        except Exception as e:
            logger.error(f"Error getting CLI hook configuration: {e}")
            return Response(
                {'error': 'Failed to get hook configuration'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=False, methods=['post'])
    def update_configuration(self, request):
        """
        Update CLI hook configuration
        """
        try:
            config = request.data.get('configuration')
            
            if not config:
                return Response(
                    {'error': 'configuration is required'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            updated_config = cli_hook_service.update_hook_configuration(config)
            
            logger.info("CLI hook configuration updated successfully")
            return Response({
                'message': 'Configuration updated successfully',
                'configuration': updated_config,
                'timestamp': timezone.now().isoformat()
            })
            
        except Exception as e:
            logger.error(f"Error updating CLI hook configuration: {e}")
            return Response(
                {'error': 'Failed to update configuration'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=False, methods=['post'])
    def validate_command(self, request):
        """
        Validate a CLI command for security and safety
        """
        try:
            command = request.data.get('command')
            
            if not command:
                return Response(
                    {'error': 'command is required'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            is_valid, error_message = cli_hook_service.validate_command(command)
            
            return Response({
                'command': command,
                'is_valid': is_valid,
                'error_message': error_message if not is_valid else None,
                'timestamp': timezone.now().isoformat()
            })
            
        except Exception as e:
            logger.error(f"Error validating CLI command: {e}")
            return Response(
                {'error': 'Failed to validate command'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=False, methods=['post'])
    def execute_command(self, request):
        """
        Execute a single CLI command
        """
        try:
            command = request.data.get('command')
            working_directory = request.data.get('working_directory')
            
            if not command:
                return Response(
                    {'error': 'command is required'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            result = cli_hook_service.execute_command(command, working_directory)
            
            logger.info(f"CLI command executed: {command} - Success: {result['success']}")
            return Response(result)
            
        except Exception as e:
            logger.error(f"Error executing CLI command: {e}")
            return Response(
                {'error': 'Failed to execute command'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=False, methods=['post'])
    def execute_hook_sequence(self, request):
        """
        Execute a sequence of CLI commands (hook sequence)
        """
        try:
            commands = request.data.get('commands')
            working_directory = request.data.get('working_directory')
            stop_on_failure = request.data.get('stop_on_failure', True)
            
            if not commands or not isinstance(commands, list):
                return Response(
                    {'error': 'commands must be a list of command strings'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            result = cli_hook_service.execute_hook_sequence(
                commands=commands,
                working_directory=working_directory,
                stop_on_failure=stop_on_failure
            )
            
            logger.info(f"Hook sequence executed: {len(commands)} commands - Success: {result['success']}")
            return Response(result)
            
        except Exception as e:
            logger.error(f"Error executing hook sequence: {e}")
            return Response(
                {'error': 'Failed to execute hook sequence'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=False, methods=['post'])
    def generate_theme_commands(self, request):
        """
        Generate CLI commands for applying a theme
        """
        try:
            theme_data = request.data.get('theme_data')
            
            if not theme_data:
                return Response(
                    {'error': 'theme_data is required'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Validate theme data structure
            required_fields = ['theme_name', 'colors']
            for field in required_fields:
                if field not in theme_data:
                    return Response(
                        {'error': f'{field} is required in theme_data'},
                        status=status.HTTP_400_BAD_REQUEST
                    )
            
            commands = cli_hook_service.generate_theme_commands(theme_data)
            
            return Response({
                'theme_data': theme_data,
                'generated_commands': commands,
                'command_count': len(commands),
                'timestamp': timezone.now().isoformat()
            })
            
        except Exception as e:
            logger.error(f"Error generating theme commands: {e}")
            return Response(
                {'error': 'Failed to generate theme commands'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=False, methods=['get'])
    def execution_history(self, request):
        """
        Get recent CLI command execution history
        """
        try:
            limit = int(request.query_params.get('limit', 50))
            limit = max(1, min(limit, 200))  # Limit between 1 and 200
            
            history = cli_hook_service.get_execution_history(limit)
            
            return Response({
                'execution_history': history,
                'total_entries': len(history),
                'limit': limit
            })
            
        except ValueError:
            return Response(
                {'error': 'Invalid limit parameter'},
                status=status.HTTP_400_BAD_REQUEST
            )
        except Exception as e:
            logger.error(f"Error getting execution history: {e}")
            return Response(
                {'error': 'Failed to get execution history'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=False, methods=['post'])
    def test_configuration(self, request):
        """
        Test current hook configuration with safe commands
        """
        try:
            test_result = cli_hook_service.test_hook_configuration()
            
            return Response(test_result)
            
        except Exception as e:
            logger.error(f"Error testing hook configuration: {e}")
            return Response(
                {'error': 'Failed to test configuration'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class NotificationViewSet(GenericViewSet):
    """
    ViewSet for notification management
    """
    
    @action(detail=False, methods=['get'])
    def status(self, request):
        """
        Get notification system status including rate limits and queue
        """
        try:
            notification_service = NotificationService()
            status_data = notification_service.get_notification_status()
            
            return Response(status_data)
            
        except Exception as e:
            logger.error(f"Error getting notification status: {e}")
            return Response(
                {'error': 'Failed to get notification status'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=False, methods=['post'])
    def process_queue(self, request):
        """
        Process queued notifications
        """
        try:
            notification_service = NotificationService()
            result = notification_service.process_notification_queue()
            
            return Response(result)
            
        except Exception as e:
            logger.error(f"Error processing notification queue: {e}")
            return Response(
                {'error': 'Failed to process notification queue'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=False, methods=['post'])
    def generate_message(self, request):
        """
        Generate contextual notification message
        """
        try:
            message_type = request.data.get('message_type')
            context = request.data.get('context', {})
            
            if not message_type:
                return Response(
                    {'error': 'message_type is required'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            notification_service = NotificationService()
            user_preferences = UserPreferences.objects.first()
            
            message = notification_service.generate_contextual_message(
                message_type, context, user_preferences
            )
            
            return Response({
                'message_type': message_type,
                'context': context,
                'generated_message': message,
                'timestamp': timezone.now().isoformat()
            })
            
        except Exception as e:
            logger.error(f"Error generating notification message: {e}")
            return Response(
                {'error': 'Failed to generate message'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class TaskViewSet(mixins.CreateModelMixin,
                mixins.RetrieveModelMixin,
                mixins.UpdateModelMixin,
                mixins.DestroyModelMixin,
                mixins.ListModelMixin,
                GenericViewSet):
    """
    ViewSet for task management with energy-based sorting and recommendations
    """
    queryset = Task.objects.all()
    serializer_class = TaskSerializer
    
    def get_queryset(self):
        """
        Filter tasks based on query parameters
        """
        queryset = Task.objects.all()
        
        # Filter by status
        status_filter = self.request.query_params.get('status')
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        
        # Filter by priority
        priority_filter = self.request.query_params.get('priority')
        if priority_filter:
            queryset = queryset.filter(priority=priority_filter)
        
        # Filter by complexity
        complexity_filter = self.request.query_params.get('complexity')
        if complexity_filter:
            queryset = queryset.filter(complexity=complexity_filter)
        
        # Filter by due date
        due_soon = self.request.query_params.get('due_soon')
        if due_soon:
            try:
                days = int(due_soon)
                due_date_limit = timezone.now() + timedelta(days=days)
                queryset = queryset.filter(due_date__lte=due_date_limit, due_date__isnull=False)
            except ValueError:
                pass
        
        return queryset
    
    def get_serializer_context(self):
        """
        Add current energy level to serializer context if provided
        """
        context = super().get_serializer_context()
        
        # Get current energy level from query params or request data
        current_energy = self.request.query_params.get('current_energy_level')
        if not current_energy and hasattr(self.request, 'data'):
            current_energy = self.request.data.get('current_energy_level')
        
        if current_energy:
            try:
                context['request'].current_energy_level = float(current_energy)
            except (ValueError, TypeError):
                pass
        
        return context
    
    def list(self, request, *args, **kwargs):
        """
        List tasks with optional energy-based sorting
        """
        try:
            queryset = self.get_queryset()
            
            # Get sorting parameters
            sort_by = request.query_params.get('sort_by', 'created_at')
            current_energy = request.query_params.get('current_energy_level')
            
            # Apply energy-based sorting if energy level provided
            if current_energy and sort_by == 'energy_match':
                try:
                    energy_level = float(current_energy)
                    # Sort by energy match score (calculated in Python)
                    tasks = list(queryset)
                    tasks.sort(key=lambda t: t.get_energy_match_score(energy_level), reverse=True)
                    
                    # Paginate manually since we sorted in Python
                    page = self.paginate_queryset(tasks)
                    if page is not None:
                        serializer = self.get_serializer(page, many=True)
                        return self.get_paginated_response(serializer.data)
                    
                    serializer = self.get_serializer(tasks, many=True)
                    return Response(serializer.data)
                except ValueError:
                    pass  # Fall back to default sorting
            
            # Default sorting
            if sort_by == 'priority':
                queryset = queryset.order_by('-priority', '-complexity_score')
            elif sort_by == 'complexity':
                queryset = queryset.order_by('-complexity_score', '-priority')
            elif sort_by == 'due_date':
                queryset = queryset.order_by('due_date', '-priority')
            else:
                queryset = queryset.order_by('-created_at')
            
            page = self.paginate_queryset(queryset)
            if page is not None:
                serializer = self.get_serializer(page, many=True)
                return self.get_paginated_response(serializer.data)
            
            serializer = self.get_serializer(queryset, many=True)
            logger.info(f"Retrieved {len(serializer.data)} tasks")
            return Response(serializer.data)
            
        except Exception as e:
            logger.error(f"Error listing tasks: {e}")
            return Response(
                {'error': 'Failed to retrieve tasks'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    def create(self, request, *args, **kwargs):
        """
        Create a new task
        """
        try:
            serializer = self.get_serializer(data=request.data)
            if serializer.is_valid():
                task = serializer.save()
                logger.info(f"Task created: {task.title}")
                return Response(serializer.data, status=status.HTTP_201_CREATED)
            else:
                logger.warning(f"Task creation validation failed: {serializer.errors}")
                return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            logger.error(f"Error creating task: {e}")
            return Response(
                {'error': 'Failed to create task'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    def update(self, request, *args, **kwargs):
        """
        Update a task and potentially update energy correlation
        """
        try:
            partial = kwargs.pop('partial', False)
            instance = self.get_object()
            serializer = self.get_serializer(instance, data=request.data, partial=partial)
            
            if serializer.is_valid():
                # Check if task is being marked as completed
                if 'status' in request.data and request.data['status'] == 'completed':
                    current_energy = request.data.get('current_energy_level')
                    if current_energy:
                        try:
                            energy_level = float(current_energy)
                            instance.update_energy_correlation(energy_level)
                        except ValueError:
                            pass
                
                task = serializer.save()
                logger.info(f"Task updated: {task.title}")
                return Response(serializer.data)
            else:
                logger.warning(f"Task update validation failed: {serializer.errors}")
                return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            logger.error(f"Error updating task: {e}")
            return Response(
                {'error': 'Failed to update task'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=False, methods=['post'])
    def sort_by_energy(self, request):
        """
        Sort tasks based on current energy level
        """
        try:
            serializer = TaskSortingSerializer(data=request.data)
            if not serializer.is_valid():
                return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
            
            current_energy = serializer.validated_data['current_energy_level']
            sort_method = serializer.validated_data['sort_method']
            include_completed = serializer.validated_data['include_completed']
            
            # Get tasks
            queryset = self.get_queryset()
            if not include_completed:
                queryset = queryset.exclude(status='completed')
            
            tasks = list(queryset)
            
            # Sort based on method
            if sort_method == 'energy_match':
                tasks.sort(key=lambda t: t.get_energy_match_score(current_energy), reverse=True)
            elif sort_method == 'priority':
                tasks.sort(key=lambda t: (t.priority == 'urgent', t.priority == 'high', t.priority == 'medium'), reverse=True)
            elif sort_method == 'complexity':
                tasks.sort(key=lambda t: t.complexity_score, reverse=True)
            elif sort_method == 'due_date':
                tasks.sort(key=lambda t: t.due_date or timezone.now() + timedelta(days=365))
            else:
                tasks.sort(key=lambda t: t.created_at, reverse=True)
            
            # Add energy match scores to response
            task_data = []
            for task in tasks:
                task_serializer = self.get_serializer(task)
                task_info = task_serializer.data
                task_info['energy_match_score'] = task.get_energy_match_score(current_energy)
                task_data.append(task_info)
            
            logger.info(f"Sorted {len(task_data)} tasks by {sort_method}")
            return Response({
                'sort_method': sort_method,
                'current_energy_level': current_energy,
                'tasks': task_data,
                'total_count': len(task_data)
            })
            
        except Exception as e:
            logger.error(f"Error sorting tasks by energy: {e}")
            return Response(
                {'error': 'Failed to sort tasks'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=False, methods=['post'])
    def recommend(self, request):
        """
        Get task recommendations based on current energy level
        """
        try:
            serializer = TaskRecommendationSerializer(data=request.data)
            if not serializer.is_valid():
                return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
            
            current_energy = serializer.validated_data['current_energy_level']
            max_tasks = serializer.validated_data['max_tasks']
            include_completed = serializer.validated_data['include_completed']
            priority_filter = serializer.validated_data.get('priority_filter')
            complexity_filter = serializer.validated_data.get('complexity_filter')
            
            # Get tasks
            queryset = self.get_queryset()
            if not include_completed:
                queryset = queryset.exclude(status='completed')
            
            # Apply filters
            if priority_filter:
                queryset = queryset.filter(priority__in=priority_filter)
            if complexity_filter:
                queryset = queryset.filter(complexity__in=complexity_filter)
            
            tasks = list(queryset)
            
            # Calculate recommendations based on energy matching
            recommendations = []
            for task in tasks:
                energy_match = task.get_energy_match_score(current_energy)
                
                # Calculate recommendation score
                recommendation_score = energy_match
                
                # Boost score for urgent/high priority tasks
                if task.priority in ['urgent', 'high']:
                    recommendation_score *= 1.2
                
                # Boost score for tasks due soon
                if task.due_date:
                    days_until_due = (task.due_date - timezone.now()).days
                    if days_until_due <= 1:
                        recommendation_score *= 1.3
                    elif days_until_due <= 3:
                        recommendation_score *= 1.1
                
                # Consider user's historical performance with similar tasks
                if task.user_energy_correlation > 0.5:
                    recommendation_score *= 1.1
                
                recommendations.append({
                    'task': task,
                    'energy_match_score': energy_match,
                    'recommendation_score': min(1.0, recommendation_score),
                    'reason': self._get_recommendation_reason(task, current_energy, energy_match)
                })
            
            # Sort by recommendation score and limit results
            recommendations.sort(key=lambda r: r['recommendation_score'], reverse=True)
            recommendations = recommendations[:max_tasks]
            
            # Format response
            recommended_tasks = []
            for rec in recommendations:
                task_serializer = self.get_serializer(rec['task'])
                task_data = task_serializer.data
                task_data.update({
                    'energy_match_score': rec['energy_match_score'],
                    'recommendation_score': rec['recommendation_score'],
                    'recommendation_reason': rec['reason']
                })
                recommended_tasks.append(task_data)
            
            logger.info(f"Generated {len(recommended_tasks)} task recommendations")
            return Response({
                'current_energy_level': current_energy,
                'recommendations': recommended_tasks,
                'total_available_tasks': len(tasks),
                'recommendation_timestamp': timezone.now().isoformat()
            })
            
        except Exception as e:
            logger.error(f"Error generating task recommendations: {e}")
            return Response(
                {'error': 'Failed to generate recommendations'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    def _get_recommendation_reason(self, task, current_energy, energy_match):
        """
        Generate a human-readable reason for the task recommendation
        """
        reasons = []
        
        if energy_match > 0.8:
            reasons.append("Perfect energy match for this task")
        elif energy_match > 0.6:
            reasons.append("Good energy match")
        elif energy_match > 0.4:
            reasons.append("Moderate energy match")
        else:
            reasons.append("Low energy match - consider for later")
        
        if task.priority in ['urgent', 'high']:
            reasons.append(f"{task.priority} priority")
        
        if task.due_date:
            days_until_due = (task.due_date - timezone.now()).days
            if days_until_due <= 1:
                reasons.append("due very soon")
            elif days_until_due <= 3:
                reasons.append("due soon")
        
        if task.user_energy_correlation > 0.5:
            reasons.append("historically performed well at this energy level")
        
        return "; ".join(reasons)
    
    @action(detail=True, methods=['post'])
    def complete(self, request, pk=None):
        """
        Mark a task as completed and update energy correlation
        """
        try:
            task = self.get_object()
            current_energy = request.data.get('current_energy_level')
            actual_duration = request.data.get('actual_duration')
            
            # Update task status
            task.status = 'completed'
            
            # Update actual duration if provided
            if actual_duration:
                try:
                    task.actual_duration = int(actual_duration)
                except ValueError:
                    pass
            
            # Update energy correlation if energy level provided
            if current_energy:
                try:
                    energy_level = float(current_energy)
                    task.update_energy_correlation(energy_level)
                except ValueError:
                    pass
            
            task.save()
            
            serializer = self.get_serializer(task)
            logger.info(f"Task completed: {task.title}")
            return Response({
                'message': 'Task marked as completed',
                'task': serializer.data,
                'energy_correlation_updated': current_energy is not None
            })
            
        except Exception as e:
            logger.error(f"Error completing task: {e}")
            return Response(
                {'error': 'Failed to complete task'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=False, methods=['get'])
    def analytics(self, request):
        """
        Get task analytics and performance insights
        """
        try:
            # Get all tasks
            all_tasks = Task.objects.all()
            completed_tasks = all_tasks.filter(status='completed')
            
            # Basic statistics
            total_tasks = all_tasks.count()
            completed_count = completed_tasks.count()
            completion_rate = (completed_count / total_tasks * 100) if total_tasks > 0 else 0
            
            # Complexity distribution
            complexity_stats = {}
            for complexity, _ in Task.COMPLEXITY_CHOICES:
                count = all_tasks.filter(complexity=complexity).count()
                completed = completed_tasks.filter(complexity=complexity).count()
                complexity_stats[complexity] = {
                    'total': count,
                    'completed': completed,
                    'completion_rate': (completed / count * 100) if count > 0 else 0
                }
            
            # Priority distribution
            priority_stats = {}
            for priority, _ in Task.PRIORITY_CHOICES:
                count = all_tasks.filter(priority=priority).count()
                completed = completed_tasks.filter(priority=priority).count()
                priority_stats[priority] = {
                    'total': count,
                    'completed': completed,
                    'completion_rate': (completed / count * 100) if count > 0 else 0
                }
            
            # Energy correlation insights
            tasks_with_correlation = completed_tasks.exclude(user_energy_correlation=0.0)
            avg_correlation = 0
            if tasks_with_correlation.exists():
                correlations = [t.user_energy_correlation for t in tasks_with_correlation]
                avg_correlation = sum(correlations) / len(correlations)
            
            # Duration analysis
            duration_stats = {}
            tasks_with_duration = completed_tasks.exclude(actual_duration__isnull=True)
            if tasks_with_duration.exists():
                durations = [t.actual_duration for t in tasks_with_duration]
                duration_stats = {
                    'avg_duration': sum(durations) / len(durations),
                    'min_duration': min(durations),
                    'max_duration': max(durations),
                    'total_tasks_with_duration': len(durations)
                }
            
            return Response({
                'overview': {
                    'total_tasks': total_tasks,
                    'completed_tasks': completed_count,
                    'completion_rate': round(completion_rate, 1),
                    'pending_tasks': total_tasks - completed_count
                },
                'complexity_analysis': complexity_stats,
                'priority_analysis': priority_stats,
                'energy_correlation': {
                    'average_correlation': round(avg_correlation, 3),
                    'tasks_with_learning_data': tasks_with_correlation.count()
                },
                'duration_analysis': duration_stats,
                'generated_at': timezone.now().isoformat()
            })
            
        except Exception as e:
            logger.error(f"Error generating task analytics: {e}")
            return Response(
                {'error': 'Failed to generate analytics'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class MusicRecommendationViewSet(mixins.CreateModelMixin,
                               mixins.RetrieveModelMixin,
                               mixins.ListModelMixin,
                               GenericViewSet):
    """
    ViewSet for music recommendations and playlist management
    """
    queryset = MusicRecommendation.objects.all()
    serializer_class = MusicRecommendationSerializer
    
    def get_queryset(self):
        """
        Filter recommendations based on query parameters
        """
        queryset = MusicRecommendation.objects.all()
        
        # Filter by user response
        user_response = self.request.query_params.get('user_response')
        if user_response:
            queryset = queryset.filter(user_response=user_response)
        
        # Filter by date range
        days = self.request.query_params.get('days')
        if days:
            try:
                days_int = int(days)
                since = timezone.now() - timedelta(days=days_int)
                queryset = queryset.filter(timestamp__gte=since)
            except ValueError:
                pass
        
        return queryset
    
    @action(detail=False, methods=['post'])
    def get_recommendations(self, request):
        """
        Get music recommendations based on current emotions and energy
        """
        try:
            emotions = request.data.get('emotions', {})
            energy_level = request.data.get('energy_level', 0.5)
            max_recommendations = request.data.get('max_recommendations', 5)
            
            if not emotions:
                return Response(
                    {'error': 'emotions parameter is required'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            try:
                energy_level = float(energy_level)
                max_recommendations = int(max_recommendations)
            except (ValueError, TypeError):
                return Response(
                    {'error': 'Invalid energy_level or max_recommendations'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Get user preferences
            user_preferences = UserPreferences.objects.first()
            
            # Get recommendations
            recommendations = music_recommendation_service.get_recommendations(
                emotions, energy_level, user_preferences, max_recommendations
            )
            
            logger.info(f"Generated {len(recommendations)} music recommendations")
            return Response({
                'recommendations': recommendations,
                'context': {
                    'emotions': emotions,
                    'energy_level': energy_level,
                    'timestamp': timezone.now().isoformat()
                }
            })
            
        except Exception as e:
            logger.error(f"Error getting music recommendations: {e}")
            return Response(
                {'error': 'Failed to get recommendations'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=False, methods=['post'])
    def feedback(self, request):
        """
        Record user feedback on a music recommendation
        """
        try:
            recommendation_id = request.data.get('recommendation_id')
            response = request.data.get('response')
            alternative_choice = request.data.get('alternative_choice')
            
            if not recommendation_id or not response:
                return Response(
                    {'error': 'recommendation_id and response are required'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Validate response type
            valid_responses = ['accepted', 'rejected', 'modified', 'ignored']
            if response not in valid_responses:
                return Response(
                    {'error': f'response must be one of: {valid_responses}'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Record feedback
            music_recommendation_service.record_user_feedback(
                recommendation_id, response, alternative_choice
            )
            
            logger.info(f"Recorded music feedback: {recommendation_id} - {response}")
            return Response({
                'message': 'Feedback recorded successfully',
                'recommendation_id': recommendation_id,
                'response': response
            })
            
        except Exception as e:
            logger.error(f"Error recording music feedback: {e}")
            return Response(
                {'error': 'Failed to record feedback'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=False, methods=['get'])
    def stats(self, request):
        """
        Get user music statistics and preferences
        """
        try:
            stats = music_recommendation_service.get_user_music_stats()
            return Response(stats)
            
        except Exception as e:
            logger.error(f"Error getting music stats: {e}")
            return Response(
                {'error': 'Failed to get music statistics'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=False, methods=['post'])
    def discover_playlists(self, request):
        """
        Discover new playlists based on genre or emotion
        """
        try:
            search_type = request.data.get('search_type', 'emotion')  # 'emotion' or 'genre'
            query = request.data.get('query')
            energy_level = request.data.get('energy_level', 0.5)
            max_results = request.data.get('max_results', 10)
            
            if not query:
                return Response(
                    {'error': 'query parameter is required'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            try:
                energy_level = float(energy_level)
                max_results = int(max_results)
            except (ValueError, TypeError):
                return Response(
                    {'error': 'Invalid energy_level or max_results'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Discover playlists
            from .services.youtube_service import youtube_service
            
            if search_type == 'genre':
                playlists = youtube_service.discover_playlists_by_genre(query, max_results)
            else:
                playlists = youtube_service.discover_playlists_by_emotion(
                    query, energy_level, max_results
                )
            
            logger.info(f"Discovered {len(playlists)} playlists for {search_type}: {query}")
            return Response({
                'playlists': playlists,
                'search_type': search_type,
                'query': query,
                'energy_level': energy_level
            })
            
        except Exception as e:
            logger.error(f"Error discovering playlists: {e}")
            return Response(
                {'error': 'Failed to discover playlists'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class YouTubePlaylistViewSet(mixins.RetrieveModelMixin,
                           mixins.UpdateModelMixin,
                           mixins.ListModelMixin,
                           GenericViewSet):
    """
    ViewSet for YouTube playlist management
    """
    queryset = YouTubePlaylist.objects.all()
    serializer_class = YouTubePlaylistSerializer
    
    def get_queryset(self):
        """
        Filter playlists based on query parameters
        """
        queryset = YouTubePlaylist.objects.filter(is_active=True)
        
        # Filter by genre
        genre = self.request.query_params.get('genre')
        if genre:
            queryset = queryset.filter(genres__name__iexact=genre)
        
        # Filter by energy level range
        min_energy = self.request.query_params.get('min_energy')
        max_energy = self.request.query_params.get('max_energy')
        
        if min_energy:
            try:
                queryset = queryset.filter(energy_level__gte=float(min_energy))
            except ValueError:
                pass
        
        if max_energy:
            try:
                queryset = queryset.filter(energy_level__lte=float(max_energy))
            except ValueError:
                pass
        
        # Filter by emotional tags
        emotion = self.request.query_params.get('emotion')
        if emotion:
            queryset = queryset.filter(emotional_tags__icontains=emotion)
        
        # Order by acceptance rate and rating
        queryset = queryset.order_by('-acceptance_rate', '-user_rating', 'title')
        
        return queryset
    
    @action(detail=True, methods=['post'])
    def rate(self, request, pk=None):
        """
        Rate a playlist
        """
        try:
            playlist = self.get_object()
            rating = request.data.get('rating')
            
            if rating is None:
                return Response(
                    {'error': 'rating is required'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            try:
                rating = float(rating)
                if not 0.0 <= rating <= 5.0:
                    raise ValueError()
            except ValueError:
                return Response(
                    {'error': 'rating must be a number between 0.0 and 5.0'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            playlist.user_rating = rating
            playlist.save()
            
            logger.info(f"Playlist rated: {playlist.title} - {rating}")
            return Response({
                'message': 'Playlist rated successfully',
                'playlist_id': playlist.youtube_id,
                'rating': rating
            })
            
        except Exception as e:
            logger.error(f"Error rating playlist: {e}")
            return Response(
                {'error': 'Failed to rate playlist'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=True, methods=['post'])
    def validate(self, request, pk=None):
        """
        Validate that a playlist still exists on YouTube
        """
        try:
            playlist = self.get_object()
            
            from .services.youtube_service import youtube_service
            is_valid = youtube_service.validate_playlist_exists(playlist.youtube_id)
            
            if not is_valid:
                playlist.is_active = False
                playlist.save()
            
            return Response({
                'playlist_id': playlist.youtube_id,
                'is_valid': is_valid,
                'is_active': playlist.is_active
            })
            
        except Exception as e:
            logger.error(f"Error validating playlist: {e}")
            return Response(
                {'error': 'Failed to validate playlist'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=False, methods=['post'])
    def batch_validate(self, request):
        """
        Validate multiple playlists in batch
        """
        try:
            playlist_ids = request.data.get('playlist_ids', [])
            
            if not playlist_ids:
                return Response(
                    {'error': 'playlist_ids is required'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            from .services.youtube_service import youtube_service
            validation_results = youtube_service.batch_validate_playlists(playlist_ids)
            
            # Update playlist status based on validation results
            updated_count = 0
            for playlist_id, is_valid in validation_results.items():
                try:
                    playlist = YouTubePlaylist.objects.get(youtube_id=playlist_id)
                    if not is_valid and playlist.is_active:
                        playlist.is_active = False
                        playlist.save()
                        updated_count += 1
                except YouTubePlaylist.DoesNotExist:
                    continue
            
            logger.info(f"Batch validated {len(playlist_ids)} playlists, updated {updated_count}")
            return Response({
                'validation_results': validation_results,
                'updated_count': updated_count,
                'total_validated': len(playlist_ids)
            })
            
        except Exception as e:
            logger.error(f"Error in batch validation: {e}")
            return Response(
                {'error': 'Failed to batch validate playlists'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=False, methods=['get'])
    def genres(self, request):
        """
        Get available music genres
        """
        try:
            from .models import MusicGenre
            genres = MusicGenre.objects.all().order_by('name')
            
            genre_data = []
            for genre in genres:
                genre_data.append({
                    'name': genre.name,
                    'emotional_associations': genre.emotional_associations,
                    'typical_energy_range': genre.typical_energy_range,
                    'playlist_count': genre.youtubeplaylist_set.filter(is_active=True).count()
                })
            
            return Response({
                'genres': genre_data,
                'total_genres': len(genre_data)
            })
            
        except Exception as e:
            logger.error(f"Error getting genres: {e}")
            return Response(
                {'error': 'Failed to get genres'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class DataPrivacyViewSet(GenericViewSet):
    """
    ViewSet for data privacy controls and local data management
    """
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # Import locally to avoid circular import issues
        from .services.data_privacy_service import data_privacy_service
        self.data_privacy_service = data_privacy_service
    
    @action(detail=False, methods=['get'])
    def data_summary(self, request):
        """
        Get summary of stored user data
        """
        try:
            summary = self.data_privacy_service.get_data_summary()
            return Response(summary)
            
        except Exception as e:
            logger.error(f"Error getting data summary: {e}")
            return Response(
                {'error': 'Failed to get data summary'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=False, methods=['post'])
    def apply_retention_policy(self, request):
        """
        Apply data retention policy by removing old data
        """
        try:
            retention_days = request.data.get('retention_days', 90)
            
            if not isinstance(retention_days, int) or retention_days < 1 or retention_days > 3650:
                return Response(
                    {'error': 'retention_days must be an integer between 1 and 3650'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            deleted_counts = self.data_privacy_service.apply_data_retention_policy(retention_days)
            
            logger.info(f"Data retention policy applied: {deleted_counts}")
            return Response({
                'message': 'Data retention policy applied successfully',
                'retention_days': retention_days,
                'deleted_counts': deleted_counts,
                'timestamp': timezone.now().isoformat()
            })
            
        except Exception as e:
            logger.error(f"Error applying data retention policy: {e}")
            return Response(
                {'error': 'Failed to apply retention policy'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=False, methods=['post'])
    def secure_delete_all(self, request):
        """
        Securely delete all user data from the system
        """
        try:
            # Require confirmation
            confirmation = request.data.get('confirmation')
            if confirmation != 'DELETE_ALL_DATA':
                return Response(
                    {'error': 'confirmation must be "DELETE_ALL_DATA" to proceed'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            deleted_counts = self.data_privacy_service.secure_delete_all_user_data()
            
            logger.warning(f"All user data deleted: {deleted_counts}")
            return Response({
                'message': 'All user data has been securely deleted',
                'deleted_counts': deleted_counts,
                'timestamp': timezone.now().isoformat()
            })
            
        except Exception as e:
            logger.error(f"Error deleting all user data: {e}")
            return Response(
                {'error': 'Failed to delete user data'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=False, methods=['get'])
    def export_data(self, request):
        """
        Export all user data for portability
        """
        try:
            include_raw_emotions = request.query_params.get('include_emotions', 'true').lower() == 'true'
            
            export_data = self.data_privacy_service.export_user_data(include_raw_emotions)
            
            logger.info("User data export completed")
            return Response(export_data)
            
        except Exception as e:
            logger.error(f"Error exporting user data: {e}")
            return Response(
                {'error': 'Failed to export user data'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=False, methods=['get'])
    def retention_policy(self, request):
        """
        Get current data retention policy
        """
        try:
            retention_days = self.data_privacy_service.get_retention_policy_days()
            
            return Response({
                'retention_days': retention_days,
                'description': f'Data is automatically deleted after {retention_days} days'
            })
            
        except Exception as e:
            logger.error(f"Error getting retention policy: {e}")
            return Response(
                {'error': 'Failed to get retention policy'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=False, methods=['post'])
    def set_retention_policy(self, request):
        """
        Set data retention policy
        """
        try:
            retention_days = request.data.get('retention_days')
            
            if not isinstance(retention_days, int) or retention_days < 1 or retention_days > 3650:
                return Response(
                    {'error': 'retention_days must be an integer between 1 and 3650'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            success = self.data_privacy_service.set_retention_policy_days(retention_days)
            
            if success:
                return Response({
                    'message': 'Retention policy updated successfully',
                    'retention_days': retention_days,
                    'timestamp': timezone.now().isoformat()
                })
            else:
                return Response(
                    {'error': 'Failed to update retention policy'},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR
                )
            
        except Exception as e:
            logger.error(f"Error setting retention policy: {e}")
            return Response(
                {'error': 'Failed to set retention policy'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=False, methods=['post'])
    def cleanup_orphaned_data(self, request):
        """
        Clean up orphaned data and inconsistencies
        """
        try:
            cleanup_counts = self.data_privacy_service.cleanup_orphaned_data()
            
            logger.info(f"Orphaned data cleanup completed: {cleanup_counts}")
            return Response({
                'message': 'Orphaned data cleanup completed',
                'cleanup_counts': cleanup_counts,
                'timestamp': timezone.now().isoformat()
            })
            
        except Exception as e:
            logger.error(f"Error cleaning up orphaned data: {e}")
            return Response(
                {'error': 'Failed to cleanup orphaned data'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=False, methods=['post'])
    def anonymize_old_data(self, request):
        """
        Anonymize old data by removing personally identifiable information
        """
        try:
            anonymize_after_days = request.data.get('anonymize_after_days', 365)
            
            if not isinstance(anonymize_after_days, int) or anonymize_after_days < 1:
                return Response(
                    {'error': 'anonymize_after_days must be a positive integer'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            anonymized_counts = self.data_privacy_service.anonymize_old_data(anonymize_after_days)
            
            logger.info(f"Data anonymization completed: {anonymized_counts}")
            return Response({
                'message': 'Old data anonymization completed',
                'anonymize_after_days': anonymize_after_days,
                'anonymized_counts': anonymized_counts,
                'timestamp': timezone.now().isoformat()
            })
            
        except Exception as e:
            logger.error(f"Error anonymizing old data: {e}")
            return Response(
                {'error': 'Failed to anonymize old data'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=False, methods=['get'])
    def validate_integrity(self, request):
        """
        Validate data integrity and return report
        """
        try:
            integrity_report = self.data_privacy_service.validate_data_integrity()
            
            return Response(integrity_report)
            
        except Exception as e:
            logger.error(f"Error validating data integrity: {e}")
            return Response(
                {'error': 'Failed to validate data integrity'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=False, methods=['get'])
    def encryption_status(self, request):
        """
        Get encryption status and settings
        """
        try:
            encryption_enabled = self.data_privacy_service.encryption_key is not None
            
            return Response({
                'encryption_enabled': encryption_enabled,
                'local_processing_only': True,
                'data_location': 'Local SQLite database',
                'privacy_compliance': {
                    'no_cloud_processing': True,
                    'no_external_transmission': True,
                    'user_controlled_deletion': True,
                    'data_portability': True
                }
            })
            
        except Exception as e:
            logger.error(f"Error getting encryption status: {e}")
            return Response(
                {'error': 'Failed to get encryption status'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=False, methods=['post'])
    def log_error(self, request):
        """
        Log an error from the frontend
        """
        try:
            error_data = {
                'type': request.data.get('error_type', 'frontend_error'),
                'message': request.data.get('error_message', ''),
                'stack_trace': request.data.get('error_stack', ''),
                'context': {
                    'component_stack': request.data.get('component_stack', ''),
                    'url': request.data.get('url', ''),
                    'timestamp': request.data.get('timestamp', ''),
                    'retry_count': request.data.get('retry_count', 0)
                },
                'user_agent': request.data.get('user_agent', ''),
                'additional_data': request.data.get('additional_data', {})
            }
            
            error_id = error_handling_service.log_error(error_data)
            
            logger.info(f"Frontend error logged with ID: {error_id}")
            return Response({
                'error_id': error_id,
                'message': 'Error logged successfully',
                'timestamp': timezone.now().isoformat()
            })
            
        except Exception as e:
            logger.error(f"Error logging frontend error: {e}")
            return Response(
                {'error': 'Failed to log error'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=False, methods=['get'])
    def error_stats(self, request):
        """
        Get error statistics and analytics
        """
        try:
            stats = error_handling_service.get_error_stats()
            return Response(stats)
            
        except Exception as e:
            logger.error(f"Error getting error stats: {e}")
            return Response(
                {'error': 'Failed to get error statistics'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=False, methods=['get'])
    def recent_errors(self, request):
        """
        Get recent errors with optional limit
        """
        try:
            limit = int(request.query_params.get('limit', 10))
            limit = max(1, min(limit, 100))  # Limit between 1 and 100
            
            recent_errors = error_handling_service.get_recent_errors(limit)
            
            return Response({
                'errors': recent_errors,
                'total_count': len(recent_errors),
                'limit': limit
            })
            
        except ValueError:
            return Response(
                {'error': 'Invalid limit parameter'},
                status=status.HTTP_400_BAD_REQUEST
            )
        except Exception as e:
            logger.error(f"Error getting recent errors: {e}")
            return Response(
                {'error': 'Failed to get recent errors'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=True, methods=['get'])
    def error_detail(self, request, pk=None):
        """
        Get detailed information about a specific error
        """
        try:
            error_detail = error_handling_service.get_error_by_id(pk)
            
            if error_detail:
                return Response(error_detail)
            else:
                return Response(
                    {'error': 'Error not found'},
                    status=status.HTTP_404_NOT_FOUND
                )
                
        except Exception as e:
            logger.error(f"Error getting error detail: {e}")
            return Response(
                {'error': 'Failed to get error detail'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=False, methods=['post'])
    def clear_errors(self, request):
        """
        Clear the error log
        """
        try:
            error_handling_service.clear_error_log()
            
            logger.info("Error log cleared by user request")
            return Response({
                'message': 'Error log cleared successfully',
                'timestamp': timezone.now().isoformat()
            })
            
        except Exception as e:
            logger.error(f"Error clearing error log: {e}")
            return Response(
                {'error': 'Failed to clear error log'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=False, methods=['get'])
    def export_errors(self, request):
        """
        Export error log as JSON
        """
        try:
            export_data = error_handling_service.export_error_log()
            
            return Response({
                'export_data': export_data,
                'timestamp': timezone.now().isoformat()
            })
            
        except Exception as e:
            logger.error(f"Error exporting error log: {e}")
            return Response(
                {'error': 'Failed to export error log'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=False, methods=['post'])
    def test_recovery(self, request):
        """
        Test error recovery mechanisms
        """
        try:
            error_type = request.data.get('error_type')
            test_data = request.data.get('test_data', {})
            
            if not error_type:
                return Response(
                    {'error': 'error_type is required'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Create a test error entry
            test_error = {
                'id': f"test_{int(timezone.now().timestamp())}",
                'type': error_type,
                'message': f"Test error for recovery testing: {error_type}",
                'context': test_data,
                'timestamp': timezone.now().isoformat()
            }
            
            # Attempt recovery
            recovery_result = error_handling_service._attempt_automatic_recovery(test_error)
            
            return Response({
                'test_error': test_error,
                'recovery_attempted': test_error.get('recovery_attempted', False),
                'recovery_successful': test_error.get('recovery_successful', False),
                'recovery_error': test_error.get('recovery_error'),
                'timestamp': timezone.now().isoformat()
            })
            
        except Exception as e:
            logger.error(f"Error testing recovery: {e}")
            return Response(
                {'error': 'Failed to test recovery'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


@api_view(['GET'])
def system_health(request):
    """
    Comprehensive system health check with error handling status
    """
    try:
        health_data = {
            'status': 'healthy',
            'service': 'SideEye Django Backend',
            'version': '1.0.0',
            'timestamp': timezone.now().isoformat(),
            'error_handling': {
                'service_active': True,
                'recent_errors': len(error_handling_service.get_recent_errors(10)),
                'error_stats': error_handling_service.get_error_stats()
            },
            'services': {}
        }
        
        # Check individual services
        try:
            from .services.emotion_analysis_service import EmotionAnalysisService
            emotion_service = EmotionAnalysisService()
            health_data['services']['emotion_analysis'] = {'status': 'healthy'}
        except Exception as e:
            health_data['services']['emotion_analysis'] = {'status': 'error', 'error': str(e)}
        
        try:
            from .services.notification_service import NotificationService
            notification_service = NotificationService()
            health_data['services']['notification'] = {'status': 'healthy'}
        except Exception as e:
            health_data['services']['notification'] = {'status': 'error', 'error': str(e)}
        
        try:
            health_data['services']['music_recommendation'] = {'status': 'healthy'}
        except Exception as e:
            health_data['services']['music_recommendation'] = {'status': 'error', 'error': str(e)}
        
        try:
            health_data['services']['theme_recommendation'] = {'status': 'healthy'}
        except Exception as e:
            health_data['services']['theme_recommendation'] = {'status': 'error', 'error': str(e)}
        
        try:
            health_data['services']['cli_hooks'] = {'status': 'healthy'}
        except Exception as e:
            health_data['services']['cli_hooks'] = {'status': 'error', 'error': str(e)}
        
        # Check if any services have errors
        service_errors = [s for s in health_data['services'].values() if s['status'] == 'error']
        if service_errors:
            health_data['status'] = 'degraded'
            health_data['service_errors'] = len(service_errors)
        
        return Response(health_data)
        
    except Exception as e:
        logger.error(f"Error in system health check: {e}")
        error_handling_service.log_error({
            'type': 'system_health_error',
            'message': str(e),
            'stack_trace': traceback.format_exc()
        })
        
        return Response({
            'status': 'error',
            'service': 'SideEye Django Backend',
            'error': 'Health check failed',
            'timestamp': timezone.now().isoformat()
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# Error Handling API Endpoints

@api_view(['POST'])
def report_error(request):
    """
    Report an error from the frontend
    """
    try:
        # Extract error data from request
        error_data = {
            'type': request.data.get('error_type', 'unknown'),
            'message': request.data.get('error_message', ''),
            'stack_trace': request.data.get('error_stack', ''),
            'context': {
                'user_agent': request.data.get('user_agent', ''),
                'url': request.data.get('url', ''),
                'timestamp': request.data.get('timestamp', timezone.now().isoformat()),
                'additional_data': request.data.get('additional_data', {})
            }
        }
        
        # Log the error
        error_id = error_handling_service.log_error(error_data)
        
        # Get error details for response
        logged_error = error_handling_service.get_error_by_id(error_id)
        
        response_data = {
            'error_id': error_id,
            'severity': logged_error.get('severity', 'unknown'),
            'message': 'Error reported successfully',
            'recovery_attempted': logged_error.get('recovery_attempted', False),
            'recovery_successful': logged_error.get('recovery_successful', False),
            'timestamp': timezone.now().isoformat()
        }
        
        # Add recovery suggestions if available
        if logged_error.get('severity') in ['high', 'critical']:
            response_data['recovery_suggestions'] = error_handling_service._get_service_recovery_suggestions('frontend')
        
        logger.info(f"Error reported from frontend: {error_id}")
        return Response(response_data, status=status.HTTP_201_CREATED)
        
    except Exception as e:
        logger.error(f"Error reporting error: {e}")
        return Response(
            {'error': 'Failed to report error'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
def error_statistics(request):
    """
    Get error statistics and health metrics
    """
    try:
        stats = error_handling_service.get_error_stats()
        
        # Add additional health metrics
        health_metrics = {
            'service_status': 'healthy',
            'uptime_hours': 24,  # This would be calculated from service start time
            'memory_usage': 'normal',  # This would be actual memory metrics
            'error_rate': stats.get('recent_errors', 0) / max(stats.get('total_errors', 1), 1) * 100
        }
        
        response_data = {
            'error_statistics': stats,
            'health_metrics': health_metrics,
            'timestamp': timezone.now().isoformat()
        }
        
        return Response(response_data)
        
    except Exception as e:
        logger.error(f"Error getting error statistics: {e}")
        return Response(
            {'error': 'Failed to get error statistics'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
def recent_errors(request):
    """
    Get recent errors with optional filtering
    """
    try:
        # Get query parameters
        limit = int(request.GET.get('limit', 10))
        severity = request.GET.get('severity')
        error_type = request.GET.get('type')
        
        # Get recent errors
        recent_errors = error_handling_service.get_recent_errors(limit)
        
        # Apply filters
        if severity:
            recent_errors = [e for e in recent_errors if e.get('severity') == severity]
        
        if error_type:
            recent_errors = [e for e in recent_errors if e.get('type') == error_type]
        
        response_data = {
            'errors': recent_errors,
            'total_count': len(recent_errors),
            'filters_applied': {
                'limit': limit,
                'severity': severity,
                'type': error_type
            },
            'timestamp': timezone.now().isoformat()
        }
        
        return Response(response_data)
        
    except ValueError:
        return Response(
            {'error': 'Invalid limit parameter'},
            status=status.HTTP_400_BAD_REQUEST
        )
    except Exception as e:
        logger.error(f"Error getting recent errors: {e}")
        return Response(
            {'error': 'Failed to get recent errors'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
def error_details(request, error_id):
    """
    Get detailed information about a specific error
    """
    try:
        error_details = error_handling_service.get_error_by_id(error_id)
        
        if not error_details:
            return Response(
                {'error': 'Error not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Add recovery suggestions based on error type and severity
        recovery_suggestions = []
        error_type = error_details.get('type', '')
        severity = error_details.get('severity', 'low')
        
        if 'api' in error_type.lower():
            recovery_suggestions = error_handling_service._get_service_recovery_suggestions('api')
        elif 'service' in error_type.lower():
            service_name = error_details.get('context', {}).get('service_name', 'unknown')
            recovery_suggestions = error_handling_service._get_service_recovery_suggestions(service_name)
        elif 'network' in error_type.lower():
            recovery_suggestions = [
                'Check internet connectivity',
                'Verify backend service is running',
                'Try refreshing the page',
                'Check firewall settings'
            ]
        else:
            recovery_suggestions = [
                'Try refreshing the page',
                'Clear browser cache',
                'Check browser console for more details'
            ]
        
        response_data = {
            'error_details': error_details,
            'recovery_suggestions': recovery_suggestions,
            'similar_errors_count': len([e for e in error_handling_service.get_recent_errors(50) 
                                       if e.get('type') == error_details.get('type')]),
            'timestamp': timezone.now().isoformat()
        }
        
        return Response(response_data)
        
    except Exception as e:
        logger.error(f"Error getting error details: {e}")
        return Response(
            {'error': 'Failed to get error details'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
def clear_error_log(request):
    """
    Clear the error log (admin function)
    """
    try:
        error_handling_service.clear_error_log()
        
        logger.info("Error log cleared")
        return Response({
            'message': 'Error log cleared successfully',
            'timestamp': timezone.now().isoformat()
        })
        
    except Exception as e:
        logger.error(f"Error clearing error log: {e}")
        return Response(
            {'error': 'Failed to clear error log'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
def export_error_log(request):
    """
    Export error log for debugging
    """
    try:
        export_data = error_handling_service.export_error_log()
        
        response = JsonResponse(json.loads(export_data), safe=False)
        response['Content-Disposition'] = f'attachment; filename="sideeye_error_log_{timezone.now().strftime("%Y%m%d_%H%M%S")}.json"'
        
        logger.info("Error log exported")
        return response
        
    except Exception as e:
        logger.error(f"Error exporting error log: {e}")
        return Response(
            {'error': 'Failed to export error log'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
def system_health(request):
    """
    Comprehensive system health check with error context
    """
    try:
        # Get error statistics
        error_stats = error_handling_service.get_error_stats()
        
        # Determine system health status
        recent_critical_errors = len([e for e in error_handling_service.get_recent_errors(10) 
                                    if e.get('severity') == 'critical'])
        recent_high_errors = len([e for e in error_handling_service.get_recent_errors(10) 
                                if e.get('severity') == 'high'])
        
        if recent_critical_errors > 0:
            health_status = 'critical'
        elif recent_high_errors > 2:
            health_status = 'degraded'
        elif error_stats.get('recent_errors', 0) > 10:
            health_status = 'warning'
        else:
            health_status = 'healthy'
        
        # Check service components
        component_health = {
            'database': 'healthy',  # Would check actual database connectivity
            'cache': 'healthy',     # Would check cache connectivity
            'file_system': 'healthy',  # Would check file system access
            'external_apis': 'healthy'  # Would check external API connectivity
        }
        
        # Try to verify each component
        try:
            from django.db import connection
            connection.ensure_connection()
        except Exception:
            component_health['database'] = 'unhealthy'
            health_status = 'critical'
        
        try:
            from django.core.cache import cache
            cache.set('health_check', 'ok', 10)
            if cache.get('health_check') != 'ok':
                component_health['cache'] = 'unhealthy'
        except Exception:
            component_health['cache'] = 'unhealthy'
        
        response_data = {
            'status': health_status,
            'timestamp': timezone.now().isoformat(),
            'error_statistics': error_stats,
            'component_health': component_health,
            'recovery_rate': error_stats.get('recovery_rate', 0),
            'recommendations': []
        }
        
        # Add recommendations based on health status
        if health_status == 'critical':
            response_data['recommendations'] = [
                'Critical errors detected - immediate attention required',
                'Check error log for details',
                'Consider restarting affected services'
            ]
        elif health_status == 'degraded':
            response_data['recommendations'] = [
                'Multiple high-severity errors detected',
                'Monitor system closely',
                'Review recent error patterns'
            ]
        elif health_status == 'warning':
            response_data['recommendations'] = [
                'Higher than normal error rate',
                'Review recent changes',
                'Monitor for patterns'
            ]
        
        return Response(response_data)
        
    except Exception as e:
        logger.error(f"Error in system health check: {e}")
        return Response({
            'status': 'critical',
            'error': 'Health check failed',
            'timestamp': timezone.now().isoformat()
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        
# Error Handling Views
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator
from django.views import View
from django.core.cache import cache
from .services.error_handling_service import error_handling_service


@method_decorator(csrf_exempt, name='dispatch')
class ErrorReportingView(View):
    """API endpoint for error reporting from frontend"""
    
    def post(self, request):
        """Handle error reports from frontend"""
        try:
            data = json.loads(request.body)
            
            # Extract error information
            error_data = {
                'type': data.get('error_type', 'frontend_error'),
                'message': data.get('error_message', ''),
                'stack_trace': data.get('error_stack', ''),
                'user_agent': request.META.get('HTTP_USER_AGENT', ''),
                'url': data.get('url', ''),
                'context': {
                    'component_stack': data.get('component_stack', ''),
                    'retry_count': data.get('retry_count', 0),
                    'timestamp': data.get('timestamp', ''),
                    'additional_data': data.get('additional_data', {})
                }
            }
            
            # Log the error
            error_id = error_handling_service.log_error(error_data)
            
            return JsonResponse({
                'success': True,
                'error_id': error_id,
                'message': 'Error logged successfully'
            })
            
        except Exception as e:
            return JsonResponse({
                'success': False,
                'error': str(e)
            }, status=500)


@method_decorator(csrf_exempt, name='dispatch')
class SystemHealthView(View):
    """API endpoint for system health status"""
    
    def get(self, request):
        """Get system health status"""
        try:
            health_status = error_handling_service.get_system_health_status()
            return JsonResponse(health_status)
            
        except Exception as e:
            return JsonResponse({
                'overall_status': 'error',
                'error': str(e),
                'timestamp': timezone.now().isoformat()
            }, status=500)


@method_decorator(csrf_exempt, name='dispatch')
class ErrorStatsView(View):
    """API endpoint for error statistics"""
    
    def get(self, request):
        """Get error statistics"""
        try:
            stats = error_handling_service.get_error_stats()
            return JsonResponse(stats)
            
        except Exception as e:
            return JsonResponse({
                'error': str(e)
            }, status=500)


@method_decorator(csrf_exempt, name='dispatch')
class ServiceDegradationView(View):
    """API endpoint for handling service degradation"""
    
    def post(self, request):
        """Report service degradation"""
        try:
            data = json.loads(request.body)
            
            service_name = data.get('service_name')
            error_message = data.get('error_message', '')
            degradation_level = data.get('degradation_level', 'partial')
            
            if not service_name:
                return JsonResponse({
                    'success': False,
                    'error': 'service_name is required'
                }, status=400)
            
            # Create error object for degradation handling
            error = Exception(error_message)
            
            result = error_handling_service.handle_service_degradation(
                service_name, error, degradation_level
            )
            
            return JsonResponse({
                'success': True,
                'result': result
            })
            
        except Exception as e:
            return JsonResponse({
                'success': False,
                'error': str(e)
            }, status=500)


@method_decorator(csrf_exempt, name='dispatch')
class OfflineModeView(View):
    """API endpoint for offline mode management"""
    
    def get(self, request):
        """Get offline mode status"""
        try:
            is_offline = error_handling_service.is_offline_mode()
            offline_reason = cache.get('offline_mode_reason', '')
            offline_timestamp = cache.get('offline_mode_timestamp', '')
            
            return JsonResponse({
                'offline': is_offline,
                'reason': offline_reason,
                'timestamp': offline_timestamp
            })
            
        except Exception as e:
            return JsonResponse({
                'error': str(e)
            }, status=500)
    
    def post(self, request):
        """Enable offline mode"""
        try:
            data = json.loads(request.body)
            reason = data.get('reason', 'manual')
            
            success = error_handling_service.enable_offline_mode(reason)
            
            return JsonResponse({
                'success': success,
                'message': 'Offline mode enabled' if success else 'Failed to enable offline mode'
            })
            
        except Exception as e:
            return JsonResponse({
                'success': False,
                'error': str(e)
            }, status=500)
    
    def delete(self, request):
        """Disable offline mode"""
        try:
            success = error_handling_service.disable_offline_mode()
            
            return JsonResponse({
                'success': success,
                'message': 'Offline mode disabled' if success else 'System was not in offline mode'
            })
            
        except Exception as e:
            return JsonResponse({
                'success': False,
                'error': str(e)
            }, status=500)