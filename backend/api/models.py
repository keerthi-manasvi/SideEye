from django.db import models
from django.core.validators import MinValueValidator, MaxValueValidator
from django.core.exceptions import ValidationError
import json


class UserPreferences(models.Model):
    """
    Model to store user preferences for music, themes, and notifications
    """
    # Music preferences
    preferred_genres = models.JSONField(
        default=list,
        blank=True,
        help_text="List of preferred music genres"
    )
    music_energy_mappings = models.JSONField(
        default=dict,
        blank=True,
        help_text="Mapping of energy levels to music preferences"
    )
    
    # Theme preferences  
    preferred_color_palettes = models.JSONField(
        default=list,
        blank=True,
        help_text="List of preferred color palettes"
    )
    theme_emotion_mappings = models.JSONField(
        default=dict,
        blank=True,
        help_text="Mapping of emotions to theme preferences"
    )
    
    # Notification settings
    notification_frequency = models.IntegerField(
        default=5,
        validators=[MinValueValidator(1), MaxValueValidator(60)],
        help_text="Notification frequency in minutes"
    )
    wellness_reminder_interval = models.IntegerField(
        default=60,
        validators=[MinValueValidator(5), MaxValueValidator(480)],
        help_text="Wellness reminder interval in minutes"
    )
    notification_tone = models.CharField(
        max_length=20,
        choices=[
            ('sarcastic', 'Sarcastic'),
            ('motivational', 'Motivational'),
            ('balanced', 'Balanced'),
            ('minimal', 'Minimal')
        ],
        default='balanced',
        help_text="Tone of notifications"
    )
    
    # CLI Hook Configuration
    cli_hook_configuration = models.JSONField(
        default=dict,
        blank=True,
        help_text="Configuration for CLI hooks and command execution"
    )
    
    # Metadata
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = "User Preferences"
        verbose_name_plural = "User Preferences"
    
    def clean(self):
        """Validate JSON fields contain expected data types"""
        super().clean()
        
        # Validate preferred_genres is a list
        if not isinstance(self.preferred_genres, list):
            raise ValidationError({'preferred_genres': 'Must be a list of genres'})
        
        # Validate music_energy_mappings is a dict
        if not isinstance(self.music_energy_mappings, dict):
            raise ValidationError({'music_energy_mappings': 'Must be a dictionary'})
        
        # Validate preferred_color_palettes is a list
        if not isinstance(self.preferred_color_palettes, list):
            raise ValidationError({'preferred_color_palettes': 'Must be a list of color palettes'})
        
        # Validate theme_emotion_mappings is a dict
        if not isinstance(self.theme_emotion_mappings, dict):
            raise ValidationError({'theme_emotion_mappings': 'Must be a dictionary'})
    
    def __str__(self):
        return f"User Preferences (Updated: {self.updated_at.strftime('%Y-%m-%d %H:%M')})"


class EmotionReading(models.Model):
    """
    Model to store emotion detection readings from TensorFlow.js
    """
    timestamp = models.DateTimeField(auto_now_add=True)
    
    # Emotion data as JSON with emotion probabilities
    emotions = models.JSONField(
        help_text="Dictionary of emotion probabilities (e.g., {'happy': 0.8, 'sad': 0.1})"
    )
    
    # Energy level from 0.0 to 1.0
    energy_level = models.FloatField(
        validators=[MinValueValidator(0.0), MaxValueValidator(1.0)],
        help_text="Energy level from 0.0 (low) to 1.0 (high)"
    )
    
    # Posture score from 0.0 to 1.0
    posture_score = models.FloatField(
        validators=[MinValueValidator(0.0), MaxValueValidator(1.0)],
        help_text="Posture quality score from 0.0 (poor) to 1.0 (excellent)"
    )
    
    # Blink rate in blinks per minute
    blink_rate = models.FloatField(
        validators=[MinValueValidator(0.0), MaxValueValidator(100.0)],
        help_text="Blink rate in blinks per minute"
    )
    
    # Detection confidence from 0.0 to 1.0
    confidence = models.FloatField(
        validators=[MinValueValidator(0.0), MaxValueValidator(1.0)],
        help_text="Detection confidence from 0.0 (low) to 1.0 (high)"
    )
    
    class Meta:
        verbose_name = "Emotion Reading"
        verbose_name_plural = "Emotion Readings"
        ordering = ['-timestamp']
        indexes = [
            models.Index(fields=['timestamp']),
            models.Index(fields=['energy_level']),
            models.Index(fields=['confidence']),
        ]
    
    def clean(self):
        """Validate emotions JSON field contains valid emotion data"""
        super().clean()
        
        if not isinstance(self.emotions, dict):
            raise ValidationError({'emotions': 'Must be a dictionary of emotion probabilities'})
        
        # Validate emotion probabilities are between 0 and 1
        for emotion, probability in self.emotions.items():
            if not isinstance(probability, (int, float)):
                raise ValidationError({'emotions': f'Probability for {emotion} must be a number'})
            if not 0.0 <= probability <= 1.0:
                raise ValidationError({'emotions': f'Probability for {emotion} must be between 0.0 and 1.0'})
    
    def get_dominant_emotion(self):
        """Return the emotion with the highest probability"""
        if not self.emotions:
            return None
        return max(self.emotions.items(), key=lambda x: x[1])
    
    def __str__(self):
        dominant_emotion = self.get_dominant_emotion()
        emotion_str = f"{dominant_emotion[0]} ({dominant_emotion[1]:.2f})" if dominant_emotion else "No emotions"
        return f"Emotion Reading - {emotion_str} at {self.timestamp.strftime('%Y-%m-%d %H:%M:%S')}"


class UserFeedback(models.Model):
    """
    Model to store user feedback on AI suggestions for learning purposes
    """
    SUGGESTION_TYPES = [
        ('music', 'Music Recommendation'),
        ('theme', 'Theme Suggestion'),
        ('task', 'Task Recommendation'),
        ('notification', 'Notification'),
    ]
    
    RESPONSE_TYPES = [
        ('accepted', 'Accepted'),
        ('rejected', 'Rejected'),
        ('modified', 'Modified'),
        ('ignored', 'Ignored'),
    ]
    
    timestamp = models.DateTimeField(auto_now_add=True)
    
    # Type of suggestion that was made
    suggestion_type = models.CharField(
        max_length=20,
        choices=SUGGESTION_TYPES,
        help_text="Type of AI suggestion"
    )
    
    # Emotional context when suggestion was made
    emotion_context = models.JSONField(
        help_text="Emotion and energy data when suggestion was made"
    )
    
    # The actual suggestion data
    suggestion_data = models.JSONField(
        help_text="Details of the suggestion that was made"
    )
    
    # User's response to the suggestion
    user_response = models.CharField(
        max_length=20,
        choices=RESPONSE_TYPES,
        help_text="How the user responded to the suggestion"
    )
    
    # Alternative preference if user rejected suggestion
    alternative_preference = models.JSONField(
        null=True,
        blank=True,
        help_text="User's alternative preference when rejecting suggestion"
    )
    
    # Optional user comment
    user_comment = models.TextField(
        blank=True,
        help_text="Optional user comment about the suggestion"
    )
    
    class Meta:
        verbose_name = "User Feedback"
        verbose_name_plural = "User Feedback"
        ordering = ['-timestamp']
        indexes = [
            models.Index(fields=['timestamp']),
            models.Index(fields=['suggestion_type']),
            models.Index(fields=['user_response']),
        ]
    
    def clean(self):
        """Validate JSON fields contain expected data"""
        super().clean()
        
        if not isinstance(self.emotion_context, dict):
            raise ValidationError({'emotion_context': 'Must be a dictionary'})
        
        if not isinstance(self.suggestion_data, dict):
            raise ValidationError({'suggestion_data': 'Must be a dictionary'})
        
        if self.alternative_preference is not None and not isinstance(self.alternative_preference, dict):
            raise ValidationError({'alternative_preference': 'Must be a dictionary or null'})
    
    def __str__(self):
        return f"{self.get_suggestion_type_display()} - {self.get_user_response_display()} at {self.timestamp.strftime('%Y-%m-%d %H:%M:%S')}"


class Task(models.Model):
    """
    Model to store user tasks with energy-based sorting and complexity scoring
    """
    PRIORITY_CHOICES = [
        ('low', 'Low'),
        ('medium', 'Medium'),
        ('high', 'High'),
        ('urgent', 'Urgent'),
    ]
    
    COMPLEXITY_CHOICES = [
        ('simple', 'Simple'),
        ('moderate', 'Moderate'),
        ('complex', 'Complex'),
        ('creative', 'Creative'),
    ]
    
    STATUS_CHOICES = [
        ('todo', 'To Do'),
        ('in_progress', 'In Progress'),
        ('completed', 'Completed'),
        ('cancelled', 'Cancelled'),
    ]
    
    # Basic task information
    title = models.CharField(
        max_length=200,
        help_text="Task title or description"
    )
    description = models.TextField(
        blank=True,
        help_text="Detailed task description"
    )
    
    # Task categorization
    priority = models.CharField(
        max_length=10,
        choices=PRIORITY_CHOICES,
        default='medium',
        help_text="Task priority level"
    )
    
    complexity = models.CharField(
        max_length=10,
        choices=COMPLEXITY_CHOICES,
        default='moderate',
        help_text="Task complexity level"
    )
    
    status = models.CharField(
        max_length=15,
        choices=STATUS_CHOICES,
        default='todo',
        help_text="Current task status"
    )
    
    # Energy-based scoring
    complexity_score = models.FloatField(
        default=0.5,
        validators=[MinValueValidator(0.0), MaxValueValidator(1.0)],
        help_text="Calculated complexity score from 0.0 (simple) to 1.0 (complex)"
    )
    
    optimal_energy_level = models.FloatField(
        default=0.5,
        validators=[MinValueValidator(0.0), MaxValueValidator(1.0)],
        help_text="Optimal energy level for this task from 0.0 (low) to 1.0 (high)"
    )
    
    # Learning data
    completion_energy_levels = models.JSONField(
        default=list,
        blank=True,
        help_text="List of energy levels when task was worked on"
    )
    
    user_energy_correlation = models.FloatField(
        default=0.0,
        validators=[MinValueValidator(-1.0), MaxValueValidator(1.0)],
        help_text="Learned correlation between user energy and task performance (-1.0 to 1.0)"
    )
    
    # Metadata
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    due_date = models.DateTimeField(
        null=True,
        blank=True,
        help_text="Optional due date for the task"
    )
    
    # Estimated and actual time
    estimated_duration = models.IntegerField(
        null=True,
        blank=True,
        validators=[MinValueValidator(1)],
        help_text="Estimated duration in minutes"
    )
    
    actual_duration = models.IntegerField(
        null=True,
        blank=True,
        validators=[MinValueValidator(1)],
        help_text="Actual duration in minutes"
    )
    
    class Meta:
        verbose_name = "Task"
        verbose_name_plural = "Tasks"
        ordering = ['-priority', '-complexity_score', 'created_at']
        indexes = [
            models.Index(fields=['status']),
            models.Index(fields=['priority']),
            models.Index(fields=['complexity_score']),
            models.Index(fields=['optimal_energy_level']),
            models.Index(fields=['due_date']),
            models.Index(fields=['created_at']),
        ]
    
    def clean(self):
        """Validate JSON fields and business logic"""
        super().clean()
        
        if not isinstance(self.completion_energy_levels, list):
            raise ValidationError({'completion_energy_levels': 'Must be a list of energy levels'})
        
        # Validate energy levels in completion_energy_levels
        for energy_level in self.completion_energy_levels:
            if not isinstance(energy_level, (int, float)):
                raise ValidationError({'completion_energy_levels': 'All energy levels must be numbers'})
            if not 0.0 <= energy_level <= 1.0:
                raise ValidationError({'completion_energy_levels': 'All energy levels must be between 0.0 and 1.0'})
    
    def calculate_complexity_score(self):
        """Calculate complexity score based on task attributes"""
        base_scores = {
            'simple': 0.2,
            'moderate': 0.5,
            'complex': 0.8,
            'creative': 0.9,
        }
        
        score = base_scores.get(self.complexity, 0.5)
        
        # Adjust based on priority
        priority_multipliers = {
            'low': 0.9,
            'medium': 1.0,
            'high': 1.1,
            'urgent': 1.2,
        }
        
        score *= priority_multipliers.get(self.priority, 1.0)
        
        # Adjust based on estimated duration
        if self.estimated_duration:
            if self.estimated_duration > 120:  # > 2 hours
                score *= 1.1
            elif self.estimated_duration < 30:  # < 30 minutes
                score *= 0.9
        
        return min(1.0, max(0.0, score))
    
    def update_energy_correlation(self, energy_level, performance_rating=None):
        """Update the energy correlation based on task completion data"""
        self.completion_energy_levels.append(energy_level)
        
        # Keep only last 10 completion records
        if len(self.completion_energy_levels) > 10:
            self.completion_energy_levels = self.completion_energy_levels[-10:]
        
        # Calculate correlation between energy levels and optimal performance
        if len(self.completion_energy_levels) >= 3:
            import statistics
            avg_energy = statistics.mean(self.completion_energy_levels)
            
            # Simple correlation: higher energy levels for complex tasks
            if self.complexity_score > 0.7:
                self.user_energy_correlation = min(1.0, avg_energy * 1.5 - 0.5)
            else:
                self.user_energy_correlation = max(-1.0, 1.0 - avg_energy * 1.5)
    
    def get_energy_match_score(self, current_energy_level):
        """Calculate how well current energy matches this task's requirements"""
        if not current_energy_level:
            return 0.5
        
        # Base match based on optimal energy level
        energy_diff = abs(current_energy_level - self.optimal_energy_level)
        base_match = 1.0 - energy_diff
        
        # Adjust based on learned correlation
        if self.user_energy_correlation != 0.0:
            correlation_bonus = self.user_energy_correlation * 0.2
            base_match += correlation_bonus
        
        return min(1.0, max(0.0, base_match))
    
    def save(self, *args, **kwargs):
        """Override save to automatically calculate complexity score"""
        self.complexity_score = self.calculate_complexity_score()
        
        # Set optimal energy level based on complexity
        if self.complexity in ['complex', 'creative']:
            self.optimal_energy_level = max(0.7, self.complexity_score)
        elif self.complexity == 'simple':
            self.optimal_energy_level = min(0.4, self.complexity_score + 0.2)
        else:
            self.optimal_energy_level = self.complexity_score
        
        super().save(*args, **kwargs)
    
    def __str__(self):
        return f"{self.title} ({self.get_status_display()}) - Complexity: {self.complexity_score:.2f}"


class MusicGenre(models.Model):
    """
    Model to store music genres and their emotional associations
    """
    name = models.CharField(
        max_length=50,
        unique=True,
        help_text="Genre name (e.g., 'rock', 'classical', 'electronic')"
    )
    
    # Emotional associations for this genre
    emotional_associations = models.JSONField(
        default=dict,
        help_text="Dictionary mapping emotions to strength scores (0.0-1.0)"
    )
    
    # Energy level associations
    typical_energy_range = models.JSONField(
        default=list,
        help_text="List with [min_energy, max_energy] for this genre"
    )
    
    # Metadata
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = "Music Genre"
        verbose_name_plural = "Music Genres"
        ordering = ['name']
    
    def clean(self):
        """Validate JSON fields"""
        super().clean()
        
        if not isinstance(self.emotional_associations, dict):
            raise ValidationError({'emotional_associations': 'Must be a dictionary'})
        
        if not isinstance(self.typical_energy_range, list) or len(self.typical_energy_range) != 2:
            raise ValidationError({'typical_energy_range': 'Must be a list with [min_energy, max_energy]'})
        
        # Validate energy range values
        if self.typical_energy_range:
            min_energy, max_energy = self.typical_energy_range
            if not (0.0 <= min_energy <= 1.0 and 0.0 <= max_energy <= 1.0):
                raise ValidationError({'typical_energy_range': 'Energy values must be between 0.0 and 1.0'})
            if min_energy > max_energy:
                raise ValidationError({'typical_energy_range': 'Min energy cannot be greater than max energy'})
    
    def __str__(self):
        return self.name


class YouTubePlaylist(models.Model):
    """
    Model to store YouTube playlist information and metadata
    """
    # YouTube playlist data
    youtube_id = models.CharField(
        max_length=50,
        unique=True,
        help_text="YouTube playlist ID"
    )
    title = models.CharField(
        max_length=200,
        help_text="Playlist title"
    )
    description = models.TextField(
        blank=True,
        help_text="Playlist description"
    )
    channel_title = models.CharField(
        max_length=100,
        blank=True,
        help_text="Channel that created the playlist"
    )
    
    # Categorization
    genres = models.ManyToManyField(
        MusicGenre,
        blank=True,
        help_text="Associated music genres"
    )
    
    # Emotional and energy associations
    emotional_tags = models.JSONField(
        default=list,
        help_text="List of emotional tags for this playlist"
    )
    energy_level = models.FloatField(
        default=0.5,
        validators=[MinValueValidator(0.0), MaxValueValidator(1.0)],
        help_text="Average energy level of this playlist (0.0-1.0)"
    )
    
    # User interaction data
    user_rating = models.FloatField(
        null=True,
        blank=True,
        validators=[MinValueValidator(0.0), MaxValueValidator(5.0)],
        help_text="User rating from 0.0 to 5.0"
    )
    play_count = models.IntegerField(
        default=0,
        help_text="Number of times this playlist was recommended/played"
    )
    acceptance_rate = models.FloatField(
        default=0.0,
        validators=[MinValueValidator(0.0), MaxValueValidator(1.0)],
        help_text="Rate at which user accepts this playlist (0.0-1.0)"
    )
    
    # Caching and metadata
    video_count = models.IntegerField(
        default=0,
        help_text="Number of videos in the playlist"
    )
    last_updated = models.DateTimeField(
        null=True,
        blank=True,
        help_text="When playlist data was last updated from YouTube"
    )
    is_active = models.BooleanField(
        default=True,
        help_text="Whether this playlist is still available and active"
    )
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = "YouTube Playlist"
        verbose_name_plural = "YouTube Playlists"
        ordering = ['-acceptance_rate', '-user_rating', 'title']
        indexes = [
            models.Index(fields=['youtube_id']),
            models.Index(fields=['energy_level']),
            models.Index(fields=['acceptance_rate']),
            models.Index(fields=['is_active']),
        ]
    
    def clean(self):
        """Validate JSON fields"""
        super().clean()
        
        if not isinstance(self.emotional_tags, list):
            raise ValidationError({'emotional_tags': 'Must be a list of emotional tags'})
    
    def update_acceptance_rate(self, accepted):
        """Update acceptance rate based on user feedback"""
        self.play_count += 1
        
        if self.play_count == 1:
            self.acceptance_rate = 1.0 if accepted else 0.0
        else:
            # Weighted average with more weight on recent interactions
            weight = 0.3  # Weight for new interaction
            if accepted:
                self.acceptance_rate = (1 - weight) * self.acceptance_rate + weight * 1.0
            else:
                self.acceptance_rate = (1 - weight) * self.acceptance_rate + weight * 0.0
        
        self.save()
    
    def get_emotion_match_score(self, emotions):
        """Calculate how well this playlist matches given emotions"""
        if not emotions or not self.emotional_tags:
            return 0.5
        
        # Calculate overlap between playlist tags and detected emotions
        emotion_scores = []
        for tag in self.emotional_tags:
            if tag in emotions:
                emotion_scores.append(emotions[tag])
        
        if not emotion_scores:
            return 0.1  # Low score if no emotional overlap
        
        # Return average of matching emotion scores
        return sum(emotion_scores) / len(emotion_scores)
    
    def __str__(self):
        return f"{self.title} (Rating: {self.acceptance_rate:.2f})"


class MusicRecommendation(models.Model):
    """
    Model to track music recommendations and their outcomes
    """
    # Context when recommendation was made
    timestamp = models.DateTimeField(auto_now_add=True)
    emotion_context = models.JSONField(
        help_text="Emotion data when recommendation was made"
    )
    energy_level = models.FloatField(
        validators=[MinValueValidator(0.0), MaxValueValidator(1.0)],
        help_text="Energy level when recommendation was made"
    )
    
    # Recommendation details
    recommended_playlist = models.ForeignKey(
        YouTubePlaylist,
        on_delete=models.CASCADE,
        help_text="The playlist that was recommended"
    )
    recommendation_reason = models.TextField(
        help_text="Explanation of why this playlist was recommended"
    )
    confidence_score = models.FloatField(
        validators=[MinValueValidator(0.0), MaxValueValidator(1.0)],
        help_text="Confidence in this recommendation (0.0-1.0)"
    )
    
    # User response
    user_response = models.CharField(
        max_length=20,
        choices=[
            ('accepted', 'Accepted'),
            ('rejected', 'Rejected'),
            ('ignored', 'Ignored'),
            ('modified', 'Modified'),
        ],
        null=True,
        blank=True,
        help_text="How the user responded to this recommendation"
    )
    response_timestamp = models.DateTimeField(
        null=True,
        blank=True,
        help_text="When the user responded to the recommendation"
    )
    
    # Alternative chosen by user (if rejected)
    alternative_choice = models.JSONField(
        null=True,
        blank=True,
        help_text="Alternative music choice made by user"
    )
    
    class Meta:
        verbose_name = "Music Recommendation"
        verbose_name_plural = "Music Recommendations"
        ordering = ['-timestamp']
        indexes = [
            models.Index(fields=['timestamp']),
            models.Index(fields=['user_response']),
            models.Index(fields=['energy_level']),
        ]
    
    def clean(self):
        """Validate JSON fields"""
        super().clean()
        
        if not isinstance(self.emotion_context, dict):
            raise ValidationError({'emotion_context': 'Must be a dictionary'})
        
        if self.alternative_choice is not None and not isinstance(self.alternative_choice, dict):
            raise ValidationError({'alternative_choice': 'Must be a dictionary or null'})
    
    def __str__(self):
        response = f" - {self.user_response}" if self.user_response else ""
        return f"Recommendation: {self.recommended_playlist.title}{response}"