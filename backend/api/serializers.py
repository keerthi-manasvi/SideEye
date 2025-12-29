from rest_framework import serializers
from .models import UserPreferences, EmotionReading, UserFeedback, Task, YouTubePlaylist, MusicRecommendation, MusicGenre


class UserPreferencesSerializer(serializers.ModelSerializer):
    """
    Serializer for UserPreferences model with validation
    """
    
    class Meta:
        model = UserPreferences
        fields = [
            'id', 'preferred_genres', 'music_energy_mappings',
            'preferred_color_palettes', 'theme_emotion_mappings',
            'notification_frequency', 'wellness_reminder_interval',
            'notification_tone', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']
    
    def validate_preferred_genres(self, value):
        """Validate that preferred_genres is a list of strings"""
        if not isinstance(value, list):
            raise serializers.ValidationError("Must be a list of genre names")
        
        for genre in value:
            if not isinstance(genre, str):
                raise serializers.ValidationError("All genres must be strings")
        
        return value
    
    def validate_music_energy_mappings(self, value):
        """Validate music energy mappings structure"""
        if not isinstance(value, dict):
            raise serializers.ValidationError("Must be a dictionary")
        
        # Validate energy levels are valid floats between 0 and 1
        for energy_level, preferences in value.items():
            try:
                energy_float = float(energy_level)
                if not 0.0 <= energy_float <= 1.0:
                    raise serializers.ValidationError(f"Energy level {energy_level} must be between 0.0 and 1.0")
            except ValueError:
                raise serializers.ValidationError(f"Energy level {energy_level} must be a valid number")
            
            if not isinstance(preferences, (list, dict)):
                raise serializers.ValidationError(f"Preferences for energy level {energy_level} must be a list or dictionary")
        
        return value
    
    def validate_preferred_color_palettes(self, value):
        """Validate that preferred_color_palettes is a list"""
        if not isinstance(value, list):
            raise serializers.ValidationError("Must be a list of color palette names")
        
        return value
    
    def validate_theme_emotion_mappings(self, value):
        """Validate theme emotion mappings structure"""
        if not isinstance(value, dict):
            raise serializers.ValidationError("Must be a dictionary")
        
        valid_emotions = ['happy', 'sad', 'angry', 'surprised', 'fearful', 'disgusted', 'neutral']
        
        for emotion, theme_prefs in value.items():
            if emotion not in valid_emotions:
                raise serializers.ValidationError(f"Invalid emotion: {emotion}. Must be one of {valid_emotions}")
            
            if not isinstance(theme_prefs, (list, dict)):
                raise serializers.ValidationError(f"Theme preferences for {emotion} must be a list or dictionary")
        
        return value


class EmotionReadingSerializer(serializers.ModelSerializer):
    """
    Serializer for EmotionReading model with validation
    """
    dominant_emotion = serializers.SerializerMethodField()
    
    class Meta:
        model = EmotionReading
        fields = [
            'id', 'timestamp', 'emotions', 'energy_level',
            'posture_score', 'blink_rate', 'confidence', 'dominant_emotion'
        ]
        read_only_fields = ['id', 'timestamp', 'dominant_emotion']
    
    def get_dominant_emotion(self, obj):
        """Get the dominant emotion from the reading"""
        dominant = obj.get_dominant_emotion()
        if dominant:
            return {
                'emotion': dominant[0],
                'probability': dominant[1]
            }
        return None
    
    def validate_emotions(self, value):
        """Validate emotions dictionary structure and values"""
        if not isinstance(value, dict):
            raise serializers.ValidationError("Must be a dictionary of emotion probabilities")
        
        if not value:
            raise serializers.ValidationError("Emotions dictionary cannot be empty")
        
        valid_emotions = ['happy', 'sad', 'angry', 'surprised', 'fearful', 'disgusted', 'neutral']
        total_probability = 0.0
        
        for emotion, probability in value.items():
            if emotion not in valid_emotions:
                raise serializers.ValidationError(f"Invalid emotion: {emotion}. Must be one of {valid_emotions}")
            
            if not isinstance(probability, (int, float)):
                raise serializers.ValidationError(f"Probability for {emotion} must be a number")
            
            if not 0.0 <= probability <= 1.0:
                raise serializers.ValidationError(f"Probability for {emotion} must be between 0.0 and 1.0")
            
            total_probability += probability
        
        # Allow some tolerance for floating point precision
        if not 0.95 <= total_probability <= 1.05:
            raise serializers.ValidationError(f"Total emotion probabilities should sum to approximately 1.0, got {total_probability}")
        
        return value
    
    def validate_energy_level(self, value):
        """Validate energy level is within valid range"""
        if not 0.0 <= value <= 1.0:
            raise serializers.ValidationError("Energy level must be between 0.0 and 1.0")
        return value
    
    def validate_posture_score(self, value):
        """Validate posture score is within valid range"""
        if not 0.0 <= value <= 1.0:
            raise serializers.ValidationError("Posture score must be between 0.0 and 1.0")
        return value
    
    def validate_blink_rate(self, value):
        """Validate blink rate is reasonable"""
        if not 0.0 <= value <= 100.0:
            raise serializers.ValidationError("Blink rate must be between 0.0 and 100.0 blinks per minute")
        return value
    
    def validate_confidence(self, value):
        """Validate confidence is within valid range"""
        if not 0.0 <= value <= 1.0:
            raise serializers.ValidationError("Confidence must be between 0.0 and 1.0")
        return value


class UserFeedbackSerializer(serializers.ModelSerializer):
    """
    Serializer for UserFeedback model with validation
    """
    
    class Meta:
        model = UserFeedback
        fields = [
            'id', 'timestamp', 'suggestion_type', 'emotion_context',
            'suggestion_data', 'user_response', 'alternative_preference',
            'user_comment'
        ]
        read_only_fields = ['id', 'timestamp']
    
    def validate_emotion_context(self, value):
        """Validate emotion context structure"""
        if not isinstance(value, dict):
            raise serializers.ValidationError("Must be a dictionary")
        
        # Check for required fields
        required_fields = ['emotions', 'energy_level']
        for field in required_fields:
            if field not in value:
                raise serializers.ValidationError(f"Missing required field: {field}")
        
        # Validate emotions if present
        if 'emotions' in value:
            emotions = value['emotions']
            if not isinstance(emotions, dict):
                raise serializers.ValidationError("Emotions in context must be a dictionary")
        
        # Validate energy level if present
        if 'energy_level' in value:
            energy = value['energy_level']
            if not isinstance(energy, (int, float)) or not 0.0 <= energy <= 1.0:
                raise serializers.ValidationError("Energy level in context must be between 0.0 and 1.0")
        
        return value
    
    def validate_suggestion_data(self, value):
        """Validate suggestion data structure"""
        if not isinstance(value, dict):
            raise serializers.ValidationError("Must be a dictionary")
        
        if not value:
            raise serializers.ValidationError("Suggestion data cannot be empty")
        
        return value
    
    def validate_alternative_preference(self, value):
        """Validate alternative preference structure"""
        if value is not None and not isinstance(value, dict):
            raise serializers.ValidationError("Must be a dictionary or null")
        
        return value


class TaskSerializer(serializers.ModelSerializer):
    """
    Serializer for Task model with energy-based sorting and learning capabilities
    """
    energy_match_score = serializers.SerializerMethodField()
    
    class Meta:
        model = Task
        fields = [
            'id', 'title', 'description', 'priority', 'complexity', 'status',
            'complexity_score', 'optimal_energy_level', 'completion_energy_levels',
            'user_energy_correlation', 'created_at', 'updated_at', 'due_date',
            'estimated_duration', 'actual_duration', 'energy_match_score'
        ]
        read_only_fields = [
            'id', 'created_at', 'updated_at', 'complexity_score', 
            'optimal_energy_level', 'user_energy_correlation', 'energy_match_score'
        ]
    
    def get_energy_match_score(self, obj):
        """Get energy match score for current user energy level"""
        # This will be calculated based on context passed in the view
        request = self.context.get('request')
        if request and hasattr(request, 'current_energy_level'):
            return obj.get_energy_match_score(request.current_energy_level)
        return None
    
    def validate_title(self, value):
        """Validate task title is not empty"""
        if not value.strip():
            raise serializers.ValidationError("Task title cannot be empty")
        return value.strip()
    
    def validate_completion_energy_levels(self, value):
        """Validate completion energy levels list"""
        if not isinstance(value, list):
            raise serializers.ValidationError("Must be a list of energy levels")
        
        for energy_level in value:
            if not isinstance(energy_level, (int, float)):
                raise serializers.ValidationError("All energy levels must be numbers")
            if not 0.0 <= energy_level <= 1.0:
                raise serializers.ValidationError("All energy levels must be between 0.0 and 1.0")
        
        return value
    
    def validate_estimated_duration(self, value):
        """Validate estimated duration is reasonable"""
        if value is not None and value <= 0:
            raise serializers.ValidationError("Estimated duration must be positive")
        return value
    
    def validate_actual_duration(self, value):
        """Validate actual duration is reasonable"""
        if value is not None and value <= 0:
            raise serializers.ValidationError("Actual duration must be positive")
        return value


class TaskRecommendationSerializer(serializers.Serializer):
    """
    Serializer for task recommendation requests and responses
    """
    current_energy_level = serializers.FloatField(
        min_value=0.0, 
        max_value=1.0,
        help_text="Current user energy level from 0.0 to 1.0"
    )
    max_tasks = serializers.IntegerField(
        default=5,
        min_value=1,
        max_value=20,
        help_text="Maximum number of tasks to recommend"
    )
    include_completed = serializers.BooleanField(
        default=False,
        help_text="Whether to include completed tasks in recommendations"
    )
    priority_filter = serializers.ListField(
        child=serializers.ChoiceField(choices=Task.PRIORITY_CHOICES),
        required=False,
        help_text="Filter tasks by priority levels"
    )
    complexity_filter = serializers.ListField(
        child=serializers.ChoiceField(choices=Task.COMPLEXITY_CHOICES),
        required=False,
        help_text="Filter tasks by complexity levels"
    )


class TaskSortingSerializer(serializers.Serializer):
    """
    Serializer for task sorting requests
    """
    current_energy_level = serializers.FloatField(
        min_value=0.0,
        max_value=1.0,
        help_text="Current user energy level for sorting"
    )
    sort_method = serializers.ChoiceField(
        choices=[
            ('energy_match', 'Energy Match'),
            ('priority', 'Priority'),
            ('complexity', 'Complexity'),
            ('due_date', 'Due Date'),
            ('created_date', 'Created Date')
        ],
        default='energy_match',
        help_text="Method to use for sorting tasks"
    )
    include_completed = serializers.BooleanField(
        default=False,
        help_text="Whether to include completed tasks"
    )


class MusicGenreSerializer(serializers.ModelSerializer):
    """
    Serializer for MusicGenre model
    """
    playlist_count = serializers.SerializerMethodField()
    
    class Meta:
        model = MusicGenre
        fields = [
            'id', 'name', 'emotional_associations', 'typical_energy_range',
            'created_at', 'updated_at', 'playlist_count'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'playlist_count']
    
    def get_playlist_count(self, obj):
        """Get count of active playlists for this genre"""
        return obj.youtubeplaylist_set.filter(is_active=True).count()
    
    def validate_emotional_associations(self, value):
        """Validate emotional associations structure"""
        if not isinstance(value, dict):
            raise serializers.ValidationError("Must be a dictionary")
        
        valid_emotions = ['happy', 'sad', 'angry', 'surprised', 'fearful', 'disgusted', 'neutral']
        
        for emotion, strength in value.items():
            if emotion not in valid_emotions:
                raise serializers.ValidationError(f"Invalid emotion: {emotion}. Must be one of {valid_emotions}")
            
            if not isinstance(strength, (int, float)):
                raise serializers.ValidationError(f"Strength for {emotion} must be a number")
            
            if not 0.0 <= strength <= 1.0:
                raise serializers.ValidationError(f"Strength for {emotion} must be between 0.0 and 1.0")
        
        return value
    
    def validate_typical_energy_range(self, value):
        """Validate energy range structure"""
        if not isinstance(value, list) or len(value) != 2:
            raise serializers.ValidationError("Must be a list with [min_energy, max_energy]")
        
        min_energy, max_energy = value
        
        if not isinstance(min_energy, (int, float)) or not isinstance(max_energy, (int, float)):
            raise serializers.ValidationError("Energy values must be numbers")
        
        if not (0.0 <= min_energy <= 1.0 and 0.0 <= max_energy <= 1.0):
            raise serializers.ValidationError("Energy values must be between 0.0 and 1.0")
        
        if min_energy > max_energy:
            raise serializers.ValidationError("Min energy cannot be greater than max energy")
        
        return value


class YouTubePlaylistSerializer(serializers.ModelSerializer):
    """
    Serializer for YouTubePlaylist model
    """
    genres = MusicGenreSerializer(many=True, read_only=True)
    emotion_match_score = serializers.SerializerMethodField()
    
    class Meta:
        model = YouTubePlaylist
        fields = [
            'id', 'youtube_id', 'title', 'description', 'channel_title',
            'genres', 'emotional_tags', 'energy_level', 'user_rating',
            'play_count', 'acceptance_rate', 'video_count', 'last_updated',
            'is_active', 'created_at', 'updated_at', 'emotion_match_score'
        ]
        read_only_fields = [
            'id', 'play_count', 'acceptance_rate', 'last_updated',
            'created_at', 'updated_at', 'emotion_match_score'
        ]
    
    def get_emotion_match_score(self, obj):
        """Get emotion match score for current context"""
        # This will be calculated based on context passed in the view
        request = self.context.get('request')
        if request and hasattr(request, 'current_emotions'):
            return obj.get_emotion_match_score(request.current_emotions)
        return None
    
    def validate_emotional_tags(self, value):
        """Validate emotional tags list"""
        if not isinstance(value, list):
            raise serializers.ValidationError("Must be a list of emotional tags")
        
        valid_emotions = ['happy', 'sad', 'angry', 'surprised', 'fearful', 'disgusted', 'neutral', 
                         'calm', 'excited', 'focused', 'nostalgic', 'energetic', 'relaxed']
        
        for tag in value:
            if not isinstance(tag, str):
                raise serializers.ValidationError("All emotional tags must be strings")
            if tag not in valid_emotions:
                raise serializers.ValidationError(f"Invalid emotional tag: {tag}")
        
        return value
    
    def validate_energy_level(self, value):
        """Validate energy level is within valid range"""
        if not 0.0 <= value <= 1.0:
            raise serializers.ValidationError("Energy level must be between 0.0 and 1.0")
        return value
    
    def validate_user_rating(self, value):
        """Validate user rating is within valid range"""
        if value is not None and not 0.0 <= value <= 5.0:
            raise serializers.ValidationError("User rating must be between 0.0 and 5.0")
        return value


class MusicRecommendationSerializer(serializers.ModelSerializer):
    """
    Serializer for MusicRecommendation model
    """
    recommended_playlist = YouTubePlaylistSerializer(read_only=True)
    dominant_emotion = serializers.SerializerMethodField()
    
    class Meta:
        model = MusicRecommendation
        fields = [
            'id', 'timestamp', 'emotion_context', 'energy_level',
            'recommended_playlist', 'recommendation_reason', 'confidence_score',
            'user_response', 'response_timestamp', 'alternative_choice',
            'dominant_emotion'
        ]
        read_only_fields = [
            'id', 'timestamp', 'recommended_playlist', 'recommendation_reason',
            'confidence_score', 'dominant_emotion'
        ]
    
    def get_dominant_emotion(self, obj):
        """Get dominant emotion from emotion context"""
        if obj.emotion_context and isinstance(obj.emotion_context, dict):
            emotions = obj.emotion_context.get('emotions', {})
            if emotions:
                dominant = max(emotions.items(), key=lambda x: x[1])
                return {
                    'emotion': dominant[0],
                    'probability': dominant[1]
                }
        return None
    
    def validate_emotion_context(self, value):
        """Validate emotion context structure"""
        if not isinstance(value, dict):
            raise serializers.ValidationError("Must be a dictionary")
        
        if 'emotions' not in value:
            raise serializers.ValidationError("Missing required field: emotions")
        
        emotions = value['emotions']
        if not isinstance(emotions, dict):
            raise serializers.ValidationError("Emotions must be a dictionary")
        
        return value
    
    def validate_energy_level(self, value):
        """Validate energy level is within valid range"""
        if not 0.0 <= value <= 1.0:
            raise serializers.ValidationError("Energy level must be between 0.0 and 1.0")
        return value
    
    def validate_confidence_score(self, value):
        """Validate confidence score is within valid range"""
        if not 0.0 <= value <= 1.0:
            raise serializers.ValidationError("Confidence score must be between 0.0 and 1.0")
        return value
    
    def validate_user_response(self, value):
        """Validate user response is a valid choice"""
        if value is not None:
            valid_responses = ['accepted', 'rejected', 'ignored', 'modified']
            if value not in valid_responses:
                raise serializers.ValidationError(f"User response must be one of: {valid_responses}")
        return value
    
    def validate_alternative_choice(self, value):
        """Validate alternative choice structure"""
        if value is not None and not isinstance(value, dict):
            raise serializers.ValidationError("Must be a dictionary or null")
        return value


class MusicRecommendationRequestSerializer(serializers.Serializer):
    """
    Serializer for music recommendation requests
    """
    emotions = serializers.DictField(
        child=serializers.FloatField(min_value=0.0, max_value=1.0),
        help_text="Dictionary of emotion probabilities"
    )
    energy_level = serializers.FloatField(
        min_value=0.0,
        max_value=1.0,
        help_text="Current energy level from 0.0 to 1.0"
    )
    max_recommendations = serializers.IntegerField(
        default=5,
        min_value=1,
        max_value=10,
        help_text="Maximum number of recommendations to return"
    )
    preferred_genres = serializers.ListField(
        child=serializers.CharField(max_length=50),
        required=False,
        help_text="List of preferred music genres"
    )
    
    def validate_emotions(self, value):
        """Validate emotions dictionary"""
        if not value:
            raise serializers.ValidationError("Emotions dictionary cannot be empty")
        
        valid_emotions = ['happy', 'sad', 'angry', 'surprised', 'fearful', 'disgusted', 'neutral']
        total_probability = 0.0
        
        for emotion, probability in value.items():
            if emotion not in valid_emotions:
                raise serializers.ValidationError(f"Invalid emotion: {emotion}")
            total_probability += probability
        
        # Allow some tolerance for floating point precision
        if not 0.95 <= total_probability <= 1.05:
            raise serializers.ValidationError(f"Total emotion probabilities should sum to approximately 1.0")
        
        return value


class MusicFeedbackSerializer(serializers.Serializer):
    """
    Serializer for music recommendation feedback
    """
    recommendation_id = serializers.IntegerField(
        help_text="ID of the music recommendation"
    )
    response = serializers.ChoiceField(
        choices=['accepted', 'rejected', 'modified', 'ignored'],
        help_text="User's response to the recommendation"
    )
    alternative_choice = serializers.DictField(
        required=False,
        help_text="Alternative music choice if recommendation was rejected"
    )
    rating = serializers.FloatField(
        min_value=0.0,
        max_value=5.0,
        required=False,
        help_text="Optional rating for the recommended playlist"
    )
    comment = serializers.CharField(
        max_length=500,
        required=False,
        help_text="Optional comment about the recommendation"
    )
    
    def validate_alternative_choice(self, value):
        """Validate alternative choice structure"""
        if value is not None:
            if not isinstance(value, dict):
                raise serializers.ValidationError("Must be a dictionary")
            
            # Validate common fields if present
            if 'genre' in value and not isinstance(value['genre'], str):
                raise serializers.ValidationError("Genre must be a string")
            
            if 'energy_level' in value:
                energy = value['energy_level']
                if not isinstance(energy, (int, float)) or not 0.0 <= energy <= 1.0:
                    raise serializers.ValidationError("Energy level must be between 0.0 and 1.0")
        
        return value


class PlaylistDiscoverySerializer(serializers.Serializer):
    """
    Serializer for playlist discovery requests
    """
    search_type = serializers.ChoiceField(
        choices=['emotion', 'genre'],
        default='emotion',
        help_text="Type of search to perform"
    )
    query = serializers.CharField(
        max_length=100,
        help_text="Search query (emotion name or genre name)"
    )
    energy_level = serializers.FloatField(
        min_value=0.0,
        max_value=1.0,
        default=0.5,
        help_text="Energy level for emotion-based searches"
    )
    max_results = serializers.IntegerField(
        default=10,
        min_value=1,
        max_value=25,
        help_text="Maximum number of playlists to discover"
    )
    
    def validate_query(self, value):
        """Validate search query"""
        if not value.strip():
            raise serializers.ValidationError("Query cannot be empty")
        return value.strip().lower()