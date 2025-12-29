"""
Tests for Data Privacy Service

Tests data retention policies, secure deletion, data export, and encryption functionality.
"""

import os
import json
from datetime import datetime, timedelta
from unittest.mock import patch, MagicMock
from django.test import TestCase
from django.utils import timezone
from django.conf import settings
from cryptography.fernet import Fernet

from ..models import (
    EmotionReading, UserFeedback, Task, UserPreferences,
    YouTubePlaylist, MusicRecommendation, MusicGenre
)
from ..services.data_privacy_service import data_privacy_service


class DataPrivacyServiceTest(TestCase):
    """Test cases for DataPrivacyService"""
    
    def setUp(self):
        """Set up test data"""
        self.service = data_privacy_service
        
        # Create test user preferences
        self.user_preferences = UserPreferences.objects.create(
            preferred_genres=['rock', 'jazz'],
            notification_frequency=10,
            notification_tone='balanced'
        )
        
        # Create test emotion readings
        self.old_emotion = EmotionReading.objects.create(
            emotions={'happy': 0.8, 'sad': 0.2},
            energy_level=0.7,
            posture_score=0.6,
            blink_rate=15.0,
            confidence=0.9
        )
        # Make it old by updating timestamp
        old_time = timezone.now() - timedelta(days=100)
        EmotionReading.objects.filter(id=self.old_emotion.id).update(timestamp=old_time)
        
        self.recent_emotion = EmotionReading.objects.create(
            emotions={'neutral': 0.6, 'happy': 0.4},
            energy_level=0.5,
            posture_score=0.8,
            blink_rate=18.0,
            confidence=0.85
        )
        
        # Create test tasks
        self.old_task = Task.objects.create(
            title="Old completed task",
            description="This is an old task",
            status='completed',
            complexity='simple'
        )
        # Make it old
        old_time = timezone.now() - timedelta(days=100)
        Task.objects.filter(id=self.old_task.id).update(updated_at=old_time)
        
        self.recent_task = Task.objects.create(
            title="Recent task",
            description="This is a recent task",
            status='todo',
            complexity='moderate'
        )
        
        # Create test feedback
        self.old_feedback = UserFeedback.objects.create(
            suggestion_type='music',
            emotion_context={'happy': 0.7},
            suggestion_data={'playlist': 'test'},
            user_response='accepted',
            user_comment='Great suggestion!'
        )
        # Make it old
        old_time = timezone.now() - timedelta(days=100)
        UserFeedback.objects.filter(id=self.old_feedback.id).update(timestamp=old_time)
        
        self.recent_feedback = UserFeedback.objects.create(
            suggestion_type='theme',
            emotion_context={'sad': 0.6},
            suggestion_data={'theme': 'dark'},
            user_response='rejected'
        )
        
        # Create test music genre and playlist
        self.genre = MusicGenre.objects.create(
            name='rock',
            emotional_associations={'happy': 0.8, 'energetic': 0.9},
            typical_energy_range=[0.6, 1.0]
        )
        
        self.playlist = YouTubePlaylist.objects.create(
            youtube_id='test123',
            title='Test Playlist',
            description='Test description',
            energy_level=0.7,
            user_rating=4.5,
            play_count=10,
            acceptance_rate=0.8
        )
        
        # Create test music recommendation
        self.old_recommendation = MusicRecommendation.objects.create(
            emotion_context={'happy': 0.8},
            energy_level=0.7,
            recommended_playlist=self.playlist,
            recommendation_reason='High energy match',
            confidence_score=0.9,
            user_response='accepted'
        )
        # Make it old
        old_time = timezone.now() - timedelta(days=100)
        MusicRecommendation.objects.filter(id=self.old_recommendation.id).update(timestamp=old_time)
    
    def test_encryption_key_generation(self):
        """Test encryption key generation and derivation"""
        # Test password-based key derivation
        password = "test_password_123"
        key1 = self.service._derive_key_from_password(password)
        key2 = self.service._derive_key_from_password(password)
        
        # Same password should generate same key
        self.assertEqual(key1, key2)
        
        # Different password should generate different key
        key3 = self.service._derive_key_from_password("different_password")
        self.assertNotEqual(key1, key3)
    
    def test_data_encryption_decryption(self):
        """Test data encryption and decryption"""
        # Set up encryption key
        self.service.encryption_key = Fernet.generate_key()
        
        test_data = "This is sensitive user data"
        
        # Test encryption
        encrypted = self.service.encrypt_data(test_data)
        self.assertNotEqual(encrypted, test_data)
        self.assertIsInstance(encrypted, str)
        
        # Test decryption
        decrypted = self.service.decrypt_data(encrypted)
        self.assertEqual(decrypted, test_data)
    
    def test_data_encryption_disabled(self):
        """Test behavior when encryption is disabled"""
        # Disable encryption
        self.service.encryption_key = None
        
        test_data = "This is test data"
        
        # Should return data unchanged
        encrypted = self.service.encrypt_data(test_data)
        self.assertEqual(encrypted, test_data)
        
        decrypted = self.service.decrypt_data(test_data)
        self.assertEqual(decrypted, test_data)
    
    def test_apply_data_retention_policy(self):
        """Test data retention policy application"""
        # Count initial data
        initial_emotions = EmotionReading.objects.count()
        initial_feedback = UserFeedback.objects.count()
        initial_tasks = Task.objects.count()
        initial_recommendations = MusicRecommendation.objects.count()
        
        self.assertEqual(initial_emotions, 2)
        self.assertEqual(initial_feedback, 2)
        self.assertEqual(initial_tasks, 2)
        self.assertEqual(initial_recommendations, 1)
        
        # Apply retention policy (90 days)
        deleted_counts = self.service.apply_data_retention_policy(90)
        
        # Check that old data was deleted
        self.assertEqual(deleted_counts['emotion_readings'], 1)
        self.assertEqual(deleted_counts['user_feedback'], 1)
        self.assertEqual(deleted_counts['completed_tasks'], 1)
        self.assertEqual(deleted_counts['music_recommendations'], 1)
        
        # Check remaining data
        self.assertEqual(EmotionReading.objects.count(), 1)
        self.assertEqual(UserFeedback.objects.count(), 1)
        self.assertEqual(Task.objects.count(), 1)  # Only recent task remains
        self.assertEqual(MusicRecommendation.objects.count(), 0)
        
        # Recent data should still exist
        self.assertTrue(EmotionReading.objects.filter(id=self.recent_emotion.id).exists())
        self.assertTrue(UserFeedback.objects.filter(id=self.recent_feedback.id).exists())
        self.assertTrue(Task.objects.filter(id=self.recent_task.id).exists())
    
    def test_secure_delete_all_user_data(self):
        """Test secure deletion of all user data"""
        # Verify initial data exists
        self.assertTrue(EmotionReading.objects.exists())
        self.assertTrue(UserFeedback.objects.exists())
        self.assertTrue(Task.objects.exists())
        self.assertTrue(UserPreferences.objects.exists())
        self.assertTrue(MusicRecommendation.objects.exists())
        
        # Delete all user data
        deleted_counts = self.service.secure_delete_all_user_data()
        
        # Check deletion counts
        self.assertEqual(deleted_counts['emotion_readings'], 2)
        self.assertEqual(deleted_counts['user_feedback'], 2)
        self.assertEqual(deleted_counts['tasks'], 2)
        self.assertEqual(deleted_counts['user_preferences'], 1)
        self.assertEqual(deleted_counts['music_recommendations'], 1)
        
        # Verify all user data is deleted
        self.assertFalse(EmotionReading.objects.exists())
        self.assertFalse(UserFeedback.objects.exists())
        self.assertFalse(Task.objects.exists())
        self.assertFalse(UserPreferences.objects.exists())
        self.assertFalse(MusicRecommendation.objects.exists())
        
        # YouTube playlists should still exist but user data reset
        self.assertTrue(YouTubePlaylist.objects.exists())
        playlist = YouTubePlaylist.objects.get(id=self.playlist.id)
        self.assertIsNone(playlist.user_rating)
        self.assertEqual(playlist.play_count, 0)
        self.assertEqual(playlist.acceptance_rate, 0.0)
    
    def test_export_user_data(self):
        """Test user data export functionality"""
        # Test export with emotions
        export_data = self.service.export_user_data(include_raw_emotions=True)
        
        # Check export structure
        self.assertIn('export_timestamp', export_data)
        self.assertIn('export_version', export_data)
        self.assertIn('data', export_data)
        self.assertIn('summary', export_data)
        
        # Check data sections
        data = export_data['data']
        self.assertIn('user_preferences', data)
        self.assertIn('tasks', data)
        self.assertIn('user_feedback', data)
        self.assertIn('music_recommendations', data)
        self.assertIn('emotion_readings', data)
        
        # Check summary
        summary = export_data['summary']
        self.assertEqual(summary['total_emotion_readings'], 2)
        self.assertEqual(summary['total_tasks'], 2)
        self.assertEqual(summary['total_feedback_entries'], 2)
        self.assertEqual(summary['total_music_recommendations'], 1)
        
        # Test export without emotions
        export_data_no_emotions = self.service.export_user_data(include_raw_emotions=False)
        self.assertNotIn('emotion_readings', export_data_no_emotions['data'])
    
    def test_get_data_summary(self):
        """Test data summary generation"""
        summary = self.service.get_data_summary()
        
        # Check structure
        self.assertIn('data_counts', summary)
        self.assertIn('date_ranges', summary)
        self.assertIn('privacy_settings', summary)
        
        # Check data counts
        counts = summary['data_counts']
        self.assertEqual(counts['emotion_readings'], 2)
        self.assertEqual(counts['user_feedback'], 2)
        self.assertEqual(counts['tasks'], 2)
        self.assertEqual(counts['music_recommendations'], 1)
        self.assertEqual(counts['user_preferences'], 1)
        
        # Check privacy settings
        privacy = summary['privacy_settings']
        self.assertIn('encryption_enabled', privacy)
        self.assertIn('retention_policy_days', privacy)
        self.assertTrue(privacy['local_processing_only'])
        
        # Check date ranges
        ranges = summary['date_ranges']
        self.assertIn('emotion_readings', ranges)
        self.assertIn('user_feedback', ranges)
        self.assertIn('tasks', ranges)
    
    def test_cleanup_orphaned_data(self):
        """Test cleanup of orphaned and invalid data"""
        # Create invalid emotion reading
        invalid_emotion = EmotionReading.objects.create(
            emotions={'happy': 0.5},
            energy_level=0.5,
            posture_score=0.5,
            blink_rate=15.0,
            confidence=0.05  # Very low confidence
        )
        
        # Create empty feedback
        empty_feedback = UserFeedback.objects.create(
            suggestion_type='music',
            emotion_context={'happy': 0.5},
            suggestion_data=None,  # Empty suggestion data
            user_response='ignored'
        )
        
        # Run cleanup
        cleanup_counts = self.service.cleanup_orphaned_data()
        
        # Check cleanup results
        self.assertEqual(cleanup_counts['low_confidence_emotions'], 1)
        self.assertEqual(cleanup_counts['empty_feedback'], 1)
        
        # Verify invalid data was removed
        self.assertFalse(EmotionReading.objects.filter(id=invalid_emotion.id).exists())
        self.assertFalse(UserFeedback.objects.filter(id=empty_feedback.id).exists())
    
    def test_anonymize_old_data(self):
        """Test data anonymization functionality"""
        # Create old feedback with personal data
        old_feedback_with_comment = UserFeedback.objects.create(
            suggestion_type='music',
            emotion_context={'happy': 0.7},
            suggestion_data={'playlist': 'test'},
            user_response='rejected',
            user_comment='I hate this song because it reminds me of my ex',
            alternative_preference={'genre': 'classical'}
        )
        # Make it old
        old_time = timezone.now() - timedelta(days=400)
        UserFeedback.objects.filter(id=old_feedback_with_comment.id).update(timestamp=old_time)
        
        # Create old task with personal description
        old_task_with_description = Task.objects.create(
            title="Personal task",
            description="Call mom about dad's birthday party at 123 Main St",
            status='completed'
        )
        # Make it old
        Task.objects.filter(id=old_task_with_description.id).update(created_at=old_time)
        
        # Run anonymization (365 days)
        anonymized_counts = self.service.anonymize_old_data(365)
        
        # Check anonymization results
        self.assertEqual(anonymized_counts['user_feedback'], 1)
        self.assertEqual(anonymized_counts['task_descriptions'], 1)
        
        # Verify data was anonymized
        anonymized_feedback = UserFeedback.objects.get(id=old_feedback_with_comment.id)
        self.assertEqual(anonymized_feedback.user_comment, '[Anonymized]')
        self.assertIsNone(anonymized_feedback.alternative_preference)
        
        anonymized_task = Task.objects.get(id=old_task_with_description.id)
        self.assertEqual(anonymized_task.description, '[Anonymized]')
    
    def test_validate_data_integrity(self):
        """Test data integrity validation"""
        # Create some invalid data
        invalid_emotion = EmotionReading.objects.create(
            emotions={'happy': 0.5},
            energy_level=0.5,
            posture_score=0.5,
            blink_rate=15.0,
            confidence=-0.1  # Invalid confidence
        )
        
        invalid_task = Task.objects.create(
            title="Invalid task",
            complexity='simple'
        )
        # Manually set invalid complexity score
        Task.objects.filter(id=invalid_task.id).update(complexity_score=-0.5)
        
        # Run integrity validation
        report = self.service.validate_data_integrity()
        
        # Check report structure
        self.assertIn('timestamp', report)
        self.assertIn('checks_passed', report)
        self.assertIn('checks_failed', report)
        self.assertIn('issues', report)
        self.assertIn('recommendations', report)
        
        # Should have found issues
        self.assertGreater(report['checks_failed'], 0)
        self.assertGreater(len(report['issues']), 0)
    
    def test_retention_policy_configuration(self):
        """Test retention policy configuration"""
        # Test getting default retention policy
        default_days = self.service.get_retention_policy_days()
        self.assertEqual(default_days, 90)  # Default from settings
        
        # Test setting retention policy
        success = self.service.set_retention_policy_days(30)
        self.assertTrue(success)
        
        # Test invalid retention policy
        success = self.service.set_retention_policy_days(-1)
        self.assertFalse(success)
        
        success = self.service.set_retention_policy_days(5000)
        self.assertFalse(success)
    
    @patch.dict(os.environ, {'SIDEEYE_ENABLE_ENCRYPTION': 'true'})
    def test_encryption_environment_variable(self):
        """Test encryption configuration via environment variable"""
        # Create a new service instance to test environment variable loading
        from ..services.data_privacy_service import DataPrivacyService
        service = DataPrivacyService()
        # Should have generated an encryption key
        self.assertIsNotNone(service.encryption_key)
    
    @patch('backend.api.services.data_privacy_service.logger')
    def test_error_handling(self, mock_logger):
        """Test error handling in privacy service methods"""
        # Test with database error simulation
        with patch('backend.api.models.EmotionReading.objects.filter') as mock_filter:
            mock_filter.side_effect = Exception("Database error")
            
            # Should handle error gracefully
            with self.assertRaises(Exception):
                self.service.apply_data_retention_policy(90)
            
            # Should log the error
            mock_logger.error.assert_called()


class DataPrivacyAPITest(TestCase):
    """Test cases for Data Privacy API endpoints"""
    
    def setUp(self):
        """Set up test data"""
        # Create test data
        self.user_preferences = UserPreferences.objects.create(
            preferred_genres=['rock'],
            notification_frequency=5
        )
        
        self.emotion = EmotionReading.objects.create(
            emotions={'happy': 0.8},
            energy_level=0.7,
            posture_score=0.6,
            blink_rate=15.0,
            confidence=0.9
        )
        
        self.task = Task.objects.create(
            title="Test task",
            description="Test description",
            status='todo'
        )
    
    def test_data_summary_endpoint(self):
        """Test data summary API endpoint"""
        response = self.client.get('/api/privacy/data_summary/')
        
        self.assertEqual(response.status_code, 200)
        data = response.json()
        
        self.assertIn('data_counts', data)
        self.assertIn('privacy_settings', data)
        self.assertEqual(data['data_counts']['emotion_readings'], 1)
        self.assertEqual(data['data_counts']['tasks'], 1)
        self.assertEqual(data['data_counts']['user_preferences'], 1)
    
    def test_export_data_endpoint(self):
        """Test data export API endpoint"""
        response = self.client.get('/api/privacy/export_data/')
        
        self.assertEqual(response.status_code, 200)
        data = response.json()
        
        self.assertIn('export_timestamp', data)
        self.assertIn('data', data)
        self.assertIn('summary', data)
        
        # Test without emotions
        response = self.client.get('/api/privacy/export_data/?include_emotions=false')
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertNotIn('emotion_readings', data.get('data', {}))
    
    def test_retention_policy_endpoints(self):
        """Test retention policy API endpoints"""
        # Get current policy
        response = self.client.get('/api/privacy/retention_policy/')
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn('retention_days', data)
        
        # Set new policy
        response = self.client.post('/api/privacy/set_retention_policy/', {
            'retention_days': 60
        }, content_type='application/json')
        self.assertEqual(response.status_code, 200)
        
        # Test invalid policy
        response = self.client.post('/api/privacy/set_retention_policy/', {
            'retention_days': -1
        }, content_type='application/json')
        self.assertEqual(response.status_code, 400)
    
    def test_apply_retention_policy_endpoint(self):
        """Test apply retention policy API endpoint"""
        response = self.client.post('/api/privacy/apply_retention_policy/', {
            'retention_days': 30
        }, content_type='application/json')
        
        self.assertEqual(response.status_code, 200)
        data = response.json()
        
        self.assertIn('deleted_counts', data)
        self.assertIn('retention_days', data)
        self.assertEqual(data['retention_days'], 30)
    
    def test_secure_delete_all_endpoint(self):
        """Test secure delete all data API endpoint"""
        # Test without confirmation
        response = self.client.post('/api/privacy/secure_delete_all/', {
            'confirmation': 'wrong'
        }, content_type='application/json')
        self.assertEqual(response.status_code, 400)
        
        # Test with correct confirmation
        response = self.client.post('/api/privacy/secure_delete_all/', {
            'confirmation': 'DELETE_ALL_DATA'
        }, content_type='application/json')
        self.assertEqual(response.status_code, 200)
        
        data = response.json()
        self.assertIn('deleted_counts', data)
        
        # Verify data was deleted
        self.assertFalse(EmotionReading.objects.exists())
        self.assertFalse(Task.objects.exists())
        self.assertFalse(UserPreferences.objects.exists())
    
    def test_cleanup_orphaned_data_endpoint(self):
        """Test cleanup orphaned data API endpoint"""
        response = self.client.post('/api/privacy/cleanup_orphaned_data/')
        
        self.assertEqual(response.status_code, 200)
        data = response.json()
        
        self.assertIn('cleanup_counts', data)
        self.assertIn('message', data)
    
    def test_anonymize_old_data_endpoint(self):
        """Test anonymize old data API endpoint"""
        response = self.client.post('/api/privacy/anonymize_old_data/', {
            'anonymize_after_days': 365
        }, content_type='application/json')
        
        self.assertEqual(response.status_code, 200)
        data = response.json()
        
        self.assertIn('anonymized_counts', data)
        self.assertIn('anonymize_after_days', data)
        self.assertEqual(data['anonymize_after_days'], 365)
    
    def test_validate_integrity_endpoint(self):
        """Test validate integrity API endpoint"""
        response = self.client.get('/api/privacy/validate_integrity/')
        
        self.assertEqual(response.status_code, 200)
        data = response.json()
        
        self.assertIn('checks_passed', data)
        self.assertIn('checks_failed', data)
        self.assertIn('issues', data)
        self.assertIn('recommendations', data)
    
    def test_encryption_status_endpoint(self):
        """Test encryption status API endpoint"""
        response = self.client.get('/api/privacy/encryption_status/')
        
        self.assertEqual(response.status_code, 200)
        data = response.json()
        
        self.assertIn('encryption_enabled', data)
        self.assertIn('local_processing_only', data)
        self.assertIn('privacy_compliance', data)
        
        compliance = data['privacy_compliance']
        self.assertTrue(compliance['no_cloud_processing'])
        self.assertTrue(compliance['no_external_transmission'])
        self.assertTrue(compliance['user_controlled_deletion'])
        self.assertTrue(compliance['data_portability'])