"""
Task Service for energy-based task management and recommendations
"""
import logging
from typing import List, Dict, Any, Optional, Tuple
from django.utils import timezone
from datetime import timedelta
from django.db.models import Q, Avg, Count
import statistics

from ..models import Task, EmotionReading, UserFeedback

logger = logging.getLogger(__name__)


class TaskService:
    """
    Service for managing tasks with energy-based sorting and learning
    """
    
    def __init__(self):
        self.logger = logger
    
    def create_task(self, task_data: Dict[str, Any]) -> Task:
        """
        Create a new task with automatic complexity scoring
        """
        try:
            task = Task(**task_data)
            task.full_clean()  # Validate the task
            task.save()  # This will automatically calculate complexity_score and optimal_energy_level
            
            self.logger.info(f"Created task: {task.title} with complexity score {task.complexity_score}")
            return task
            
        except Exception as e:
            self.logger.error(f"Error creating task: {e}")
            raise
    
    def get_energy_sorted_tasks(
        self, 
        current_energy_level: float, 
        include_completed: bool = False,
        max_tasks: Optional[int] = None
    ) -> List[Task]:
        """
        Get tasks sorted by energy match score
        """
        try:
            # Get tasks
            queryset = Task.objects.all()
            if not include_completed:
                queryset = queryset.exclude(status='completed')
            
            tasks = list(queryset)
            
            # Calculate energy match scores and sort
            task_scores = []
            for task in tasks:
                energy_match = task.get_energy_match_score(current_energy_level)
                task_scores.append((task, energy_match))
            
            # Sort by energy match score (descending)
            task_scores.sort(key=lambda x: x[1], reverse=True)
            
            # Extract tasks and limit if requested
            sorted_tasks = [task for task, _ in task_scores]
            if max_tasks:
                sorted_tasks = sorted_tasks[:max_tasks]
            
            self.logger.info(f"Sorted {len(sorted_tasks)} tasks by energy match for level {current_energy_level}")
            return sorted_tasks
            
        except Exception as e:
            self.logger.error(f"Error sorting tasks by energy: {e}")
            raise
    
    def get_task_recommendations(
        self,
        current_energy_level: float,
        max_recommendations: int = 5,
        priority_filter: Optional[List[str]] = None,
        complexity_filter: Optional[List[str]] = None,
        include_completed: bool = False
    ) -> List[Dict[str, Any]]:
        """
        Get intelligent task recommendations based on current energy and context
        """
        try:
            # Get filtered tasks
            queryset = Task.objects.all()
            if not include_completed:
                queryset = queryset.exclude(status='completed')
            
            if priority_filter:
                queryset = queryset.filter(priority__in=priority_filter)
            
            if complexity_filter:
                queryset = queryset.filter(complexity__in=complexity_filter)
            
            tasks = list(queryset)
            
            # Calculate recommendation scores
            recommendations = []
            for task in tasks:
                recommendation = self._calculate_recommendation_score(task, current_energy_level)
                recommendations.append(recommendation)
            
            # Sort by recommendation score and limit
            recommendations.sort(key=lambda r: r['recommendation_score'], reverse=True)
            recommendations = recommendations[:max_recommendations]
            
            self.logger.info(f"Generated {len(recommendations)} task recommendations")
            return recommendations
            
        except Exception as e:
            self.logger.error(f"Error generating task recommendations: {e}")
            raise
    
    def _calculate_recommendation_score(self, task: Task, current_energy_level: float) -> Dict[str, Any]:
        """
        Calculate a comprehensive recommendation score for a task
        """
        # Base score from energy matching
        energy_match = task.get_energy_match_score(current_energy_level)
        recommendation_score = energy_match
        
        # Priority boost
        priority_multipliers = {
            'urgent': 1.4,
            'high': 1.2,
            'medium': 1.0,
            'low': 0.8
        }
        recommendation_score *= priority_multipliers.get(task.priority, 1.0)
        
        # Due date urgency boost
        urgency_boost = self._calculate_urgency_boost(task)
        recommendation_score *= urgency_boost
        
        # Historical performance boost
        if task.user_energy_correlation > 0.5:
            recommendation_score *= 1.15
        elif task.user_energy_correlation < -0.3:
            recommendation_score *= 0.85
        
        # Complexity appropriateness for current energy
        complexity_match = self._calculate_complexity_match(task, current_energy_level)
        recommendation_score *= complexity_match
        
        # Ensure score doesn't exceed 1.0
        recommendation_score = min(1.0, recommendation_score)
        
        # Generate explanation
        explanation = self._generate_recommendation_explanation(
            task, current_energy_level, energy_match, urgency_boost, complexity_match
        )
        
        return {
            'task': task,
            'recommendation_score': recommendation_score,
            'energy_match_score': energy_match,
            'urgency_boost': urgency_boost,
            'complexity_match': complexity_match,
            'explanation': explanation,
            'factors': {
                'energy_match': energy_match,
                'priority': task.priority,
                'urgency': urgency_boost,
                'historical_performance': task.user_energy_correlation,
                'complexity_appropriateness': complexity_match
            }
        }
    
    def _calculate_urgency_boost(self, task: Task) -> float:
        """
        Calculate urgency boost based on due date
        """
        if not task.due_date:
            return 1.0
        
        days_until_due = (task.due_date - timezone.now()).days
        
        if days_until_due < 0:
            return 1.5  # Overdue
        elif days_until_due == 0:
            return 1.4  # Due today
        elif days_until_due == 1:
            return 1.3  # Due tomorrow
        elif days_until_due <= 3:
            return 1.2  # Due within 3 days
        elif days_until_due <= 7:
            return 1.1  # Due within a week
        else:
            return 1.0  # Not urgent
    
    def _calculate_complexity_match(self, task: Task, current_energy_level: float) -> float:
        """
        Calculate how well task complexity matches current energy level
        """
        # High energy should match complex tasks
        if current_energy_level > 0.7:
            if task.complexity in ['complex', 'creative']:
                return 1.2
            elif task.complexity == 'moderate':
                return 1.0
            else:
                return 0.9
        
        # Medium energy matches moderate tasks well
        elif current_energy_level > 0.4:
            if task.complexity == 'moderate':
                return 1.1
            elif task.complexity in ['simple', 'complex']:
                return 1.0
            else:
                return 0.95
        
        # Low energy should match simple tasks
        else:
            if task.complexity == 'simple':
                return 1.2
            elif task.complexity == 'moderate':
                return 0.9
            else:
                return 0.7
    
    def _generate_recommendation_explanation(
        self, 
        task: Task, 
        current_energy_level: float, 
        energy_match: float,
        urgency_boost: float,
        complexity_match: float
    ) -> str:
        """
        Generate human-readable explanation for recommendation
        """
        explanations = []
        
        # Energy match explanation
        if energy_match > 0.8:
            explanations.append("excellent energy match")
        elif energy_match > 0.6:
            explanations.append("good energy match")
        elif energy_match > 0.4:
            explanations.append("moderate energy match")
        else:
            explanations.append("low energy match - consider for later")
        
        # Priority explanation
        if task.priority in ['urgent', 'high']:
            explanations.append(f"{task.priority} priority task")
        
        # Urgency explanation
        if urgency_boost > 1.3:
            explanations.append("due very soon")
        elif urgency_boost > 1.1:
            explanations.append("due soon")
        
        # Complexity explanation
        if complexity_match > 1.1:
            explanations.append("complexity well-suited for current energy")
        elif complexity_match < 0.9:
            explanations.append("may be too complex/simple for current energy")
        
        # Historical performance
        if task.user_energy_correlation > 0.5:
            explanations.append("historically performed well at this energy level")
        elif task.user_energy_correlation < -0.3:
            explanations.append("historically challenging at this energy level")
        
        return "; ".join(explanations)
    
    def update_task_completion(
        self, 
        task_id: int, 
        current_energy_level: Optional[float] = None,
        actual_duration: Optional[int] = None,
        performance_rating: Optional[float] = None
    ) -> Task:
        """
        Mark task as completed and update learning data
        """
        try:
            task = Task.objects.get(id=task_id)
            task.status = 'completed'
            
            if actual_duration:
                task.actual_duration = actual_duration
            
            if current_energy_level:
                task.update_energy_correlation(current_energy_level, performance_rating)
            
            task.save()
            
            self.logger.info(f"Task completed: {task.title}")
            return task
            
        except Task.DoesNotExist:
            self.logger.error(f"Task not found: {task_id}")
            raise
        except Exception as e:
            self.logger.error(f"Error updating task completion: {e}")
            raise
    
    def analyze_task_patterns(self, days: int = 30) -> Dict[str, Any]:
        """
        Analyze task completion patterns and energy correlations
        """
        try:
            # Get tasks from the specified period
            since_date = timezone.now() - timedelta(days=days)
            tasks = Task.objects.filter(created_at__gte=since_date)
            completed_tasks = tasks.filter(status='completed')
            
            # Basic statistics
            total_tasks = tasks.count()
            completed_count = completed_tasks.count()
            completion_rate = (completed_count / total_tasks * 100) if total_tasks > 0 else 0
            
            # Energy correlation analysis
            tasks_with_correlation = completed_tasks.exclude(user_energy_correlation=0.0)
            energy_insights = self._analyze_energy_correlations(tasks_with_correlation)
            
            # Complexity performance analysis
            complexity_performance = self._analyze_complexity_performance(completed_tasks)
            
            # Time-based patterns
            time_patterns = self._analyze_time_patterns(completed_tasks)
            
            # Priority effectiveness
            priority_analysis = self._analyze_priority_effectiveness(tasks)
            
            analysis = {
                'period_days': days,
                'overview': {
                    'total_tasks': total_tasks,
                    'completed_tasks': completed_count,
                    'completion_rate': round(completion_rate, 1),
                    'pending_tasks': total_tasks - completed_count
                },
                'energy_insights': energy_insights,
                'complexity_performance': complexity_performance,
                'time_patterns': time_patterns,
                'priority_analysis': priority_analysis,
                'generated_at': timezone.now().isoformat()
            }
            
            self.logger.info(f"Generated task pattern analysis for {days} days")
            return analysis
            
        except Exception as e:
            self.logger.error(f"Error analyzing task patterns: {e}")
            raise
    
    def _analyze_energy_correlations(self, tasks) -> Dict[str, Any]:
        """
        Analyze energy level correlations with task performance
        """
        if not tasks.exists():
            return {'message': 'No tasks with energy correlation data'}
        
        correlations = [t.user_energy_correlation for t in tasks]
        
        return {
            'average_correlation': round(statistics.mean(correlations), 3),
            'median_correlation': round(statistics.median(correlations), 3),
            'positive_correlations': len([c for c in correlations if c > 0.3]),
            'negative_correlations': len([c for c in correlations if c < -0.3]),
            'neutral_correlations': len([c for c in correlations if -0.3 <= c <= 0.3]),
            'total_tasks_analyzed': len(correlations)
        }
    
    def _analyze_complexity_performance(self, tasks) -> Dict[str, Any]:
        """
        Analyze performance by task complexity
        """
        complexity_stats = {}
        
        for complexity, _ in Task.COMPLEXITY_CHOICES:
            complexity_tasks = tasks.filter(complexity=complexity)
            if complexity_tasks.exists():
                # Calculate average completion time if available
                tasks_with_duration = complexity_tasks.exclude(actual_duration__isnull=True)
                avg_duration = None
                if tasks_with_duration.exists():
                    durations = [t.actual_duration for t in tasks_with_duration]
                    avg_duration = round(statistics.mean(durations), 1)
                
                # Calculate average energy correlation
                tasks_with_correlation = complexity_tasks.exclude(user_energy_correlation=0.0)
                avg_correlation = None
                if tasks_with_correlation.exists():
                    correlations = [t.user_energy_correlation for t in tasks_with_correlation]
                    avg_correlation = round(statistics.mean(correlations), 3)
                
                complexity_stats[complexity] = {
                    'completed_count': complexity_tasks.count(),
                    'average_duration_minutes': avg_duration,
                    'average_energy_correlation': avg_correlation,
                    'tasks_with_duration_data': tasks_with_duration.count(),
                    'tasks_with_correlation_data': tasks_with_correlation.count()
                }
        
        return complexity_stats
    
    def _analyze_time_patterns(self, tasks) -> Dict[str, Any]:
        """
        Analyze task completion time patterns
        """
        if not tasks.exists():
            return {'message': 'No completed tasks to analyze'}
        
        # Group by hour of completion
        hourly_completions = {}
        for task in tasks:
            hour = task.updated_at.hour
            hourly_completions[hour] = hourly_completions.get(hour, 0) + 1
        
        # Find peak productivity hours
        if hourly_completions:
            peak_hour = max(hourly_completions.items(), key=lambda x: x[1])
            
            return {
                'hourly_distribution': hourly_completions,
                'peak_productivity_hour': peak_hour[0],
                'peak_hour_completions': peak_hour[1],
                'total_hours_active': len(hourly_completions)
            }
        
        return {'message': 'No time pattern data available'}
    
    def _analyze_priority_effectiveness(self, tasks) -> Dict[str, Any]:
        """
        Analyze how effectively different priorities are being handled
        """
        priority_stats = {}
        
        for priority, _ in Task.PRIORITY_CHOICES:
            priority_tasks = tasks.filter(priority=priority)
            completed_priority_tasks = priority_tasks.filter(status='completed')
            
            total_count = priority_tasks.count()
            completed_count = completed_priority_tasks.count()
            completion_rate = (completed_count / total_count * 100) if total_count > 0 else 0
            
            # Calculate average time to completion for completed tasks
            avg_completion_time = None
            if completed_priority_tasks.exists():
                completion_times = []
                for task in completed_priority_tasks:
                    if task.created_at and task.updated_at:
                        time_diff = (task.updated_at - task.created_at).total_seconds() / 3600  # hours
                        completion_times.append(time_diff)
                
                if completion_times:
                    avg_completion_time = round(statistics.mean(completion_times), 1)
            
            priority_stats[priority] = {
                'total_tasks': total_count,
                'completed_tasks': completed_count,
                'completion_rate': round(completion_rate, 1),
                'average_completion_time_hours': avg_completion_time
            }
        
        return priority_stats
    
    def get_task_suggestions_for_energy(self, current_energy_level: float) -> Dict[str, Any]:
        """
        Get contextual suggestions for task management based on current energy
        """
        try:
            suggestions = {
                'current_energy_level': current_energy_level,
                'energy_category': self._categorize_energy_level(current_energy_level),
                'recommended_task_types': [],
                'suggested_actions': [],
                'optimal_task_complexity': None
            }
            
            if current_energy_level > 0.7:
                suggestions['recommended_task_types'] = ['complex', 'creative']
                suggestions['suggested_actions'] = [
                    'Tackle challenging problems',
                    'Work on creative projects',
                    'Handle complex analysis tasks',
                    'Make important decisions'
                ]
                suggestions['optimal_task_complexity'] = 'high'
                
            elif current_energy_level > 0.4:
                suggestions['recommended_task_types'] = ['moderate', 'simple']
                suggestions['suggested_actions'] = [
                    'Handle routine tasks',
                    'Organize and plan',
                    'Review and edit work',
                    'Communicate with team'
                ]
                suggestions['optimal_task_complexity'] = 'moderate'
                
            else:
                suggestions['recommended_task_types'] = ['simple']
                suggestions['suggested_actions'] = [
                    'Handle administrative tasks',
                    'Organize files and workspace',
                    'Read and research',
                    'Take breaks and recharge'
                ]
                suggestions['optimal_task_complexity'] = 'low'
            
            # Get actual task recommendations
            recommendations = self.get_task_recommendations(
                current_energy_level, max_recommendations=3
            )
            
            suggestions['specific_task_recommendations'] = [
                {
                    'task_id': rec['task'].id,
                    'title': rec['task'].title,
                    'recommendation_score': rec['recommendation_score'],
                    'explanation': rec['explanation']
                }
                for rec in recommendations
            ]
            
            return suggestions
            
        except Exception as e:
            self.logger.error(f"Error generating task suggestions: {e}")
            raise
    
    def _categorize_energy_level(self, energy_level: float) -> str:
        """
        Categorize energy level into human-readable categories
        """
        if energy_level > 0.8:
            return 'very_high'
        elif energy_level > 0.6:
            return 'high'
        elif energy_level > 0.4:
            return 'moderate'
        elif energy_level > 0.2:
            return 'low'
        else:
            return 'very_low'