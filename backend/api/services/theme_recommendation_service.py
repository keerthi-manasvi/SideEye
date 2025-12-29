"""
Theme recommendation service for emotion-based theme suggestions
"""
import logging
from typing import List, Dict, Optional, Tuple
from datetime import datetime, timedelta
from django.utils import timezone
from django.db.models import Q, Avg, Count
import random

from ..models import UserPreferences, UserFeedback, EmotionReading
from .cli_hook_service import cli_hook_service

logger = logging.getLogger(__name__)


class ThemeRecommendationService:
    """
    Service for generating emotion-based theme recommendations
    """
    
    def __init__(self):
        self.default_themes = {
            'happy': {
                'name': 'Bright Sunshine',
                'colors': ['#FFD700', '#FFA500', '#FF6347'],
                'palette': 'warm_bright',
                'energy_range': [0.6, 1.0]
            },
            'sad': {
                'name': 'Gentle Blues',
                'colors': ['#4682B4', '#5F9EA0', '#708090'],
                'palette': 'cool_muted',
                'energy_range': [0.0, 0.4]
            },
            'angry': {
                'name': 'Intense Reds',
                'colors': ['#DC143C', '#B22222', '#8B0000'],
                'palette': 'warm_intense',
                'energy_range': [0.7, 1.0]
            },
            'calm': {
                'name': 'Peaceful Greens',
                'colors': ['#228B22', '#32CD32', '#90EE90'],
                'palette': 'cool_soft',
                'energy_range': [0.2, 0.6]
            },
            'focused': {
                'name': 'Deep Focus',
                'colors': ['#2F4F4F', '#696969', '#778899'],
                'palette': 'neutral_dark',
                'energy_range': [0.4, 0.8]
            },
            'neutral': {
                'name': 'Balanced Grays',
                'colors': ['#808080', '#A9A9A9', '#C0C0C0'],
                'palette': 'neutral_balanced',
                'energy_range': [0.3, 0.7]
            }
        }
    
    def get_recommendations(self, emotions: Dict[str, float], energy_level: float,
                          user_preferences: Optional[UserPreferences] = None,
                          max_recommendations: int = 3) -> List[Dict]:
        """
        Get theme recommendations based on emotions and energy level
        
        Args:
            emotions: Dictionary of emotion probabilities
            energy_level: Current energy level (0.0-1.0)
            user_preferences: User's theme preferences
            max_recommendations: Maximum number of recommendations
            
        Returns:
            List of theme recommendation dictionaries
        """
        logger.info(f"Generating theme recommendations for emotions: {emotions}, energy: {energy_level}")
        
        # Get dominant emotion
        dominant_emotion = max(emotions.items(), key=lambda x: x[1]) if emotions else ('neutral', 0.5)
        primary_emotion, emotion_strength = dominant_emotion
        
        # Get theme candidates
        theme_candidates = self._get_theme_candidates(
            primary_emotion, energy_level, user_preferences, emotions
        )
        
        # Score and rank themes
        scored_themes = self._score_themes(
            theme_candidates, emotions, energy_level, user_preferences
        )
        
        # Select top recommendations
        recommendations = []
        for theme_data, score in scored_themes[:max_recommendations]:
            recommendation = self._create_theme_recommendation(
                theme_data, emotions, energy_level, score
            )
            recommendations.append(recommendation)
        
        logger.info(f"Generated {len(recommendations)} theme recommendations")
        return recommendations
    
    def _get_theme_candidates(self, emotion: str, energy_level: float,
                            user_preferences: Optional[UserPreferences],
                            emotions: Dict[str, float]) -> List[Dict]:
        """Get candidate themes based on emotion and preferences"""
        
        candidates = []
        
        # Start with default theme for primary emotion
        if emotion in self.default_themes:
            base_theme = self.default_themes[emotion].copy()
            candidates.append(base_theme)
        
        # Add variations based on energy level
        energy_variations = self._generate_energy_variations(emotion, energy_level)
        candidates.extend(energy_variations)
        
        # Add user preference-based themes
        if user_preferences:
            preference_themes = self._generate_preference_themes(
                user_preferences, emotion, energy_level
            )
            candidates.extend(preference_themes)
        
        # Add themes for secondary emotions
        for secondary_emotion, probability in emotions.items():
            if secondary_emotion != emotion and probability > 0.2:
                if secondary_emotion in self.default_themes:
                    secondary_theme = self.default_themes[secondary_emotion].copy()
                    secondary_theme['name'] = f"Mixed {secondary_theme['name']}"
                    secondary_theme['secondary_emotion'] = secondary_emotion
                    candidates.append(secondary_theme)
        
        return candidates
    
    def _generate_energy_variations(self, emotion: str, energy_level: float) -> List[Dict]:
        """Generate theme variations based on energy level"""
        
        variations = []
        
        if emotion not in self.default_themes:
            return variations
        
        base_theme = self.default_themes[emotion]
        
        # High energy variation
        if energy_level > 0.7:
            high_energy_theme = {
                'name': f"Energized {base_theme['name']}",
                'colors': self._brighten_colors(base_theme['colors']),
                'palette': f"bright_{base_theme['palette']}",
                'energy_range': [0.7, 1.0],
                'variation': 'high_energy'
            }
            variations.append(high_energy_theme)
        
        # Low energy variation
        if energy_level < 0.3:
            low_energy_theme = {
                'name': f"Soft {base_theme['name']}",
                'colors': self._soften_colors(base_theme['colors']),
                'palette': f"muted_{base_theme['palette']}",
                'energy_range': [0.0, 0.3],
                'variation': 'low_energy'
            }
            variations.append(low_energy_theme)
        
        return variations
    
    def _generate_preference_themes(self, user_preferences: UserPreferences,
                                  emotion: str, energy_level: float) -> List[Dict]:
        """Generate themes based on user preferences"""
        
        preference_themes = []
        
        # Use preferred color palettes
        for palette in user_preferences.preferred_color_palettes:
            theme = {
                'name': f"Your {palette.title()} Theme",
                'colors': self._get_colors_for_palette(palette),
                'palette': palette,
                'energy_range': [max(0.0, energy_level - 0.2), min(1.0, energy_level + 0.2)],
                'user_preference': True
            }
            preference_themes.append(theme)
        
        # Use emotion-theme mappings
        if emotion in user_preferences.theme_emotion_mappings:
            emotion_prefs = user_preferences.theme_emotion_mappings[emotion]
            if isinstance(emotion_prefs, dict):
                theme = {
                    'name': f"Your {emotion.title()} Theme",
                    'colors': emotion_prefs.get('colors', self.default_themes.get(emotion, {}).get('colors', [])),
                    'palette': emotion_prefs.get('palette', 'custom'),
                    'energy_range': [0.0, 1.0],
                    'learned_preference': True
                }
                preference_themes.append(theme)
        
        return preference_themes
    
    def _score_themes(self, themes: List[Dict], emotions: Dict[str, float],
                     energy_level: float, user_preferences: Optional[UserPreferences]) -> List[Tuple[Dict, float]]:
        """Score themes based on multiple factors"""
        
        scored_themes = []
        
        for theme in themes:
            score = 0.0
            
            # Energy level match (30% weight)
            energy_range = theme.get('energy_range', [0.0, 1.0])
            if energy_range[0] <= energy_level <= energy_range[1]:
                energy_score = 1.0
            else:
                # Calculate distance from range
                if energy_level < energy_range[0]:
                    distance = energy_range[0] - energy_level
                else:
                    distance = energy_level - energy_range[1]
                energy_score = max(0.0, 1.0 - distance)
            
            score += energy_score * 0.3
            
            # User preference bonus (40% weight)
            preference_score = 0.5  # Default
            if theme.get('user_preference'):
                preference_score = 1.0
            elif theme.get('learned_preference'):
                preference_score = 0.9
            elif user_preferences and theme.get('palette') in user_preferences.preferred_color_palettes:
                preference_score = 0.8
            
            score += preference_score * 0.4
            
            # Emotion appropriateness (20% weight)
            emotion_score = self._calculate_emotion_appropriateness(theme, emotions)
            score += emotion_score * 0.2
            
            # Novelty factor (10% weight) - prefer themes not recently used
            novelty_score = self._calculate_novelty_score(theme)
            score += novelty_score * 0.1
            
            scored_themes.append((theme, score))
        
        # Sort by score (descending)
        scored_themes.sort(key=lambda x: x[1], reverse=True)
        
        return scored_themes
    
    def _calculate_emotion_appropriateness(self, theme: Dict, emotions: Dict[str, float]) -> float:
        """Calculate how appropriate a theme is for given emotions"""
        
        # Simple mapping of theme characteristics to emotions
        theme_emotion_mapping = {
            'bright': ['happy', 'excited'],
            'dark': ['sad', 'focused', 'angry'],
            'warm': ['happy', 'angry', 'excited'],
            'cool': ['sad', 'calm', 'focused'],
            'muted': ['sad', 'calm', 'neutral'],
            'intense': ['angry', 'excited']
        }
        
        palette = theme.get('palette', '')
        theme_emotions = []
        
        for characteristic, associated_emotions in theme_emotion_mapping.items():
            if characteristic in palette:
                theme_emotions.extend(associated_emotions)
        
        # Calculate overlap with current emotions
        total_overlap = 0.0
        for emotion, probability in emotions.items():
            if emotion in theme_emotions:
                total_overlap += probability
        
        return min(1.0, total_overlap)
    
    def _calculate_novelty_score(self, theme: Dict) -> float:
        """Calculate novelty score based on recent usage"""
        
        # Check recent theme feedback
        recent_cutoff = timezone.now() - timedelta(hours=4)
        recent_feedback = UserFeedback.objects.filter(
            suggestion_type='theme',
            timestamp__gte=recent_cutoff
        )
        
        theme_name = theme.get('name', '')
        recent_usage_count = 0
        
        for feedback in recent_feedback:
            suggestion_data = feedback.suggestion_data or {}
            if suggestion_data.get('theme_name') == theme_name:
                recent_usage_count += 1
        
        # Higher novelty for less recently used themes
        if recent_usage_count == 0:
            return 1.0
        else:
            return max(0.1, 1.0 - (recent_usage_count * 0.3))
    
    def _create_theme_recommendation(self, theme_data: Dict, emotions: Dict[str, float],
                                   energy_level: float, confidence_score: float) -> Dict:
        """Create a theme recommendation record"""
        
        # Generate CLI commands for theme application
        cli_commands = self._generate_cli_commands(theme_data)
        
        # Generate recommendation reason
        reason = self._generate_recommendation_reason(theme_data, emotions, energy_level)
        
        recommendation = {
            'theme_name': theme_data['name'],
            'colors': theme_data['colors'],
            'palette': theme_data.get('palette', 'custom'),
            'cli_commands': cli_commands,
            'confidence_score': confidence_score,
            'reason': reason,
            'energy_level': energy_level,
            'emotion_context': emotions,
            'timestamp': timezone.now().isoformat()
        }
        
        return recommendation
    
    def _generate_cli_commands(self, theme_data: Dict) -> List[str]:
        """Generate CLI commands to apply the theme using CLI hook service"""
        
        # Use CLI hook service to generate theme commands
        return cli_hook_service.generate_theme_commands(theme_data)
    
    def _generate_recommendation_reason(self, theme_data: Dict, emotions: Dict[str, float],
                                      energy_level: float) -> str:
        """Generate human-readable recommendation reason"""
        
        reasons = []
        
        # Energy-based reason
        if energy_level > 0.7:
            reasons.append("energizing colors to match your high energy")
        elif energy_level < 0.3:
            reasons.append("calming colors to support your low energy state")
        else:
            reasons.append("balanced colors for your current energy level")
        
        # Emotion-based reason
        dominant_emotion = max(emotions.items(), key=lambda x: x[1])[0]
        emotion_reasons = {
            'happy': "bright tones to enhance your positive mood",
            'sad': "gentle colors to provide comfort",
            'angry': "intense colors to channel your energy",
            'calm': "peaceful tones to maintain your tranquility",
            'focused': "minimal colors to support concentration",
            'neutral': "balanced colors for your steady state"
        }
        
        if dominant_emotion in emotion_reasons:
            reasons.append(emotion_reasons[dominant_emotion])
        
        # User preference reason
        if theme_data.get('user_preference'):
            reasons.append("matches your preferred color palette")
        elif theme_data.get('learned_preference'):
            reasons.append("based on your previous theme choices")
        
        # Combine reasons
        if len(reasons) > 1:
            return f"This theme offers {reasons[0]} and {', '.join(reasons[1:])}"
        elif reasons:
            return f"This theme provides {reasons[0]}"
        else:
            return "This theme might suit your current state"
    
    def record_user_feedback(self, theme_recommendation: Dict, response: str,
                           alternative_choice: Optional[Dict] = None):
        """Record user feedback on a theme recommendation"""
        
        try:
            # Create user feedback record
            feedback = UserFeedback.objects.create(
                suggestion_type='theme',
                emotion_context=theme_recommendation['emotion_context'],
                suggestion_data={
                    'theme_name': theme_recommendation['theme_name'],
                    'colors': theme_recommendation['colors'],
                    'palette': theme_recommendation['palette'],
                    'confidence_score': theme_recommendation['confidence_score']
                },
                user_response=response,
                alternative_preference=alternative_choice
            )
            
            # Learn from feedback
            self._learn_from_feedback(theme_recommendation, response, alternative_choice)
            
            logger.info(f"Recorded theme feedback: {response} for {theme_recommendation['theme_name']}")
            
        except Exception as e:
            logger.error(f"Error recording theme feedback: {e}")
    
    def _learn_from_feedback(self, theme_recommendation: Dict, response: str,
                           alternative_choice: Optional[Dict]):
        """Learn from user feedback to improve future recommendations"""
        
        try:
            preferences, created = UserPreferences.objects.get_or_create()
            
            emotion_context = theme_recommendation['emotion_context']
            dominant_emotion = max(emotion_context.items(), key=lambda x: x[1])[0]
            
            if response == 'accepted':
                self._reinforce_successful_theme(theme_recommendation, preferences, dominant_emotion)
            elif response == 'rejected' and alternative_choice:
                self._learn_from_alternative_theme(alternative_choice, preferences, dominant_emotion)
            
            preferences.save()
            
        except Exception as e:
            logger.error(f"Error learning from theme feedback: {e}")
    
    def _reinforce_successful_theme(self, theme_recommendation: Dict,
                                  preferences: UserPreferences, emotion: str):
        """Reinforce successful theme patterns"""
        
        # Add palette to preferred palettes
        palette = theme_recommendation['palette']
        if palette not in preferences.preferred_color_palettes:
            preferences.preferred_color_palettes.append(palette)
        
        # Update emotion-theme mappings
        if emotion not in preferences.theme_emotion_mappings:
            preferences.theme_emotion_mappings[emotion] = {}
        
        preferences.theme_emotion_mappings[emotion] = {
            'colors': theme_recommendation['colors'],
            'palette': palette,
            'success_count': preferences.theme_emotion_mappings.get(emotion, {}).get('success_count', 0) + 1
        }
    
    def _learn_from_alternative_theme(self, alternative_choice: Dict,
                                    preferences: UserPreferences, emotion: str):
        """Learn from user's alternative theme choice"""
        
        # Extract preferences from alternative choice
        if 'palette' in alternative_choice:
            palette = alternative_choice['palette']
            if palette not in preferences.preferred_color_palettes:
                preferences.preferred_color_palettes.append(palette)
        
        if 'colors' in alternative_choice:
            if emotion not in preferences.theme_emotion_mappings:
                preferences.theme_emotion_mappings[emotion] = {}
            
            preferences.theme_emotion_mappings[emotion] = {
                'colors': alternative_choice['colors'],
                'palette': alternative_choice.get('palette', 'custom'),
                'user_defined': True
            }
    
    def _brighten_colors(self, colors: List[str]) -> List[str]:
        """Brighten a list of hex colors"""
        
        brightened = []
        for color in colors:
            # Simple brightening by increasing RGB values
            if color.startswith('#') and len(color) == 7:
                try:
                    r = int(color[1:3], 16)
                    g = int(color[3:5], 16)
                    b = int(color[5:7], 16)
                    
                    # Increase brightness by 20%
                    r = min(255, int(r * 1.2))
                    g = min(255, int(g * 1.2))
                    b = min(255, int(b * 1.2))
                    
                    brightened.append(f'#{r:02x}{g:02x}{b:02x}')
                except ValueError:
                    brightened.append(color)
            else:
                brightened.append(color)
        
        return brightened
    
    def _soften_colors(self, colors: List[str]) -> List[str]:
        """Soften a list of hex colors"""
        
        softened = []
        for color in colors:
            # Simple softening by decreasing saturation
            if color.startswith('#') and len(color) == 7:
                try:
                    r = int(color[1:3], 16)
                    g = int(color[3:5], 16)
                    b = int(color[5:7], 16)
                    
                    # Decrease saturation by moving towards gray
                    gray = (r + g + b) // 3
                    r = int(r * 0.7 + gray * 0.3)
                    g = int(g * 0.7 + gray * 0.3)
                    b = int(b * 0.7 + gray * 0.3)
                    
                    softened.append(f'#{r:02x}{g:02x}{b:02x}')
                except ValueError:
                    softened.append(color)
            else:
                softened.append(color)
        
        return softened
    
    def _get_colors_for_palette(self, palette: str) -> List[str]:
        """Get colors for a named palette"""
        
        palette_colors = {
            'warm_bright': ['#FF6B6B', '#FFE66D', '#FF8E53'],
            'cool_muted': ['#6C7B7F', '#9CAFB7', '#B8D4DA'],
            'neutral_dark': ['#2C3E50', '#34495E', '#5D6D7E'],
            'vibrant': ['#E74C3C', '#3498DB', '#2ECC71'],
            'pastel': ['#FFB3BA', '#BAFFC9', '#BAE1FF'],
            'monochrome': ['#2C2C2C', '#5A5A5A', '#8A8A8A']
        }
        
        return palette_colors.get(palette, ['#808080', '#A0A0A0', '#C0C0C0'])
    
    def apply_theme(self, theme_recommendation):
        """Apply a theme using CLI hooks with fallback mechanisms"""
        logger.info(f"Applying theme: {theme_recommendation['theme_name']}")
        result = cli_hook_service.apply_theme_with_fallback(theme_recommendation)
        return result
    
    def get_theme_learning_effectiveness(self) -> Dict:
        """
        Calculate how well the theme learning system is performing
        
        Returns:
            Dictionary with learning effectiveness metrics
        """
        try:
            # Get recent feedback (last 7 days)
            recent_cutoff = timezone.now() - timedelta(days=7)
            older_cutoff = timezone.now() - timedelta(days=14)
            
            recent_feedback = UserFeedback.objects.filter(
                suggestion_type='theme',
                timestamp__gte=recent_cutoff
            )
            older_feedback = UserFeedback.objects.filter(
                suggestion_type='theme',
                timestamp__gte=older_cutoff,
                timestamp__lt=recent_cutoff
            )
            
            recent_acceptance = recent_feedback.filter(user_response='accepted').count()
            recent_total = recent_feedback.count()
            
            older_acceptance = older_feedback.filter(user_response='accepted').count()
            older_total = older_feedback.count()
            
            recent_rate = (recent_acceptance / recent_total * 100) if recent_total > 0 else 0
            older_rate = (older_acceptance / older_total * 100) if older_total > 0 else 0
            
            improvement = recent_rate - older_rate
            
            # Get feedback distribution
            feedback_distribution = {}
            all_feedback = UserFeedback.objects.filter(suggestion_type='theme')
            
            for response_type in ['accepted', 'rejected', 'modified', 'ignored']:
                count = all_feedback.filter(user_response=response_type).count()
                feedback_distribution[response_type] = count
            
            return {
                'recent_acceptance_rate': round(recent_rate, 1),
                'previous_acceptance_rate': round(older_rate, 1),
                'improvement': round(improvement, 1),
                'total_feedback_entries': sum(feedback_distribution.values()),
                'feedback_distribution': feedback_distribution,
                'learning_active': True
            }
            
        except Exception as e:
            logger.error(f"Error calculating theme learning effectiveness: {e}")
            return {'learning_active': False, 'error': str(e)}


# Global instance
theme_recommendation_service = ThemeRecommendationService()