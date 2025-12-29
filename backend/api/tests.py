from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APITestCase, APIClient
from rest_framework import status
from django.utils import timezone
from datetime import timedelta
import json

from .models import UserPreferences, EmotionReading, UserFeedback
from .serializers import (
    UserPreferencesSerializer, 
    EmotionReadingSerializer, 
    UserFeedbackSerializer,
    TaskSerializer
)


class UserPreferencesAPITestCase(APITestCase):
    """Test cases for UserPreferences API endpoints"""
    
    def setUp(self):
        self.client = APIClient()
        self.preferences_url = reverse('preferences-list')
        
        # Sample preference data
        self.valid_preferences_data = {
            'preferred_genres': ['rock', 'jazz', 'electronic'],
            'music_energy_mappings': {
                '0.2': ['ambient', 'classical'],
                '0.8': ['rock', 'electronic']
            },
            'preferred_color_palettes': ['dark', 'blue'],
            'theme_emotion_mappings': {
                'happy': ['bright', 'colorful'],
                'sad': ['dark', 'muted']
            },
            'notification_frequency': 10,
            'wellness_reminder_interval': 120,
            'notification_tone': 'sarcastic'
        }
    
    def test_create_user_preferences(self):
        """Test creating user preferences"""
        response = self.client.post(self.preferences_url, self.valid_preferences_data, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(UserPreferences.objects.count(), 1)
        
        preferences = UserPreferences.objects.first()
        self.assertEqual(preferences.preferred_genres, ['rock', 'jazz', 'electronic'])
        self.assertEqual(preferences.notification_tone, 'sarcastic')
    
    def test_get_user_preferences(self):
        """Test retrieving user preferences"""
        # Create preferences first
        UserPreferences.objects.create(**self.valid_preferences_data)
        
        response = self.client.get(self.preferences_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['preferred_genres'], ['rock', 'jazz', 'electronic'])
    
    def test_update_user_preferences(self):
        """Test updating user preferences"""
        preferences = UserPreferences.objects.create(**self.valid_preferences_data)
        
        update_data = {
            'notification_frequency': 15,
            'notification_tone': 'motivational'
        }
        
        response = self.client.post(self.preferences_url, update_data, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        preferences.refresh_from_db()
        self.assertEqual(preferences.notification_frequency, 15)
        self.assertEqual(preferences.notification_tone, 'motivational')
    
    def test_invalid_preferences_validation(self):
        """Test validation of invalid preference data"""
        invalid_data = {
            'preferred_genres': 'not_a_list',  # Should be a list
            'notification_frequency': 0,  # Below minimum
            'music_energy_mappings': 'not_a_dict'  # Should be a dict
        }
        
        response = self.client.post(self.preferences_url, invalid_data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('preferred_genres', response.data)
        self.assertIn('notification_frequency', response.data)


class EmotionReadingAPITestCase(APITestCase):
    """Test cases for EmotionReading API endpoints"""
    
    def setUp(self):
        self.client = APIClient()
        self.emotions_url = reverse('emotions-list')
        
        # Sample emotion data
        self.valid_emotion_data = {
            'emotions': {
                'happy': 0.7,
                'sad': 0.1,
                'neutral': 0.2
            },
            'energy_level': 0.8,
            'posture_score': 0.6,
            'blink_rate': 15.5,
            'confidence': 0.9
        }
    
    def test_create_emotion_reading(self):
        """Test creating an emotion reading"""
        response = self.client.post(self.emotions_url, self.valid_emotion_data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(EmotionReading.objects.count(), 1)
        
        reading = EmotionReading.objects.first()
        self.assertEqual(reading.emotions['happy'], 0.7)
        self.assertEqual(reading.energy_level, 0.8)
        self.assertIsNotNone(response.data['dominant_emotion'])
        self.assertEqual(response.data['dominant_emotion']['emotion'], 'happy')
    
    def test_list_emotion_readings(self):
        """Test listing emotion readings"""
        # Create some test readings
        EmotionReading.objects.create(**self.valid_emotion_data)
        EmotionReading.objects.create(**{
            **self.valid_emotion_data,
            'emotions': {'sad': 0.8, 'happy': 0.2}
        })
        
        response = self.client.get(self.emotions_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # Check if response has pagination structure or is a direct list
        if 'results' in response.data:
            self.assertEqual(len(response.data['results']), 2)
        else:
            self.assertEqual(len(response.data), 2)
    
    def test_get_latest_emotion_reading(self):
        """Test getting the latest emotion reading"""
        EmotionReading.objects.create(**self.valid_emotion_data)
        
        latest_url = reverse('emotions-latest')
        response = self.client.get(latest_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['energy_level'], 0.8)
    
    def test_emotion_summary(self):
        """Test emotion summary endpoint"""
        # Create multiple readings
        for i in range(3):
            EmotionReading.objects.create(**self.valid_emotion_data)
        
        summary_url = reverse('emotions-summary')
        response = self.client.get(summary_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['total_readings'], 3)
        self.assertIn('averages', response.data)
        self.assertIn('emotion_distribution', response.data)
    
    def test_invalid_emotion_data_validation(self):
        """Test validation of invalid emotion data"""
        invalid_data = {
            'emotions': {
                'happy': 1.5,  # Above maximum
                'invalid_emotion': 0.3  # Invalid emotion
            },
            'energy_level': -0.1,  # Below minimum
            'confidence': 2.0  # Above maximum
        }
        
        response = self.client.post(self.emotions_url, invalid_data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('emotions', response.data)
        self.assertIn('energy_level', response.data)
        self.assertIn('confidence', response.data)
    
    def test_emotion_probabilities_sum_validation(self):
        """Test that emotion probabilities should sum to approximately 1.0"""
        invalid_data = {
            **self.valid_emotion_data,
            'emotions': {
                'happy': 0.1,
                'sad': 0.1,
                'neutral': 0.1  # Sum = 0.3, should be close to 1.0
            }
        }
        
        response = self.client.post(self.emotions_url, invalid_data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('emotions', response.data)
    
    def test_filter_emotions_by_date_range(self):
        """Test filtering emotion readings by date range"""
        # Create some test readings
        EmotionReading.objects.create(**self.valid_emotion_data)
        EmotionReading.objects.create(**self.valid_emotion_data)
        
        # Test that the endpoint accepts date parameters without error
        response = self.client.get(f"{self.emotions_url}?start_date=2023-01-01T00:00:00Z")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        # Test end_date parameter
        response = self.client.get(f"{self.emotions_url}?end_date=2025-12-31T23:59:59Z")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        # Test limit parameter
        response = self.client.get(f"{self.emotions_url}?limit=1")
        self.assertEqual(response.status_code, status.HTTP_200_OK)


class UserFeedbackAPITestCase(APITestCase):
    """Test cases for UserFeedback API endpoints"""
    
    def setUp(self):
        self.client = APIClient()
        self.feedback_url = reverse('feedback-list')
        
        # Sample feedback data
        self.valid_feedback_data = {
            'suggestion_type': 'music',
            'emotion_context': {
                'emotions': {'happy': 0.8, 'neutral': 0.2},
                'energy_level': 0.7
            },
            'suggestion_data': {
                'playlist': 'Upbeat Rock',
                'genre': 'rock'
            },
            'user_response': 'accepted',
            'user_comment': 'Great suggestion!'
        }
    
    def test_create_user_feedback(self):
        """Test creating user feedback"""
        response = self.client.post(self.feedback_url, self.valid_feedback_data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(UserFeedback.objects.count(), 1)
        
        feedback = UserFeedback.objects.first()
        self.assertEqual(feedback.suggestion_type, 'music')
        self.assertEqual(feedback.user_response, 'accepted')
    
    def test_list_user_feedback(self):
        """Test listing user feedback"""
        UserFeedback.objects.create(**self.valid_feedback_data)
        UserFeedback.objects.create(**{
            **self.valid_feedback_data,
            'suggestion_type': 'theme',
            'user_response': 'rejected'
        })
        
        response = self.client.get(self.feedback_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # Check if response has pagination structure or is a direct list
        if 'results' in response.data:
            self.assertEqual(len(response.data['results']), 2)
        else:
            self.assertEqual(len(response.data), 2)
    
    def test_filter_feedback_by_suggestion_type(self):
        """Test filtering feedback by suggestion type"""
        UserFeedback.objects.create(**self.valid_feedback_data)
        UserFeedback.objects.create(**{
            **self.valid_feedback_data,
            'suggestion_type': 'theme'
        })
        
        response = self.client.get(f"{self.feedback_url}?suggestion_type=music")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # Check if response has pagination structure or is a direct list
        if 'results' in response.data:
            self.assertEqual(len(response.data['results']), 1)
            self.assertEqual(response.data['results'][0]['suggestion_type'], 'music')
        else:
            self.assertEqual(len(response.data), 1)
            self.assertEqual(response.data[0]['suggestion_type'], 'music')
    
    def test_feedback_analytics(self):
        """Test feedback analytics endpoint"""
        # Create various feedback entries
        UserFeedback.objects.create(**self.valid_feedback_data)
        UserFeedback.objects.create(**{
            **self.valid_feedback_data,
            'user_response': 'rejected'
        })
        UserFeedback.objects.create(**{
            **self.valid_feedback_data,
            'suggestion_type': 'theme',
            'user_response': 'accepted'
        })
        
        analytics_url = reverse('feedback-analytics')
        response = self.client.get(analytics_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('feedback_statistics', response.data)
        self.assertEqual(response.data['total_feedback_entries'], 3)
        
        # Check music feedback stats
        music_stats = response.data['feedback_statistics']['music']
        self.assertEqual(music_stats['total'], 2)
        self.assertEqual(music_stats['accepted'], 1)
        self.assertEqual(music_stats['rejected'], 1)
    
    def test_invalid_feedback_validation(self):
        """Test validation of invalid feedback data"""
        invalid_data = {
            'suggestion_type': 'invalid_type',  # Invalid choice
            'emotion_context': 'not_a_dict',  # Should be dict
            'suggestion_data': {},  # Empty dict
            'user_response': 'invalid_response'  # Invalid choice
        }
        
        response = self.client.post(self.feedback_url, invalid_data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('suggestion_type', response.data)
        self.assertIn('emotion_context', response.data)
        self.assertIn('suggestion_data', response.data)
        self.assertIn('user_response', response.data)
    
    def test_emotion_context_validation(self):
        """Test validation of emotion context structure"""
        invalid_data = {
            **self.valid_feedback_data,
            'emotion_context': {
                'emotions': 'not_a_dict',  # Should be dict
                'energy_level': 1.5  # Above maximum
            }
        }
        
        response = self.client.post(self.feedback_url, invalid_data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('emotion_context', response.data)


class TaskAPITestCase(APITestCase):
    """Test cases for Task API endpoints (placeholder implementation)"""
    
    def setUp(self):
        self.client = APIClient()
        self.tasks_url = reverse('tasks-list')
        
        # Sample task data
        self.valid_task_data = {
            'title': 'Test Task',
            'description': 'A test task for validation',
            'complexity': 0.7,
            'energy_requirement': 0.6,
            'priority': 8,
            'completed': False
        }
    
    def test_list_tasks_placeholder(self):
        """Test listing tasks (placeholder implementation)"""
        response = self.client.get(self.tasks_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('message', response.data)
        self.assertIn('placeholder_data', response.data)
        self.assertEqual(len(response.data['placeholder_data']), 2)
    
    def test_create_task_placeholder(self):
        """Test creating a task (placeholder implementation)"""
        response = self.client.post(self.tasks_url, self.valid_task_data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIn('message', response.data)
        self.assertIn('submitted_data', response.data)
        self.assertEqual(response.data['submitted_data']['title'], 'Test Task')
    
    def test_task_serializer_validation(self):
        """Test task serializer validation"""
        invalid_data = {
            'title': '',  # Empty title
            'complexity': 1.5,  # Above maximum
            'energy_requirement': -0.1,  # Below minimum
            'priority': 15  # Above maximum
        }
        
        response = self.client.post(self.tasks_url, invalid_data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


class HealthCheckAPITestCase(APITestCase):
    """Test cases for health check endpoint"""
    
    def setUp(self):
        self.client = APIClient()
        self.health_url = reverse('health_check')
    
    def test_health_check(self):
        """Test health check endpoint"""
        response = self.client.get(self.health_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['status'], 'healthy')
        self.assertEqual(response.data['service'], 'SideEye Django Backend')
        self.assertIn('timestamp', response.data)


class SerializerTestCase(TestCase):
    """Test cases for serializers"""
    
    def test_user_preferences_serializer_validation(self):
        """Test UserPreferences serializer validation"""
        # Valid data
        valid_data = {
            'preferred_genres': ['rock', 'jazz'],
            'music_energy_mappings': {'0.5': ['ambient']},
            'preferred_color_palettes': ['dark'],
            'theme_emotion_mappings': {'happy': ['bright']},
            'notification_frequency': 10
        }
        
        serializer = UserPreferencesSerializer(data=valid_data)
        self.assertTrue(serializer.is_valid())
        
        # Invalid data
        invalid_data = {
            'preferred_genres': 'not_a_list',
            'music_energy_mappings': {'invalid_energy': ['ambient']},
            'notification_frequency': 0
        }
        
        serializer = UserPreferencesSerializer(data=invalid_data)
        self.assertFalse(serializer.is_valid())
        self.assertIn('preferred_genres', serializer.errors)
        self.assertIn('music_energy_mappings', serializer.errors)
        self.assertIn('notification_frequency', serializer.errors)
    
    def test_emotion_reading_serializer_validation(self):
        """Test EmotionReading serializer validation"""
        # Valid data
        valid_data = {
            'emotions': {'happy': 0.8, 'neutral': 0.2},
            'energy_level': 0.7,
            'posture_score': 0.6,
            'blink_rate': 15.0,
            'confidence': 0.9
        }
        
        serializer = EmotionReadingSerializer(data=valid_data)
        self.assertTrue(serializer.is_valid())
        
        # Invalid data
        invalid_data = {
            'emotions': {'invalid_emotion': 0.5},
            'energy_level': 1.5,
            'blink_rate': -5.0
        }
        
        serializer = EmotionReadingSerializer(data=invalid_data)
        self.assertFalse(serializer.is_valid())
        self.assertIn('emotions', serializer.errors)
        self.assertIn('energy_level', serializer.errors)
        self.assertIn('blink_rate', serializer.errors)
    
    def test_user_feedback_serializer_validation(self):
        """Test UserFeedback serializer validation"""
        # Valid data
        valid_data = {
            'suggestion_type': 'music',
            'emotion_context': {
                'emotions': {'happy': 0.8},
                'energy_level': 0.7
            },
            'suggestion_data': {'playlist': 'Rock'},
            'user_response': 'accepted'
        }
        
        serializer = UserFeedbackSerializer(data=valid_data)
        self.assertTrue(serializer.is_valid())
        
        # Invalid data
        invalid_data = {
            'suggestion_type': 'invalid',
            'emotion_context': 'not_a_dict',
            'suggestion_data': {},
            'user_response': 'invalid'
        }
        
        serializer = UserFeedbackSerializer(data=invalid_data)
        self.assertFalse(serializer.is_valid())
        self.assertIn('suggestion_type', serializer.errors)
        self.assertIn('emotion_context', serializer.errors)
        self.assertIn('suggestion_data', serializer.errors)
        self.assertIn('user_response', serializer.errors)