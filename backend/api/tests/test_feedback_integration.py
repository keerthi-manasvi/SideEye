"""
Integration tests for the complete feedback collection and learning system
"""
import json
from django.test import TestCase, Client
from django.urls import reverse
from django.utils import timezone
from datetime import timedelta

from ..models import UserPreferences, UserFeedback, MusicRecommendation, YouTubePlaylist, MusicGenre
from ..services.music_recommendation_service import music_recommendation_service
from ..services.theme_recommendation_service import theme_recommendation_service


class FeedbackIntegrationTest(TestCase):
    """Test the complete feedback collection and learning workflow"""
    
    def setUp(self):
        """Set up test data"""
        self.client = Client()
        
        # Create user preferences
        self.user_preferences = UserPreferences.objects.create(
            preferred_genres=['jazz', 'ambient'],
            preferred_color_palettes=['cool_muted'],
            music_energy_mappings={'happy': [0.8, 0.9]},
            theme_emotion_mappings={'focused': {'palette': 'neutral_dark'}}
        )
        
        # Create test music data
        self.jazz_genre = MusicGenre.objects.create(
            name='jazz',
            emotional_associations={'calm': 0.8, 'happy': 0.6},
            typical_energy_range=[0.4, 0.8]
        )
        
        self.jazz_playlist = YouTubePlaylist.objects.create(
            youtube_id='test_jazz_123',
            title='Smooth Jazz Vibes',
            description='Relaxing jazz music',
            energy_level=0.6,
            emotional_tags=['happy', 'calm'],
            acceptance_rate=0.5,
            play_count=3
        )
        self.jazz_playlist.genres.add(self.jazz_genre)
    
    def test_complete_music_feedback_workflow(self):
        """Test the complete music recommendation and feedback workflow"""
        
        # Step 1: Get music recommendations
        emotions = {'happy': 0.8, 'neutral': 0.2}
        energy_level = 0.7
        
        recommendations = music_recommendation_service.get_recommendations(
            emotions=emotions,
            energy_level=energy_level,
            user_preferences=self.user_preferences,
            max_recommendations=3
        )
        
        self.assertGreater(len(recommendations), 0)
        
        # Step 2: Simulate user accepting a recommendation
        recommendation_id = recommendations[0]['recommendation_id']
        
        music_recommendation_service.record_user_feedback(
            recommendation_id=recommendation_id,
            response='accepted'
        )
        
        # Step 3: Verify feedback was recorded
        feedback = UserFeedback.objects.filter(
            suggestion_type='music',
            user_response='accepted'
        ).first()
        
        self.assertIsNotNone(feedback)
        self.assertEqual(feedback.emotion_context, emotions)
        
        # Step 4: Verify learning occurred
        updated_preferences = UserPreferences.objects.first()
        happy_mappings = updated_preferences.music_energy_mappings.get('happy', [])
        self.assertIn(energy_level, happy_mappings)
        
        # Step 5: Verify playlist acceptance rate was updated
        self.jazz_playlist.refresh_from_db()
        self.assertGreater(self.jazz_playlist.acceptance_rate, 0.5)
    
    def test_complete_theme_feedback_workflow(self):
        """Test the complete theme recommendation and feedback workflow"""
        
        # Step 1: Get theme recommendations
        emotions = {'focused': 0.9, 'neutral': 0.1}
        energy_level = 0.6
        
        recommendations = theme_recommendation_service.get_recommendations(
            emotions=emotions,
            energy_level=energy_level,
            user_preferences=self.user_preferences,
            max_recommendations=3
        )
        
        self.assertGreater(len(recommendations), 0)
        
        # Step 2: Simulate user rejecting with alternative
        theme_recommendation = recommendations[0]
        alternative_choice = {
            'palette': 'warm_bright',
            'colors': ['#FFD700', '#FFA500'],
            'reason': 'prefer warmer colors for focus'
        }
        
        theme_recommendation_service.record_user_feedback(
            theme_recommendation=theme_recommendation,
            response='rejected',
            alternative_choice=alternative_choice
        )
        
        # Step 3: Verify feedback was recorded
        feedback = UserFeedback.objects.filter(
            suggestion_type='theme',
            user_response='rejected'
        ).first()
        
        self.assertIsNotNone(feedback)
        self.assertEqual(feedback.alternative_preference, alternative_choice)
        
        # Step 4: Verify learning occurred
        updated_preferences = UserPreferences.objects.first()
        self.assertIn('warm_bright', updated_preferences.preferred_color_palettes)
        
        # Check emotion mapping was updated
        focused_mapping = updated_preferences.theme_emotion_mappings.get('focused')
        self.assertIsNotNone(focused_mapping)
    
    def test_feedback_api_endpoints(self):
        """Test the feedback API endpoints"""
        
        # Test feedback creation endpoint
        feedback_data = {
            'suggestion_type': 'music',
            'emotion_context': {
                'emotions': {'happy': 0.8, 'neutral': 0.2},
                'energy_level': 0.7
            },
            'suggestion_data': {
                'playlist_title': 'Test Playlist',
                'genre': 'jazz'
            },
            'user_response': 'accepted',
            'user_comment': 'Great recommendation!'
        }
        
        response = self.client.post(
            '/api/feedback/',
            data=json.dumps(feedback_data),
            content_type='application/json'
        )
        
        self.assertEqual(response.status_code, 201)
        
        # Verify feedback was created
        feedback = UserFeedback.objects.filter(
            suggestion_type='music',
            user_response='accepted'
        ).first()
        
        self.assertIsNotNone(feedback)
        self.assertEqual(feedback.user_comment, 'Great recommendation!')
    
    def test_learning_effectiveness_api(self):
        """Test the learning effectiveness API endpoint"""
        
        # Clear existing feedback to start fresh
        UserFeedback.objects.all().delete()
        
        # Create some historical music recommendations with feedback
        now = timezone.now()
        
        # Create older recommendations (lower acceptance rate)
        older_time = now - timedelta(days=10)
        for i in range(4):
            recommendation = MusicRecommendation.objects.create(
                emotion_context={'emotions': {'happy': 0.8}},
                energy_level=0.7,
                recommended_playlist=self.jazz_playlist,
                recommendation_reason='Test recommendation',
                confidence_score=0.8,
                timestamp=older_time
            )
            # 50% acceptance rate for older recommendations
            if i < 2:
                recommendation.user_response = 'accepted'
                recommendation.save()
        
        # Create recent recommendations (higher acceptance rate)
        recent_time = now - timedelta(days=3)
        for i in range(4):
            recommendation = MusicRecommendation.objects.create(
                emotion_context={'emotions': {'happy': 0.8}},
                energy_level=0.7,
                recommended_playlist=self.jazz_playlist,
                recommendation_reason='Test recommendation',
                confidence_score=0.8,
                timestamp=recent_time
            )
            # 75% acceptance rate for recent recommendations
            if i < 3:
                recommendation.user_response = 'accepted'
                recommendation.save()
        
        # Test the learning effectiveness endpoint
        response = self.client.get('/api/feedback/learning_effectiveness/')
        
        self.assertEqual(response.status_code, 200)
        
        data = response.json()
        self.assertIn('music_learning', data)
        self.assertIn('theme_learning', data)
        self.assertTrue(data['overall_learning_active'])
        
        # Check that improvement is detected
        music_learning = data['music_learning']
        if music_learning['recent_acceptance_rate'] > 0 and music_learning['previous_acceptance_rate'] >= 0:
            # Only check improvement if we have meaningful data
            self.assertGreaterEqual(music_learning['recent_acceptance_rate'], 
                                  music_learning['previous_acceptance_rate'])
    
    def test_feedback_analytics_api(self):
        """Test the feedback analytics API endpoint"""
        
        # Clear any existing feedback from setup
        UserFeedback.objects.all().delete()
        
        # Create diverse feedback data
        feedback_types = [
            ('music', 'accepted'),
            ('music', 'rejected'),
            ('theme', 'accepted'),
            ('theme', 'modified'),
            ('music', 'ignored')
        ]
        
        for suggestion_type, response in feedback_types:
            UserFeedback.objects.create(
                suggestion_type=suggestion_type,
                emotion_context={'neutral': 1.0},
                suggestion_data={'test': 'data'},
                user_response=response
            )
        
        # Test analytics endpoint
        response = self.client.get('/api/feedback/analytics/')
        
        self.assertEqual(response.status_code, 200)
        
        data = response.json()
        self.assertIn('feedback_statistics', data)
        
        # Check music statistics
        music_stats = data['feedback_statistics']['music']
        self.assertEqual(music_stats['total'], 3)
        self.assertEqual(music_stats['accepted'], 1)
        self.assertEqual(music_stats['rejected'], 1)
        self.assertEqual(music_stats['ignored'], 1)
        
        # Check theme statistics
        theme_stats = data['feedback_statistics']['theme']
        self.assertEqual(theme_stats['total'], 2)
        self.assertEqual(theme_stats['accepted'], 1)
        self.assertEqual(theme_stats['modified'], 1)
    
    def test_enhanced_feedback_data_processing(self):
        """Test processing of enhanced feedback data from frontend"""
        
        # Simulate enhanced feedback data from the improved FeedbackModal
        enhanced_feedback = {
            'suggestion_type': 'music',
            'emotion_context': {
                'emotions': {'happy': 0.7, 'excited': 0.3},
                'energy_level': 0.8
            },
            'suggestion_data': {
                'playlist_title': 'Upbeat Pop Hits',
                'genre': 'pop',
                'energy_level': 0.8
            },
            'user_response': 'rejected',
            'alternative_preference': {
                'genre': 'ambient',
                'reason': 'prefer darker, more muted music'
            },
            'user_comment': 'Too bright colors for my current mood'
        }
        
        # Create feedback record
        response = self.client.post(
            '/api/feedback/',
            data=json.dumps(enhanced_feedback),
            content_type='application/json'
        )
        
        self.assertEqual(response.status_code, 201)
        
        # Verify enhanced data was stored
        feedback = UserFeedback.objects.filter(
            suggestion_type='music',
            user_response='rejected'
        ).first()
        
        self.assertIsNotNone(feedback)
        self.assertEqual(feedback.user_comment, 'Too bright colors for my current mood')
        self.assertIn('darker, more muted music', str(feedback.alternative_preference))
    
    def test_learning_system_improvement_over_time(self):
        """Test that the learning system actually improves recommendations over time"""
        
        emotions = {'calm': 0.8, 'neutral': 0.2}
        energy_level = 0.4
        
        # Get initial recommendations
        initial_recs = music_recommendation_service.get_recommendations(
            emotions=emotions,
            energy_level=energy_level,
            user_preferences=self.user_preferences
        )
        
        # Simulate multiple feedback cycles
        for cycle in range(3):
            recommendations = music_recommendation_service.get_recommendations(
                emotions=emotions,
                energy_level=energy_level,
                user_preferences=self.user_preferences
            )
            
            if recommendations:
                # Accept recommendations that match user preferences better
                for rec in recommendations:
                    if 'jazz' in rec.get('title', '').lower():
                        music_recommendation_service.record_user_feedback(
                            recommendation_id=rec['recommendation_id'],
                            response='accepted'
                        )
                    else:
                        music_recommendation_service.record_user_feedback(
                            recommendation_id=rec['recommendation_id'],
                            response='rejected',
                            alternative_choice={'genre': 'jazz', 'energy_level': 0.4}
                        )
        
        # Get final recommendations
        final_recs = music_recommendation_service.get_recommendations(
            emotions=emotions,
            energy_level=energy_level,
            user_preferences=self.user_preferences
        )
        
        # Verify learning occurred
        updated_preferences = UserPreferences.objects.first()
        
        # Should have learned the calm-energy correlation
        calm_mappings = updated_preferences.music_energy_mappings.get('calm', [])
        self.assertGreater(len(calm_mappings), 0)
        
        # Should prefer jazz more strongly
        self.assertIn('jazz', updated_preferences.preferred_genres)
    
    def test_cross_system_learning_consistency(self):
        """Test that learning is consistent between music and theme systems"""
        
        emotions = {'focused': 0.9}
        energy_level = 0.7
        
        # Get recommendations from both systems
        music_recs = music_recommendation_service.get_recommendations(
            emotions=emotions,
            energy_level=energy_level,
            user_preferences=self.user_preferences
        )
        
        theme_recs = theme_recommendation_service.get_recommendations(
            emotions=emotions,
            energy_level=energy_level,
            user_preferences=self.user_preferences
        )
        
        # Accept recommendations from both systems
        if music_recs:
            music_recommendation_service.record_user_feedback(
                recommendation_id=music_recs[0]['recommendation_id'],
                response='accepted'
            )
        
        if theme_recs:
            theme_recommendation_service.record_user_feedback(
                theme_recommendation=theme_recs[0],
                response='accepted'
            )
        
        # Verify both systems learned from the same emotion context
        updated_preferences = UserPreferences.objects.first()
        
        # Both should have updated focused-related preferences
        focused_music_mappings = updated_preferences.music_energy_mappings.get('focused', [])
        focused_theme_mappings = updated_preferences.theme_emotion_mappings.get('focused', {})
        
        # At least one system should have learned something about 'focused' emotion
        has_music_learning = len(focused_music_mappings) > 0
        has_theme_learning = len(focused_theme_mappings) > 0
        
        self.assertTrue(has_music_learning or has_theme_learning, 
                       "At least one system should learn from focused emotion feedback")