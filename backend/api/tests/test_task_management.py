"""
Tests for task management and energy-based sorting system
"""
import json
from django.test import TestCase
from django.utils import timezone
from django.urls import reverse
from rest_framework.test import APITestCase
from rest_framework import status
from datetime import timedelta, datetime
from unittest.mock import patch, MagicMock

from ..models import Task, EmotionReading, UserFeedback
from ..services.task_service import TaskService


class TaskModelTest(TestCase):
    """Test Task model functionality"""
    
    def setUp(self):
        """Set up test data"""
        self.task_data = {
            'title': 'Test Task',
            'description': 'A test task for unit testing',
            'priority': 'medium',
            'complexity': 'moderate',
            'estimated_duration': 60
        }
    
    def test_task_creation(self):
        """Test basic task creation"""
        task = Task.objects.create(**self.task_data)
        
        self.assertEqual(task.title, 'Test Task')
        self.assertEqual(task.priority, 'medium')
        self.assertEqual(task.complexity, 'moderate')
        self.assertEqual(task.status, 'todo')
        self.assertIsNotNone(task.complexity_score)
        self.assertIsNotNone(task.optimal_energy_level)
    
    def test_complexity_score_calculation(self):
        """Test automatic complexity score calculation"""
        # Simple task
        simple_task = Task.objects.create(
            title='Simple Task',
            complexity='simple',
            priority='low'
        )
        self.assertLess(simple_task.complexity_score, 0.5)
        
        # Complex task
        complex_task = Task.objects.create(
            title='Complex Task',
            complexity='complex',
            priority='high'
        )
        self.assertGreater(complex_task.complexity_score, 0.7)
        
        # Creative task
        creative_task = Task.objects.create(
            title='Creative Task',
            complexity='creative',
            priority='urgent'
        )
        self.assertGreater(creative_task.complexity_score, 0.8)
    
    def test_optimal_energy_level_setting(self):
        """Test optimal energy level is set based on complexity"""
        # Complex task should have high optimal energy
        complex_task = Task.objects.create(
            title='Complex Task',
            complexity='complex'
        )
        self.assertGreater(complex_task.optimal_energy_level, 0.6)
        
        # Simple task should have lower optimal energy
        simple_task = Task.objects.create(
            title='Simple Task',
            complexity='simple'
        )
        self.assertLess(simple_task.optimal_energy_level, 0.5)
    
    def test_energy_match_score(self):
        """Test energy match score calculation"""
        task = Task.objects.create(
            title='Test Task',
            complexity='moderate'
        )
        
        # Perfect match should score high
        perfect_match = task.get_energy_match_score(task.optimal_energy_level)
        self.assertGreater(perfect_match, 0.8)
        
        # Poor match should score low
        poor_match = task.get_energy_match_score(0.1 if task.optimal_energy_level > 0.5 else 0.9)
        self.assertLess(poor_match, 0.5)
    
    def test_update_energy_correlation(self):
        """Test energy correlation learning"""
        task = Task.objects.create(
            title='Learning Task',
            complexity='moderate'
        )
        
        # Add some completion data
        task.update_energy_correlation(0.8)
        task.update_energy_correlation(0.7)
        task.update_energy_correlation(0.9)
        
        self.assertEqual(len(task.completion_energy_levels), 3)
        self.assertNotEqual(task.user_energy_correlation, 0.0)
    
    def test_completion_energy_levels_limit(self):
        """Test that completion energy levels are limited to 10 entries"""
        task = Task.objects.create(title='Test Task')
        
        # Add 15 energy levels
        for i in range(15):
            task.update_energy_correlation(0.5 + (i % 5) * 0.1)
        
        # Should only keep the last 10
        self.assertEqual(len(task.completion_energy_levels), 10)


class TaskServiceTest(TestCase):
    """Test TaskService functionality"""
    
    def setUp(self):
        """Set up test data"""
        self.service = TaskService()
        
        # Create test tasks with different complexities and priorities
        self.simple_task = Task.objects.create(
            title='Simple Task',
            complexity='simple',
            priority='low'
        )
        
        self.moderate_task = Task.objects.create(
            title='Moderate Task',
            complexity='moderate',
            priority='medium'
        )
        
        self.complex_task = Task.objects.create(
            title='Complex Task',
            complexity='complex',
            priority='high'
        )
        
        self.urgent_task = Task.objects.create(
            title='Urgent Task',
            complexity='moderate',
            priority='urgent',
            due_date=timezone.now() + timedelta(hours=2)
        )
    
    def test_create_task(self):
        """Test task creation through service"""
        task_data = {
            'title': 'Service Created Task',
            'description': 'Created via service',
            'complexity': 'complex',
            'priority': 'high'
        }
        
        task = self.service.create_task(task_data)
        
        self.assertEqual(task.title, 'Service Created Task')
        self.assertEqual(task.complexity, 'complex')
        self.assertGreater(task.complexity_score, 0.7)
    
    def test_energy_sorted_tasks_high_energy(self):
        """Test task sorting for high energy levels"""
        high_energy = 0.9
        sorted_tasks = self.service.get_energy_sorted_tasks(high_energy)
        
        # Complex tasks should be ranked higher for high energy
        task_titles = [task.title for task in sorted_tasks]
        complex_index = task_titles.index('Complex Task')
        simple_index = task_titles.index('Simple Task')
        
        self.assertLess(complex_index, simple_index)
    
    def test_energy_sorted_tasks_low_energy(self):
        """Test task sorting for low energy levels"""
        low_energy = 0.2
        sorted_tasks = self.service.get_energy_sorted_tasks(low_energy)
        
        # Simple tasks should be ranked higher for low energy
        task_titles = [task.title for task in sorted_tasks]
        simple_index = task_titles.index('Simple Task')
        complex_index = task_titles.index('Complex Task')
        
        self.assertLess(simple_index, complex_index)
    
    def test_task_recommendations(self):
        """Test task recommendation generation"""
        recommendations = self.service.get_task_recommendations(
            current_energy_level=0.7,
            max_recommendations=3
        )
        
        self.assertLessEqual(len(recommendations), 3)
        
        # Check that recommendations have required fields
        for rec in recommendations:
            self.assertIn('task', rec)
            self.assertIn('recommendation_score', rec)
            self.assertIn('explanation', rec)
            self.assertIn('factors', rec)
    
    def test_urgent_task_boost(self):
        """Test that urgent tasks get priority boost"""
        recommendations = self.service.get_task_recommendations(
            current_energy_level=0.5,
            max_recommendations=5
        )
        
        # Find urgent task in recommendations
        urgent_rec = None
        for rec in recommendations:
            if rec['task'].title == 'Urgent Task':
                urgent_rec = rec
                break
        
        self.assertIsNotNone(urgent_rec)
        self.assertGreater(urgent_rec['urgency_boost'], 1.0)
    
    def test_task_completion_update(self):
        """Test task completion with energy correlation update"""
        task_id = self.moderate_task.id
        
        updated_task = self.service.update_task_completion(
            task_id=task_id,
            current_energy_level=0.8,
            actual_duration=45
        )
        
        self.assertEqual(updated_task.status, 'completed')
        self.assertEqual(updated_task.actual_duration, 45)
        self.assertIn(0.8, updated_task.completion_energy_levels)
    
    def test_analyze_task_patterns(self):
        """Test task pattern analysis"""
        # Create some completed tasks
        completed_task = Task.objects.create(
            title='Completed Task',
            status='completed',
            complexity='moderate',
            actual_duration=30
        )
        completed_task.update_energy_correlation(0.7)
        
        analysis = self.service.analyze_task_patterns(days=30)
        
        self.assertIn('overview', analysis)
        self.assertIn('energy_insights', analysis)
        self.assertIn('complexity_performance', analysis)
        self.assertIn('priority_analysis', analysis)
        
        # Check overview data
        overview = analysis['overview']
        self.assertGreater(overview['total_tasks'], 0)
        self.assertGreaterEqual(overview['completed_tasks'], 1)
    
    def test_task_suggestions_for_energy(self):
        """Test contextual task suggestions based on energy"""
        # High energy suggestions
        high_energy_suggestions = self.service.get_task_suggestions_for_energy(0.9)
        
        self.assertEqual(high_energy_suggestions['energy_category'], 'very_high')
        self.assertIn('complex', high_energy_suggestions['recommended_task_types'])
        self.assertIn('creative', high_energy_suggestions['recommended_task_types'])
        
        # Low energy suggestions
        low_energy_suggestions = self.service.get_task_suggestions_for_energy(0.2)
        
        self.assertEqual(low_energy_suggestions['energy_category'], 'low')
        self.assertIn('simple', low_energy_suggestions['recommended_task_types'])


class TaskAPITest(APITestCase):
    """Test Task API endpoints"""
    
    def setUp(self):
        """Set up test data"""
        self.task_data = {
            'title': 'API Test Task',
            'description': 'Testing API endpoints',
            'priority': 'medium',
            'complexity': 'moderate',
            'estimated_duration': 60
        }
        
        self.task = Task.objects.create(**self.task_data)
    
    def test_create_task_api(self):
        """Test task creation via API"""
        url = reverse('tasks-list')
        data = {
            'title': 'New API Task',
            'description': 'Created via API',
            'priority': 'high',
            'complexity': 'complex'
        }
        
        response = self.client.post(url, data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['title'], 'New API Task')
        self.assertEqual(response.data['priority'], 'high')
        self.assertIsNotNone(response.data['complexity_score'])
    
    def test_list_tasks_api(self):
        """Test task listing via API"""
        url = reverse('tasks-list')
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(len(response.data), 1)
    
    def test_list_tasks_with_filters(self):
        """Test task listing with filters"""
        # Create tasks with different statuses
        Task.objects.create(title='Completed Task', status='completed')
        Task.objects.create(title='High Priority Task', priority='high')
        
        # Test status filter
        url = reverse('tasks-list')
        response = self.client.get(url, {'status': 'completed'})
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        completed_tasks = [task for task in response.data if task['status'] == 'completed']
        self.assertGreater(len(completed_tasks), 0)
        
        # Test priority filter
        response = self.client.get(url, {'priority': 'high'})
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        high_priority_tasks = [task for task in response.data if task['priority'] == 'high']
        self.assertGreater(len(high_priority_tasks), 0)
    
    def test_energy_based_sorting_api(self):
        """Test energy-based task sorting via API"""
        # Create tasks with different complexities
        Task.objects.create(title='Simple Task', complexity='simple')
        Task.objects.create(title='Complex Task', complexity='complex')
        
        url = reverse('tasks-sort-by-energy')
        data = {
            'current_energy_level': 0.8,
            'sort_method': 'energy_match',
            'include_completed': False
        }
        
        response = self.client.post(url, data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['current_energy_level'], 0.8)
        self.assertEqual(response.data['sort_method'], 'energy_match')
        self.assertIn('tasks', response.data)
        
        # Check that tasks have energy match scores
        for task in response.data['tasks']:
            self.assertIn('energy_match_score', task)
            self.assertIsInstance(task['energy_match_score'], float)
    
    def test_task_recommendations_api(self):
        """Test task recommendations via API"""
        # Create diverse tasks
        Task.objects.create(title='Urgent Task', priority='urgent', complexity='simple')
        Task.objects.create(title='Complex Task', complexity='complex', priority='medium')
        
        url = reverse('tasks-recommend')
        data = {
            'current_energy_level': 0.7,
            'max_tasks': 3,
            'include_completed': False
        }
        
        response = self.client.post(url, data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['current_energy_level'], 0.7)
        self.assertIn('recommendations', response.data)
        self.assertLessEqual(len(response.data['recommendations']), 3)
        
        # Check recommendation structure
        for rec in response.data['recommendations']:
            self.assertIn('energy_match_score', rec)
            self.assertIn('recommendation_score', rec)
            self.assertIn('recommendation_reason', rec)
    
    def test_task_completion_api(self):
        """Test task completion via API"""
        url = reverse('tasks-complete', kwargs={'pk': self.task.id})
        data = {
            'current_energy_level': 0.6,
            'actual_duration': 45
        }
        
        response = self.client.post(url, data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['message'], 'Task marked as completed')
        self.assertTrue(response.data['energy_correlation_updated'])
        
        # Verify task was updated
        updated_task = Task.objects.get(id=self.task.id)
        self.assertEqual(updated_task.status, 'completed')
        self.assertEqual(updated_task.actual_duration, 45)
        self.assertIn(0.6, updated_task.completion_energy_levels)
    
    def test_task_analytics_api(self):
        """Test task analytics via API"""
        # Create some test data
        Task.objects.create(title='Completed Simple', complexity='simple', status='completed')
        Task.objects.create(title='Completed Complex', complexity='complex', status='completed')
        
        url = reverse('tasks-analytics')
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        # Check analytics structure
        self.assertIn('overview', response.data)
        self.assertIn('complexity_analysis', response.data)
        self.assertIn('priority_analysis', response.data)
        self.assertIn('energy_correlation', response.data)
        
        # Check overview data
        overview = response.data['overview']
        self.assertIn('total_tasks', overview)
        self.assertIn('completed_tasks', overview)
        self.assertIn('completion_rate', overview)
    
    def test_update_task_api(self):
        """Test task update via API"""
        url = reverse('tasks-detail', kwargs={'pk': self.task.id})
        data = {
            'title': 'Updated Task Title',
            'priority': 'high',
            'status': 'in_progress'
        }
        
        response = self.client.patch(url, data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['title'], 'Updated Task Title')
        self.assertEqual(response.data['priority'], 'high')
        self.assertEqual(response.data['status'], 'in_progress')
    
    def test_delete_task_api(self):
        """Test task deletion via API"""
        url = reverse('tasks-detail', kwargs={'pk': self.task.id})
        response = self.client.delete(url)
        
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        
        # Verify task was deleted
        with self.assertRaises(Task.DoesNotExist):
            Task.objects.get(id=self.task.id)
    
    def test_invalid_energy_level(self):
        """Test API with invalid energy levels"""
        url = reverse('tasks-sort-by-energy')
        data = {
            'current_energy_level': 1.5,  # Invalid: > 1.0
            'sort_method': 'energy_match'
        }
        
        response = self.client.post(url, data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
    
    def test_task_validation(self):
        """Test task validation"""
        url = reverse('tasks-list')
        
        # Test empty title
        data = {
            'title': '',
            'complexity': 'moderate'
        }
        
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        
        # Test invalid priority
        data = {
            'title': 'Valid Title',
            'priority': 'invalid_priority',
            'complexity': 'moderate'
        }
        
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


class TaskLearningTest(TestCase):
    """Test task learning and correlation functionality"""
    
    def setUp(self):
        """Set up test data"""
        self.task = Task.objects.create(
            title='Learning Task',
            complexity='moderate',
            priority='medium'
        )
    
    def test_energy_correlation_learning(self):
        """Test that tasks learn from completion patterns"""
        # Simulate completing task at high energy multiple times
        for _ in range(5):
            self.task.update_energy_correlation(0.8)
        
        # Task should learn that high energy works well
        self.assertGreater(self.task.user_energy_correlation, 0.0)
        
        # Energy match score should be higher for high energy
        high_energy_score = self.task.get_energy_match_score(0.8)
        low_energy_score = self.task.get_energy_match_score(0.2)
        
        self.assertGreater(high_energy_score, low_energy_score)
    
    def test_complex_task_energy_preference(self):
        """Test that complex tasks prefer high energy"""
        complex_task = Task.objects.create(
            title='Complex Learning Task',
            complexity='complex'
        )
        
        # Complete at high energy several times
        for _ in range(3):
            complex_task.update_energy_correlation(0.9)
        
        # Should have positive correlation
        self.assertGreater(complex_task.user_energy_correlation, 0.0)
    
    def test_simple_task_energy_preference(self):
        """Test that simple tasks can work at low energy"""
        simple_task = Task.objects.create(
            title='Simple Learning Task',
            complexity='simple'
        )
        
        # Complete at low energy several times
        for _ in range(3):
            simple_task.update_energy_correlation(0.3)
        
        # Should adapt to low energy preference
        low_energy_score = simple_task.get_energy_match_score(0.3)
        high_energy_score = simple_task.get_energy_match_score(0.9)
        
        # For simple tasks, low energy should still be acceptable
        self.assertGreater(low_energy_score, 0.5)


class TaskIntegrationTest(APITestCase):
    """Integration tests for task management with other components"""
    
    def setUp(self):
        """Set up test data"""
        # Create emotion reading for context
        self.emotion_reading = EmotionReading.objects.create(
            emotions={'happy': 0.7, 'neutral': 0.3},
            energy_level=0.8,
            posture_score=0.9,
            blink_rate=15.0,
            confidence=0.95
        )
        
        # Create tasks
        self.simple_task = Task.objects.create(
            title='Simple Integration Task',
            complexity='simple',
            priority='low'
        )
        
        self.complex_task = Task.objects.create(
            title='Complex Integration Task',
            complexity='complex',
            priority='high'
        )
    
    def test_task_recommendation_with_emotion_context(self):
        """Test task recommendations considering emotion context"""
        # High energy from emotion reading should favor complex tasks
        url = reverse('tasks-recommend')
        data = {
            'current_energy_level': self.emotion_reading.energy_level,
            'max_tasks': 5
        }
        
        response = self.client.post(url, data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        # Complex task should be recommended higher due to high energy
        recommendations = response.data['recommendations']
        complex_rec = next((r for r in recommendations if r['title'] == 'Complex Integration Task'), None)
        simple_rec = next((r for r in recommendations if r['title'] == 'Simple Integration Task'), None)
        
        if complex_rec and simple_rec:
            self.assertGreater(complex_rec['recommendation_score'], simple_rec['recommendation_score'])
    
    def test_task_completion_feedback_loop(self):
        """Test that task completion creates learning feedback"""
        # Complete task with energy level
        url = reverse('tasks-complete', kwargs={'pk': self.simple_task.id})
        data = {
            'current_energy_level': 0.3,  # Low energy for simple task
            'actual_duration': 20
        }
        
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        # Check that task learned from this completion
        updated_task = Task.objects.get(id=self.simple_task.id)
        self.assertIn(0.3, updated_task.completion_energy_levels)
        
        # Future recommendations should consider this learning
        recommend_url = reverse('tasks-recommend')
        recommend_data = {
            'current_energy_level': 0.3,
            'max_tasks': 3
        }
        
        recommend_response = self.client.post(recommend_url, recommend_data, format='json')
        self.assertEqual(recommend_response.status_code, status.HTTP_200_OK)