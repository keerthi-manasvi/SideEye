"""
Tests for Theme Management and CLI Hook Integration
"""
import json
from unittest.mock import patch, MagicMock
from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APITestCase
from rest_framework import status
from django.utils import timezone

from ..models import UserPreferences, UserFeedback
from ..services.theme_recommendation_service import theme_recommendation_service
from ..services.cli_hook_service import cli_hook_service


class ThemeRecommendationServiceTest(TestCase):
    """Test cases for Theme Recommendation Service"""
    
    def setUp(self):
        """Set up test fixtures"""
        self.emotions = {
            'happy': 0.8,
            'sad': 0.1,
            'neutral': 0.1
        }
        self.energy_level = 0.7
        
        # Create user preferences
        self.user_preferences = UserPreferences.objects.create(
            preferred_color_palettes=['warm_bright', 'vibrant'],
            theme_emotion_mappings={
                'happy': {
                    'colors': ['#FFD700', '#FFA500'],
                    'palette': 'warm_bright'
                }
            }
        )
    
    def test_get_recommendations_basic(self):
        """Test basic theme recommendations"""
        recommendations = theme_recommendation_service.get_recommendations(
            emotions=self.emotions,
            energy_level=self.energy_level,
            user_preferences=self.user_preferences,
            max_recommendations=3
        )
        
        self.assertIsInstance(recommendations, list)
        self.assertLessEqual(len(recommendations), 3)
        
        for rec in recommendations:
            self.assertIn('theme_name', rec)
            self.assertIn('colors', rec)
            self.assertIn('palette', rec)
            self.assertIn('cli_commands', rec)
            self.assertIn('confidence_score', rec)
            self.assertIn('reason', rec)
    
    def test_get_recommendations_no_preferences(self):
        """Test recommendations without user preferences"""
        recommendations = theme_recommendation_service.get_recommendations(
            emotions=self.emotions,
            energy_level=self.energy_level,
            user_preferences=None,
            max_recommendations=2
        )
        
        self.assertIsInstance(recommendations, list)
        self.assertLessEqual(len(recommendations), 2)
    
    def test_get_recommendations_high_energy(self):
        """Test recommendations for high energy levels"""
        high_energy_emotions = {'excited': 0.9, 'happy': 0.1}
        
        recommendations = theme_recommendation_service.get_recommendations(
            emotions=high_energy_emotions,
            energy_level=0.9,
            user_preferences=self.user_preferences
        )
        
        self.assertGreater(len(recommendations), 0)
        
        # Check that recommendations include energizing themes
        for rec in recommendations:
            self.assertIsInstance(rec['colors'], list)
            self.assertGreater(len(rec['colors']), 0)
    
    def test_get_recommendations_low_energy(self):
        """Test recommendations for low energy levels"""
        low_energy_emotions = {'sad': 0.6, 'calm': 0.4}
        
        recommendations = theme_recommendation_service.get_recommendations(
            emotions=low_energy_emotions,
            energy_level=0.2,
            user_preferences=self.user_preferences
        )
        
        self.assertGreater(len(recommendations), 0)
        
        # Check that recommendations include calming themes
        for rec in recommendations:
            self.assertIn('reason', rec)
            # Should mention calming or low energy support
            reason_lower = rec['reason'].lower()
            self.assertTrue(
                'calm' in reason_lower or 
                'low energy' in reason_lower or 
                'comfort' in reason_lower or
                'gentle' in reason_lower
            )
    
    def test_generate_energy_variations(self):
        """Test energy-based theme variations"""
        variations = theme_recommendation_service._generate_energy_variations('happy', 0.8)
        
        self.assertIsInstance(variations, list)
        
        # Should include high energy variation
        high_energy_found = False
        for variation in variations:
            if variation.get('variation') == 'high_energy':
                high_energy_found = True
                self.assertIn('Energized', variation['name'])
        
        self.assertTrue(high_energy_found)
    
    def test_generate_preference_themes(self):
        """Test user preference-based theme generation"""
        preference_themes = theme_recommendation_service._generate_preference_themes(
            self.user_preferences, 'happy', 0.7
        )
        
        self.assertIsInstance(preference_themes, list)
        self.assertGreater(len(preference_themes), 0)
        
        # Should include themes based on preferred palettes
        palette_found = False
        for theme in preference_themes:
            if theme.get('palette') in self.user_preferences.preferred_color_palettes:
                palette_found = True
        
        self.assertTrue(palette_found)
    
    def test_score_themes(self):
        """Test theme scoring algorithm"""
        themes = [
            {
                'name': 'Test Theme 1',
                'colors': ['#FF0000'],
                'palette': 'warm_bright',
                'energy_range': [0.6, 1.0],
                'user_preference': True
            },
            {
                'name': 'Test Theme 2',
                'colors': ['#0000FF'],
                'palette': 'cool_muted',
                'energy_range': [0.0, 0.4]
            }
        ]
        
        scored_themes = theme_recommendation_service._score_themes(
            themes, self.emotions, self.energy_level, self.user_preferences
        )
        
        self.assertEqual(len(scored_themes), 2)
        
        # First theme should score higher (user preference + energy match)
        theme1_score = scored_themes[0][1]
        theme2_score = scored_themes[1][1]
        
        self.assertGreater(theme1_score, theme2_score)
    
    def test_calculate_emotion_appropriateness(self):
        """Test emotion appropriateness calculation"""
        bright_theme = {'palette': 'warm_bright'}
        dark_theme = {'palette': 'cool_dark'}
        
        happy_emotions = {'happy': 0.8, 'excited': 0.2}
        sad_emotions = {'sad': 0.7, 'calm': 0.3}
        
        # Bright theme should be more appropriate for happy emotions
        bright_happy_score = theme_recommendation_service._calculate_emotion_appropriateness(
            bright_theme, happy_emotions
        )
        bright_sad_score = theme_recommendation_service._calculate_emotion_appropriateness(
            bright_theme, sad_emotions
        )
        
        self.assertGreater(bright_happy_score, bright_sad_score)
    
    def test_calculate_novelty_score(self):
        """Test novelty score calculation"""
        theme = {'name': 'Test Novelty Theme'}
        
        # Should have high novelty when no recent usage
        novelty_score = theme_recommendation_service._calculate_novelty_score(theme)
        self.assertEqual(novelty_score, 1.0)
        
        # Create recent feedback for this theme
        UserFeedback.objects.create(
            suggestion_type='theme',
            emotion_context=self.emotions,
            suggestion_data={'theme_name': 'Test Novelty Theme'},
            user_response='accepted'
        )
        
        # Should have lower novelty after recent usage
        novelty_score_after = theme_recommendation_service._calculate_novelty_score(theme)
        self.assertLess(novelty_score_after, novelty_score)
    
    def test_create_theme_recommendation(self):
        """Test theme recommendation creation"""
        theme_data = {
            'name': 'Test Recommendation Theme',
            'colors': ['#123456', '#789ABC'],
            'palette': 'test_palette'
        }
        
        recommendation = theme_recommendation_service._create_theme_recommendation(
            theme_data, self.emotions, self.energy_level, 0.85
        )
        
        self.assertEqual(recommendation['theme_name'], 'Test Recommendation Theme')
        self.assertEqual(recommendation['colors'], ['#123456', '#789ABC'])
        self.assertEqual(recommendation['palette'], 'test_palette')
        self.assertEqual(recommendation['confidence_score'], 0.85)
        self.assertEqual(recommendation['energy_level'], self.energy_level)
        self.assertEqual(recommendation['emotion_context'], self.emotions)
        self.assertIn('cli_commands', recommendation)
        self.assertIn('reason', recommendation)
        self.assertIn('timestamp', recommendation)
    
    def test_generate_recommendation_reason(self):
        """Test recommendation reason generation"""
        theme_data = {'name': 'Test Theme', 'user_preference': True}
        
        reason = theme_recommendation_service._generate_recommendation_reason(
            theme_data, self.emotions, self.energy_level
        )
        
        self.assertIsInstance(reason, str)
        self.assertGreater(len(reason), 0)
        self.assertIn('energy', reason.lower())
    
    def test_record_user_feedback(self):
        """Test user feedback recording"""
        theme_recommendation = {
            'theme_name': 'Feedback Test Theme',
            'colors': ['#ABCDEF'],
            'palette': 'test',
            'confidence_score': 0.9,
            'emotion_context': self.emotions
        }
        
        theme_recommendation_service.record_user_feedback(
            theme_recommendation, 'accepted', None
        )
        
        # Check that feedback was recorded
        feedback = UserFeedback.objects.filter(suggestion_type='theme').first()
        self.assertIsNotNone(feedback)
        self.assertEqual(feedback.user_response, 'accepted')
        self.assertEqual(feedback.suggestion_data['theme_name'], 'Feedback Test Theme')
    
    def test_learn_from_feedback_accepted(self):
        """Test learning from accepted feedback"""
        theme_recommendation = {
            'theme_name': 'Learning Test Theme',
            'colors': ['#FEDCBA'],
            'palette': 'learning_test',
            'confidence_score': 0.9,
            'emotion_context': {'happy': 0.9}
        }
        
        # Record accepted feedback
        theme_recommendation_service.record_user_feedback(
            theme_recommendation, 'accepted', None
        )
        
        # Check that preferences were updated
        preferences = UserPreferences.objects.first()
        self.assertIn('learning_test', preferences.preferred_color_palettes)
        self.assertIn('happy', preferences.theme_emotion_mappings)
    
    def test_learn_from_feedback_rejected_with_alternative(self):
        """Test learning from rejected feedback with alternative"""
        theme_recommendation = {
            'theme_name': 'Rejected Theme',
            'colors': ['#000000'],
            'palette': 'rejected_palette',
            'confidence_score': 0.7,
            'emotion_context': {'sad': 0.8}
        }
        
        alternative_choice = {
            'colors': ['#FFFFFF'],
            'palette': 'preferred_alternative'
        }
        
        # Record rejected feedback with alternative
        theme_recommendation_service.record_user_feedback(
            theme_recommendation, 'rejected', alternative_choice
        )
        
        # Check that alternative preferences were learned
        preferences = UserPreferences.objects.first()
        self.assertIn('preferred_alternative', preferences.preferred_color_palettes)
    
    def test_brighten_colors(self):
        """Test color brightening function"""
        colors = ['#808080', '#404040']
        brightened = theme_recommendation_service._brighten_colors(colors)
        
        self.assertEqual(len(brightened), len(colors))
        
        # Check that colors were actually brightened
        for original, bright in zip(colors, brightened):
            if original.startswith('#') and len(original) == 7:
                # Extract RGB values
                orig_r = int(original[1:3], 16)
                bright_r = int(bright[1:3], 16)
                self.assertGreaterEqual(bright_r, orig_r)
    
    def test_soften_colors(self):
        """Test color softening function"""
        colors = ['#FF0000', '#00FF00']
        softened = theme_recommendation_service._soften_colors(colors)
        
        self.assertEqual(len(softened), len(colors))
        
        # Softened colors should be less saturated
        for softened_color in softened:
            self.assertTrue(softened_color.startswith('#'))
            self.assertEqual(len(softened_color), 7)
    
    def test_get_colors_for_palette(self):
        """Test palette color retrieval"""
        warm_colors = theme_recommendation_service._get_colors_for_palette('warm_bright')
        cool_colors = theme_recommendation_service._get_colors_for_palette('cool_muted')
        unknown_colors = theme_recommendation_service._get_colors_for_palette('unknown_palette')
        
        self.assertIsInstance(warm_colors, list)
        self.assertIsInstance(cool_colors, list)
        self.assertIsInstance(unknown_colors, list)
        
        self.assertGreater(len(warm_colors), 0)
        self.assertGreater(len(cool_colors), 0)
        self.assertGreater(len(unknown_colors), 0)
        
        # Colors should be different for different palettes
        self.assertNotEqual(warm_colors, cool_colors)
    
    @patch('api.services.cli_hook_service.cli_hook_service.apply_theme_with_fallback')
    def test_apply_theme(self, mock_apply):
        """Test theme application"""
        mock_apply.return_value = {
            'success': True,
            'theme_name': 'Applied Theme',
            'commands_executed': 5,
            'commands_successful': 4
        }
        
        theme_recommendation = {
            'theme_name': 'Applied Theme',
            'colors': ['#123456'],
            'palette': 'test'
        }
        
        result = theme_recommendation_service.apply_theme(theme_recommendation)
        
        self.assertTrue(result['success'])
        self.assertEqual(result['theme_name'], 'Applied Theme')
        mock_apply.assert_called_once_with(theme_recommendation)


class ThemeManagementAPITest(APITestCase):
    """Test cases for Theme Management API endpoints"""
    
    def setUp(self):
        """Set up test fixtures"""
        self.emotions = {
            'happy': 0.8,
            'excited': 0.2
        }
        self.energy_level = 0.7
        
        # Create user preferences
        UserPreferences.objects.create(
            preferred_color_palettes=['warm_bright'],
            theme_emotion_mappings={}
        )
    
    def test_get_theme_recommendations(self):
        """Test GET theme recommendations endpoint"""
        url = reverse('themes-get-recommendations')
        data = {
            'emotions': self.emotions,
            'energy_level': self.energy_level,
            'max_recommendations': 3
        }
        
        response = self.client.post(url, data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('recommendations', response.data)
        self.assertIn('total_count', response.data)
        self.assertIn('request_context', response.data)
        
        recommendations = response.data['recommendations']
        self.assertIsInstance(recommendations, list)
        self.assertLessEqual(len(recommendations), 3)
    
    def test_get_theme_recommendations_missing_data(self):
        """Test theme recommendations with missing required data"""
        url = reverse('themes-get-recommendations')
        
        # Missing emotions
        response = self.client.post(url, {'energy_level': 0.5}, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        
        # Missing energy_level
        response = self.client.post(url, {'emotions': self.emotions}, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        
        # Invalid energy_level
        response = self.client.post(url, {
            'emotions': self.emotions,
            'energy_level': 1.5
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
    
    def test_submit_theme_feedback(self):
        """Test theme feedback submission endpoint"""
        url = reverse('themes-submit-feedback')
        
        theme_recommendation = {
            'theme_name': 'Test Feedback Theme',
            'colors': ['#123456'],
            'palette': 'test',
            'confidence_score': 0.8,
            'emotion_context': self.emotions
        }
        
        data = {
            'theme_recommendation': theme_recommendation,
            'response': 'accepted'
        }
        
        response = self.client.post(url, data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('message', response.data)
        self.assertEqual(response.data['response'], 'accepted')
        
        # Check that feedback was recorded in database
        feedback = UserFeedback.objects.filter(suggestion_type='theme').first()
        self.assertIsNotNone(feedback)
        self.assertEqual(feedback.user_response, 'accepted')
    
    def test_submit_theme_feedback_invalid_response(self):
        """Test theme feedback with invalid response"""
        url = reverse('themes-submit-feedback')
        
        data = {
            'theme_recommendation': {'theme_name': 'Test'},
            'response': 'invalid_response'
        }
        
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
    
    def test_get_theme_learning_metrics(self):
        """Test theme learning metrics endpoint"""
        url = reverse('themes-learning-metrics')
        
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # The response structure depends on the learning effectiveness implementation
        self.assertIsInstance(response.data, dict)
    
    def test_apply_theme_endpoint_no_mock(self):
        """Test theme application endpoint without mock"""
        url = reverse('themes-apply-theme')
        data = {
            'theme_data': {
                'theme_name': 'Applied Theme',
                'colors': ['#FF0000', '#00FF00'],
                'palette': 'test_palette'
            }
        }
        
        response = self.client.post(url, data, format='json')
        
        # Should get a response (may fail due to CLI commands, but endpoint should work)
        self.assertIn(response.status_code, [status.HTTP_200_OK, status.HTTP_500_INTERNAL_SERVER_ERROR])
        
        if response.status_code == status.HTTP_200_OK:
            self.assertIn('success', response.data)
        else:
            # If it fails, it should be due to CLI execution, not missing method
            self.assertIn('error', response.data)
    
    def test_apply_theme_missing_data(self):
        """Test theme application with missing data"""
        url = reverse('themes-apply-theme')
        
        # Missing theme_data
        response = self.client.post(url, {}, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        
        # Missing required fields in theme_data
        response = self.client.post(url, {
            'theme_data': {'theme_name': 'Test'}  # Missing colors
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


class CLIHookAPITest(APITestCase):
    """Test cases for CLI Hook API endpoints"""
    
    def test_get_cli_hook_configuration(self):
        """Test GET CLI hook configuration endpoint"""
        url = reverse('cli-hooks-configuration')
        
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIsInstance(response.data, dict)
        self.assertIn('enabled', response.data)
        self.assertIn('timeout_seconds', response.data)
        self.assertIn('custom_commands', response.data)
    
    def test_update_cli_hook_configuration(self):
        """Test POST CLI hook configuration update endpoint"""
        url = reverse('cli-hooks-update-configuration')
        
        new_config = {
            'enabled': True,
            'timeout_seconds': 60,
            'stop_on_failure': False,
            'custom_commands': {
                'theme_application': ['python --version']
            }
        }
        
        data = {'configuration': new_config}
        
        response = self.client.post(url, data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('message', response.data)
        self.assertIn('configuration', response.data)
        
        # Verify configuration was updated
        updated_config = response.data['configuration']
        self.assertTrue(updated_config['enabled'])
        self.assertEqual(updated_config['timeout_seconds'], 60)
    
    def test_validate_cli_command(self):
        """Test CLI command validation endpoint"""
        url = reverse('cli-hooks-validate-command')
        
        # Test valid command
        data = {'command': 'python --version'}
        response = self.client.post(url, data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['is_valid'])
        self.assertIsNone(response.data['error_message'])
        
        # Test invalid command
        data = {'command': 'rm -rf /'}
        response = self.client.post(url, data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(response.data['is_valid'])
        self.assertIsNotNone(response.data['error_message'])
    
    @patch('subprocess.run')
    def test_execute_cli_command(self, mock_run):
        """Test CLI command execution endpoint"""
        # Mock successful execution
        mock_result = MagicMock()
        mock_result.returncode = 0
        mock_result.stdout = "Command executed successfully"
        mock_result.stderr = ""
        mock_run.return_value = mock_result
        
        url = reverse('cli-hooks-execute-command')
        data = {'command': 'python --version'}
        
        response = self.client.post(url, data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['success'])
        self.assertEqual(response.data['return_code'], 0)
        self.assertIn('execution_time', response.data)
    
    @patch('subprocess.run')
    def test_execute_hook_sequence(self, mock_run):
        """Test hook sequence execution endpoint"""
        # Mock successful execution
        mock_result = MagicMock()
        mock_result.returncode = 0
        mock_result.stdout = "Success"
        mock_result.stderr = ""
        mock_run.return_value = mock_result
        
        url = reverse('cli-hooks-execute-hook-sequence')
        data = {
            'commands': ['python --version', 'git --version'],
            'stop_on_failure': True
        }
        
        response = self.client.post(url, data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['success'])
        self.assertEqual(response.data['total_commands'], 2)
        self.assertEqual(response.data['successful_commands'], 2)
    
    def test_generate_theme_commands(self):
        """Test theme command generation endpoint"""
        url = reverse('cli-hooks-generate-theme-commands')
        
        theme_data = {
            'theme_name': 'API Test Theme',
            'colors': ['#FF0000', '#00FF00', '#0000FF'],
            'palette': 'api_test'
        }
        
        data = {'theme_data': theme_data}
        
        response = self.client.post(url, data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('generated_commands', response.data)
        self.assertIn('command_count', response.data)
        self.assertIsInstance(response.data['generated_commands'], list)
    
    def test_get_execution_history(self):
        """Test execution history endpoint"""
        url = reverse('cli-hooks-execution-history')
        
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('execution_history', response.data)
        self.assertIn('total_entries', response.data)
        self.assertIsInstance(response.data['execution_history'], list)
    
    @patch('subprocess.run')
    def test_test_configuration(self, mock_run):
        """Test configuration testing endpoint"""
        # Mock successful execution
        mock_result = MagicMock()
        mock_result.returncode = 0
        mock_result.stdout = "Test successful"
        mock_result.stderr = ""
        mock_run.return_value = mock_result
        
        url = reverse('cli-hooks-test-configuration')
        
        response = self.client.post(url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('overall_success', response.data)
        self.assertIn('test_results', response.data)
        self.assertIsInstance(response.data['test_results'], list)