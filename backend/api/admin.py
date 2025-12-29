from django.contrib import admin
from .models import UserPreferences, EmotionReading, UserFeedback


@admin.register(UserPreferences)
class UserPreferencesAdmin(admin.ModelAdmin):
    """Admin interface for UserPreferences model"""
    list_display = ('id', 'notification_tone', 'notification_frequency', 'wellness_reminder_interval', 'updated_at')
    list_filter = ('notification_tone', 'created_at', 'updated_at')
    search_fields = ('notification_tone',)
    readonly_fields = ('created_at', 'updated_at')
    
    fieldsets = (
        ('Music Preferences', {
            'fields': ('preferred_genres', 'music_energy_mappings')
        }),
        ('Theme Preferences', {
            'fields': ('preferred_color_palettes', 'theme_emotion_mappings')
        }),
        ('Notification Settings', {
            'fields': ('notification_frequency', 'wellness_reminder_interval', 'notification_tone')
        }),
        ('Metadata', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )


@admin.register(EmotionReading)
class EmotionReadingAdmin(admin.ModelAdmin):
    """Admin interface for EmotionReading model"""
    list_display = ('id', 'timestamp', 'get_dominant_emotion_display', 'energy_level', 'posture_score', 'confidence')
    list_filter = ('timestamp', 'energy_level', 'confidence')
    search_fields = ('emotions',)
    readonly_fields = ('timestamp',)
    ordering = ('-timestamp',)
    
    def get_dominant_emotion_display(self, obj):
        """Display the dominant emotion in the list view"""
        dominant = obj.get_dominant_emotion()
        if dominant:
            return f"{dominant[0]} ({dominant[1]:.2f})"
        return "No emotions"
    get_dominant_emotion_display.short_description = 'Dominant Emotion'


@admin.register(UserFeedback)
class UserFeedbackAdmin(admin.ModelAdmin):
    """Admin interface for UserFeedback model"""
    list_display = ('id', 'timestamp', 'suggestion_type', 'user_response', 'user_comment_preview')
    list_filter = ('suggestion_type', 'user_response', 'timestamp')
    search_fields = ('user_comment', 'suggestion_data')
    readonly_fields = ('timestamp',)
    ordering = ('-timestamp',)
    
    def user_comment_preview(self, obj):
        """Display a preview of the user comment"""
        if obj.user_comment:
            return obj.user_comment[:50] + "..." if len(obj.user_comment) > 50 else obj.user_comment
        return "No comment"
    user_comment_preview.short_description = 'Comment Preview'
    
    fieldsets = (
        ('Suggestion Details', {
            'fields': ('suggestion_type', 'emotion_context', 'suggestion_data')
        }),
        ('User Response', {
            'fields': ('user_response', 'alternative_preference', 'user_comment')
        }),
        ('Metadata', {
            'fields': ('timestamp',),
            'classes': ('collapse',)
        }),
    )