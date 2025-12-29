"""
Data Privacy Service for SideEye

Handles data retention policies, secure deletion, data export, and optional encryption.
Ensures compliance with privacy requirements and user data control.
"""

import os
import json
import hashlib
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any
from django.conf import settings
from django.db import transaction
from django.core.serializers import serialize
from django.utils import timezone
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
import base64

from ..models import (
    EmotionReading, UserFeedback, Task, UserPreferences,
    YouTubePlaylist, MusicRecommendation
)

logger = logging.getLogger(__name__)


class DataPrivacyService:
    """
    Service for managing data privacy, retention, and security features
    """
    
    def __init__(self):
        self.encryption_key = None
        self._load_encryption_settings()
    
    def _load_encryption_settings(self):
        """Load encryption settings from Django settings or environment"""
        try:
            # Try to load encryption key from settings or generate one
            encryption_password = getattr(settings, 'DATA_ENCRYPTION_PASSWORD', None)
            if encryption_password:
                self.encryption_key = self._derive_key_from_password(encryption_password)
            else:
                # Check if encryption is enabled in environment
                if os.getenv('SIDEEYE_ENABLE_ENCRYPTION', 'false').lower() == 'true':
                    # Generate a key if encryption is enabled but no password set
                    self.encryption_key = Fernet.generate_key()
                    logger.warning("Generated new encryption key. Set DATA_ENCRYPTION_PASSWORD for persistent encryption.")
        except Exception as e:
            logger.error(f"Failed to load encryption settings: {e}")
            self.encryption_key = None
    
    def _derive_key_from_password(self, password: str) -> bytes:
        """Derive encryption key from password using PBKDF2"""
        # Use a fixed salt for consistency (in production, this should be configurable)
        salt = b'sideeye_salt_2024'  # 16 bytes
        kdf = PBKDF2HMAC(
            algorithm=hashes.SHA256(),
            length=32,
            salt=salt,
            iterations=100000,
        )
        key = base64.urlsafe_b64encode(kdf.derive(password.encode()))
        return key
    
    def encrypt_data(self, data: str) -> str:
        """Encrypt sensitive data if encryption is enabled"""
        if not self.encryption_key:
            return data
        
        try:
            fernet = Fernet(self.encryption_key)
            encrypted_data = fernet.encrypt(data.encode())
            return base64.urlsafe_b64encode(encrypted_data).decode()
        except Exception as e:
            logger.error(f"Failed to encrypt data: {e}")
            return data
    
    def decrypt_data(self, encrypted_data: str) -> str:
        """Decrypt sensitive data if encryption is enabled"""
        if not self.encryption_key:
            return encrypted_data
        
        try:
            fernet = Fernet(self.encryption_key)
            decoded_data = base64.urlsafe_b64decode(encrypted_data.encode())
            decrypted_data = fernet.decrypt(decoded_data)
            return decrypted_data.decode()
        except Exception as e:
            logger.error(f"Failed to decrypt data: {e}")
            return encrypted_data
    
    def apply_data_retention_policy(self, retention_days: int = 90) -> Dict[str, int]:
        """
        Apply data retention policy by removing old data
        
        Args:
            retention_days: Number of days to retain data (default: 90)
            
        Returns:
            Dictionary with counts of deleted records by model
        """
        cutoff_date = timezone.now() - timedelta(days=retention_days)
        deleted_counts = {}
        
        try:
            with transaction.atomic():
                # Delete old emotion readings
                emotion_count = EmotionReading.objects.filter(
                    timestamp__lt=cutoff_date
                ).count()
                EmotionReading.objects.filter(timestamp__lt=cutoff_date).delete()
                deleted_counts['emotion_readings'] = emotion_count
                
                # Delete old user feedback
                feedback_count = UserFeedback.objects.filter(
                    timestamp__lt=cutoff_date
                ).count()
                UserFeedback.objects.filter(timestamp__lt=cutoff_date).delete()
                deleted_counts['user_feedback'] = feedback_count
                
                # Delete old music recommendations
                recommendation_count = MusicRecommendation.objects.filter(
                    timestamp__lt=cutoff_date
                ).count()
                MusicRecommendation.objects.filter(timestamp__lt=cutoff_date).delete()
                deleted_counts['music_recommendations'] = recommendation_count
                
                # Delete completed tasks older than retention period
                completed_tasks_count = Task.objects.filter(
                    status='completed',
                    updated_at__lt=cutoff_date
                ).count()
                Task.objects.filter(
                    status='completed',
                    updated_at__lt=cutoff_date
                ).delete()
                deleted_counts['completed_tasks'] = completed_tasks_count
                
                logger.info(f"Data retention policy applied. Deleted: {deleted_counts}")
                
        except Exception as e:
            logger.error(f"Failed to apply data retention policy: {e}")
            raise
        
        return deleted_counts
    
    def secure_delete_all_user_data(self) -> Dict[str, int]:
        """
        Securely delete all user data from the system
        
        Returns:
            Dictionary with counts of deleted records by model
        """
        deleted_counts = {}
        
        try:
            with transaction.atomic():
                # Delete all emotion readings
                emotion_count = EmotionReading.objects.count()
                EmotionReading.objects.all().delete()
                deleted_counts['emotion_readings'] = emotion_count
                
                # Delete all user feedback
                feedback_count = UserFeedback.objects.count()
                UserFeedback.objects.all().delete()
                deleted_counts['user_feedback'] = feedback_count
                
                # Delete all tasks
                task_count = Task.objects.count()
                Task.objects.all().delete()
                deleted_counts['tasks'] = task_count
                
                # Delete all music recommendations
                recommendation_count = MusicRecommendation.objects.count()
                MusicRecommendation.objects.all().delete()
                deleted_counts['music_recommendations'] = recommendation_count
                
                # Reset user preferences to defaults
                preferences_count = UserPreferences.objects.count()
                UserPreferences.objects.all().delete()
                deleted_counts['user_preferences'] = preferences_count
                
                # Keep YouTube playlists as they're not personal data
                # but reset user-specific data
                playlist_count = YouTubePlaylist.objects.count()
                YouTubePlaylist.objects.update(
                    user_rating=None,
                    play_count=0,
                    acceptance_rate=0.0
                )
                deleted_counts['playlist_user_data_reset'] = playlist_count
                
                logger.info(f"All user data securely deleted. Counts: {deleted_counts}")
                
        except Exception as e:
            logger.error(f"Failed to securely delete user data: {e}")
            raise
        
        return deleted_counts
    
    def export_user_data(self, include_raw_emotions: bool = True) -> Dict[str, Any]:
        """
        Export all user data for portability
        
        Args:
            include_raw_emotions: Whether to include raw emotion readings (can be large)
            
        Returns:
            Dictionary containing all user data
        """
        try:
            export_data = {
                'export_timestamp': timezone.now().isoformat(),
                'export_version': '1.0',
                'data': {}
            }
            
            # Export user preferences
            preferences = UserPreferences.objects.all()
            if preferences.exists():
                export_data['data']['user_preferences'] = json.loads(
                    serialize('json', preferences)
                )
            
            # Export tasks
            tasks = Task.objects.all()
            if tasks.exists():
                export_data['data']['tasks'] = json.loads(
                    serialize('json', tasks)
                )
            
            # Export user feedback
            feedback = UserFeedback.objects.all()
            if feedback.exists():
                export_data['data']['user_feedback'] = json.loads(
                    serialize('json', feedback)
                )
            
            # Export music recommendations
            recommendations = MusicRecommendation.objects.all()
            if recommendations.exists():
                export_data['data']['music_recommendations'] = json.loads(
                    serialize('json', recommendations)
                )
            
            # Export YouTube playlists with user data
            playlists = YouTubePlaylist.objects.exclude(
                user_rating__isnull=True,
                play_count=0
            )
            if playlists.exists():
                export_data['data']['youtube_playlists'] = json.loads(
                    serialize('json', playlists)
                )
            
            # Optionally export emotion readings (can be very large)
            if include_raw_emotions:
                # Limit to last 30 days to prevent huge exports
                recent_cutoff = timezone.now() - timedelta(days=30)
                emotions = EmotionReading.objects.filter(timestamp__gte=recent_cutoff)
                if emotions.exists():
                    export_data['data']['emotion_readings'] = json.loads(
                        serialize('json', emotions)
                    )
                    export_data['data']['emotion_readings_note'] = "Limited to last 30 days"
            
            # Add summary statistics
            export_data['summary'] = {
                'total_emotion_readings': EmotionReading.objects.count(),
                'total_tasks': Task.objects.count(),
                'total_feedback_entries': UserFeedback.objects.count(),
                'total_music_recommendations': MusicRecommendation.objects.count(),
                'data_retention_days': self.get_retention_policy_days(),
                'encryption_enabled': self.encryption_key is not None
            }
            
            logger.info("User data export completed successfully")
            return export_data
            
        except Exception as e:
            logger.error(f"Failed to export user data: {e}")
            raise
    
    def get_data_summary(self) -> Dict[str, Any]:
        """
        Get summary of stored user data
        
        Returns:
            Dictionary with data counts and storage information
        """
        try:
            summary = {
                'data_counts': {
                    'emotion_readings': EmotionReading.objects.count(),
                    'user_feedback': UserFeedback.objects.count(),
                    'tasks': Task.objects.count(),
                    'music_recommendations': MusicRecommendation.objects.count(),
                    'user_preferences': UserPreferences.objects.count(),
                    'youtube_playlists': YouTubePlaylist.objects.count()
                },
                'date_ranges': {},
                'privacy_settings': {
                    'encryption_enabled': self.encryption_key is not None,
                    'retention_policy_days': self.get_retention_policy_days(),
                    'local_processing_only': True
                }
            }
            
            # Get date ranges for time-series data
            if EmotionReading.objects.exists():
                oldest_emotion = EmotionReading.objects.earliest('timestamp')
                newest_emotion = EmotionReading.objects.latest('timestamp')
                summary['date_ranges']['emotion_readings'] = {
                    'oldest': oldest_emotion.timestamp.isoformat(),
                    'newest': newest_emotion.timestamp.isoformat()
                }
            
            if UserFeedback.objects.exists():
                oldest_feedback = UserFeedback.objects.earliest('timestamp')
                newest_feedback = UserFeedback.objects.latest('timestamp')
                summary['date_ranges']['user_feedback'] = {
                    'oldest': oldest_feedback.timestamp.isoformat(),
                    'newest': newest_feedback.timestamp.isoformat()
                }
            
            if Task.objects.exists():
                oldest_task = Task.objects.earliest('created_at')
                newest_task = Task.objects.latest('created_at')
                summary['date_ranges']['tasks'] = {
                    'oldest': oldest_task.created_at.isoformat(),
                    'newest': newest_task.created_at.isoformat()
                }
            
            return summary
            
        except Exception as e:
            logger.error(f"Failed to get data summary: {e}")
            raise
    
    def get_retention_policy_days(self) -> int:
        """Get current data retention policy in days"""
        return getattr(settings, 'DATA_RETENTION_DAYS', 90)
    
    def set_retention_policy_days(self, days: int) -> bool:
        """
        Set data retention policy (this would typically update a config file)
        
        Args:
            days: Number of days to retain data
            
        Returns:
            True if successful, False otherwise
        """
        try:
            # In a real implementation, this would update a configuration file
            # For now, we'll just validate the input
            if days < 1 or days > 3650:  # 1 day to 10 years
                raise ValueError("Retention days must be between 1 and 3650")
            
            # This would typically write to a config file or environment variable
            logger.info(f"Data retention policy would be set to {days} days")
            return True
            
        except Exception as e:
            logger.error(f"Failed to set retention policy: {e}")
            return False
    
    def cleanup_orphaned_data(self) -> Dict[str, int]:
        """
        Clean up orphaned data and inconsistencies
        
        Returns:
            Dictionary with counts of cleaned up records
        """
        cleanup_counts = {}
        
        try:
            with transaction.atomic():
                # Clean up music recommendations for deleted playlists
                orphaned_recommendations = MusicRecommendation.objects.filter(
                    recommended_playlist__isnull=True
                )
                recommendation_count = orphaned_recommendations.count()
                orphaned_recommendations.delete()
                cleanup_counts['orphaned_recommendations'] = recommendation_count
                
                # Clean up invalid emotion readings (confidence < 0.1)
                invalid_emotions = EmotionReading.objects.filter(confidence__lt=0.1)
                emotion_count = invalid_emotions.count()
                invalid_emotions.delete()
                cleanup_counts['low_confidence_emotions'] = emotion_count
                
                # Clean up empty feedback entries
                empty_feedback = UserFeedback.objects.filter(
                    suggestion_data__isnull=True
                )
                feedback_count = empty_feedback.count()
                empty_feedback.delete()
                cleanup_counts['empty_feedback'] = feedback_count
                
                logger.info(f"Orphaned data cleanup completed: {cleanup_counts}")
                
        except Exception as e:
            logger.error(f"Failed to cleanup orphaned data: {e}")
            raise
        
        return cleanup_counts
    
    def anonymize_old_data(self, anonymize_after_days: int = 365) -> Dict[str, int]:
        """
        Anonymize old data by removing personally identifiable information
        
        Args:
            anonymize_after_days: Days after which to anonymize data
            
        Returns:
            Dictionary with counts of anonymized records
        """
        cutoff_date = timezone.now() - timedelta(days=anonymize_after_days)
        anonymized_counts = {}
        
        try:
            with transaction.atomic():
                # Anonymize old user feedback by removing comments
                feedback_to_anonymize = UserFeedback.objects.filter(
                    timestamp__lt=cutoff_date,
                    user_comment__isnull=False
                )
                feedback_count = feedback_to_anonymize.count()
                feedback_to_anonymize.update(
                    user_comment="[Anonymized]",
                    alternative_preference=None
                )
                anonymized_counts['user_feedback'] = feedback_count
                
                # Anonymize old task descriptions
                tasks_to_anonymize = Task.objects.filter(
                    created_at__lt=cutoff_date
                ).exclude(description="")
                task_count = tasks_to_anonymize.count()
                tasks_to_anonymize.update(description="[Anonymized]")
                anonymized_counts['task_descriptions'] = task_count
                
                logger.info(f"Data anonymization completed: {anonymized_counts}")
                
        except Exception as e:
            logger.error(f"Failed to anonymize old data: {e}")
            raise
        
        return anonymized_counts
    
    def validate_data_integrity(self) -> Dict[str, Any]:
        """
        Validate data integrity and return report
        
        Returns:
            Dictionary with integrity check results
        """
        integrity_report = {
            'timestamp': timezone.now().isoformat(),
            'checks_passed': 0,
            'checks_failed': 0,
            'issues': [],
            'recommendations': []
        }
        
        try:
            # Check for emotion readings with invalid data
            invalid_emotions = EmotionReading.objects.filter(
                confidence__lt=0.0
            ).count()
            if invalid_emotions > 0:
                integrity_report['checks_failed'] += 1
                integrity_report['issues'].append(
                    f"Found {invalid_emotions} emotion readings with invalid confidence scores"
                )
                integrity_report['recommendations'].append(
                    "Run cleanup_orphaned_data() to remove invalid emotion readings"
                )
            else:
                integrity_report['checks_passed'] += 1
            
            # Check for tasks with invalid complexity scores
            invalid_tasks = Task.objects.filter(
                complexity_score__lt=0.0
            ).count()
            if invalid_tasks > 0:
                integrity_report['checks_failed'] += 1
                integrity_report['issues'].append(
                    f"Found {invalid_tasks} tasks with invalid complexity scores"
                )
            else:
                integrity_report['checks_passed'] += 1
            
            # Check for orphaned music recommendations
            orphaned_recs = MusicRecommendation.objects.filter(
                recommended_playlist__isnull=True
            ).count()
            if orphaned_recs > 0:
                integrity_report['checks_failed'] += 1
                integrity_report['issues'].append(
                    f"Found {orphaned_recs} orphaned music recommendations"
                )
                integrity_report['recommendations'].append(
                    "Run cleanup_orphaned_data() to remove orphaned recommendations"
                )
            else:
                integrity_report['checks_passed'] += 1
            
            # Check data age and suggest retention policy application
            old_data_cutoff = timezone.now() - timedelta(days=self.get_retention_policy_days())
            old_emotions = EmotionReading.objects.filter(
                timestamp__lt=old_data_cutoff
            ).count()
            if old_emotions > 1000:  # Threshold for suggesting cleanup
                integrity_report['recommendations'].append(
                    f"Found {old_emotions} old emotion readings. Consider applying retention policy."
                )
            
            logger.info(f"Data integrity validation completed: {integrity_report}")
            
        except Exception as e:
            logger.error(f"Failed to validate data integrity: {e}")
            integrity_report['issues'].append(f"Integrity check failed: {str(e)}")
            integrity_report['checks_failed'] += 1
        
        return integrity_report


# Global instance
data_privacy_service = DataPrivacyService()