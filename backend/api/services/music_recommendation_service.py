"""
Music recommendation service for emotion-based playlist suggestions
"""
import logging
from typing import List, Dict, Optional, Tuple
from datetime import datetime, timedelta
from django.utils import timezone
from django.db.models import Q, Avg, Count
from django.core.cache import cache
import random

from ..models import (
    YouTubePlaylist, MusicGenre, MusicRecommendation, 
    UserPreferences, UserFeedback, EmotionReading
)
from .youtube_service import youtube_service

logger = logging.getLogger(__name__)


class MusicRecommendationService:
    """
    Service for generating emotion-based music recommendations
    """
    
    def __init__(self):
        self.youtube_service = youtube_service
        self.default_genres = [
            'pop', 'rock', 'electronic', 'classical', 'jazz', 'hip-hop',
            'indie', 'folk', 'ambient', 'instrumental'
        ]
    
    def get_recommendations(self, emotions: Dict[str, float], energy_level: float, 
                          user_preferences: Optional[UserPreferences] = None,
                          max_recommendations: int = 5) -> List[Dict]:
        """
        Get music recommendations based on emotions and energy level
        
        Args:
            emotions: Dictionary of emotion probabilities
            energy_level: Current energy level (0.0-1.0)
            user_preferences: User's music preferences
            max_recommendations: Maximum number of recommendations
            
        Returns:
            List of recommendation dictionaries
        """
        logger.info(f"Generating music recommendations for emotions: {emotions}, energy: {energy_level}")
        
        # Get dominant emotion
        dominant_emotion = max(emotions.items(), key=lambda x: x[1]) if emotions else ('neutral', 0.5)
        primary_emotion, emotion_strength = dominant_emotion
        
        # Get existing playlists that match the criteria
        matching_playlists = self._find_matching_playlists(
            primary_emotion, energy_level, user_preferences
        )
        
        # If we don't have enough cached playlists, discover new ones
        if len(matching_playlists) < max_recommendations:
            self._discover_and_cache_playlists(primary_emotion, energy_level, user_preferences)
            matching_playlists = self._find_matching_playlists(
                primary_emotion, energy_level, user_preferences
            )
        
        # Score and rank playlists
        scored_playlists = self._score_playlists(
            matching_playlists, emotions, energy_level, user_preferences
        )
        
        # Select top recommendations
        recommendations = []
        for playlist, score in scored_playlists[:max_recommendations]:
            recommendation = self._create_recommendation_record(
                playlist, emotions, energy_level, score
            )
            recommendations.append({
                'playlist_id': playlist.youtube_id,
                'title': playlist.title,
                'description': playlist.description,
                'channel_title': playlist.channel_title,
                'energy_level': playlist.energy_level,
                'emotional_tags': playlist.emotional_tags,
                'confidence_score': score,
                'recommendation_id': recommendation.id,
                'reason': recommendation.recommendation_reason
            })
        
        logger.info(f"Generated {len(recommendations)} music recommendations")
        return recommendations
    
    def _find_matching_playlists(self, emotion: str, energy_level: float, 
                                user_preferences: Optional[UserPreferences]) -> List[YouTubePlaylist]:
        """Find playlists that match the given criteria"""
        
        # Base query for active playlists
        query = Q(is_active=True)
        
        # Filter by emotional tags
        emotion_variants = self._get_emotion_variants(emotion)
        for variant in emotion_variants:
            query |= Q(emotional_tags__icontains=variant)
        
        # Filter by energy level (within reasonable range)
        energy_tolerance = 0.3
        query &= Q(
            energy_level__gte=max(0.0, energy_level - energy_tolerance),
            energy_level__lte=min(1.0, energy_level + energy_tolerance)
        )
        
        playlists = YouTubePlaylist.objects.filter(query)
        
        # Filter by user's preferred genres if available
        if user_preferences and user_preferences.preferred_genres:
            genre_filter = Q()
            for genre_name in user_preferences.preferred_genres:
                try:
                    genre = MusicGenre.objects.get(name__iexact=genre_name)
                    genre_filter |= Q(genres=genre)
                except MusicGenre.DoesNotExist:
                    continue
            
            if genre_filter:
                preferred_playlists = playlists.filter(genre_filter).distinct()
                other_playlists = playlists.exclude(genre_filter).distinct()
                
                # Combine with preference for user's genres
                playlists = list(preferred_playlists) + list(other_playlists)
            else:
                playlists = list(playlists)
        else:
            playlists = list(playlists)
        
        return playlists
    
    def _discover_and_cache_playlists(self, emotion: str, energy_level: float,
                                    user_preferences: Optional[UserPreferences]):
        """Discover new playlists and cache them"""
        
        if not self.youtube_service.is_available():
            logger.warning("YouTube service not available for playlist discovery")
            return
        
        # Discover playlists by emotion
        discovered_playlists = self.youtube_service.discover_playlists_by_emotion(
            emotion, energy_level, max_results=10
        )
        
        # Also discover by user's preferred genres
        if user_preferences and user_preferences.preferred_genres:
            for genre in user_preferences.preferred_genres[:3]:  # Limit to top 3 genres
                genre_playlists = self.youtube_service.discover_playlists_by_genre(
                    genre, max_results=5
                )
                discovered_playlists.extend(genre_playlists)
        
        # Cache discovered playlists
        for playlist_data in discovered_playlists:
            self._cache_playlist(playlist_data, emotion, energy_level)
    
    def _cache_playlist(self, playlist_data: Dict, emotion: str, energy_level: float):
        """Cache a discovered playlist in the database"""
        
        try:
            # Check if playlist already exists
            existing_playlist = YouTubePlaylist.objects.filter(
                youtube_id=playlist_data['youtube_id']
            ).first()
            
            if existing_playlist:
                # Update existing playlist
                existing_playlist.title = playlist_data['title']
                existing_playlist.description = playlist_data['description']
                existing_playlist.channel_title = playlist_data['channel_title']
                existing_playlist.last_updated = timezone.now()
                existing_playlist.save()
                return existing_playlist
            
            # Create new playlist
            playlist = YouTubePlaylist.objects.create(
                youtube_id=playlist_data['youtube_id'],
                title=playlist_data['title'],
                description=playlist_data['description'],
                channel_title=playlist_data['channel_title'],
                energy_level=energy_level,
                emotional_tags=[emotion],
                last_updated=timezone.now()
            )
            
            # Try to categorize by genre based on title/description
            self._categorize_playlist_by_genre(playlist)
            
            logger.info(f"Cached new playlist: {playlist.title}")
            return playlist
            
        except Exception as e:
            logger.error(f"Error caching playlist {playlist_data.get('youtube_id')}: {e}")
            return None
    
    def _categorize_playlist_by_genre(self, playlist: YouTubePlaylist):
        """Automatically categorize playlist by genre based on title/description"""
        
        text_to_analyze = f"{playlist.title} {playlist.description}".lower()
        
        # Get all genres and check for matches
        genres = MusicGenre.objects.all()
        matched_genres = []
        
        for genre in genres:
            if genre.name.lower() in text_to_analyze:
                matched_genres.append(genre)
        
        # Add matched genres
        if matched_genres:
            playlist.genres.set(matched_genres)
            playlist.save()
    
    def _score_playlists(self, playlists: List[YouTubePlaylist], emotions: Dict[str, float],
                        energy_level: float, user_preferences: Optional[UserPreferences]) -> List[Tuple[YouTubePlaylist, float]]:
        """Score playlists based on multiple factors"""
        
        scored_playlists = []
        
        for playlist in playlists:
            score = 0.0
            
            # Emotion match score (40% weight)
            emotion_score = playlist.get_emotion_match_score(emotions)
            score += emotion_score * 0.4
            
            # Energy level match score (30% weight)
            energy_diff = abs(playlist.energy_level - energy_level)
            energy_score = max(0.0, 1.0 - energy_diff)
            score += energy_score * 0.3
            
            # User acceptance rate (20% weight)
            acceptance_score = playlist.acceptance_rate
            score += acceptance_score * 0.2
            
            # User rating (10% weight)
            rating_score = (playlist.user_rating or 2.5) / 5.0 if playlist.user_rating else 0.5
            score += rating_score * 0.1
            
            # Bonus for user's preferred genres
            if user_preferences and user_preferences.preferred_genres:
                playlist_genres = [g.name for g in playlist.genres.all()]
                genre_overlap = len(set(playlist_genres) & set(user_preferences.preferred_genres))
                if genre_overlap > 0:
                    score += 0.1 * genre_overlap  # Bonus for each matching genre
            
            # Penalty for recently recommended playlists (avoid repetition)
            recent_recommendations = MusicRecommendation.objects.filter(
                recommended_playlist=playlist,
                timestamp__gte=timezone.now() - timedelta(hours=2)
            ).count()
            
            if recent_recommendations > 0:
                score *= (0.8 ** recent_recommendations)  # Exponential penalty
            
            scored_playlists.append((playlist, score))
        
        # Sort by score (descending)
        scored_playlists.sort(key=lambda x: x[1], reverse=True)
        
        return scored_playlists
    
    def _create_recommendation_record(self, playlist: YouTubePlaylist, emotions: Dict[str, float],
                                   energy_level: float, confidence_score: float) -> MusicRecommendation:
        """Create a recommendation record for tracking"""
        
        # Generate recommendation reason
        dominant_emotion = max(emotions.items(), key=lambda x: x[1]) if emotions else ('neutral', 0.5)
        reason = self._generate_recommendation_reason(
            playlist, dominant_emotion[0], energy_level, confidence_score
        )
        
        recommendation = MusicRecommendation.objects.create(
            emotion_context=emotions,
            energy_level=energy_level,
            recommended_playlist=playlist,
            recommendation_reason=reason,
            confidence_score=confidence_score
        )
        
        return recommendation
    
    def _generate_recommendation_reason(self, playlist: YouTubePlaylist, emotion: str,
                                     energy_level: float, confidence_score: float) -> str:
        """Generate human-readable recommendation reason"""
        
        reasons = []
        
        # Emotion-based reason
        if emotion in playlist.emotional_tags:
            reasons.append(f"matches your {emotion} mood")
        
        # Energy-based reason
        if energy_level > 0.7:
            if playlist.energy_level > 0.6:
                reasons.append("provides high energy music")
            else:
                reasons.append("offers a calming contrast to your high energy")
        elif energy_level < 0.3:
            if playlist.energy_level < 0.4:
                reasons.append("matches your low energy state")
            else:
                reasons.append("might help boost your energy")
        else:
            reasons.append("fits your current energy level")
        
        # Acceptance rate reason
        if playlist.acceptance_rate > 0.7:
            reasons.append("has been well-received by you before")
        
        # Combine reasons
        if len(reasons) > 1:
            return f"This playlist {reasons[0]} and {', '.join(reasons[1:])}"
        elif reasons:
            return f"This playlist {reasons[0]}"
        else:
            return "This playlist might suit your current state"
    
    def _get_emotion_variants(self, emotion: str) -> List[str]:
        """Get variants and synonyms for an emotion"""
        
        emotion_variants = {
            'happy': ['happy', 'joy', 'cheerful', 'upbeat', 'positive', 'excited'],
            'sad': ['sad', 'melancholy', 'depressed', 'down', 'blue', 'emotional'],
            'angry': ['angry', 'mad', 'frustrated', 'aggressive', 'intense', 'furious'],
            'calm': ['calm', 'peaceful', 'relaxed', 'serene', 'tranquil', 'chill'],
            'excited': ['excited', 'energetic', 'pumped', 'enthusiastic', 'hyper'],
            'focused': ['focused', 'concentrated', 'study', 'work', 'productive'],
            'nostalgic': ['nostalgic', 'memories', 'throwback', 'classic', 'retro'],
            'neutral': ['neutral', 'balanced', 'moderate', 'steady']
        }
        
        return emotion_variants.get(emotion, [emotion])
    
    def record_user_feedback(self, recommendation_id: int, response: str, 
                           alternative_choice: Optional[Dict] = None):
        """Record user feedback on a recommendation"""
        
        try:
            recommendation = MusicRecommendation.objects.get(id=recommendation_id)
            recommendation.user_response = response
            recommendation.response_timestamp = timezone.now()
            recommendation.alternative_choice = alternative_choice
            recommendation.save()
            
            # Update playlist acceptance rate
            playlist = recommendation.recommended_playlist
            accepted = response == 'accepted'
            playlist.update_acceptance_rate(accepted)
            
            # Learn from feedback
            self._learn_from_feedback(recommendation, response, alternative_choice)
            
            logger.info(f"Recorded feedback for recommendation {recommendation_id}: {response}")
            
        except MusicRecommendation.DoesNotExist:
            logger.error(f"Recommendation {recommendation_id} not found")
        except Exception as e:
            logger.error(f"Error recording feedback: {e}")
    
    def _learn_from_feedback(self, recommendation: MusicRecommendation, response: str,
                           alternative_choice: Optional[Dict]):
        """Learn from user feedback to improve future recommendations"""
        
        # Create user feedback record
        feedback = UserFeedback.objects.create(
            suggestion_type='music',
            emotion_context=recommendation.emotion_context,
            suggestion_data={
                'playlist_id': recommendation.recommended_playlist.youtube_id,
                'playlist_title': recommendation.recommended_playlist.title,
                'energy_level': recommendation.recommended_playlist.energy_level,
                'emotional_tags': recommendation.recommended_playlist.emotional_tags,
                'confidence_score': recommendation.confidence_score
            },
            user_response=response,
            alternative_preference=alternative_choice
        )
        
        # Learn from all types of feedback
        self._update_learning_models(recommendation, response, alternative_choice)
        
        # Update user preferences based on feedback
        if response == 'rejected' and alternative_choice:
            self._update_preferences_from_alternative(
                recommendation.emotion_context, alternative_choice
            )
        elif response == 'accepted':
            self._reinforce_successful_recommendation(recommendation)
        
        # Update recommendation patterns
        self._update_recommendation_patterns(recommendation, response)
    
    def _update_preferences_from_alternative(self, emotion_context: Dict, alternative_choice: Dict):
        """Update user preferences based on alternative choice"""
        
        try:
            # Get or create user preferences
            preferences, created = UserPreferences.objects.get_or_create()
            
            # Extract genre information from alternative choice
            if 'genre' in alternative_choice:
                genre = alternative_choice['genre']
                if genre not in preferences.preferred_genres:
                    preferences.preferred_genres.append(genre)
            
            # Update music-energy mappings
            dominant_emotion = max(emotion_context.items(), key=lambda x: x[1])[0]
            energy_level = alternative_choice.get('energy_level', 0.5)
            
            if dominant_emotion not in preferences.music_energy_mappings:
                preferences.music_energy_mappings[dominant_emotion] = []
            
            preferences.music_energy_mappings[dominant_emotion].append(energy_level)
            
            # Keep only recent mappings (last 10)
            if len(preferences.music_energy_mappings[dominant_emotion]) > 10:
                preferences.music_energy_mappings[dominant_emotion] = \
                    preferences.music_energy_mappings[dominant_emotion][-10:]
            
            preferences.save()
            
        except Exception as e:
            logger.error(f"Error updating preferences from alternative: {e}")
    
    def get_user_music_stats(self) -> Dict:
        """Get statistics about user's music preferences and feedback"""
        
        try:
            # Get recommendation statistics
            total_recommendations = MusicRecommendation.objects.count()
            accepted_recommendations = MusicRecommendation.objects.filter(
                user_response='accepted'
            ).count()
            
            acceptance_rate = (accepted_recommendations / total_recommendations * 100) if total_recommendations > 0 else 0
            
            # Get most recommended genres
            genre_stats = {}
            recommendations = MusicRecommendation.objects.select_related('recommended_playlist')
            
            for rec in recommendations:
                for genre in rec.recommended_playlist.genres.all():
                    genre_name = genre.name
                    if genre_name not in genre_stats:
                        genre_stats[genre_name] = {'total': 0, 'accepted': 0}
                    
                    genre_stats[genre_name]['total'] += 1
                    if rec.user_response == 'accepted':
                        genre_stats[genre_name]['accepted'] += 1
            
            # Calculate genre acceptance rates
            for genre_name in genre_stats:
                stats = genre_stats[genre_name]
                stats['acceptance_rate'] = (stats['accepted'] / stats['total'] * 100) if stats['total'] > 0 else 0
            
            return {
                'total_recommendations': total_recommendations,
                'acceptance_rate': round(acceptance_rate, 1),
                'genre_statistics': genre_stats,
                'top_genres': sorted(
                    genre_stats.items(),
                    key=lambda x: x[1]['acceptance_rate'],
                    reverse=True
                )[:5]
            }
            
        except Exception as e:
            logger.error(f"Error getting music stats: {e}")
            return {}
    
    def _update_learning_models(self, recommendation: MusicRecommendation, response: str, 
                              alternative_choice: Optional[Dict]):
        """Update learning models based on user feedback"""
        
        try:
            # Update emotion-energy correlation learning
            self._update_emotion_energy_correlation(recommendation, response)
            
            # Update genre preference learning
            self._update_genre_preference_learning(recommendation, response, alternative_choice)
            
            # Update temporal pattern learning
            self._update_temporal_patterns(recommendation, response)
            
        except Exception as e:
            logger.error(f"Error updating learning models: {e}")
    
    def _reinforce_successful_recommendation(self, recommendation: MusicRecommendation):
        """Reinforce patterns from successful recommendations"""
        
        try:
            preferences, created = UserPreferences.objects.get_or_create()
            
            # Get dominant emotion from recommendation
            emotions = recommendation.emotion_context
            dominant_emotion = max(emotions.items(), key=lambda x: x[1])[0]
            
            # Reinforce energy-emotion mapping
            energy_level = recommendation.energy_level
            if dominant_emotion not in preferences.music_energy_mappings:
                preferences.music_energy_mappings[dominant_emotion] = []
            
            preferences.music_energy_mappings[dominant_emotion].append(energy_level)
            
            # Keep only recent successful mappings (last 15)
            if len(preferences.music_energy_mappings[dominant_emotion]) > 15:
                preferences.music_energy_mappings[dominant_emotion] = \
                    preferences.music_energy_mappings[dominant_emotion][-15:]
            
            # Reinforce genre preferences
            playlist_genres = [g.name for g in recommendation.recommended_playlist.genres.all()]
            for genre in playlist_genres:
                if genre not in preferences.preferred_genres:
                    preferences.preferred_genres.append(genre)
            
            preferences.save()
            
        except Exception as e:
            logger.error(f"Error reinforcing successful recommendation: {e}")
    
    def _update_recommendation_patterns(self, recommendation: MusicRecommendation, response: str):
        """Update recommendation patterns based on feedback"""
        
        try:
            # Update playlist-specific patterns
            playlist = recommendation.recommended_playlist
            
            # Adjust energy level based on feedback
            if response == 'accepted':
                # Slightly adjust playlist energy towards user's current energy
                user_energy = recommendation.energy_level
                current_playlist_energy = playlist.energy_level
                
                # Weighted average with more weight on current energy
                new_energy = (current_playlist_energy * 0.8) + (user_energy * 0.2)
                playlist.energy_level = max(0.0, min(1.0, new_energy))
                
            elif response == 'rejected':
                # Slightly move away from user's current energy
                user_energy = recommendation.energy_level
                current_playlist_energy = playlist.energy_level
                
                # Move slightly away from user energy
                if user_energy > current_playlist_energy:
                    new_energy = current_playlist_energy * 0.95
                else:
                    new_energy = min(1.0, current_playlist_energy * 1.05)
                
                playlist.energy_level = max(0.0, min(1.0, new_energy))
            
            playlist.save()
            
        except Exception as e:
            logger.error(f"Error updating recommendation patterns: {e}")
    
    def _update_emotion_energy_correlation(self, recommendation: MusicRecommendation, response: str):
        """Learn emotion-energy correlations from feedback"""
        
        try:
            preferences, created = UserPreferences.objects.get_or_create()
            
            emotions = recommendation.emotion_context
            energy_level = recommendation.energy_level
            
            # Update correlations for each emotion
            for emotion, probability in emotions.items():
                if probability > 0.3:  # Only learn from significant emotions
                    if emotion not in preferences.music_energy_mappings:
                        preferences.music_energy_mappings[emotion] = []
                    
                    if response == 'accepted':
                        # Reinforce this energy level for this emotion
                        preferences.music_energy_mappings[emotion].append(energy_level)
                    elif response == 'rejected':
                        # Learn what energy levels to avoid for this emotion
                        # Store negative examples with a marker
                        negative_energy = f"avoid_{energy_level}"
                        if negative_energy not in preferences.music_energy_mappings[emotion]:
                            preferences.music_energy_mappings[emotion].append(negative_energy)
                    
                    # Keep manageable history size
                    if len(preferences.music_energy_mappings[emotion]) > 20:
                        preferences.music_energy_mappings[emotion] = \
                            preferences.music_energy_mappings[emotion][-20:]
            
            preferences.save()
            
        except Exception as e:
            logger.error(f"Error updating emotion-energy correlation: {e}")
    
    def _update_genre_preference_learning(self, recommendation: MusicRecommendation, response: str,
                                        alternative_choice: Optional[Dict]):
        """Learn genre preferences from feedback"""
        
        try:
            preferences, created = UserPreferences.objects.get_or_create()
            
            playlist_genres = [g.name for g in recommendation.recommended_playlist.genres.all()]
            dominant_emotion = max(recommendation.emotion_context.items(), key=lambda x: x[1])[0]
            
            if response == 'accepted':
                # Reinforce these genres for this emotion
                for genre in playlist_genres:
                    if genre not in preferences.preferred_genres:
                        preferences.preferred_genres.append(genre)
                
            elif response == 'rejected' and alternative_choice:
                # Learn from alternative preference
                alt_genre = alternative_choice.get('genre')
                if alt_genre and alt_genre not in preferences.preferred_genres:
                    preferences.preferred_genres.append(alt_genre)
                
                # Reduce preference for rejected genres (but don't remove completely)
                # This could be implemented as a weighted preference system in the future
            
            preferences.save()
            
        except Exception as e:
            logger.error(f"Error updating genre preference learning: {e}")
    
    def _update_temporal_patterns(self, recommendation: MusicRecommendation, response: str):
        """Learn temporal patterns from feedback"""
        
        try:
            # This could be expanded to learn time-of-day preferences, 
            # day-of-week patterns, etc.
            current_hour = timezone.now().hour
            
            # For now, just log the pattern for future implementation
            logger.info(f"Temporal pattern: {response} at hour {current_hour} for emotion {max(recommendation.emotion_context.items(), key=lambda x: x[1])[0]}")
            
        except Exception as e:
            logger.error(f"Error updating temporal patterns: {e}")
    
    def get_learning_effectiveness(self) -> Dict:
        """Get metrics on learning algorithm effectiveness"""
        
        try:
            # Calculate improvement over time
            recent_cutoff = timezone.now() - timedelta(days=7)
            older_cutoff = timezone.now() - timedelta(days=14)
            
            recent_recommendations = MusicRecommendation.objects.filter(
                timestamp__gte=recent_cutoff
            )
            older_recommendations = MusicRecommendation.objects.filter(
                timestamp__gte=older_cutoff,
                timestamp__lt=recent_cutoff
            )
            
            recent_acceptance = recent_recommendations.filter(user_response='accepted').count()
            recent_total = recent_recommendations.count()
            
            older_acceptance = older_recommendations.filter(user_response='accepted').count()
            older_total = older_recommendations.count()
            
            recent_rate = (recent_acceptance / recent_total * 100) if recent_total > 0 else 0
            older_rate = (older_acceptance / older_total * 100) if older_total > 0 else 0
            
            improvement = recent_rate - older_rate
            
            # Get feedback distribution
            feedback_distribution = {}
            for response_type, _ in MusicRecommendation._meta.get_field('user_response').choices:
                count = MusicRecommendation.objects.filter(user_response=response_type).count()
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
            logger.error(f"Error calculating learning effectiveness: {e}")
            return {'learning_active': False, 'error': str(e)}
    
    def cleanup_old_recommendations(self, days_to_keep: int = 30):
        """Clean up old recommendation records"""
        
        cutoff_date = timezone.now() - timedelta(days=days_to_keep)
        
        deleted_count = MusicRecommendation.objects.filter(
            timestamp__lt=cutoff_date
        ).delete()[0]
        
        logger.info(f"Cleaned up {deleted_count} old music recommendations")
        return deleted_count


# Global instance
music_recommendation_service = MusicRecommendationService()