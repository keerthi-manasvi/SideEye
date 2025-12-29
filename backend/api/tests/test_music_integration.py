"""
Integration tests for music recommendation system
"""
import json
from unittest.mock import patch, MagicMock
from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APITestCase
from rest_framework import status
from django.utils import timezone

from ..models import (
    MusicGenre, YouTubePlaylist, MusicRecommendation, 
    UserPreferences, EmotionReading
)
from ..services.youtube_service import YouTubeService
from ..services.music_recommendation_service import MusicRecommendationService


class YouTubeServiceIntegrationTest(TestCase):
    """Test YouTube service integration"""
    
    def setUp(self):
        self.youtube_service = YouTubeService()
        
        # Create test genres
        self.pop_genre = MusicGenre.objects.create(
            name='pop',
            emotional_associations={'happy': 0.8, 'excited': 0.7},
            typical_energy_range=[0.5, 0.8]
        )
        
        self.rock_genre = MusicGenre.objects.create(
            name='rock',
            emotional_associations={'angry': 0.7, 'excited': 0.8},
            typical_energy_range=[0.6, 0.9]
        )
    
    @patch('api.services.youtube_service.build')
    def test_search_playlists_success(self, mock_build):
        """Test successful playlist search"""
        # Mock YouTube API response
        mock_youtube = MagicMock()
        mock_build.return_value = mock_youtube
        
        mock_search = MagicMock()
        mock_youtube.search.return_value = mock_search
        mock_list = MagicMock()
        mock_search.list.return_value = mock_list
        
        mock_response = {
            'items': [
                {
                    'id': {'playlistId': 'PLtest123'},
                    'snippet': {
                        'title': 'Happy Pop Music',
                        'description': 'Upbeat pop songs',
                        'channelTitle': 'Music Channel',
                        'publishedAt': '2023-01-01T00:00:00Z'
                    }
                }
            ]
        }
        mock_list.execute.return_value = mock_response
        
        # Test search
        self.youtube_service.api_key = 'test_key'
        self.youtube_service._initialize_client()
        
        results = self.youtube_service.search_playlists('happy music', max_results=10)
        
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]['youtube_id'], 'PLtest123')
        self.assertEqual(results[0]['title'], 'Happy Pop Music')
    
    @patch('api.services.youtube_service.build')
    def test_get_playlist_details_success(self, mock_build):
        """Test getting playlist details"""
        # Mock YouTube API response
        mock_youtube = MagicMock()
        mock_build.return_value = mock_youtube
        
        mock_playlists = MagicMock()
        mock_youtube.playlists.return_value = mock_playlists
        mock_list = MagicMock()
        mock_playlists.list.return_value = mock_list
        
        mock_response = {
            'items': [
                {
                    'id': 'PLtest123',
                    'snippet': {
                        'title': 'Test Playlist',
                        'description': 'Test description',
                        'channelTitle': 'Test Channel',
                        'publishedAt': '2023-01-01T00:00:00Z'
                    },
                    'contentDetails': {
                        'itemCount': 25
                    }
                }
            ]
        }
        mock_list.execute.return_value = mock_response
        
        # Test get details
        self.youtube_service.api_key = 'test_key'
        self.youtube_service._initialize_client()
        
        result = self.youtube_service.get_playlist_details('PLtest123')
        
        self.assertIsNotNone(result)
        self.assertEqual(result['youtube_id'], 'PLtest123')
        self.assertEqual(result['video_count'], 25)
    
    def test_discover_playlists_by_emotion(self):
        """Test emotion-based playlist discovery"""
        with patch.object(self.youtube_service, 'search_playlists') as mock_search:
            mock_search.return_value = [
                {
                    'youtube_id': 'PLhappy1',
                    'title': 'Happy Songs',
                    'description': 'Feel good music',
                    'channel_title': 'Music Channel'
                }
            ]
            
            results = self.youtube_service.discover_playlists_by_emotion(
                'happy', energy_level=0.8, max_results=5
            )
            
            self.assertEqual(len(results), 1)
            self.assertEqual(results[0]['youtube_id'], 'PLhappy1')
            
            # Verify search was called with appropriate queries
            self.assertTrue(mock_search.called)
    
    def test_discover_playlists_by_genre(self):
        """Test genre-based playlist discovery"""
        with patch.object(self.youtube_service, 'search_playlists') as mock_search:
            mock_search.return_value = [
                {
                    'youtube_id': 'PLrock1',
                    'title': 'Rock Hits',
                    'description': 'Best rock songs',
                    'channel_title': 'Rock Channel'
                }
            ]
            
            results = self.youtube_service.discover_playlists_by_genre('rock', max_results=10)
            
            self.assertEqual(len(results), 1)
            self.assertEqual(results[0]['youtube_id'], 'PLrock1')


class MusicRecommendationServiceIntegrationTest(TestCase):
    """Test music recommendation service integration"""
    
    def setUp(self):
        self.recommendation_service = MusicRecommendationService()
        
        # Create test genres
        self.pop_genre = MusicGenre.objects.create(
            name='pop',
            emotional_associations={'happy': 0.8, 'excited': 0.7},
            typical_energy_range=[0.5, 0.8]
        )
        
        # Create test playlists
        self.happy_playlist = YouTubePlaylist.objects.create(
            youtube_id='PLhappy123',
            title='Happy Pop Songs',
            description='Upbeat pop music',
            channel_title='Music Channel',
            energy_level=0.7,
            emotional_tags=['happy', 'excited'],
            acceptance_rate=0.8,
            user_rating=4.5
        )
        self.happy_playlist.genres.add(self.pop_genre)
        
        self.sad_playlist = YouTubePlaylist.objects.create(
            youtube_id='PLsad123',
            title='Sad Ballads',
            description='Emotional songs',
            channel_title='Ballad Channel',
            energy_level=0.3,
            emotional_tags=['sad', 'calm'],
            acceptance_rate=0.6,
            user_rating=4.0
        )
        
        # Create user preferences
        self.user_preferences = UserPreferences.objects.create(
            preferred_genres=['pop', 'rock'],
            music_energy_mappings={'happy': [0.7, 0.8, 0.6]}
        )
    
    def test_get_recommendations_happy_emotion(self):
        """Test getting recommendations for happy emotion"""
        emotions = {'happy': 0.8, 'neutral': 0.2}
        energy_level = 0.7
        
        recommendations = self.recommendation_service.get_recommendations(
            emotions, energy_level, self.user_preferences, max_recommendations=3
        )
        
        self.assertGreater(len(recommendations), 0)
        
        # Should prefer the happy playlist
        happy_rec = next((r for r in recommendations if r['playlist_id'] == 'PLhappy123'), None)
        self.assertIsNotNone(happy_rec)
        self.assertGreater(happy_rec['confidence_score'], 0.5)
    
    def test_get_recommendations_sad_emotion(self):
        """Test getting recommendations for sad emotion"""
        emotions = {'sad': 0.7, 'neutral': 0.3}
        energy_level = 0.3
        
        recommendations = self.recommendation_service.get_recommendations(
            emotions, energy_level, self.user_preferences, max_recommendations=3
        )
        
        self.assertGreater(len(recommendations), 0)
        
        # Should prefer the sad playlist
        sad_rec = next((r for r in recommendations if r['playlist_id'] == 'PLsad123'), None)
        self.assertIsNotNone(sad_rec)
    
    def test_discover_and_cache_playlists(self):
        """Test playlist discovery and caching"""
        # Test that when no matching playlists exist, the system handles it gracefully
        emotions = {'happy': 0.9, 'neutral': 0.1}
        energy_level = 0.8
        
        # Clear existing playlists that might match
        YouTubePlaylist.objects.all().delete()
        
        recommendations = self.recommendation_service.get_recommendations(
            emotions, energy_level, self.user_preferences, max_recommendations=5
        )
        
        # Should handle empty results gracefully
        self.assertIsInstance(recommendations, list)
        # Since YouTube service is not available in tests, should return empty list
        self.assertEqual(len(recommendations), 0)
    
    def test_record_user_feedback(self):
        """Test recording user feedback"""
        # Create a recommendation
        recommendation = MusicRecommendation.objects.create(
            emotion_context={'emotions': {'happy': 0.8}, 'energy_level': 0.7},
            energy_level=0.7,
            recommended_playlist=self.happy_playlist,
            recommendation_reason='Test recommendation',
            confidence_score=0.8
        )
        
        # Record positive feedback
        self.recommendation_service.record_user_feedback(
            recommendation.id, 'accepted'
        )
        
        # Check feedback was recorded
        recommendation.refresh_from_db()
        self.assertEqual(recommendation.user_response, 'accepted')
        self.assertIsNotNone(recommendation.response_timestamp)
        
        # Check playlist acceptance rate was updated
        self.happy_playlist.refresh_from_db()
        self.assertGreater(self.happy_playlist.acceptance_rate, 0.8)
    
    def test_get_user_music_stats(self):
        """Test getting user music statistics"""
        # Create some recommendations with feedback
        rec1 = MusicRecommendation.objects.create(
            emotion_context={'emotions': {'happy': 0.8}},
            energy_level=0.7,
            recommended_playlist=self.happy_playlist,
            recommendation_reason='Test 1',
            confidence_score=0.8,
            user_response='accepted'
        )
        
        rec2 = MusicRecommendation.objects.create(
            emotion_context={'emotions': {'sad': 0.7}},
            energy_level=0.3,
            recommended_playlist=self.sad_playlist,
            recommendation_reason='Test 2',
            confidence_score=0.6,
            user_response='rejected'
        )
        
        stats = self.recommendation_service.get_user_music_stats()
        
        self.assertEqual(stats['total_recommendations'], 2)
        self.assertEqual(stats['acceptance_rate'], 50.0)  # 1 out of 2 accepted


class MusicRecommendationAPITest(APITestCase):
    """Test music recommendation API endpoints"""
    
    def setUp(self):
        # Create test data
        self.pop_genre = MusicGenre.objects.create(
            name='pop',
            emotional_associations={'happy': 0.8},
            typical_energy_range=[0.5, 0.8]
        )
        
        self.playlist = YouTubePlaylist.objects.create(
            youtube_id='PLtest123',
            title='Test Playlist',
            description='Test description',
            channel_title='Test Channel',
            energy_level=0.7,
            emotional_tags=['happy'],
            acceptance_rate=0.8
        )
        self.playlist.genres.add(self.pop_genre)
    
    def test_get_music_recommendations_api(self):
        """Test the music recommendations API endpoint"""
        url = reverse('music-recommendations-get-recommendations')
        data = {
            'emotions': {'happy': 0.8, 'neutral': 0.2},
            'energy_level': 0.7,
            'max_recommendations': 3
        }
        
        response = self.client.post(url, data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('recommendations', response.data)
        self.assertIn('context', response.data)
        
        recommendations = response.data['recommendations']
        self.assertGreater(len(recommendations), 0)
        
        # Check recommendation structure
        rec = recommendations[0]
        self.assertIn('playlist_id', rec)
        self.assertIn('title', rec)
        self.assertIn('confidence_score', rec)
        self.assertIn('recommendation_id', rec)
    
    def test_music_feedback_api(self):
        """Test the music feedback API endpoint"""
        # Create a recommendation first
        recommendation = MusicRecommendation.objects.create(
            emotion_context={'emotions': {'happy': 0.8}},
            energy_level=0.7,
            recommended_playlist=self.playlist,
            recommendation_reason='Test recommendation',
            confidence_score=0.8
        )
        
        url = reverse('music-recommendations-feedback')
        data = {
            'recommendation_id': recommendation.id,
            'response': 'accepted'
        }
        
        response = self.client.post(url, data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('message', response.data)
        
        # Check feedback was recorded
        recommendation.refresh_from_db()
        self.assertEqual(recommendation.user_response, 'accepted')
    
    def test_music_stats_api(self):
        """Test the music statistics API endpoint"""
        url = reverse('music-recommendations-stats')
        
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # Should return empty stats initially
        self.assertEqual(response.data.get('total_recommendations', 0), 0)
    
    @patch('api.services.youtube_service.youtube_service')
    def test_discover_playlists_api(self, mock_youtube_service):
        """Test the playlist discovery API endpoint"""
        mock_youtube_service.discover_playlists_by_emotion.return_value = [
            {
                'youtube_id': 'PLdiscovered123',
                'title': 'Discovered Playlist',
                'description': 'Found via API',
                'channel_title': 'Discovery Channel'
            }
        ]
        
        url = reverse('music-recommendations-discover-playlists')
        data = {
            'search_type': 'emotion',
            'query': 'happy',
            'energy_level': 0.7,
            'max_results': 5
        }
        
        response = self.client.post(url, data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('playlists', response.data)
        
        playlists = response.data['playlists']
        self.assertEqual(len(playlists), 1)
        self.assertEqual(playlists[0]['youtube_id'], 'PLdiscovered123')


class YouTubePlaylistAPITest(APITestCase):
    """Test YouTube playlist API endpoints"""
    
    def setUp(self):
        self.genre = MusicGenre.objects.create(
            name='rock',
            emotional_associations={'angry': 0.7},
            typical_energy_range=[0.6, 0.9]
        )
        
        self.playlist = YouTubePlaylist.objects.create(
            youtube_id='PLrock123',
            title='Rock Playlist',
            description='Rock songs',
            channel_title='Rock Channel',
            energy_level=0.8,
            emotional_tags=['angry', 'excited'],
            acceptance_rate=0.7,
            user_rating=4.0
        )
        self.playlist.genres.add(self.genre)
    
    def test_list_playlists_api(self):
        """Test listing playlists"""
        url = reverse('youtube-playlists-list')
        
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        
        playlist_data = response.data[0]
        self.assertEqual(playlist_data['youtube_id'], 'PLrock123')
        self.assertEqual(playlist_data['title'], 'Rock Playlist')
    
    def test_rate_playlist_api(self):
        """Test rating a playlist"""
        url = reverse('youtube-playlists-rate', kwargs={'pk': self.playlist.pk})
        data = {'rating': 4.5}
        
        response = self.client.post(url, data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        # Check rating was updated
        self.playlist.refresh_from_db()
        self.assertEqual(self.playlist.user_rating, 4.5)
    
    @patch('api.services.youtube_service.youtube_service')
    def test_validate_playlist_api(self, mock_youtube_service):
        """Test playlist validation"""
        mock_youtube_service.validate_playlist_exists.return_value = True
        
        url = reverse('youtube-playlists-validate', kwargs={'pk': self.playlist.pk})
        
        response = self.client.post(url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['is_valid'])
        self.assertTrue(response.data['is_active'])
    
    def test_get_genres_api(self):
        """Test getting available genres"""
        url = reverse('youtube-playlists-genres')
        
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('genres', response.data)
        
        genres = response.data['genres']
        self.assertEqual(len(genres), 1)
        self.assertEqual(genres[0]['name'], 'rock')


class MusicRecommendationWorkflowTest(TestCase):
    """Test complete music recommendation workflow"""
    
    def setUp(self):
        # Create comprehensive test data
        self.pop_genre = MusicGenre.objects.create(
            name='pop',
            emotional_associations={'happy': 0.8, 'excited': 0.7},
            typical_energy_range=[0.5, 0.8]
        )
        
        self.classical_genre = MusicGenre.objects.create(
            name='classical',
            emotional_associations={'calm': 0.8, 'focused': 0.9},
            typical_energy_range=[0.2, 0.6]
        )
        
        # Create playlists for different moods
        self.energetic_playlist = YouTubePlaylist.objects.create(
            youtube_id='PLenergetic123',
            title='High Energy Pop',
            description='Upbeat pop songs',
            channel_title='Energy Music',
            energy_level=0.8,
            emotional_tags=['happy', 'excited'],
            acceptance_rate=0.9,
            user_rating=4.8
        )
        self.energetic_playlist.genres.add(self.pop_genre)
        
        self.calm_playlist = YouTubePlaylist.objects.create(
            youtube_id='PLcalm123',
            title='Classical Focus',
            description='Peaceful classical music',
            channel_title='Classical Channel',
            energy_level=0.3,
            emotional_tags=['calm', 'focused'],
            acceptance_rate=0.8,
            user_rating=4.5
        )
        self.calm_playlist.genres.add(self.classical_genre)
        
        # Create user preferences
        self.user_preferences = UserPreferences.objects.create(
            preferred_genres=['pop', 'classical'],
            music_energy_mappings={
                'happy': [0.7, 0.8, 0.9],
                'calm': [0.2, 0.3, 0.4]
            }
        )
        
        self.recommendation_service = MusicRecommendationService()
    
    def test_complete_recommendation_workflow(self):
        """Test complete workflow from emotion to recommendation to feedback"""
        
        # Step 1: Get recommendations for high energy happy state
        emotions = {'happy': 0.8, 'excited': 0.2}
        energy_level = 0.8
        
        recommendations = self.recommendation_service.get_recommendations(
            emotions, energy_level, self.user_preferences, max_recommendations=3
        )
        
        self.assertGreater(len(recommendations), 0)
        
        # Should prefer energetic playlist
        energetic_rec = next(
            (r for r in recommendations if r['playlist_id'] == 'PLenergetic123'), 
            None
        )
        self.assertIsNotNone(energetic_rec)
        self.assertGreater(energetic_rec['confidence_score'], 0.6)
        
        # Step 2: User accepts the recommendation
        recommendation_id = energetic_rec['recommendation_id']
        self.recommendation_service.record_user_feedback(
            recommendation_id, 'accepted'
        )
        
        # Step 3: Check that acceptance rate improved
        self.energetic_playlist.refresh_from_db()
        self.assertGreaterEqual(self.energetic_playlist.acceptance_rate, 0.9)
        
        # Step 4: Get recommendations for low energy calm state
        emotions = {'calm': 0.7, 'neutral': 0.3}
        energy_level = 0.3
        
        recommendations = self.recommendation_service.get_recommendations(
            emotions, energy_level, self.user_preferences, max_recommendations=3
        )
        
        # Should prefer calm playlist
        calm_rec = next(
            (r for r in recommendations if r['playlist_id'] == 'PLcalm123'), 
            None
        )
        self.assertIsNotNone(calm_rec)
        
        # Step 5: User rejects with alternative
        recommendation_id = calm_rec['recommendation_id']
        alternative = {
            'genre': 'ambient',
            'energy_level': 0.2,
            'reason': 'Prefer more ambient music'
        }
        
        self.recommendation_service.record_user_feedback(
            recommendation_id, 'rejected', alternative
        )
        
        # Step 6: Check that user preferences were updated
        self.user_preferences.refresh_from_db()
        self.assertIn('ambient', self.user_preferences.preferred_genres)
    
    def test_learning_from_feedback_patterns(self):
        """Test that system learns from feedback patterns"""
        
        # Create multiple recommendations and feedback
        emotions = {'happy': 0.8, 'neutral': 0.2}
        energy_level = 0.7
        
        # Generate several recommendations
        for i in range(5):
            recommendations = self.recommendation_service.get_recommendations(
                emotions, energy_level, self.user_preferences, max_recommendations=1
            )
            
            if recommendations:
                rec_id = recommendations[0]['recommendation_id']
                # Accept energetic playlist, reject calm playlist
                response = 'accepted' if recommendations[0]['playlist_id'] == 'PLenergetic123' else 'rejected'
                self.recommendation_service.record_user_feedback(rec_id, response)
        
        # Check that energetic playlist has higher acceptance rate
        self.energetic_playlist.refresh_from_db()
        self.calm_playlist.refresh_from_db()
        
        self.assertGreater(
            self.energetic_playlist.acceptance_rate,
            self.calm_playlist.acceptance_rate
        )
        
        # Future recommendations should prefer energetic playlist for happy emotions
        final_recommendations = self.recommendation_service.get_recommendations(
            emotions, energy_level, self.user_preferences, max_recommendations=2
        )
        
        # Energetic playlist should be ranked higher
        energetic_rec = next(
            (r for r in final_recommendations if r['playlist_id'] == 'PLenergetic123'), 
            None
        )
        calm_rec = next(
            (r for r in final_recommendations if r['playlist_id'] == 'PLcalm123'), 
            None
        )
        
        if energetic_rec and calm_rec:
            self.assertGreater(
                energetic_rec['confidence_score'],
                calm_rec['confidence_score']
            )