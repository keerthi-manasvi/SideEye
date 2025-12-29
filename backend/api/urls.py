from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

# Create a router and register our viewsets with it
router = DefaultRouter()

# Register ViewSets with the router
router.register(r'preferences', views.UserPreferencesViewSet, basename='preferences')
router.register(r'emotions', views.EmotionReadingViewSet, basename='emotions')
router.register(r'feedback', views.UserFeedbackViewSet, basename='feedback')
router.register(r'tasks', views.TaskViewSet, basename='tasks')
router.register(r'notifications', views.NotificationViewSet, basename='notifications')
router.register(r'themes', views.ThemeRecommendationViewSet, basename='themes')
router.register(r'cli-hooks', views.CLIHookViewSet, basename='cli-hooks')
router.register(r'music/recommendations', views.MusicRecommendationViewSet, basename='music-recommendations')
router.register(r'music/playlists', views.YouTubePlaylistViewSet, basename='youtube-playlists')
router.register(r'privacy', views.DataPrivacyViewSet, basename='privacy')
router.register(r'errors', views.ErrorHandlingViewSet, basename='errors')

urlpatterns = [
    # Include the router URLs
    path('', include(router.urls)),
    
    # Health check endpoint
    path('health/', views.health_check, name='health_check'),
    
    # System health endpoint with comprehensive error handling status
    path('system-health/', views.system_health, name='system_health'),
    
    # Error Handling Endpoints
    path('errors/report/', views.ErrorReportingView.as_view(), name='error_reporting'),
    path('system/health-status/', views.SystemHealthView.as_view(), name='system_health_status'),
    path('system/error-stats/', views.ErrorStatsView.as_view(), name='error_stats'),
    path('system/service-degradation/', views.ServiceDegradationView.as_view(), name='service_degradation'),
    path('system/offline-mode/', views.OfflineModeView.as_view(), name='offline_mode'),
]