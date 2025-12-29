"""
Integration Tests for Complete Backend Workflows

Tests end-to-end workflows through Django API:
1. Complete emotion-to-action workflows
2. User feedback and learning cycles
3. Notification rate limiting and queue management
4. Performance under load
5. Error handling and recovery
"""

import json
import time
import threading
from datetime import datetime, timedelta
from unittest.mock import patch, MagicMock

from django.test import TestCase, TransactionTestCase
from django.urls import reverse
from django.utils import timezone
from django.core.cache import cache
from django.db import transaction

from api.models import UserPreferences, EmotionReading, UserFeedback, Task
from api.services.emotion_analysis_service import EmotionAnalysisService
from api.services.notification_service import NotificationService
from api.services.music_recommendation_service import MusicRecommendationService
from api.services.theme_recommendation_service import ThemeRecommendationService


class CompleteWorkflowIntegrationTests(TestCase):
    """Test complete emotion-to-action workflows"""
    
    def setUp(self):
        self.user_prefs = UserPreferences.objects.create(
            preferred_genres=['rock', 'classical'],
            music_energy_mappings={'high': 'rock', 'low': 'classical'},
            preferred_color_palettes=['dark', 'bright'],
            theme_emotion_mappings={'happy': 'bright', 'sad': 'dark'}
        )
        
        # Create test tasks
        Task.objects.create(
            title='Complex Analysis',
            description='Requires high focus',
            complexity=0.9,
            energy_required=0.8
        )
        Task.objects.create(
            title='Email Review',
            description='Routine task',
            complexity=0.3,
            energy_required=0.4
        )
    
    def test_high_energy_emotion_workflow(self):
        """Test complete workflow for high energy emotions"""
        # Step 1: Submit emotion data
        emotion_data = {
            'emotions': {
                'happy': 0.8,
                'neutral': 0.2,
                'sad': 0.0,
                'angry': 0.0,
                'surprised': 0.0,
                'fearful': 0.0,
                'disgusted': 0.0
            },
            'confidence': 0.9,
            'posture_score': 0.8,
            'blink_rate': 15
        }
        
        response = self.client.post(
            reverse('emotion-analysis'),
            data=json.dumps(emotion_data),
            content_type='application/json'
        )
        
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertTrue(data['success'])
        self.assertGreater(data['energy_level'], 0.7)  # High energy
        
        # Step 2: Get task recommendations
        response = self.client.get(reverse('task-list'))
        self.assertEqual(response.status_code, 200)
        
        tasks = response.json()['tasks']
        # High complexity task should be first for high energy
        self.assertEqual(tasks[0]['title'], 'Complex Analysis')
        
        # Step 3: Get music recommendation
        response = self.client.post(
            reverse('music-recommend'),
            data=json.dumps({'energy_level': data['energy_level'], 'emotions': emotion_data['emotions']}),
            content_type='application/json'
        )
        
        self.assertEqual(response.status_code, 200)
        music_data = response.json()
        self.assertIn('rock', music_data['playlist']['genre'].lower())
        
        # Step 4: Get theme recommendation
        response = self.client.post(
            reverse('theme-recommend'),
            data=json.dumps({'emotions': emotion_data['emotions'], 'energy_level': data['energy_level']}),
            content_type='application/json'
        )
        
        self.assertEqual(response.status_code, 200)
        theme_data = response.json()
        self.assertIn('bright', theme_data['theme']['name'].lower())
    
    def test_low_energy_emotion_workflow(self):
        """Test complete workflow for low energy emotions"""
        emotion_data = {
            'emotions': {
                'happy': 0.1,
                'neutral': 0.3,
                'sad': 0.6,
                'angry': 0.0,
                'surprised': 0.0,
                'fearful': 0.0,
                'disgusted': 0.0
            },
            'confidence': 0.85,
            'posture_score': 0.4,
            'blink_rate': 8
        }
        
        # Submit emotion data
        response = self.client.post(
            reverse('emotion-analysis'),
            data=json.dumps(emotion_data),
            content_type='application/json'
        )
        
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertLess(data['energy_level'], 0.5)  # Low energy
        
        # Get task recommendations - should prioritize low complexity
        response = self.client.get(reverse('task-list'))
        tasks = response.json()['tasks']
        self.assertEqual(tasks[0]['title'], 'Email Review')
        
        # Music should be calming
        response = self.client.post(
            reverse('music-recommend'),
            data=json.dumps({'energy_level': data['energy_level'], 'emotions': emotion_data['emotions']}),
            content_type='application/json'
        )
        
        music_data = response.json()
        self.assertIn('classical', music_data['playlist']['genre'].lower())
    
    def test_workflow_with_partial_failures(self):
        """Test workflow continues with partial service failures"""
        emotion_data = {
            'emotions': {'happy': 0.7, 'neutral': 0.3},
            'confidence': 0.9
        }
        
        # Emotion analysis should succeed
        response = self.client.post(
            reverse('emotion-analysis'),
            data=json.dumps(emotion_data),
            content_type='application/json'
        )
        self.assertEqual(response.status_code, 200)
        
        # Mock music service failure
        with patch('api.services.music_recommendation_service.MusicRecommendationService.get_recommendation') as mock_music:
            mock_music.side_effect = Exception("YouTube API error")
            
            response = self.client.post(
                reverse('music-recommend'),
                data=json.dumps({'energy_level': 0.7, 'emotions': emotion_data['emotions']}),
                content_type='application/json'
            )
            
            # Should return error but not crash
            self.assertEqual(response.status_code, 500)
            
            # Theme service should still work
            response = self.client.post(
                reverse('theme-recommend'),
                data=json.dumps({'emotions': emotion_data['emotions'], 'energy_level': 0.7}),
                content_type='application/json'
            )
            self.assertEqual(response.status_code, 200)


class UserFeedbackLearningIntegrationTests(TestCase):
    """Test user feedback and learning cycle integration"""
    
    def setUp(self):
        self.user_prefs = UserPreferences.objects.create()
    
    def test_music_feedback_learning_cycle(self):
        """Test complete music feedback and learning cycle"""
        # Step 1: Get initial recommendation
        response = self.client.post(
            reverse('music-recommend'),
            data=json.dumps({'energy_level': 0.7, 'emotions': {'happy': 0.8}}),
            content_type='application/json'
        )
        
        self.assertEqual(response.status_code, 200)
        initial_recommendation = response.json()
        
        # Step 2: User rejects recommendation
        feedback_data = {
            'suggestion_type': 'music',
            'emotion_context': {'happy': 0.8},
            'suggestion_data': initial_recommendation['playlist'],
            'user_response': 'rejected',
            'alternative_preference': {'preferred_genre': 'jazz'}
        }
        
        response = self.client.post(
            reverse('feedback-submit'),
            data=json.dumps(feedback_data),
            content_type='application/json'
        )
        
        self.assertEqual(response.status_code, 200)
        
        # Verify feedback was stored
        feedback = UserFeedback.objects.filter(suggestion_type='music').first()
        self.assertIsNotNone(feedback)
        self.assertEqual(feedback.user_response, 'rejected')
        
        # Step 3: Get new recommendation - should incorporate learning
        response = self.client.post(
            reverse('music-recommend'),
            data=json.dumps({'energy_level': 0.7, 'emotions': {'happy': 0.8}}),
            content_type='application/json'
        )
        
        new_recommendation = response.json()
        
        # Should be different from initial recommendation
        self.assertNotEqual(
            initial_recommendation['playlist']['name'],
            new_recommendation['playlist']['name']
        )
    
    def test_theme_feedback_learning_cycle(self):
        """Test theme feedback and learning cycle"""
        # Get theme recommendation
        response = self.client.post(
            reverse('theme-recommend'),
            data=json.dumps({'emotions': {'sad': 0.7}, 'energy_level': 0.3}),
            content_type='application/json'
        )
        
        initial_theme = response.json()
        
        # Submit negative feedback
        feedback_data = {
            'suggestion_type': 'theme',
            'emotion_context': {'sad': 0.7},
            'suggestion_data': initial_theme['theme'],
            'user_response': 'rejected',
            'alternative_preference': {'preferred_palette': 'bright'}
        }
        
        response = self.client.post(
            reverse('feedback-submit'),
            data=json.dumps(feedback_data),
            content_type='application/json'
        )
        
        self.assertEqual(response.status_code, 200)
        
        # Get new recommendation
        response = self.client.post(
            reverse('theme-recommend'),
            data=json.dumps({'emotions': {'sad': 0.7}, 'energy_level': 0.3}),
            content_type='application/json'
        )
        
        new_theme = response.json()
        
        # Should incorporate user preference for bright themes
        self.assertIn('bright', new_theme['theme']['name'].lower())
    
    def test_positive_feedback_reinforcement(self):
        """Test that positive feedback reinforces recommendations"""
        # Get recommendation
        response = self.client.post(
            reverse('music-recommend'),
            data=json.dumps({'energy_level': 0.8, 'emotions': {'happy': 0.9}}),
            content_type='application/json'
        )
        
        recommendation = response.json()
        
        # Submit positive feedback
        feedback_data = {
            'suggestion_type': 'music',
            'emotion_context': {'happy': 0.9},
            'suggestion_data': recommendation['playlist'],
            'user_response': 'accepted'
        }
        
        response = self.client.post(
            reverse('feedback-submit'),
            data=json.dumps(feedback_data),
            content_type='application/json'
        )
        
        self.assertEqual(response.status_code, 200)
        
        # Future similar recommendations should be more likely
        for _ in range(3):
            response = self.client.post(
                reverse('music-recommend'),
                data=json.dumps({'energy_level': 0.8, 'emotions': {'happy': 0.9}}),
                content_type='application/json'
            )
            
            new_recommendation = response.json()
            # Should get similar genre
            self.assertEqual(
                recommendation['playlist']['genre'],
                new_recommendation['playlist']['genre']
            )


class NotificationRateLimitingIntegrationTests(TransactionTestCase):
    """Test notification rate limiting and queue management"""
    
    def setUp(self):
        cache.clear()
        self.notification_service = NotificationService()
    
    def test_action_notification_rate_limiting(self):
        """Test 2 per 5 minute rate limit for action notifications"""
        # Send 3 notifications rapidly
        for i in range(3):
            response = self.client.post(
                reverse('notification-send'),
                data=json.dumps({
                    'type': 'action',
                    'subtype': 'music_change',
                    'message': f'Music changed {i}',
                    'priority': 'normal'
                }),
                content_type='application/json'
            )
            
            if i < 2:
                # First 2 should succeed
                self.assertEqual(response.status_code, 200)
                data = response.json()
                self.assertTrue(data['success'])
                self.assertFalse(data.get('rate_limit_hit', False))
            else:
                # Third should be rate limited
                self.assertEqual(response.status_code, 200)
                data = response.json()
                self.assertFalse(data['success'])
                self.assertTrue(data['rate_limit_hit'])
                self.assertTrue(data['queued'])
    
    def test_wellness_notification_rate_limiting(self):
        """Test 5 per hour rate limit for wellness notifications"""
        # Send 6 wellness notifications
        for i in range(6):
            response = self.client.post(
                reverse('notification-send'),
                data=json.dumps({
                    'type': 'wellness',
                    'subtype': 'posture_reminder',
                    'message': f'Posture reminder {i}',
                    'priority': 'high'
                }),
                content_type='application/json'
            )
            
            if i < 5:
                # First 5 should succeed
                self.assertEqual(response.status_code, 200)
                data = response.json()
                self.assertTrue(data['success'])
            else:
                # Sixth should be rate limited
                data = response.json()
                self.assertTrue(data['rate_limit_hit'])
    
    def test_notification_queue_management(self):
        """Test notification queue and prioritization"""
        # Fill up rate limit
        for i in range(2):
            self.client.post(
                reverse('notification-send'),
                data=json.dumps({
                    'type': 'action',
                    'message': f'Action {i}',
                    'priority': 'normal'
                }),
                content_type='application/json'
            )
        
        # Send high priority notification (should be queued)
        response = self.client.post(
            reverse('notification-send'),
            data=json.dumps({
                'type': 'wellness',
                'message': 'High priority wellness',
                'priority': 'high'
            }),
            content_type='application/json'
        )
        
        data = response.json()
        self.assertTrue(data['queued'])
        
        # Send normal priority notification
        response = self.client.post(
            reverse('notification-send'),
            data=json.dumps({
                'type': 'action',
                'message': 'Normal priority action',
                'priority': 'normal'
            }),
            content_type='application/json'
        )
        
        # Check queue status
        response = self.client.get(reverse('notification-queue'))
        queue_data = response.json()
        
        # High priority should be first in queue
        self.assertEqual(queue_data['queue'][0]['priority'], 'high')
    
    def test_rate_limit_reset(self):
        """Test rate limit reset after time window"""
        # Hit rate limit
        for i in range(2):
            self.client.post(
                reverse('notification-send'),
                data=json.dumps({
                    'type': 'action',
                    'message': f'Action {i}'
                }),
                content_type='application/json'
            )
        
        # Third should be rate limited
        response = self.client.post(
            reverse('notification-send'),
            data=json.dumps({
                'type': 'action',
                'message': 'Rate limited'
            }),
            content_type='application/json'
        )
        
        data = response.json()
        self.assertTrue(data['rate_limit_hit'])
        
        # Simulate time passing (mock cache expiry)
        cache.clear()
        
        # Should be able to send again
        response = self.client.post(
            reverse('notification-send'),
            data=json.dumps({
                'type': 'action',
                'message': 'After reset'
            }),
            content_type='application/json'
        )
        
        data = response.json()
        self.assertTrue(data['success'])
        self.assertFalse(data.get('rate_limit_hit', False))


class PerformanceIntegrationTests(TransactionTestCase):
    """Test system performance under load"""
    
    def test_concurrent_emotion_processing(self):
        """Test concurrent emotion analysis requests"""
        def submit_emotion_data(thread_id):
            emotion_data = {
                'emotions': {'happy': 0.5 + (thread_id * 0.1), 'neutral': 0.5},
                'confidence': 0.8,
                'thread_id': thread_id
            }
            
            response = self.client.post(
                reverse('emotion-analysis'),
                data=json.dumps(emotion_data),
                content_type='application/json'
            )
            
            return response.status_code == 200
        
        # Launch 10 concurrent requests
        threads = []
        results = []
        
        for i in range(10):
            thread = threading.Thread(
                target=lambda i=i: results.append(submit_emotion_data(i))
            )
            threads.append(thread)
            thread.start()
        
        # Wait for all threads
        for thread in threads:
            thread.join()
        
        # All requests should succeed
        self.assertEqual(len(results), 10)
        self.assertTrue(all(results))
    
    def test_high_frequency_feedback_processing(self):
        """Test processing many feedback submissions"""
        start_time = time.time()
        
        # Submit 50 feedback items rapidly
        for i in range(50):
            feedback_data = {
                'suggestion_type': 'music',
                'emotion_context': {'happy': 0.5 + (i * 0.01)},
                'suggestion_data': {'name': f'Playlist {i}'},
                'user_response': 'accepted' if i % 2 == 0 else 'rejected'
            }
            
            response = self.client.post(
                reverse('feedback-submit'),
                data=json.dumps(feedback_data),
                content_type='application/json'
            )
            
            self.assertEqual(response.status_code, 200)
        
        end_time = time.time()
        processing_time = end_time - start_time
        
        # Should process all feedback within reasonable time (5 seconds)
        self.assertLess(processing_time, 5.0)
        
        # Verify all feedback was stored
        feedback_count = UserFeedback.objects.count()
        self.assertEqual(feedback_count, 50)
    
    def test_memory_usage_stability(self):
        """Test memory usage remains stable during continuous processing"""
        import psutil
        import os
        
        process = psutil.Process(os.getpid())
        initial_memory = process.memory_info().rss
        
        # Process many requests
        for i in range(100):
            emotion_data = {
                'emotions': {'happy': 0.5, 'neutral': 0.5},
                'confidence': 0.8
            }
            
            self.client.post(
                reverse('emotion-analysis'),
                data=json.dumps(emotion_data),
                content_type='application/json'
            )
            
            # Get recommendations
            self.client.post(
                reverse('music-recommend'),
                data=json.dumps({'energy_level': 0.7, 'emotions': emotion_data['emotions']}),
                content_type='application/json'
            )
        
        final_memory = process.memory_info().rss
        memory_growth = final_memory - initial_memory
        
        # Memory growth should be reasonable (less than 50MB)
        self.assertLess(memory_growth, 50 * 1024 * 1024)


class ErrorHandlingIntegrationTests(TestCase):
    """Test error handling and recovery scenarios"""
    
    def test_invalid_emotion_data_handling(self):
        """Test handling of invalid emotion data"""
        invalid_data_sets = [
            {},  # Empty data
            {'emotions': {}},  # Empty emotions
            {'emotions': {'invalid': 1.5}},  # Invalid emotion values
            {'emotions': {'happy': 'not_a_number'}},  # Invalid data types
            {'confidence': -0.5}  # Invalid confidence
        ]
        
        for invalid_data in invalid_data_sets:
            response = self.client.post(
                reverse('emotion-analysis'),
                data=json.dumps(invalid_data),
                content_type='application/json'
            )
            
            # Should return error but not crash
            self.assertIn(response.status_code, [400, 422])
            
            data = response.json()
            self.assertFalse(data.get('success', True))
            self.assertIn('error', data)
    
    def test_database_error_recovery(self):
        """Test recovery from database errors"""
        with patch('api.models.EmotionReading.objects.create') as mock_create:
            mock_create.side_effect = Exception("Database error")
            
            emotion_data = {
                'emotions': {'happy': 0.7, 'neutral': 0.3},
                'confidence': 0.9
            }
            
            response = self.client.post(
                reverse('emotion-analysis'),
                data=json.dumps(emotion_data),
                content_type='application/json'
            )
            
            # Should handle error gracefully
            self.assertEqual(response.status_code, 500)
            data = response.json()
            self.assertFalse(data['success'])
            self.assertIn('error', data)
    
    def test_external_service_failure_handling(self):
        """Test handling of external service failures"""
        with patch('api.services.youtube_service.YouTubeService.search_playlists') as mock_youtube:
            mock_youtube.side_effect = Exception("YouTube API error")
            
            response = self.client.post(
                reverse('music-recommend'),
                data=json.dumps({'energy_level': 0.7, 'emotions': {'happy': 0.8}}),
                content_type='application/json'
            )
            
            # Should return fallback recommendation
            self.assertEqual(response.status_code, 200)
            data = response.json()
            self.assertIn('fallback', data['playlist']['name'].lower())
    
    def test_malformed_request_handling(self):
        """Test handling of malformed requests"""
        malformed_requests = [
            'invalid json',
            '{"incomplete": }',
            None,
            ''
        ]
        
        for malformed_data in malformed_requests:
            response = self.client.post(
                reverse('emotion-analysis'),
                data=malformed_data,
                content_type='application/json'
            )
            
            # Should return 400 Bad Request
            self.assertEqual(response.status_code, 400)